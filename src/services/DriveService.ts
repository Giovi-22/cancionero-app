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
        const chordPro = this.convertGoogleDocJsonToChordPro(docJson);
        if (chordPro && chordPro.trim().length > 0) {
          console.log('[DriveService] Google Doc convertido a ChordPro via Docs API v1 (detección por color).');
          return legacyToChordPro(chordPro, songName);
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

  /**
   * Determina si un color RGB es "azul" (usado para identificar acordes en el doc).
   * Los acordes suelen tener un tono azul dominante.
   */
  private isBlueColor(rgb: any): boolean {
    if (!rgb) return false;
    const r = rgb.red || 0;
    const g = rgb.green || 0;
    const b = rgb.blue || 0;
    // Azul dominante, significativamente mayor que el rojo
    return b > 0.3 && b > r * 1.5 && b >= g * 0.7;
  }

  /**
   * Determina si un color es "no negro / no predeterminado"
   * (usado para detectar posibles colores de sección como naranja, rojo, etc.)
   */
  private isColoredText(rgb: any): boolean {
    if (!rgb) return false;
    const r = rgb.red || 0;
    const g = rgb.green || 0;
    const b = rgb.blue || 0;
    // Texto predeterminado (negro) o blanco tiene todos los canales similares y bajos/altos
    const isBlackish = r < 0.2 && g < 0.2 && b < 0.2;
    const isWhitish = r > 0.8 && g > 0.8 && b > 0.8;
    return !isBlackish && !isWhitish;
  }

  /**
   * Fusiona una línea de acordes (posición por columna) con una línea de letra,
   * insertando cada acorde en su índice de caracter correspondiente.
   */
  private mergeChordAndLyric(chordLine: string, lyricLine: string): string {
    const chordRegex = /\S+/g;
    let match;
    const chords: { chord: string; index: number }[] = [];
    while ((match = chordRegex.exec(chordLine)) !== null) {
      chords.push({ chord: match[0], index: match.index });
    }
    if (chords.length === 0) return lyricLine;

    chords.sort((a, b) => b.index - a.index);
    let result = lyricLine;
    for (const c of chords) {
      if (c.index > result.length) {
        result = result + ' '.repeat(c.index - result.length);
      }
      let insertAt = c.index;
      // Si el índice cae en medio de una palabra, retroceder al inicio de la palabra
      if (insertAt < result.length && result[insertAt] !== ' ') {
        while (insertAt > 0 && result[insertAt - 1] !== ' ') insertAt--;
      }
      result = result.substring(0, insertAt) + `[${c.chord}]` + result.substring(insertAt);
    }
    return result;
  }

  /**
   * Formatea una línea de acordes sin letra (sola) como ChordPro.
   */
  private formatChordsOnly(chordLine: string): string {
    return chordLine.replace(/\S+/g, (token) => `[${token}]`);
  }

  /**
   * Convierte una línea de metadatos (Intro, Tono, BPM...) envolviendo
   * en corchetes únicamente los tokens que son acordes válidos.
   */
  private convertMetadataLine(line: string): string {
    // Regex básico de acorde
    const chordRe = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|\d)*(\/[A-G][b#]?)?$/i;
    return line.replace(/\S+/g, (token) => {
      if (token.includes(':') || /^[xX]\d+$/.test(token)) return token;
      if (chordRe.test(token)) return `[${token}]`;
      return token;
    });
  }

  /**
   * Convierte el JSON de la Google Docs API v1 directamente a formato ChordPro
   * usando información de COLOR de cada textRun para identificar:
   *   - Acordes    → texto AZUL
   *   - Secciones  → texto AZUL que empieza con '['
   *   - Letra      → texto negro / sin color especial
   *   - Metadatos  → líneas con label como "Tono:", "BPM:", etc.
   */
  private convertGoogleDocJsonToChordPro(docJson: any): string {
    if (!docJson?.body?.content) return '';

    type ParaType = 'chord-line' | 'lyric' | 'section' | 'metadata' | 'mixed' | 'empty';
    const paragraphs: Array<{ type: ParaType; rawText: string; chordProLine: string }> = [];

    const METADATA_RE = /^(Intro|Solo|Outro|Puente|Bridge|Instrumental|Tono|BPM|Comp[áa]s|NOTA|Note|Final|Interludio|Key|Tempo|Capo):/i;

    for (const structElem of docJson.body.content) {
      if (!structElem.paragraph?.elements) continue;

      const runs: Array<{ text: string; isBlue: boolean }> = [];
      let hasBlue = false;
      let hasNonBlue = false;

      for (const elem of structElem.paragraph.elements) {
        const content = (elem.textRun?.content || '').replace(/\n$/, '');
        if (!content) continue;
        const rgb = elem.textRun?.textStyle?.foregroundColor?.color?.rgbColor;
        const blue = this.isBlueColor(rgb);
        runs.push({ text: content, isBlue: blue });
        if (blue && content.trim()) hasBlue = true;
        else if (!blue && content.trim()) hasNonBlue = true;
      }

      const rawText = runs.map(r => r.text).join('');
      if (!rawText.trim()) {
        paragraphs.push({ type: 'empty', rawText: '', chordProLine: '' });
        continue;
      }

      const trimmed = rawText.trim();

      if (hasBlue && !hasNonBlue) {
        // Todo azul: sección o línea de acordes pura
        if (trimmed.startsWith('[')) {
          // Sección: [VERSO 1], [CORO], [FINAL] X2, etc.
          paragraphs.push({ type: 'section', rawText, chordProLine: trimmed });
        } else {
          // Línea de acordes pura: se va a fusionar con la letra siguiente
          paragraphs.push({ type: 'chord-line', rawText, chordProLine: '' });
        }
      } else if (hasBlue && hasNonBlue) {
        // Mixta: acordes inline dentro de la misma línea de letra
        let line = '';
        for (const run of runs) {
          if (run.isBlue) {
            // Cada token azul es un acorde
            const tokens = run.text.trim().split(/\s+/).filter(Boolean);
            line += tokens.map(t => `[${t}]`).join('');
          } else {
            line += run.text;
          }
        }
        paragraphs.push({ type: 'mixed', rawText, chordProLine: line.trimEnd() });
      } else {
        // Sin azul: metadato o letra
        if (METADATA_RE.test(trimmed)) {
          paragraphs.push({ type: 'metadata', rawText, chordProLine: '' });
        } else {
          paragraphs.push({ type: 'lyric', rawText, chordProLine: '' });
        }
      }
    }

    // --- Fase 2: Construir el ChordPro fusionando chord-lines con lyrics ---
    const result: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];

      if (para.type === 'empty') {
        result.push('');
        continue;
      }

      if (para.type === 'section') {
        if (result.length > 0 && result[result.length - 1] !== '') result.push('');
        result.push(para.chordProLine);
        continue;
      }

      if (para.type === 'mixed') {
        result.push(para.chordProLine);
        continue;
      }

      if (para.type === 'metadata') {
        result.push(this.convertMetadataLine(para.rawText));
        continue;
      }

      if (para.type === 'chord-line') {
        // Buscar la siguiente línea de letra (salteando vacías)
        let j = i + 1;
        while (j < paragraphs.length && paragraphs[j].type === 'empty') j++;

        if (j < paragraphs.length && paragraphs[j].type === 'lyric') {
          result.push(this.mergeChordAndLyric(para.rawText, paragraphs[j].rawText));
          i = j;
        } else {
          // Acorde sin letra
          result.push(this.formatChordsOnly(para.rawText));
        }
        continue;
      }

      // Lyric plain
      if (para.type === 'lyric') {
        result.push(para.rawText);
      }
    }

    // Limpiar líneas vacías excesivas y retornar
    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
}

export const driveService = new DriveService();
