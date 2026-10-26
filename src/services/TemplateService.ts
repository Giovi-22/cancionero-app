import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  SONG_TEMPLATE_FILENAME,
  SONG_EXAMPLE_FILENAME,
  SONG_TEMPLATE_TEXT,
  SONG_EXAMPLE_TEXT,
} from '../constants/songTemplate';

export class TemplateService {
  /**
   * Genera el archivo .txt de plantilla o ejemplo en el caché del dispositivo
   * y abre el menú nativo para compartir (guardar en Drive, etc.).
   */
  static async shareSongFile(kind: 'template' | 'example'): Promise<void> {
    const filename =
      kind === 'template' ? SONG_TEMPLATE_FILENAME : SONG_EXAMPLE_FILENAME;
    const text =
      kind === 'template' ? SONG_TEMPLATE_TEXT : SONG_EXAMPLE_TEXT;

    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        throw new Error(
          'La función de compartir no está disponible en este dispositivo.'
        );
      }

      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error('No se pudo acceder al directorio temporal.');
      }

      const fileUri = `${cacheDir}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: 'Guardar en Drive',
        UTI: 'public.plain-text',
      });
    } catch (error: any) {
      // Si el usuario simplemente canceló o cerró el diálogo de compartir, no es un error
      const message = error?.message?.toLowerCase() || '';
      if (
        message.includes('dismiss') ||
        message.includes('cancel') ||
        message.includes('canceled') ||
        message.includes('cancelled')
      ) {
        return;
      }

      // Si fue nuestro propio error de disponibilidad, relanzarlo con su mensaje
      if (
        error?.message ===
        'La función de compartir no está disponible en este dispositivo.'
      ) {
        throw error;
      }

      console.error('[TemplateService] Error al compartir archivo:', error);
      throw new Error('No se pudo preparar el archivo. Intentá nuevamente.');
    }
  }
}
