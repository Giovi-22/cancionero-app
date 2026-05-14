import * as FileSystem from 'expo-file-system';

const SONGS_DIR = `${FileSystem.documentDirectory}songs/`;

export class FileSystemService {
  static async ensureDirExists() {
    const dirInfo = await FileSystem.getInfoAsync(SONGS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SONGS_DIR, { intermediates: true });
    }
  }

  static async saveSongContent(id: string, content: string): Promise<string> {
    await this.ensureDirExists();
    const filePath = `${SONGS_DIR}${id}.txt`;
    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return filePath;
  }

  static async getSongContent(id: string): Promise<string | null> {
    const filePath = `${SONGS_DIR}${id}.txt`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return null;
    }
    return await FileSystem.readAsStringAsync(filePath);
  }

  static async deleteSongFile(id: string) {
    const filePath = `${SONGS_DIR}${id}.txt`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  }

  static getLocalPath(id: string): string {
    return `${SONGS_DIR}${id}.txt`;
  }
}
