import * as SQLite from 'expo-sqlite';
import { SongMetadata, Library } from '../types';
import { supabase } from '../lib/supabase';
import { FileSystemService } from './FileSystemService';

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

    // Migraciones manuales
    try {
      await db.execAsync('ALTER TABLE setlists ADD COLUMN date TEXT;');
    } catch (e) {}

    // Migración manual: Añadir view_count si no existe
    try {
      await db.execAsync('ALTER TABLE songs ADD COLUMN view_count INTEGER DEFAULT 0;');
      console.log('Added view_count column to songs table');
    } catch (e) {}

    // Migración manual: Añadir library_id a canciones y setlists si no existen
    try {
      await db.execAsync('ALTER TABLE songs ADD COLUMN library_id TEXT;');
      console.log('Added library_id column to songs table');
    } catch (e) {}

    try {
      await db.execAsync('ALTER TABLE setlists ADD COLUMN library_id TEXT;');
      console.log('Added library_id column to setlists table');
    } catch (e) {}

    // Migración inicial: si no hay bibliotecas, crear la de por defecto y migrar los datos locales
    try {
      const libCount = await db.getFirstAsync<any>('SELECT COUNT(*) as count FROM libraries');
      if (!libCount || libCount.count === 0) {
        console.log('No libraries found. Starting initial migration...');

        // Intentar leer la carpeta de Drive actual guardada
        const driveFolderIdRow = await db.getFirstAsync<any>("SELECT value FROM settings WHERE key = 'drive_folder_id'");
        let driveFolderId = '';
        if (driveFolderIdRow) {
          try {
            driveFolderId = JSON.parse(driveFolderIdRow.value);
          } catch (e) {
            driveFolderId = driveFolderIdRow.value;
          }
        }

        const now = Date.now();
        // Crear biblioteca 'default'
        await db.runAsync(
          'INSERT INTO libraries (id, name, driveFolderId, syncEnabled, icon, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          ['default', 'Mi Biblioteca', driveFolderId, 1, 'book-open', '#3b82f6', now, now]
        );
        console.log('Created default library: Mi Biblioteca');

        // Asignar todas las canciones y listas huérfanas a la biblioteca por defecto
        await db.runAsync("UPDATE songs SET library_id = 'default' WHERE library_id IS NULL");
        await db.runAsync("UPDATE setlists SET library_id = 'default' WHERE library_id IS NULL");
        console.log('Assigned existing songs and setlists to default library');

        // Establecer la biblioteca por defecto como activa
        const activeLibRow = await db.getFirstAsync<any>("SELECT value FROM settings WHERE key = 'active_library_id'");
        if (!activeLibRow) {
          await db.runAsync(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_library_id', ?)",
            [JSON.stringify('default')]
          );
          console.log("Set active_library_id to default");
        }
      }
    } catch (e) {
      console.error('Error during initial libraries migration:', e);
    }
  }

  // --- CRUD de Bibliotecas ---
  static async saveLibrary(library: Library) {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO libraries (id, name, driveFolderId, syncEnabled, icon, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        library.id,
        library.name,
        library.driveFolderId || '',
        library.syncEnabled ? 1 : 0,
        library.icon || 'book-open',
        library.color || '#3b82f6',
        library.createdAt,
        library.updatedAt
      ]
    );
  }

  static async getAllLibraries(): Promise<Library[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM libraries ORDER BY name ASC');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      driveFolderId: row.driveFolderId || '',
      syncEnabled: row.syncEnabled === 1,
      icon: row.icon || 'book-open',
      color: row.color || '#3b82f6',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  static async getLibrary(id: string): Promise<Library | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM libraries WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      driveFolderId: row.driveFolderId || '',
      syncEnabled: row.syncEnabled === 1,
      icon: row.icon || 'book-open',
      color: row.color || '#3b82f6',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  static async deleteLibrary(id: string) {
    const db = await this.getDb();
    
    // Obtener canciones de esta biblioteca para borrarlas físicamente
    const songs = await db.getAllAsync<any>('SELECT id FROM songs WHERE library_id = ?', [id]);
    for (const song of songs) {
      await FileSystemService.deleteSongFile(song.id);
    }
    
    await db.runAsync('DELETE FROM songs WHERE library_id = ?', [id]);
    await db.runAsync('DELETE FROM setlists WHERE library_id = ?', [id]);
    await db.runAsync('DELETE FROM libraries WHERE id = ?', [id]);
    
    // Sincronizar borrado de listas en Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('setlists').delete().match({ library_id: id, user_id: user.id });
      }
    } catch (e) {
      console.error('Error deleting library setlists from Supabase:', e);
    }
  }

  // --- Operaciones de Canciones ---
  static async saveSongs(songs: SongMetadata[], libraryId?: string) {
    const db = await this.getDb();
    const targetLibrary = libraryId || 'default';
    await db.withTransactionAsync(async () => {
      for (const song of songs) {
        await db.runAsync(
          'INSERT OR IGNORE INTO songs (id, name, mimeType, modifiedTime, localPath, syncStatus, lastSyncedAt, library_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [song.id, song.name, song.mimeType || '', song.modifiedTime || '', song.localPath || '', song.syncStatus || 'synced', song.lastSyncedAt || new Date().toISOString(), targetLibrary]
        );
        await db.runAsync(
          'UPDATE songs SET name = ?, mimeType = ?, modifiedTime = ?, localPath = ?, syncStatus = ?, lastSyncedAt = ?, library_id = ? WHERE id = ?',
          [song.name, song.mimeType || '', song.modifiedTime || '', song.localPath || '', song.syncStatus || 'synced', song.lastSyncedAt || new Date().toISOString(), targetLibrary, song.id]
        );
      }
    });
  }

  static async incrementSongViewCount(songId: string) {
    const db = await this.getDb();
    await db.runAsync('UPDATE songs SET view_count = view_count + 1 WHERE id = ?', [songId]);
    
    // Sincronizar con Supabase en background
    this.syncStatsToSupabase(songId);
  }

  private static async syncStatsToSupabase(songId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const db = await this.getDb();
      const row = await db.getFirstAsync<any>('SELECT view_count FROM songs WHERE id = ?', [songId]);
      if (!row) return;

      await supabase.from('song_stats').upsert({
        user_id: user.id,
        song_id: songId,
        view_count: row.view_count,
        last_played_at: new Date().toISOString()
      }, { onConflict: 'user_id,song_id' });
    } catch (e) {
      console.error('Error syncing stats to Supabase:', e);
    }
  }

  static async getTopSongs(limit: number = 10, libraryId?: string): Promise<SongMetadata[]> {
    const db = await this.getDb();
    if (libraryId) {
      return await db.getAllAsync<any>('SELECT * FROM songs WHERE library_id = ? ORDER BY view_count DESC LIMIT ?', [libraryId, limit]);
    }
    return await db.getAllAsync<any>('SELECT * FROM songs ORDER BY view_count DESC LIMIT ?', [limit]);
  }

  static async getAllSongs(libraryId?: string): Promise<SongMetadata[]> {
    const db = await this.getDb();
    let rows;
    if (libraryId) {
      rows = await db.getAllAsync<any>('SELECT * FROM songs WHERE library_id = ? ORDER BY name ASC', [libraryId]);
    } else {
      rows = await db.getAllAsync<any>('SELECT * FROM songs ORDER BY name ASC');
    }
    return rows || [];
  }

  // --- Operaciones de Ajustes ---
  static async saveSetting(key: string, value: any) {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );

    // Sincronizar TODAS las configuraciones a Supabase (modo silencioso)
    this.syncSettingsToSupabase();
  }

  private static async syncSettingsToSupabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const db = await this.getDb();
      const allSettingsRows = await db.getAllAsync<any>('SELECT * FROM settings');
      const allSettings: Record<string, any> = {};
      for (const row of allSettingsRows) {
        try {
          allSettings[row.key] = JSON.parse(row.value);
        } catch(e) {
          allSettings[row.key] = row.value;
        }
      }
      
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        settings: allSettings,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error syncing settings to Supabase:', e);
    }
  }

  static async getSetting<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', [key]);
      return row ? JSON.parse(row.value) : null;
    } catch (e) {
      return null;
    }
  }

  // --- Operaciones de Setlists ---
  static async saveSetlist(setlist: any, libraryId?: string) {
    const db = await this.getDb();
    const libId = libraryId || setlist.libraryId || 'default';
    await db.runAsync(
      'INSERT OR REPLACE INTO setlists (id, name, date, songIds, isPublic, lastUpdated, library_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [setlist.id, setlist.name, setlist.date || null, JSON.stringify(setlist.songIds), setlist.isPublic ? 1 : 0, new Date().toISOString(), libId]
    );
    
    // Sincronizar con Supabase
    this.syncSetlistToSupabase({ ...setlist, libraryId: libId });
  }

  private static async syncSetlistToSupabase(setlist: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('setlists').upsert({
        id: setlist.id,
        user_id: user.id,
        name: setlist.name,
        date: setlist.date || null,
        song_ids: setlist.songIds,
        is_public: !!setlist.isPublic,
        last_updated: new Date().toISOString(),
        library_id: setlist.libraryId || 'default'
      });
    } catch (e) {
      console.error('Error syncing setlist to Supabase:', e);
    }
  }

  static async getAllSetlists(libraryId?: string): Promise<any[]> {
    const db = await this.getDb();
    let rows;
    if (libraryId) {
      rows = await db.getAllAsync<any>('SELECT * FROM setlists WHERE library_id = ? ORDER BY name ASC', [libraryId]);
    } else {
      rows = await db.getAllAsync<any>('SELECT * FROM setlists ORDER BY name ASC');
    }
    return rows.map(row => ({
      ...row,
      songIds: JSON.parse(row.songIds),
      isPublic: !!row.isPublic,
    }));
  }

  static async deleteSong(id: string) {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM songs WHERE id = ?', [id]);
    await FileSystemService.deleteSongFile(id);
  }

  static async deleteSetlistLocal(id: string) {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM setlists WHERE id = ?', [id]);
    
    // También borrar en Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('setlists').delete().match({ id, user_id: user.id });
      }
    } catch (e) {}
  }

  static async pullFromSupabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Traer Estadísticas
      const { data: stats } = await supabase.from('song_stats').select('*').eq('user_id', user.id);
      if (stats) {
        const db = await this.getDb();
        for (const s of stats) {
          await db.runAsync('UPDATE songs SET view_count = ? WHERE id = ?', [s.view_count, s.song_id]);
        }
      }

      // 2. Traer Listas
      const { data: remoteSetlists } = await supabase.from('setlists').select('*').eq('user_id', user.id);
      if (remoteSetlists) {
        const db = await this.getDb();
        for (const rs of remoteSetlists) {
          await db.runAsync(
            'INSERT OR REPLACE INTO setlists (id, name, songIds, isPublic, lastUpdated, library_id) VALUES (?, ?, ?, ?, ?, ?)',
            [rs.id, rs.name, JSON.stringify(rs.song_ids), rs.is_public ? 1 : 0, rs.last_updated, rs.library_id || 'default']
          );
        }
      }

      // 3. Traer Ajustes
      const { data: settingsRow } = await supabase.from('user_settings').select('settings').eq('user_id', user.id).single();
      if (settingsRow?.settings) {
        for (const [key, value] of Object.entries(settingsRow.settings)) {
          await this.saveSetting(key, value);
        }
      }
    } catch (e) {
      console.error('Error pulling from Supabase:', e);
    }
  }
}

