import { driveService } from './DriveService';
import { StorageService } from './StorageService';
import { FileSystemService } from './FileSystemService';
import { authService } from './AuthService';
import { Song, SongMetadata } from '../types';

export class SyncService {
  private static isSyncing = false;

  /**
   * Sincroniza todo el repertorio desde una carpeta de Google Drive
   * @param folderId ID de la carpeta en Google Drive
   * @param force Si es true, descarga todas las canciones ignorando la coincidencia de fechas
   * @returns Promise<boolean> true si hubo cambios reales descargados o eliminados, false en caso contrario
   */
  public static async syncFullRepertoire(folderId: string, force: boolean = false, libraryId?: string): Promise<boolean> {
    if (this.isSyncing) return false;
    if (!folderId) throw new Error('No se ha configurado un ID de carpeta');
    
    this.isSyncing = true;

    try {
      console.log(`[Sync] Starting full repertoire sync for folder: ${folderId} (Force: ${force})`);

      // 1. Verificar autenticación y traer datos de Supabase
      const token = await authService.getGoogleAccessToken();
      if (!token) throw new Error('Usuario no autenticado en Google');

      // Traer listas, estadísticas y ajustes de la nube antes de empezar con Drive
      await StorageService.pullFromSupabase();

      // 2. Obtener lista de canciones remotas
      const remoteFiles = await driveService.getSongsFromFolder(folderId);
      
      // 3. Obtener lista local para comparar
      const localSongs = await StorageService.getAllSongs(libraryId);
      const localSongsMap = new Map(localSongs.map(s => [s.id, s]));

      const songsToUpdate: Song[] = [];
      const songsToDelete: string[] = [];

      // 4. Identificar qué descargar y qué borrar
      for (const remoteFile of remoteFiles) {
        const localSong = localSongsMap.get(remoteFile.id);
        
        // Verificamos si el archivo local realmente existe físicamente
        const fileContent = await FileSystemService.getSongContent(remoteFile.id);
        const fileExists = fileContent !== null;

        // Si no existe localmente, o se modificó en la nube, o la ruta guardada estaba mal (como el 'undefined' de antes)
        if (
          force ||
          !localSong ||
          !fileExists ||
          localSong.modifiedTime !== remoteFile.modifiedTime ||
          (localSong.localPath ?? '').includes('undefined')
        ) {
          if (force) {
            console.log(`[Sync] Canción '${remoteFile.name}' requiere descarga (Sincronización forzada)`);
          } else if (!localSong) {
            console.log(`[Sync] Canción '${remoteFile.name}' requiere descarga (No existe localmente)`);
          } else if (!fileExists) {
            console.log(`[Sync] Canción '${remoteFile.name}' requiere descarga (Falta el archivo físico)`);
          } else if (localSong.modifiedTime !== remoteFile.modifiedTime) {
            console.log(`[Sync] Canción '${remoteFile.name}' requiere descarga (Modificada en la nube. Local: '${localSong.modifiedTime || 'Ninguna'}', Drive: '${remoteFile.modifiedTime || 'Ninguna'}')`);
          } else {
            console.log(`[Sync] Canción '${remoteFile.name}' requiere descarga (Ruta local corrupta)`);
          }

          songsToUpdate.push({
            id: remoteFile.id,
            name: remoteFile.name,
            mimeType: remoteFile.mimeType,
            modifiedTime: remoteFile.modifiedTime
          });
        } else {
          console.log(`[Sync] Canción '${remoteFile.name}' al día. Fecha: '${localSong.modifiedTime}'`);
        }
      }

      // Identificar borrados (están local pero no en remoto)
      const remoteIds = new Set(remoteFiles.map((f: any) => f.id));
      for (const localSong of localSongs) {
        if (!remoteIds.has(localSong.id)) {
          songsToDelete.push(localSong.id);
        }
      }

      console.log(`[Sync] Sync plan: ${songsToUpdate.length} to download, ${songsToDelete.length} to delete.`);

      // Conjunto para registrar los IDs de descargas fallidas
      const failedSongIds = new Set<string>();

      // 5. Descargar en grupos (batches)
      if (songsToUpdate.length > 0) {
        await this.downloadSongsInBatches(songsToUpdate, failedSongIds);
      }

      // 6. Eliminar locales que ya no están en Drive
      for (const id of songsToDelete) {
        await StorageService.deleteSong(id);
        await FileSystemService.deleteSongFile(id);
      }

      // 7. Actualizar metadatos finales en SQLite (Asegurando rutas correctas y excluyendo fallidas)
      const finalMetadata: SongMetadata[] = remoteFiles
        .filter((rf: any) => !failedSongIds.has(rf.id))
        .map((rf: any) => ({
          id: rf.id,
          name: rf.name,
          mimeType: rf.mimeType,
          modifiedTime: rf.modifiedTime,
          localPath: FileSystemService.getLocalPath(rf.id),
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        }));
      
      await StorageService.saveSongs(finalMetadata, libraryId);

      console.log('[Sync] Sync completed successfully.');

      // Retornar true si hubo descargas exitosas o eliminaciones
      const successfulDownloadsCount = songsToUpdate.length - failedSongIds.size;
      return successfulDownloadsCount > 0 || songsToDelete.length > 0;
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private static async downloadSongsInBatches(songs: Song[], failedSongIds: Set<string>) {
    const BATCH_SIZE = 5;
    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async song => {
          const success = await this.downloadAndStoreSong(song);
          if (!success) {
            failedSongIds.add(song.id);
          }
        })
      );
      console.log(`[Sync] Downloaded batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(songs.length / BATCH_SIZE)}`);
    }
  }

  private static async downloadAndStoreSong(song: Song): Promise<boolean> {
    try {
      const content = await driveService.getSongContent(song.id, song.mimeType);
      if (content) {
        await FileSystemService.saveSongContent(song.id, content);
        return true;
      }
      return false;
    } catch (e) {
      console.error(`[Sync] Failed to download song ${song.name}:`, e);
      return false;
    }
  }
}
