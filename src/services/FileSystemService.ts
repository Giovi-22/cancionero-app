import * as FileSystem from 'expo-file-system/legacy';

export class FileSystemService {
  // ============================================================
  // PERSONAL
  // ============================================================

  private static getSongsDir() {
    // Si documentDirectory es null, usamos el cache como fallback temporal,
    // pero en Expo Go siempre debería estar disponible.
    const baseDir =
      FileSystem.documentDirectory ||
      FileSystem.cacheDirectory ||
      '';

    return `${baseDir}songs/`;
  }

  static async ensureDirExists() {
    const dir =
      this.getSongsDir();

    const dirInfo =
      await FileSystem.getInfoAsync(
        dir
      );

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        dir,
        {
          intermediates: true,
        }
      );
    }
  }

  static async saveSongContent(
    id: string,
    content: string
  ): Promise<string> {
    await this.ensureDirExists();

    const filePath =
      `${this.getSongsDir()}${id}.txt`;

    await FileSystem.writeAsStringAsync(
      filePath,
      content,
      {
        encoding:
          FileSystem.EncodingType.UTF8,
      }
    );

    return filePath;
  }

  static async getSongContent(
    id: string
  ): Promise<string | null> {
    const filePath =
      `${this.getSongsDir()}${id}.txt`;

    try {
      const fileInfo =
        await FileSystem.getInfoAsync(
          filePath
        );

      if (!fileInfo.exists) {
        return null;
      }

      return await FileSystem.readAsStringAsync(
        filePath
      );
    } catch {
      return null;
    }
  }

  static async deleteSongFile(
    id: string
  ) {
    const filePath =
      `${this.getSongsDir()}${id}.txt`;

    try {
      const fileInfo =
        await FileSystem.getInfoAsync(
          filePath
        );

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(
          filePath
        );
      }
    } catch {
      // Ignorar errores al borrar.
    }
  }

  static getLocalPath(
    id: string
  ): string {
    return `${this.getSongsDir()}${id}.txt`;
  }

  // ============================================================
  // BAND MODE
  // ============================================================

  private static getBandsDir() {
    const baseDir =
      FileSystem.documentDirectory ||
      FileSystem.cacheDirectory ||
      '';

    return `${baseDir}bands/`;
  }

  private static getBandSongsDir(
    bandId: string
  ) {
    return `${this.getBandsDir()}${bandId}/`;
  }

  static async ensureBandDirExists(
    bandId: string
  ) {
    const dir =
      this.getBandSongsDir(
        bandId
      );

    const dirInfo =
      await FileSystem.getInfoAsync(
        dir
      );

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        dir,
        {
          intermediates: true,
        }
      );
    }
  }

  static async saveBandSongContent(
    bandId: string,
    songId: string,
    content: string
  ): Promise<string> {
    await this.ensureBandDirExists(
      bandId
    );

    const filePath =
      `${this.getBandSongsDir(
        bandId
      )}${songId}.txt`;

    await FileSystem.writeAsStringAsync(
      filePath,
      content,
      {
        encoding:
          FileSystem.EncodingType.UTF8,
      }
    );

    return filePath;
  }

  static async getBandSongContent(
    bandId: string,
    songId: string
  ): Promise<string | null> {
    const filePath =
      this.getBandSongLocalPath(
        bandId,
        songId
      );

    try {
      const fileInfo =
        await FileSystem.getInfoAsync(
          filePath
        );

      if (!fileInfo.exists) {
        return null;
      }

      return await FileSystem.readAsStringAsync(
        filePath
      );
    } catch {
      return null;
    }
  }

  /**
   * Indica si una canción de banda
   * ya está almacenada localmente.
   */
  static async bandSongExists(
    bandId: string,
    songId: string
  ): Promise<boolean> {
    const filePath =
      this.getBandSongLocalPath(
        bandId,
        songId
      );

    try {
      const fileInfo =
        await FileSystem.getInfoAsync(
          filePath
        );

      return fileInfo.exists;
    } catch {
      return false;
    }
  }

  static async deleteBandSongFile(
    bandId: string,
    songId: string
  ) {
    const filePath =
      this.getBandSongLocalPath(
        bandId,
        songId
      );

    try {
      const fileInfo =
        await FileSystem.getInfoAsync(
          filePath
        );

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(
          filePath
        );
      }
    } catch {
      // Ignorar errores al borrar.
    }
  }

  static getBandSongLocalPath(
    bandId: string,
    songId: string
  ): string {
    return `${this.getBandSongsDir(
      bandId
    )}${songId}.txt`;
  }
}