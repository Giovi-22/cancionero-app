import * as SQLite from 'expo-sqlite';
import { SongMetadata } from '../types';
import { supabase } from '../lib/supabase';

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
        songIds TEXT NOT NULL,
        isPublic INTEGER DEFAULT 0,
        lastUpdated TEXT
      );
    `);

    // Migración manual: Añadir view_count si no existe (SQLite no lo hace solo en CREATE TABLE IF EXISTS)
    try {
      await db.execAsync('ALTER TABLE songs ADD COLUMN view_count INTEGER DEFAULT 0;');
      console.log('Added view_count column to songs table');
    } catch (e) {
      // Si ya existe, dará error, lo ignoramos
    }
  }

  static async saveSongs(songs: SongMetadata[]) {
    const db = await this.getDb();
    await db.withTransactionAsync(async () => {
      for (const song of songs) {
        await db.runAsync(
          'INSERT OR IGNORE INTO songs (id, name, mimeType, modifiedTime, localPath, syncStatus, lastSyncedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [song.id, song.name, song.mimeType || '', song.modifiedTime || '', song.localPath || '', song.syncStatus || 'synced', song.lastSyncedAt || new Date().toISOString()]
        );
        await db.runAsync(
          'UPDATE songs SET name = ?, mimeType = ?, modifiedTime = ?, localPath = ?, syncStatus = ?, lastSyncedAt = ? WHERE id = ?',
          [song.name, song.mimeType || '', song.modifiedTime || '', song.localPath || '', song.syncStatus || 'synced', song.lastSyncedAt || new Date().toISOString(), song.id]
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

  static async getTopSongs(limit: number = 10): Promise<SongMetadata[]> {
    const db = await this.getDb();
    return await db.getAllAsync<any>('SELECT * FROM songs ORDER BY view_count DESC LIMIT ?', [limit]);
  }

  static async getAllSongs(): Promise<SongMetadata[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM songs ORDER BY name ASC');
    return rows || [];
  }

  static async saveSetting(key: string, value: any) {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );

    // Sincronizar ajustes (como el folder_id)
    if (key === 'drive_folder_id') {
      this.syncSettingsToSupabase();
    }
  }

  private static async syncSettingsToSupabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const driveFolderId = await this.getSetting('drive_folder_id');
      
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        settings: { drive_folder_id: driveFolderId },
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

  // Setlist methods
  static async saveSetlist(setlist: any) {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO setlists (id, name, songIds, isPublic, lastUpdated) VALUES (?, ?, ?, ?, ?)',
      [setlist.id, setlist.name, JSON.stringify(setlist.songIds), setlist.isPublic ? 1 : 0, new Date().toISOString()]
    );
    
    // Sincronizar con Supabase
    this.syncSetlistToSupabase(setlist);
  }

  private static async syncSetlistToSupabase(setlist: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('setlists').upsert({
        id: setlist.id,
        user_id: user.id,
        name: setlist.name,
        song_ids: setlist.songIds,
        is_public: !!setlist.isPublic,
        last_updated: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error syncing setlist to Supabase:', e);
    }
  }

  static async getAllSetlists(): Promise<any[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM setlists ORDER BY name ASC');
    return rows.map(row => ({
      ...row,
      songIds: JSON.parse(row.songIds),
      isPublic: !!row.isPublic,
    }));
  }

  static async deleteSong(id: string) {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM songs WHERE id = ?', [id]);
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

  /**
   * Descarga todo lo de Supabase al teléfono
   */
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
            'INSERT OR REPLACE INTO setlists (id, name, songIds, isPublic, lastUpdated) VALUES (?, ?, ?, ?, ?)',
            [rs.id, rs.name, JSON.stringify(rs.song_ids), rs.is_public ? 1 : 0, rs.last_updated]
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
