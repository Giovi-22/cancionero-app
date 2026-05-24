import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';


export class PdfService {
  /**
   * Generates a beautifully formatted PDF for a song and opens the native sharing dialog.
   */
  static async generateAndShare(
    title: string,
    parsedLines: any[],
    viewMode: 'all' | 'lyrics',
    transpose: number,
    capo: number,
    bpm?: number
  ): Promise<void> {
    try {
      // 1. Generate the custom Google Docs HTML
      const htmlContent = this.generateHtml(title, parsedLines, viewMode, transpose, capo, bpm);

      // 2. Print HTML to a temporary PDF file
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // 3. Share the PDF natively
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Compartir canción: ${title}`,
        UTI: 'com.adobe.pdf', // iOS standard document type identifier
      });
    } catch (error) {
      console.error('Error generating/sharing PDF:', error);
      throw new Error('No se pudo generar o compartir el PDF. Intenta nuevamente.');
    }
  }

  /**
   * Generates the beautiful, Google Docs-like HTML template with custom styles and fonts.
   */
  private static generateHtml(
    title: string,
    parsedLines: any[],
    viewMode: 'all' | 'lyrics',
    transpose: number,
    capo: number,
    bpm?: number
  ): string {
    const showChords = viewMode === 'all';
    
    // Construct the metadata rows
    const keyStr = transpose > 0 ? `+${transpose}` : transpose.toString();
    const capoText = capo > 0 ? `Traste ${capo}` : 'Sin Capo';
    const bpmText = bpm ? `${bpm} BPM` : 'N/D';

    // Parse the lines into HTML blocks
    const linesHtml = parsedLines
      .map((line, lIndex) => {
        const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
        
        if (isTitle) {
          // Title was already printed in the header, skip it here
          return '';
        }

        if (line.type === 'section') {
          // Render section headers (e.g. [CORO], [ESTROFA])
          const sectionText = line.blocks[0]?.text.replace(/[\[\]]/g, '').trim();
          return `
            <div class="line-wrapper section-header">
              <h3>${sectionText}</h3>
            </div>
          `;
        }

        // Render standard lines
        return `
          <div class="line-wrapper type-${line.type} ${line.isMetadata ? 'metadata-line' : ''}">
            <div class="blocks-container">
              ${line.blocks
                .map((block: { chord?: string; text: string }) => {
                  const hasChord = block.chord && showChords;
                  const chordHtml = hasChord 
                    ? `<span class="chord">${this.escapeHtml(block.chord!)}</span>` 
                    : '';
                  const textHtml = `<span class="lyric">${this.escapeHtml(block.text || ' ')}</span>`;
                  
                  return `
                    <div class="block">
                      ${chordHtml}
                      ${textHtml}
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(title)}</title>
        <!-- Load elegant Google Fonts -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
        
        <style>
          /* CSS Reset & Google Docs Page Layout */
          @page {
            size: A4;
            margin: 1.2in 1in 1.2in 1in; /* Standard premium margins */
          }
          
          body {
            font-family: 'Inter', sans-serif;
            color: #1a1a1a; /* Elegant soft black */
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Clean Google Docs Title Styling */
          .doc-header {
            text-align: center;
            margin-bottom: 25px;
            page-break-inside: avoid;
          }

          h1.doc-title {
            font-family: 'Inter', sans-serif;
            font-size: 26px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 12px 0;
            letter-spacing: -0.5px;
          }

          /* Modern Metadata Grid (Google Docs Table-like) */
          .metadata-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            max-width: 480px;
            margin: 0 auto 20px auto;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 15px;
          }

          .meta-item {
            text-align: center;
          }

          .meta-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            color: #6b7280;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }

          .meta-value {
            font-size: 13px;
            font-weight: 600;
            color: #374151;
          }

          .header-line {
            border: 0;
            height: 1px;
            background-color: #e5e7eb;
            margin: 0 0 25px 0;
          }

          /* Song lines layout */
          .line-wrapper {
            margin-bottom: 6px;
            page-break-inside: avoid;
          }

          /* Section titles styled elegantly */
          .section-header {
            margin-top: 18px;
            margin-bottom: 8px;
            border-bottom: 1px solid #f3f4f6;
            padding-bottom: 4px;
          }

          .section-header h3 {
            font-size: 12px;
            font-weight: 700;
            color: #b45309; /* Elegant warm orange/amber for sections */
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0;
          }

          .blocks-container {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
          }

          .block {
            display: flex;
            flex-direction: column;
            min-width: 4px;
          }

          /* Chords typography and color */
          .chord {
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
            font-size: 12px;
            font-weight: 700;
            color: #1d4ed8; /* Premium deep sapphire blue */
            line-height: 14px;
            margin-bottom: 1px;
            white-space: pre;
          }

          /* Lyrics typography */
          .lyric {
            font-family: 'Inter', sans-serif;
            font-size: 14.5px;
            color: #2b2b2b;
            line-height: 22px;
            white-space: pre-wrap;
          }

          /* Metadata line style (like Intro/Puente when they are single rows) */
          .metadata-line .chord {
            color: #1e40af;
          }
          
          .metadata-line .lyric {
            font-weight: 600;
            color: #4b5563;
          }

          /* Google Docs Running Footer Style */
          .doc-footer {
            position: fixed;
            bottom: -0.6in;
            left: 0;
            right: 0;
            height: 25px;
            border-top: 1px solid #f3f4f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #9ca3af;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
          }

          .footer-right {
            text-align: right;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="doc-header">
          <h1 class="doc-title">${this.escapeHtml(title)}</h1>
          
          <!-- Metadatos de la canción -->
          <div class="metadata-grid">
            <div class="meta-item">
              <div class="meta-label">Tono</div>
              <div class="meta-value">${keyStr}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Capo</div>
              <div class="meta-value">${capoText}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">BPM</div>
              <div class="meta-value">${bpmText}</div>
            </div>
          </div>
          <hr class="header-line">
        </div>

        <!-- Song Content -->
        <div class="doc-content">
          ${linesHtml}
        </div>

        <!-- Google Docs Running Footer -->
        <div class="doc-footer">
          <div>Ministerio de Alabanza ICBS</div>
          <div class="footer-right">Generado por Cancionero App</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Helper to escape HTML characters safely.
   */
  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
