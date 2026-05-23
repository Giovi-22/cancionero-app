import { authService } from './AuthService';

export class DriveService {
  private static DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';

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
   * Obtiene las canciones de una carpeta específica
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

    // Si es un Google Doc, vamos directo a exportar
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

  private async exportGoogleDoc(fileId: string, token: string): Promise<string> {
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
    
    return await exportResponse.text();
  }
}

export const driveService = new DriveService();
