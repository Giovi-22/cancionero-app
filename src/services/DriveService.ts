import { authService } from './AuthService';
import { legacyToChordPro } from '../utils/legacyToChordPro';

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
    if (!response.ok) return [];
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
    if (!response.ok) return [];
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
  async getSongContent(fileId: string, mimeType?: string): Promise<string> {
    const token = await authService.getGoogleAccessToken();
    if (!token) throw new Error('No hay token de acceso a Google');

    // Si es un Google Doc, vamos directo a procesar con Docs API / export
    if (mimeType === 'application/vnd.google-apps.document') {
      return this.exportGoogleDoc(fileId, token);
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
        return this.exportGoogleDoc(fileId, token);
      }

      return await response.text();
    } catch (e) {
      return this.exportGoogleDoc(fileId, token);
    }
  }

  /**
   * Obtiene y convierte un Google Doc. Intenta primero usar Google Docs API v1
   * para obtener la estructura interna; si falla (ej. sin scope), usa fallback a export text/plain.
   */
  private async exportGoogleDoc(fileId: string, token: string): Promise<string> {
    // 1. Intentar obtener el documento a través de Google Docs API v1
    try {
      const response = await fetch(
        `${DriveService.DOCS_API_URL}/${fileId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const docJson = await response.json();
        const extractedText = this.extractTextFromGoogleDocJson(docJson);
        if (extractedText && extractedText.trim().length > 0) {
          console.log('[DriveService] Google Doc procesado exitosamente vía Google Docs API v1.');
          return legacyToChordPro(extractedText);
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
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    if (!exportResponse.ok) {
      throw new Error('No se pudo exportar el Google Doc');
    }
    
    const plainText = await exportResponse.text();
    return legacyToChordPro(plainText);
  }

  /**
   * Extrae el texto estructural de la respuesta JSON de Google Docs API v1
   */
  private extractTextFromGoogleDocJson(docJson: any): string {
    if (!docJson?.body?.content) return '';

    const lines: string[] = [];

    for (const structElem of docJson.body.content) {
      if (!structElem.paragraph?.elements) continue;

      let lineBuffer = '';
      for (const elem of structElem.paragraph.elements) {
        if (!elem.textRun?.content) continue;
        lineBuffer += elem.textRun.content;
      }

      const splitLines = lineBuffer.split('\n');
      for (let i = 0; i < splitLines.length; i++) {
        if (i === splitLines.length - 1 && splitLines[i] === '') continue;
        lines.push(splitLines[i]);
      }
    }

    return lines.join('\n');
  }
}

export const driveService = new DriveService();
