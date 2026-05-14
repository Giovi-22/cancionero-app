import { Song } from '../types';

export class DriveService {
  private static instance: DriveService;
  private readonly baseUrl = 'https://www.googleapis.com/drive/v3';
  
  private constructor() {}

  public static getInstance(): DriveService {
    if (!DriveService.instance) {
      DriveService.instance = new DriveService();
    }
    return DriveService.instance;
  }

  private async fetchFromDrive(accessToken: string, endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || 'Error fetching from Google Drive');
    }

    if (options.method === 'GET' && endpoint.includes('/export')) {
      return response.text();
    }

    return response.json();
  }

  /**
   * Obtiene recursivamente todos los IDs de las subcarpetas
   */
  private async getAllSubfolderIds(accessToken: string, rootFolderId: string): Promise<string[]> {
    const folderIds: string[] = [rootFolderId];
    const queue = [rootFolderId];
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      try {
        const query = encodeURIComponent(`'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
        const data = await this.fetchFromDrive(accessToken, `/files?q=${query}&fields=files(id)`);
        
        const subfolders = data.files || [];
        for (const folder of subfolders) {
          if (folder.id) {
            folderIds.push(folder.id);
            queue.push(folder.id);
          }
        }
      } catch (error) {
        console.error(`Error fetching subfolders for ${currentId}:`, error);
      }
    }
    
    return folderIds;
  }

  /**
   * Obtiene el listado de archivos (Google Docs) de una carpeta y sus subcarpetas
   */
  public async getSongsFromFolder(accessToken: string, rootFolderId: string): Promise<Song[]> {
    try {
      const allFolderIds = await this.getAllSubfolderIds(accessToken, rootFolderId);
      const parentQuery = allFolderIds.map(id => `'${id}' in parents`).join(' or ');
      const query = encodeURIComponent(`(${parentQuery}) and (mimeType = 'application/vnd.google-apps.document') and trashed = false`);
      
      let allFiles: any[] = [];
      let nextPageToken: string | undefined = undefined;

      do {
        const url = `/files?q=${query}&fields=nextPageToken,files(id,name,mimeType,modifiedTime)&orderBy=name&pageSize=100${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await this.fetchFromDrive(accessToken, url);
        
        if (data.files) {
          allFiles = [...allFiles, ...data.files];
        }
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      return allFiles.map((file: any) => ({
        id: file.id || '',
        name: file.name || 'Sin título',
        mimeType: file.mimeType || '',
        modifiedTime: file.modifiedTime || undefined,
      }));
    } catch (error) {
      console.error('Error fetching songs from Drive:', error);
      throw new Error('No se pudieron obtener las canciones de Google Drive.');
    }
  }

  /**
   * Obtiene el contenido de un Google Doc como texto plano
   */
  public async getSongContent(accessToken: string, fileId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/files/${fileId}/export?mimeType=text/plain`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return '';
      return await response.text();
    } catch (error) {
      console.error(`Error exporting song content for ${fileId}:`, error);
      return '';
    }
  }
}

export const driveService = DriveService.getInstance();
