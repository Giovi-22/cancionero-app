export interface Song {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  localPath?: string;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface SongMetadata extends Song {
  // Additional metadata for local database
  lastSyncedAt?: string;
}

export interface AppSettings {
  transpose: number;
  fontSize: number;
  showChords: boolean;
  autoScrollSpeed: number;
}
