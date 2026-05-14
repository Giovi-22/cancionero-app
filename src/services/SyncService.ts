import { DriveService, driveService } from './DriveService';
import { StorageService } from './StorageService';
import { FileSystemService } from './FileSystemService';
import { Song, SongMetadata } from '../types';

export class SyncService {
  private static isSyncing = false;

  public static async syncFullRepertoire(accessToken: string, folderId: string) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.log('Starting full repertoire sync...');

      // 1. Get remote song list
      const remoteSongs = await driveService.getSongsFromFolder(accessToken, folderId);
      
      // 2. Get local song list
      const localSongs = await StorageService.getAllSongs();
      const localSongsMap = new Map(localSongs.map(s => [s.id, s]));

      // 3. Identify changes
      const songsToUpdate: Song[] = [];
      const songsToDelete: string[] = [];

      for (const remoteSong of remoteSongs) {
        const localSong = localSongsMap.get(remoteSong.id);
        
        if (!localSong || localSong.modifiedTime !== remoteSong.modifiedTime) {
          songsToUpdate.push(remoteSong);
        }
      }

      // Identify songs that are local but not remote (deleted in Drive)
      const remoteIds = new Set(remoteSongs.map(s => s.id));
      for (const localSong of localSongs) {
        if (!remoteIds.has(localSong.id)) {
          songsToDelete.push(localSong.id);
        }
      }

      console.log(`Sync status: ${songsToUpdate.length} to update, ${songsToDelete.length} to delete out of ${remoteSongs.length} total.`);

      // 4. Batch update
      if (songsToUpdate.length > 0) {
        await this.downloadSongsInBatches(accessToken, songsToUpdate);
      }

      // 5. Delete removed songs
      for (const id of songsToDelete) {
        await StorageService.deleteSong(id);
        await FileSystemService.deleteSongFile(id);
      }

      // 6. Update SQLite with all remote songs metadata (to keep index fresh)
      const finalMetadata: SongMetadata[] = remoteSongs.map(rs => ({
        ...rs,
        localPath: FileSystemService.getLocalPath(rs.id),
        syncStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
      }));
      await StorageService.saveSongs(finalMetadata);

      console.log('Sync completed successfully.');
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private static async downloadSongsInBatches(accessToken: string, songs: Song[]) {
    const BATCH_SIZE = 5;
    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(song => this.downloadAndStoreSong(accessToken, song)));
      console.log(`Downloaded batch ${i / BATCH_SIZE + 1} of ${Math.ceil(songs.length / BATCH_SIZE)}`);
    }
  }

  private static async downloadAndStoreSong(accessToken: string, song: Song) {
    try {
      const content = await driveService.getSongContent(accessToken, song.id);
      if (content) {
        await FileSystemService.saveSongContent(song.id, content);
      }
    } catch (e) {
      console.error(`Failed to download song ${song.id}:`, e);
      // We don't throw here to allow other songs to download
    }
  }
}
