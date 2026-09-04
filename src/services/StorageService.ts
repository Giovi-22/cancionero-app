import * as SQLite from 'expo-sqlite';
import { SongMetadata, Library, Setlist } from '../types';
import { auth, firestore } from '../lib/firebase';
import { FileSystemService } from './FileSystemService';
import { legacyToChordPro } from '../utils/legacyToChordPro';
import { isSingleChord } from '../utils/chordpro';

const DB_NAME = 'cancionero.db';

export class StorageService {
  private static dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  static async getDb() {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        await this.init(db);
        return db;
      })();
    }

    return this.dbPromise;
  }

  private static async init(db: SQLite.SQLiteDatabase) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        mimeType TEXT,
        modifiedTime TEXT,
        localPath TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        view_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        date TEXT,
        songIds TEXT NOT NULL,
        isPublic INTEGER DEFAULT 0,
        lastUpdated TEXT
      );

      CREATE TABLE IF NOT EXISTS libraries (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        driveFolderId TEXT,
        syncEnabled INTEGER DEFAULT 1,
        icon TEXT,
        color TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    // -----------------------------------------------------------------------
    // Migraciones manuales
    // -----------------------------------------------------------------------

    try {
      await db.execAsync('ALTER TABLE setlists ADD COLUMN date TEXT;');
    } catch (e) { }

    try {
      await db.execAsync(
        'ALTER TABLE songs ADD COLUMN view_count INTEGER DEFAULT 0;'
      );
    } catch (e) { }

    try {
      await db.execAsync(
        'ALTER TABLE songs ADD COLUMN library_id TEXT;'
      );
    } catch (e) { }

    try {
      await db.execAsync(
        'ALTER TABLE setlists ADD COLUMN library_id TEXT;'
      );
    } catch (e) { }

    try {
      await db.execAsync(
        'ALTER TABLE songs ADD COLUMN folder_name TEXT;'
      );
    } catch (e) { }

    try {
      await db.execAsync(
        'ALTER TABLE setlists ADD COLUMN notes TEXT;'
      );
    } catch (e) { }

    try {
      await db.execAsync(
        'ALTER TABLE setlists ADD COLUMN song_notes TEXT;'
      );
    } catch (e) { }

    // -----------------------------------------------------------------------
    // Migración inicial de bibliotecas
    // -----------------------------------------------------------------------

    try {
      const libCount = await db.getFirstAsync<any>(
        'SELECT COUNT(*) as count FROM libraries'
      );

      if (!libCount || libCount.count === 0) {
        const driveFolderIdRow = await db.getFirstAsync<any>(
          "SELECT value FROM settings WHERE key = 'drive_folder_id'"
        );

        let driveFolderId = '';

        if (driveFolderIdRow) {
          try {
            driveFolderId = JSON.parse(driveFolderIdRow.value);
          } catch (e) {
            driveFolderId = driveFolderIdRow.value;
          }
        }

        const now = Date.now();

        await db.runAsync(
          `INSERT INTO libraries
            (id, name, driveFolderId, syncEnabled, icon, color, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'default',
            'Mi Biblioteca',
            driveFolderId,
            1,
            'book-open',
            '#3b82f6',
            now,
            now,
          ]
        );

        await db.runAsync(
          "UPDATE songs SET library_id = 'default' WHERE library_id IS NULL"
        );

        await db.runAsync(
          "UPDATE setlists SET library_id = 'default' WHERE library_id IS NULL"
        );

        const activeLibRow = await db.getFirstAsync<any>(
          "SELECT value FROM settings WHERE key = 'active_library_id'"
        );

        if (!activeLibRow) {
          await db.runAsync(
            `INSERT OR REPLACE INTO settings (key, value)
             VALUES ('active_library_id', ?)`,
            [JSON.stringify('default')]
          );
        }
      }
    } catch (e) {
      console.error(
        'Error during initial libraries migration:',
        e
      );
    }

    // -----------------------------------------------------------------------
    // Migración de canciones legacy → ChordPro
    // -----------------------------------------------------------------------

    try {
      await this.migrateLocalSongsToChordPro(db);
    } catch (e) {
      console.error(
        'Error migrating local songs to ChordPro:',
        e
      );
    }
  }

  private static async migrateLocalSongsToChordPro(
    db: SQLite.SQLiteDatabase
  ) {
    try {
      const songs = await db.getAllAsync<any>(
        'SELECT id, name FROM songs'
      );

      if (!songs || songs.length === 0) return;

      let migratedCount = 0;

      for (const song of songs) {
        const content = await FileSystemService.getSongContent(song.id);

        if (content) {
          const cleanName = (song.name || '').replace(
            /\.(chordpro|pro|cho|chopro|crd|txt)$/i,
            ''
          );

          const converted = legacyToChordPro(
            content,
            cleanName
          );

          if (converted && converted !== content) {
            await FileSystemService.saveSongContent(
              song.id,
              converted
            );

            migratedCount++;
          }
        }
      }
    } catch (error) {
      console.error(
        '[Migration] Failed to migrate local songs:',
        error
      );
    }
  }

  // ===========================================================================
  // BIBLIOTECAS
  // ===========================================================================

  static async saveLibrary(library: Library) {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO libraries
        (id, name, driveFolderId, syncEnabled, icon, color, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        library.id,
        library.name,
        library.driveFolderId || '',
        library.syncEnabled ? 1 : 0,
        library.icon || 'book-open',
        library.color || '#3b82f6',
        library.createdAt,
        library.updatedAt,
      ]
    );
  }

  static async getAllLibraries(): Promise<Library[]> {
    const db = await this.getDb();

    const rows = await db.getAllAsync<any>(
      'SELECT * FROM libraries ORDER BY name ASC'
    );

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      driveFolderId: row.driveFolderId || '',
      syncEnabled: row.syncEnabled === 1,
      icon: row.icon || 'book-open',
      color: row.color || '#3b82f6',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  static async getLibrary(
    id: string
  ): Promise<Library | null> {
    const db = await this.getDb();

    const row = await db.getFirstAsync<any>(
      'SELECT * FROM libraries WHERE id = ?',
      [id]
    );

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      driveFolderId: row.driveFolderId || '',
      syncEnabled: row.syncEnabled === 1,
      icon: row.icon || 'book-open',
      color: row.color || '#3b82f6',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static async deleteLibrary(id: string) {
    const db = await this.getDb();

    const songs = await db.getAllAsync<any>(
      'SELECT id FROM songs WHERE library_id = ?',
      [id]
    );

    for (const song of songs) {
      await FileSystemService.deleteSongFile(song.id);
    }

    await db.runAsync(
      'DELETE FROM songs WHERE library_id = ?',
      [id]
    );

    await db.runAsync(
      'DELETE FROM setlists WHERE library_id = ?',
      [id]
    );

    await db.runAsync(
      'DELETE FROM libraries WHERE id = ?',
      [id]
    );

    // IMPORTANTE:
    // StorageService ya no sincroniza ni elimina setlists de Firestore.
    // Esa responsabilidad corresponde a SetlistService.
  }

  // ===========================================================================
  // CANCIONES
  // ===========================================================================

  static async saveSongs(
    songs: SongMetadata[],
    libraryId?: string
  ) {
    const db = await this.getDb();
    const targetLibrary = libraryId || 'default';

    await db.withTransactionAsync(async () => {
      for (const song of songs) {
        await db.runAsync(
          `INSERT OR IGNORE INTO songs
            (id, name, mimeType, modifiedTime, localPath,
             syncStatus, lastSyncedAt, library_id, folder_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            song.id,
            song.name,
            song.mimeType || '',
            song.modifiedTime || '',
            song.localPath || '',
            song.syncStatus || 'synced',
            song.lastSyncedAt || new Date().toISOString(),
            targetLibrary,
            song.folderName || null,
          ]
        );

        await db.runAsync(
          `UPDATE songs
           SET name = ?,
               mimeType = ?,
               modifiedTime = ?,
               localPath = ?,
               syncStatus = ?,
               lastSyncedAt = ?,
               library_id = ?,
               folder_name = ?
           WHERE id = ?`,
          [
            song.name,
            song.mimeType || '',
            song.modifiedTime || '',
            song.localPath || '',
            song.syncStatus || 'synced',
            song.lastSyncedAt || new Date().toISOString(),
            targetLibrary,
            song.folderName || null,
            song.id,
          ]
        );
      }
    });
  }

  static async incrementSongViewCount(
    songId: string
  ) {
    const db = await this.getDb();

    await db.runAsync(
      'UPDATE songs SET view_count = view_count + 1 WHERE id = ?',
      [songId]
    );

    this.syncStatsToFirestore(songId);
  }

  private static async syncStatsToFirestore(
    songId: string
  ) {
    try {
      const user = auth().currentUser;

      if (!user) return;

      const db = await this.getDb();

      const row = await db.getFirstAsync<any>(
        'SELECT view_count FROM songs WHERE id = ?',
        [songId]
      );

      if (!row) return;

      const docId = `${user.uid}_${songId}`;

      await firestore()
        .collection('song_stats')
        .doc(docId)
        .set(
          {
            user_id: user.uid,
            song_id: songId,
            view_count: row.view_count,
            last_played_at: new Date().toISOString(),
          },
          { merge: true }
        );
    } catch (e) {
      console.error(
        'Error syncing stats to Firestore:',
        e
      );
    }
  }

  static async getTopSongs(
    limit: number = 10,
    libraryId?: string
  ): Promise<SongMetadata[]> {
    const db = await this.getDb();

    if (libraryId) {
      return await db.getAllAsync<any>(
        `SELECT *
         FROM songs
         WHERE library_id = ?
         ORDER BY view_count DESC
         LIMIT ?`,
        [libraryId, limit]
      );
    }

    return await db.getAllAsync<any>(
      `SELECT *
       FROM songs
       ORDER BY view_count DESC
       LIMIT ?`,
      [limit]
    );
  }

  static async getAllSongs(
    libraryId?: string
  ): Promise<SongMetadata[]> {
    const db = await this.getDb();

    let rows;

    if (libraryId) {
      rows = await db.getAllAsync<any>(
        `SELECT *
         FROM songs
         WHERE library_id = ?
         ORDER BY name ASC`,
        [libraryId]
      );
    } else {
      rows = await db.getAllAsync<any>(
        'SELECT * FROM songs ORDER BY name ASC'
      );
    }

    return (rows || []).map(row => ({
      ...row,
      folderName: row.folder_name || undefined,
    }));
  }

  // ===========================================================================
  // AJUSTES
  // ===========================================================================

  static async saveSetting(
    key: string,
    value: any
  ) {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value)
       VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );

    this.syncSettingsToFirestore();
  }

  private static async syncSettingsToFirestore() {
    try {
      const user = auth().currentUser;

      if (!user) return;

      const db = await this.getDb();

      const allSettingsRows = await db.getAllAsync<any>(
        'SELECT * FROM settings'
      );

      const allSettings: Record<string, any> = {};

      for (const row of allSettingsRows) {
        try {
          allSettings[row.key] = JSON.parse(row.value);
        } catch (e) {
          allSettings[row.key] = row.value;
        }
      }

      await firestore()
        .collection('user_settings')
        .doc(user.uid)
        .set(
          {
            user_id: user.uid,
            settings: allSettings,
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
    } catch (e) {
      console.error(
        'Error syncing settings to Firestore:',
        e
      );
    }
  }

  static async getSetting<T>(
    key: string
  ): Promise<T | null> {
    try {
      const db = await this.getDb();

      const row = await db.getFirstAsync<any>(
        'SELECT value FROM settings WHERE key = ?',
        [key]
      );

      return row ? JSON.parse(row.value) : null;
    } catch (e) {
      return null;
    }
  }

  // ===========================================================================
  // SETLISTS — SOLAMENTE PERSISTENCIA LOCAL
  // ===========================================================================

  static async saveSetlist(
    setlist: Setlist,
    libraryId?: string
  ) {
    const db = await this.getDb();

    const libId =
      libraryId ||
      setlist.libraryId ||
      'default';

    const songNotesJson = setlist.songNotes
      ? JSON.stringify(setlist.songNotes)
      : null;

    await db.runAsync(
      `INSERT OR REPLACE INTO setlists
        (id, name, date, songIds, isPublic,
         lastUpdated, library_id, notes, song_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        setlist.id,
        setlist.name,
        setlist.date || null,
        JSON.stringify(setlist.songIds || []),
        setlist.isPublic ? 1 : 0,
        setlist.lastUpdated || new Date().toISOString(),
        libId,
        setlist.notes || null,
        songNotesJson,
      ]
    );
  }

  static async getAllSetlists(
    libraryId?: string
  ): Promise<Setlist[]> {
    const db = await this.getDb();

    let rows;

    if (libraryId) {
      rows = await db.getAllAsync<any>(
        `SELECT *
         FROM setlists
         WHERE library_id = ?
         ORDER BY COALESCE(date, lastUpdated, id) DESC`,
        [libraryId]
      );
    } else {
      rows = await db.getAllAsync<any>(
        `SELECT *
         FROM setlists
         ORDER BY COALESCE(date, lastUpdated, id) DESC`
      );
    }

    return (rows || []).map(row => {
      let songNotes: Record<string, string> = {};

      if (row.song_notes) {
        try {
          songNotes = JSON.parse(row.song_notes);
        } catch (e) {
          songNotes = {};
        }
      }

      let songIds: string[] = [];

      try {
        songIds = JSON.parse(row.songIds || '[]');
      } catch (e) {
        songIds = [];
      }

      return {
        id: row.id,
        name: row.name,
        date: row.date || undefined,
        songIds,
        isPublic: row.isPublic === 1,
        notes: row.notes || undefined,
        songNotes,
        lastUpdated: row.lastUpdated || undefined,
        libraryId: row.library_id || undefined,
      };
    });
  }

  static async deleteSetlistLocal(
    id: string
  ) {
    const db = await this.getDb();

    await db.runAsync(
      'DELETE FROM setlists WHERE id = ?',
      [id]
    );

    // IMPORTANTE:
    // No tocar Firestore desde acá.
    // SetlistService es responsable de eliminar la versión remota.
  }

  // ===========================================================================
  // BORRADO DE CANCIONES
  // ===========================================================================

  static async deleteSong(id: string) {
    const db = await this.getDb();

    await db.runAsync(
      'DELETE FROM songs WHERE id = ?',
      [id]
    );

    await FileSystemService.deleteSongFile(id);
  }

  // ===========================================================================
  // SINCRONIZACIÓN DE DATOS NO-SETLIST
  // ===========================================================================

  static async pullFromFirestore() {
    try {
      const user = auth().currentUser;

      if (!user) return;

      // -----------------------------------------------------------------------
      // 1. Estadísticas
      // -----------------------------------------------------------------------

      const statsSnapshot = await firestore()
        .collection('song_stats')
        .where('user_id', '==', user.uid)
        .get();

      if (!statsSnapshot.empty) {
        const db = await this.getDb();

        for (const doc of statsSnapshot.docs) {
          const s = doc.data();

          await db.runAsync(
            `UPDATE songs
             SET view_count = ?
             WHERE id = ?`,
            [
              s.view_count || 0,
              s.song_id,
            ]
          );
        }
      }

      // -----------------------------------------------------------------------
      // 2. Setlists
      //
      // IMPORTANTE:
      // Ya NO se sincronizan acá.
      //
      // La responsabilidad pertenece a SetlistService.
      // -----------------------------------------------------------------------

      // -----------------------------------------------------------------------
      // 3. Ajustes
      // -----------------------------------------------------------------------

      const settingsDoc = await firestore()
        .collection('user_settings')
        .doc(user.uid)
        .get();

      if (
        settingsDoc.exists &&
        settingsDoc.data()?.settings
      ) {
        const settingsObj =
          settingsDoc.data()?.settings;

        for (const [key, value] of Object.entries(
          settingsObj
        )) {
          // Persistimos localmente sin necesidad de
          // volver a subir el dato a Firestore.
          const db = await this.getDb();

          await db.runAsync(
            `INSERT OR REPLACE INTO settings (key, value)
             VALUES (?, ?)`,
            [
              key,
              JSON.stringify(value),
            ]
          );
        }
      }
    } catch (e) {
      console.error(
        'Error pulling from Firestore:',
        e
      );
    }
  }
}