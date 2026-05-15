import { driveService } from './DriveService';
import { StorageService } from './StorageService';
import { FileSystemService } from './FileSystemService';
import { authService } from './AuthService';
import { Song, SongMetadata } from '../types';

export class SyncService {
  private static isSyncing = false;

  /**
   * Sincroniza todo el repertorio desde una carpeta de Google Drive
   */
  public static async syncFullRepertoire(folderId: string) {
    if (this.isSyncing) return;
    if (!folderId) throw new Error('No se ha configurado un ID de carpeta');
    
    this.isSyncing = true;

    try {
      console.log('Starting full repertoire sync for folder:', folderId);

      // 1. Verificar autenticación
      const token = await authService.getGoogleAccessToken();
      if (!token) throw new Error('Usuario no autenticado en Google');

      // 2. Obtener lista de canciones remotas
      const remoteFiles = await driveService.getSongsFromFolder(folderId);
      
      // 3. Obtener lista local para comparar
      const localSongs = await StorageService.getAllSongs();
      const localSongsMap = new Map(localSongs.map(s => [s.id, s]));

      const songsToUpdate: Song[] = [];
      const songsToDelete: string[] = [];

      // 4. Identificar qué descargar y qué borrar
      for (const remoteFile of remoteFiles) {
        const localSong = localSongsMap.get(remoteFile.id);
        
        // Si no existe o se modificó en la nube
        if (!localSong || localSong.modifiedTime !== remoteFile.modifiedTime) {
          songsToUpdate.push({
            id: remoteFile.id,
            name: remoteFile.name,
            mimeType: remoteFile.mimeType,
            modifiedTime: remoteFile.modifiedTime
          });
        }
      }

      // Identificar borrados (están local pero no en remoto)
      const remoteIds = new Set(remoteFiles.map(f => f.id));
      for (const localSong of localSongs) {
        if (!remoteIds.has(localSong.id)) {
          songsToDelete.push(localSong.id);
        }
      }

      console.log(`Sync plan: ${songsToUpdate.length} to download, ${songsToDelete.length} to delete.`);

      // 5. Descargar en grupos (batches)
      if (songsToUpdate.length > 0) {
        await this.downloadSongsInBatches(songsToUpdate);
      }

      // 6. Eliminar locales que ya no están en Drive
      for (const id of songsToDelete) {
        await StorageService.deleteSong(id);
        await FileSystemService.deleteSongFile(id);
      }

      // 7. Actualizar metadatos finales en SQLite
      const finalMetadata: SongMetadata[] = remoteFiles.map(rf => ({
        id: rf.id,
        name: rf.name,
        mimeType: rf.mimeType,
        modifiedTime: rf.modifiedTime,
        localPath: FileSystemService.getLocalPath(rf.id),
        syncStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
      }));
      
      await StorageService.saveSongs(finalMetadata);

      console.log('Sync completed successfully.');
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private static async downloadSongsInBatches(songs: Song[]) {
    const BATCH_SIZE = 5;
    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(song => this.downloadAndStoreSong(song)));
    }
  }

  private static async downloadAndStoreSong(song: Song) {
    try {
      const content = await driveService.getSongContent(song.id, song.mimeType);
      if (content) {
        await FileSystemService.saveSongContent(song.id, content);
      }
    } catch (e) {
      console.error(`Failed to download song ${song.name}:`, e);
    }
  }
}
