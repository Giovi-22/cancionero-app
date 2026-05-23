import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SQLite from 'expo-sqlite';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Adaptador de almacenamiento persistente usando SQLite directamente.
// Esto permite que la sesión de Supabase se mantenga entre reinicios de la app
// sin necesidad de instalar paquetes adicionales como AsyncStorage.
let _db: SQLite.SQLiteDatabase | null = null;

async function getSettingsDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('cancionero.db');
  // La tabla ya fue creada por StorageService, pero usamos IF NOT EXISTS por seguridad
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  return _db;
}

const sqliteStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const db = await getSettingsDb();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [key]
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const db = await getSettingsDb();
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    } catch (e) {
      console.error('[Supabase Storage] Error saving key:', key, e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const db = await getSettingsDb();
      await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
    } catch (e) {
      console.error('[Supabase Storage] Error removing key:', key, e);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sqliteStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
