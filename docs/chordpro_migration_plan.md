# Migración Completa del Sistema de Canciones a ChordPro

## Objetivo

Migrar toda la arquitectura interna de manejo de canciones al formato ChordPro.

A partir de esta migración:
- Google Docs seguirá siendo el origen de las canciones.
- El texto original legacy se convertirá automáticamente a ChordPro al importar.
- Toda la aplicación trabajará únicamente con ChordPro internamente.
- Las canciones se almacenarán localmente y en base de datos en formato ChordPro.
- El renderer, transposición, exportación PDF y demás herramientas usarán ChordPro como fuente de verdad.

---

## Problema Actual y Solución

Actualmente el sistema depende de alineación visual usando fuentes monospace, pestañas (tabs) y espacios. Esto genera problemas cuando Google Docs o el render responsive alteran el espaciado.

**Solución con ChordPro:** Al anclar semánticamente los acordes al texto (`[G]Bendice [C]Alma`), la alineación visual deja de ser relevante para el almacenamiento y la transferencia. El renderizado y la transposición se vuelven mucho más predecibles y sencillos.

### Flujo de Datos Propuesto
```text
Google Docs
    ↓
Texto legacy (acordes arriba)
    ↓
Conversor Legacy → ChordPro (sync time)
    ↓
ChordPro (guardado en .txt local)
    ↓
Parser ChordPro (render/memo time)
    ↓
Estructura SongBlocks (SongLineParsed[])
    ↓
Renderer React Native (SongViewer.tsx) / PdfService.ts
```

---

## Decisiones Técnicas y Casos de Borde

### 1. Colisión de Corchetes (`[VERSO 1]` vs `[C]`)
En la aplicación actual, las secciones de la canción se delimitan usando corchetes en líneas dedicadas (ej: `[VERSO 1]`, `[CORO]`). En ChordPro, los acordes también van en corchetes.
- **Solución:** Implementar un validador que compruebe si el contenido de los corchetes es un acorde válido (ej. `C`, `F#m7b5/A`, `G/B`). Si no lo es, y ocupa una línea completa, se parseará como una sección. También se dará soporte a directivas ChordPro estándar de comentarios como `{comment: Coro}` o `{c: Coro}` mapeándolos a secciones de la interfaz.

### 2. Acordes sin Letra o al Final de la Línea (`[C]Hola [G]`)
Si un acorde se ubica al final de la línea o no tiene letra asociada debajo, el parser debe evitar que la estructura colapse en el renderizado de React Native.
- **Solución:** El parser forzará un espacio en blanco (`' '`) como contenido del bloque si el texto asociado está vacío. Esto asegura que el layout de React Native mantenga el ancho mínimo para dibujar el acorde sin superposiciones.

### 3. Reutilización del Algoritmo de Alineación Existente
Para la conversión de canciones legacy a ChordPro, utilizaremos la función `parseSongToBlocks` existente. Como ya alinea correctamente los acordes y el texto en objetos `{ chord, text }`, la conversión se reduce a unir los bloques serializándolos como `[chord]text`. Esto garantiza un 100% de consistencia con las importaciones previas.

---

## Especificación de Código de Utilidades

### 1. Parser y Transpositor: `src/utils/chordpro.ts`

