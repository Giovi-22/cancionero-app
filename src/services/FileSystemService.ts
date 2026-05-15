import * as FileSystem from 'expo-file-system/legacy';

export class FileSystemService {
  private static getSongsDir() {
    // Si documentDirectory es null, usamos el cache como fallback temporal, 
    // pero en Expo Go siempre debería estar disponible.
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    return `${baseDir}songs/`;
  }

  static async ensureDirExists() {
    const dir = this.getSongsDir();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  static async saveSongContent(id: string, content: string): Promise<string> {
    await this.ensureDirExists();
    const filePath = `${this.getSongsDir()}${id}.txt`;
    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return filePath;
  }

  static async getSongContent(id: string): Promise<string | null> {
    const filePath = `${this.getSongsDir()}${id}.txt`;
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return null;
      }
      return await FileSystem.readAsStringAsync(filePath);
    } catch (e) {
      return null;
    }
  }

  static async deleteSongFile(id: string) {
    const filePath = `${this.getSongsDir()}${id}.txt`;
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }
    } catch (e) {
      // Ignorar errores al borrar
    }
  }

  static getLocalPath(id: string): string {
    return `${this.getSongsDir()}${id}.txt`;
  }
}
