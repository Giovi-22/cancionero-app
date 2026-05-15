import * as SQLite from 'expo-sqlite';
import { SongMetadata } from '../types';

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
    // Create tables in a single transaction-like block
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
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
      
      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        songIds TEXT NOT NULL,
        isPublic INTEGER DEFAULT 0,
        lastUpdated TEXT
      );
    `);
  }

  static async saveSongs(songs: SongMetadata[]) {
    const db = await this.getDb();
    
    // Usar una transacción para mayor velocidad y seguridad
    for (const song of songs) {
      try {
        await db.runAsync(
          'INSERT OR REPLACE INTO songs (id, name, mimeType, modifiedTime, localPath, syncStatus, lastSyncedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [song.id, song.name, song.mimeType || '', song.modifiedTime || '', song.localPath || '', song.syncStatus || 'synced', new Date().toISOString()]
        );
      } catch (e) {
        console.error('Error saving song:', song.name, e);
      }
    }
  }

  static async getAllSongs(): Promise<SongMetadata[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM songs ORDER BY name ASC');
    return rows || [];
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
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', [key]);
      return row ? JSON.parse(row.value) : null;
    } catch (e) {
      return null;
    }
  }

  // Setlist methods
  static async saveSetlists(setlists: any[]) {
    const db = await this.getDb();
    for (const setlist of setlists) {
      await db.runAsync(
        'INSERT OR REPLACE INTO setlists (id, name, songIds, isPublic, lastUpdated) VALUES (?, ?, ?, ?, ?)',
        [setlist.id, setlist.name, JSON.stringify(setlist.songIds), setlist.isPublic ? 1 : 0, new Date().toISOString()]
      );
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

  static async deleteSetlistLocal(id: string) {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM setlists WHERE id = ?', [id]);
  }
}
