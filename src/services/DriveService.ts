import { authService } from './AuthService';
import { legacyToChordPro } from '../utils/legacyToChordPro';
import { convertGoogleDocToChordPro } from '../utils/chordpro/chordProConverter';

export class DriveService {
  private static DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
  private static DOCS_API_URL = 'https://docs.googleapis.com/v1/documents';

  /**
   * Lista carpetas de Google Drive (propias o compartidas)
   */
  static async listFolders(parentId: string = 'root', showShared: boolean = false) {
    const token = await authService.getGoogleAccessToken();
    if (!token) throw new Error('No hay token de acceso a Google');

    let query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    if (showShared && parentId === 'root') {
      // Raíz de compartidos: muestra todas las carpetas compartidas conmigo
      query += ` and sharedWithMe = true`;
    } else {
      // Navegar dentro de cualquier carpeta (propia o compartida)
      query += ` and '${parentId}' in parents`;
    }

    const response = await fetch(
      `${this.DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id, name)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error al listar carpetas de Drive');
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Lista subcarpetas directas de un folder
   */
  private static async listSubfolders(folderId: string, token: string): Promise<{ id: string; name: string }[]> {
    const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const response = await fetch(
      `${this.DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id, name)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Error al listar subcarpetas: ${err.error?.message || response.status}`);
    }
    const data = await response.json();
    return data.files || [];
  }

  /**
   * Obtiene archivos de canciones directamente dentro de una carpeta
   */
  private static async getSongsInFolder(folderId: string, token: string): Promise<any[]> {
    const query = `'${folderId}' in parents and trashed = false and (mimeType = 'text/plain' or mimeType = 'application/vnd.google-apps.document' or name contains '.txt' or name contains '.pro' or name contains '.chordpro' or name contains '.cho')`;
    const response = await fetch(
      `${this.DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, modifiedTime)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Error al obtener canciones de la carpeta: ${err.error?.message || response.status}`);
    }
    const data = await response.json();
    return data.files || [];
  }

  /**
   * Obtiene TODAS las canciones de una carpeta y sus subcarpetas de forma recursiva.
   * Cada canción lleva el campo `folderName` indicando su subcarpeta de origen
   * (undefined = carpeta raíz).
   */
  static async getSongsFromFolderRecursive(
    folderId: string,
    folderName?: string,
    depth: number = 0,
    maxDepth: number = 4
  ): Promise<Array<{ id: string; name: string; mimeType: string; modifiedTime: string; folderName?: string }>> {
    const token = await authService.getGoogleAccessToken();
    if (!token) throw new Error('No hay token de acceso a Google');

    // Obtener canciones y subcarpetas en paralelo
    const [songs, subfolders] = await Promise.all([
      this.getSongsInFolder(folderId, token),
      depth < maxDepth ? this.listSubfolders(folderId, token) : Promise.resolve([]),
    ]);

    // Canciones en esta carpeta, etiquetadas con su nombre de carpeta
    const taggedSongs = songs.map((s: any) => ({
      ...s,
      folderName: folderName ?? undefined,
    }));

    // Recursión en subcarpetas (en paralelo)
    const subResults = await Promise.all(
      subfolders.map((sub: { id: string; name: string }) =>
        this.getSongsFromFolderRecursive(sub.id, sub.name, depth + 1, maxDepth)
      )
    );

    return [...taggedSongs, ...subResults.flat()];
  }

  /**
   * Obtiene las canciones de una carpeta específica (sin subcarpetas — compatibilidad)
   */
  async getSongsFromFolder(folderId: string) {
    const token = await authService.getGoogleAccessToken();
    if (!token) throw new Error('No hay token de acceso a Google');

    // Buscamos archivos de texto o Google Docs
    const query = `'${folderId}' in parents and trashed = false and (mimeType = 'text/plain' or mimeType = 'application/vnd.google-apps.document' or name contains '.txt' or name contains '.pro' or name contains '.chordpro' or name contains '.cho')`;

    const response = await fetch(
      `${DriveService.DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, modifiedTime)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Error al obtener canciones de Google Drive');
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Obtiene el contenido de un archivo con reintentos para Google Docs
   */
  async getSongContent(fileId: string, mimeType?: string, songName?: string): Promise<string> {
    const token = await authService.getGoogleAccessToken();
    if (!token) throw new Error('No hay token de acceso a Google');

    // Si es un Google Doc, vamos directo a procesar con Docs API / export
    if (mimeType === 'application/vnd.google-apps.document') {
      return this.exportGoogleDoc(fileId, token, songName);
    }

    try {
      const response = await fetch(
        `${DriveService.DRIVE_API_URL}/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        // Si falla el media, intentamos exportar por si acaso es un formato de Google
        return this.exportGoogleDoc(fileId, token, songName);
      }

      const textContent = await response.text();
      return legacyToChordPro(textContent, songName);
    } catch (e) {
      return this.exportGoogleDoc(fileId, token, songName);
    }
  }

  /**
   * Obtiene y convierte un Google Doc. Intenta primero usar Google Docs API v1
   * para obtener la estructura interna; si falla (ej. sin scope), usa fallback a export text/plain.
   */
  private async exportGoogleDoc(fileId: string, token: string, songName?: string): Promise<string> {
    // 1. Intentar obtener el documento a través de Google Docs API v1 (detección por color)
    try {
      const response = await fetch(
        `${DriveService.DOCS_API_URL}/${fileId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const docJson = await response.json();
        const chordPro = convertGoogleDocToChordPro(docJson.body.content || []);
        if (chordPro && chordPro.trim().length > 0) {
          console.log('[DriveService] Google Doc convertido a ChordPro mediante ChordProConverter');
          return chordPro;
        }
      } else {
        console.warn('[DriveService] Google Docs API devolvió status:', response.status, '- Usando fallback a export plain text');
      }
    } catch (e) {
      console.warn('[DriveService] Error llamando a Google Docs API, usando fallback:', e);
    }

    // 2. Fallback: exportar como text/plain desde Drive API
    const exportResponse = await fetch(
      `${DriveService.DRIVE_API_URL}/${fileId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!exportResponse.ok) throw new Error('No se pudo exportar el Google Doc');
    const plainText = await exportResponse.text();
    return legacyToChordPro(plainText, songName);
  }

}
export const driveService = new DriveService();
