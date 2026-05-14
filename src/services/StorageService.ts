import * as SQLite from 'expo-sqlite';
import { SongMetadata } from '../types';

const DB_NAME = 'cancionero.db';

export class StorageService {
  private static db: SQLite.SQLiteDatabase | null = null;

  static async getDb() {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.init();
    }
    return this.db;
  }

  private static async init() {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Create songs table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        mimeType TEXT,
        modifiedTime TEXT,
        localPath TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  static async saveSongs(songs: SongMetadata[]) {
    const db = await this.getDb();
    
    for (const song of songs) {
      await db.runAsync(
        'INSERT OR REPLACE INTO songs (id, name, mimeType, modifiedTime, localPath, syncStatus, lastSyncedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [song.id, song.name, song.mimeType || '', song.modifiedTime || '', song.localPath || '', song.syncStatus || 'synced', new Date().toISOString()]
      );
    }
  }

  static async getAllSongs(): Promise<SongMetadata[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM songs ORDER BY name ASC');
    return rows.map(row => ({
      ...row,
    }));
  }

  static async getSongById(id: string): Promise<SongMetadata | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM songs WHERE id = ?', [id]);
    return row || null;
  }

  static async deleteSong(id: string) {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM songs WHERE id = ?', [id]);
  }

  static async saveSetting(key: string, value: any) {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );
  }

  static async getSetting<T>(key: string): Promise<T | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? JSON.parse(row.value) : null;
  }
}