```typescript
import { SongLineParsed, SongBlock } from '../types';
import { transposeChord } from './chordUtils';

/**
 * Valida si un string dentro de corchetes representa un acorde musical.
 */
export function isSingleChord(token: string): boolean {
  const chordRegex = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|v|i|[0-9]|sus|add|dim|aug|maj|min)*\d*(?:[b#+-]\d+)?(?:\([^)]+\))?(?:\/[A-G][b#]?)?$/i;
  return chordRegex.test(token.trim());
}

/**
 * Parsea un texto ChordPro a la estructura de bloques que consume la interfaz de la aplicación.
 */
export function parseChordPro(text: string): SongLineParsed[] {
  const lines = text.split('\n');
  const result: SongLineParsed[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      result.push({
        type: 'text',
        blocks: [{ text: '' }]
      });
      continue;
    }

    // 1. Detectar cabecera de sección legacy: [CORO], [VERSO 1]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inside = trimmed.slice(1, -1).trim();
      if (!isSingleChord(inside)) {
        result.push({
          type: 'section',
          blocks: [{ text: line.trim() }]
        });
        continue;
      }
    }

    // 2. Detectar directivas estándar de ChordPro ({comment: Coro} o {c: Coro})
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inside = trimmed.slice(1, -1).trim();
      const colonIdx = inside.indexOf(':');
      if (colonIdx !== -1) {
        const key = inside.slice(0, colonIdx).trim().toLowerCase();
        const value = inside.slice(colonIdx + 1).trim();
        
        if (key === 'comment' || key === 'c') {
          result.push({
            type: 'section',
            blocks: [{ text: `[${value.toUpperCase()}]` }]
          });
          continue;
        }
      }
    }

    // 3. Parsear acordes y letras incrustados: "Hola [C]mundo [G]"
    const blocks: SongBlock[] = [];
    const chordRegex = /\[([^\]]+)\]/g;
    let match;
    const matches: { chord: string; index: number; length: number }[] = [];

    while ((match = chordRegex.exec(line)) !== null) {
      matches.push({
        chord: match[1],
        index: match.index,
        length: match[0].length
      });
    }

    // Si no contiene acordes en corchetes, es texto plano
    if (matches.length === 0) {
      result.push({
        type: 'text',
        blocks: [{ text: line }]
      });
      continue;
    }

    // Agregar texto plano inicial si existe antes del primer acorde
    if (matches[0].index > 0) {
      blocks.push({
        text: line.substring(0, matches[0].index)
      });
    }

    // Procesar cada acorde y el texto que lo acompaña
    for (let j = 0; j < matches.length; j++) {
      const current = matches[j];
      const startOfText = current.index + current.length;
      const endOfText = (j + 1 < matches.length) ? matches[j + 1].index : line.length;
      
      const blockText = line.substring(startOfText, endOfText);
      blocks.push({
        chord: current.chord,
        // Espacio preventivo para que no colapse visualmente el rendering si está vacío
        text: blockText || ' ' 
      });
    }

    result.push({
      type: 'chords-lyrics',
      blocks
    });
  }

  return result;
}

/**
 * Transpone todos los acordes en una cadena en formato ChordPro.
 */
export function transposeChordPro(chordProText: string, semitones: number): string {
  if (semitones === 0) return chordProText;

  return chordProText.replace(/\[([^\]]+)\]/g, (match, chord) => {
    if (isSingleChord(chord)) {
      return `[${transposeChord(chord, semitones)}]`;
    }
    return match;
  });
}
```

### 2. Conversor: `src/utils/legacyToChordPro.ts`

```typescript
import { cleanSongText, parseSongToBlocks } from './chordUtils';

/**
 * Convierte texto legacy (acordes en línea superior) a ChordPro semántico.
 * Si el texto ya tiene formato ChordPro, lo devuelve sin alteraciones.
 */
export function legacyToChordPro(legacyText: string): string {
  // Evitar doble conversión si ya tiene formato ChordPro básico
  if (/\[[A-G][b#]?[^\]]*\]/.test(legacyText)) {
    return legacyText;
  }

  const cleaned = cleanSongText(legacyText);
  const parsedLines = parseSongToBlocks(cleaned);

  return parsedLines.map(line => {
    if (line.type === 'chords-lyrics') {
      return line.blocks.map(block => {
        if (block.chord) {
          return `[${block.chord}]${block.text}`;
        }
        return block.text;
      }).join('');
    } else if (line.type === 'section') {
      return line.blocks[0]?.text || '';
    } else {
      return line.blocks[0]?.text || '';
    }
  }).join('\n');
}
```

---

## Plan de Integración en el Proyecto

### Paso 1: Crear las Utilidades
1. Escribir `src/utils/chordpro.ts` con el parser y transpositor.
2. Escribir `src/utils/legacyToChordPro.ts` con el convertidor legacy.

### Paso 2: Integración en la Descarga e Importación
1. Modificar `SyncService.ts` en `downloadAndStoreSong` para que antes de persistir el contenido mediante `FileSystemService.saveSongContent`, procese el texto de Google Docs usando `legacyToChordPro(content)`.

### Paso 3: Integración en el Visor
1. Modificar `SongViewer.tsx` para que su `useMemo` de procesamiento use `transposeChordPro` and `parseChordPro`:
   ```typescript
   const parsedLines = useMemo(() => {
     const contentWithoutFooter = content.replace(new RegExp(FOOTER_TEXT, 'gi'), '');
     // Transponemos directamente sobre el string ChordPro
     const transposed = transposeChordPro(contentWithoutFooter, transpose - capo);
     // Parsea a bloques el string transpuesto
     return parseChordPro(transposed);
   }, [content, transpose, capo]);
   ```

### Paso 4: Migración de Datos Locales
1. Implementar una función de migración local en el inicio de la app (ej. en `StorageService.init` o un hook inicial) que:
   - Liste las canciones guardadas localmente.
   - Lee cada archivo, lo convierte usando `legacyToChordPro` y lo guarda de nuevo.
   - Esto evita forzar al usuario a sincronizar todo de nuevo desde cero tras actualizar la versión.
