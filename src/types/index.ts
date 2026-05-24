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
  libraryId?: string;
}

export interface AppSettings {
  transpose: number;
  fontSize: number;
  showChords: boolean;
  autoScrollSpeed: number;
}

export interface Library {
  id: string;
  userId?: string;
  name: string;
  driveFolderId?: string;
  syncEnabled: boolean;
  icon?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  songIds: string[];
  isPublic: boolean;
  lastUpdated?: string;
  libraryId?: string;
}

