import { driveService } from './DriveService';
import { FileSystemService } from './FileSystemService';
import { BandSong } from '../types/band';

export class BandSongService {
    static async getSongContent(
        bandId: string,
        song: BandSong
    ): Promise<string | null> {
        // 1. Buscar primero en el almacenamiento local
        const localContent =
            await FileSystemService.getBandSongContent(
                bandId,
                song.id
            );

        if (localContent) {
            return localContent;
        }

        // 2. Si no está localmente, obtenerla desde Google Drive
        const content =
            await driveService.getSongContent(
                song.id,
                song.mimeType,
                song.name
            );

        if (!content) {
            return null;
        }

        // 3. Guardarla localmente para futuras aperturas
        await FileSystemService.saveBandSongContent(
            bandId,
            song.id,
            content
        );

        return content;
    }
}