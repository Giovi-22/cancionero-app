// src/utils/chordpro/ChordProConverter.ts

/**
 * Convierte el contenido estructurado de Google Docs API
 * directamente a formato ChordPro.
 *
 * Este conversor es independiente de Google Drive y de la UI.
 */

export function convertGoogleDocToChordPro(contentArray: any[]): string {
  const lines: string[] = [];

  // ============================================================
  // EXTRAER TODAS LAS LÍNEAS DEL DOCUMENTO
  // ============================================================

  for (let i = 0; i < contentArray.length; i++) {
    const item = contentArray[i];

    if (item.paragraph?.elements) {
      let paragraphText = "";

      for (let j = 0; j < item.paragraph.elements.length; j++) {
        const element = item.paragraph.elements[j];

        if (element.textRun?.content) {
          paragraphText += element.textRun.content;
        }
      }

      const subLines = paragraphText
        .replace(/\r/g, "")
        .split("\n");

      if (
        subLines.length > 1 &&
        subLines[subLines.length - 1] === ""
      ) {
        subLines.pop();
      }

      lines.push(...subLines);
    }
  }

  // ============================================================
  // VARIABLES
  // ============================================================

  const metadataHeaders: string[] = [];
  const chordProResult: string[] = [];

  let i = 0;

  let currentBlock: string | null = null;

  // ============================================================
  // BLOQUES
  // ============================================================

  function closeCurrentBlock(): void {
    if (!currentBlock) return;

    chordProResult.push(
      `{end_of_${currentBlock}}`
    );

    currentBlock = null;
  }

  function openBlock(
    blockName: string,
    label?: string
  ): void {

    if (currentBlock) {
      closeCurrentBlock();
    }

    if (label) {
      chordProResult.push(
        `{start_of_${blockName}: ${label}}`
      );
    } else {
      chordProResult.push(
        `{start_of_${blockName}}`
      );
    }

    currentBlock = blockName;
  }

  // ============================================================
  // PROCESAR LÍNEAS
  // ============================================================

  while (i < lines.length) {

    const currentLine = lines[i];
    const trimmed = currentLine.trim();

    // ==========================================================
    // TÍTULO
    // ==========================================================

    if (
      i === 0 ||
      (
        i === 1 &&
        lines[0].trim() === "" &&
        trimmed !== "" &&
        !trimmed.includes(":")
      )
    ) {

      metadataHeaders.push(
        `{title: ${trimmed}}`
      );

      i++;
      continue;
    }

    // ==========================================================
    // INTRO: ...
    // ==========================================================

    if (/^Intro:/i.test(trimmed)) {

      let introContent =
        trimmed.replace(/^Intro:\s*/i, "");

      introContent =
        introContent.replace(
          /[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*7?(\/[A-G][#b]?)?/g,
          "[$&]"
        );

      metadataHeaders.push(
        `{comment: Intro: ${introContent}}`
      );

      i++;
      continue;
    }

    // ==========================================================
    // TONO
    // ==========================================================

    if (/^Tono:/i.test(trimmed)) {

      metadataHeaders.push(
        `{key: ${trimmed.replace(/^Tono:\s*/i, "")}}`
      );

      i++;
      continue;
    }

    // ==========================================================
    // BPM
    // ==========================================================

    if (/^BPM:/i.test(trimmed)) {

      metadataHeaders.push(
        `{tempo: ${trimmed.replace(/^BPM:\s*/i, "")}}`
      );

      i++;
      continue;
    }

    // ==========================================================
    // COMPÁS
    // ==========================================================

    if (/^Compás:/i.test(trimmed)) {

      metadataHeaders.push(
        `{time: ${trimmed.replace(/^Compás:\s*/i, "")}}`
      );

      i++;
      continue;
    }

    // ==========================================================
    // NOTA
    // ==========================================================

    if (/^NOTA:/i.test(trimmed)) {

      const notaVal =
        trimmed.replace(/^NOTA:\s*/i, "");

      if (
        notaVal &&
        notaVal !== "-"
      ) {
        metadataHeaders.push(
          `{comment: Nota: ${notaVal}}`
        );
      }

      i++;
      continue;
    }

    // ==========================================================
    // VERSO
    // ==========================================================

    const matchVerso =
      trimmed.match(
        /^\[VERSO(?:\s+(\d+))?\]$/i
      );

    if (matchVerso) {

      const numero = matchVerso[1];

      if (numero) {
        openBlock(
          "verse",
          `VERSO ${numero}`
        );
      } else {
        openBlock(
          "verse",
          "VERSO"
        );
      }

      i++;
      continue;
    }

    // ==========================================================
    // CORO
    // ==========================================================

    if (/^\[CORO\]$/i.test(trimmed)) {

      openBlock("chorus");

      i++;
      continue;
    }

    // ==========================================================
    // PUENTE
    // ==========================================================

    if (/^\[PUENTE\]$/i.test(trimmed)) {

      openBlock("bridge");

      i++;
      continue;
    }

    // ==========================================================
    // INTERLUDIO
    // ==========================================================

    if (/^\[INTERLUDIO\]$/i.test(trimmed)) {

      openBlock("interlude");

      i++;
      continue;
    }

    // ==========================================================
    // INTRO
    // ==========================================================

    if (/^\[INTRO\]$/i.test(trimmed)) {

      openBlock("intro");

      i++;
      continue;
    }

    // ==========================================================
    // OUTRO
    // ==========================================================

    if (/^\[OUTRO\]$/i.test(trimmed)) {

      openBlock("outro");

      i++;
      continue;
    }

    // ==========================================================
    // FINAL
    // ==========================================================

    if (/^\[FINAL\]$/i.test(trimmed)) {

      openBlock(
        "outro",
        "FINAL"
      );

      i++;
      continue;
    }

    // ==========================================================
    // PRE-CORO
    // ==========================================================

    if (
      /^\[PRE[\s-]?CORO\]$/i.test(trimmed)
    ) {

      openBlock("pre_chorus");

      i++;
      continue;
    }

    // ==========================================================
    // TAB
    // ==========================================================

    if (/^\[TAB\]$/i.test(trimmed)) {

      openBlock("tab");

      i++;
      continue;
    }

    // ==========================================================
    // GRID
    // ==========================================================

    if (/^\[GRID\]$/i.test(trimmed)) {

      openBlock("grid");

      i++;
      continue;
    }

    // ==========================================================
    // FIN
    // ==========================================================

    if (/^\[FIN\]$/i.test(trimmed)) {

      closeCurrentBlock();

      i++;
      continue;
    }

    // ==========================================================
    // LÍNEA DE ACORDES
    // ==========================================================

    if (isChordLine(currentLine)) {

      const nextLine = lines[i + 1];

      let puedeFusionarse = false;

      if (
        nextLine !== undefined &&
        nextLine.trim() !== "" &&
        !isChordLine(nextLine)
      ) {

        const nextTrimmed =
          nextLine.trim();

        const esDirectiva =
          /^[\[\{]/.test(nextTrimmed);

        if (!esDirectiva) {
          puedeFusionarse = true;
        }
      }

      // --------------------------------------------------------
      // ACORDES + LETRA
      // --------------------------------------------------------

      if (puedeFusionarse) {

        const mergedLine =
          mergeChordsAndLyrics(
            currentLine,
            nextLine
          );

        chordProResult.push(
          mergedLine
        );

        i += 2;
        continue;
      }

      // --------------------------------------------------------
      // LÍNEA DE ACORDES SOLA
      // --------------------------------------------------------

      chordProResult.push(
        formatStandaloneChordLine(
          currentLine
        )
      );

      i++;
      continue;
    }

    // ==========================================================
    // LÍNEA NORMAL
    // ==========================================================

    if (trimmed !== "") {
      chordProResult.push(
        currentLine
      );
    }

    i++;
  }

  // ============================================================
  // CERRAR ÚLTIMO BLOQUE
  // ============================================================

  if (currentBlock) {
    closeCurrentBlock();
  }

  // ============================================================
  // RESULTADO
  // ============================================================

  return (
    metadataHeaders.join("\n") +
    "\n\n" +
    chordProResult.join("\n")
  );
}


// ================================================================
// DETECTAR LÍNEA DE ACORDES
// ================================================================

export function isChordLine(line: string): boolean {

  if (!line || line.trim() === "") {
    return false;
  }

  const trimmed = line.trim();

  // No considerar metadatos como líneas de acordes
  if (
    /^(intro|tono|bpm|compás|verso|coro|puente|interludio|outro|final|pre[\s-]?coro|nota)/i
      .test(trimmed)
  ) {
    return false;
  }

  const chordRegex =
    /^[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*7?(\/[A-G][#b]?)?$/;

  const tokens =
    trimmed.split(/\s+/);

  let validTokens = 0;

  for (const token of tokens) {

    // Guiones son separadores
    if (/^-+$/.test(token)) {
      continue;
    }

    if (!chordRegex.test(token)) {
      return false;
    }

    validTokens++;
  }

  return validTokens > 0;
}


// ================================================================
// FUSIONAR ACORDES + LETRA
// ================================================================

export function mergeChordsAndLyrics(
  chordLine: string,
  lyricLine: string
): string {

  const regex = /[^\s\-]+/g;

  let match: RegExpExecArray | null;

  const chordsToInsert: {
    index: number;
    chord: string;
  }[] = [];

  while ((match = regex.exec(chordLine)) !== null) {

    chordsToInsert.push({
      index: match.index,
      chord: match[0]
    });
  }

  // Insertar desde atrás hacia adelante
  chordsToInsert.sort(
    (a, b) => b.index - a.index
  );

  let result = lyricLine;

  for (const item of chordsToInsert) {

    const chordFormatted =
      `[${item.chord}]`;

    if (item.index <= result.length) {

      result =
        result.slice(0, item.index) +
        chordFormatted +
        result.slice(item.index);

    } else {

      result =
        result +
        " " +
        chordFormatted;
    }
  }

  return result;
}


// ================================================================
// FORMATEAR LÍNEA DE ACORDES SOLA
// ================================================================

export function formatStandaloneChordLine(
  line: string
): string {

  const chordRegex =
    /[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*7?(\/[A-G][#b]?)?/g;

  return line.replace(
    chordRegex,
    match => `[${match}]`
  );
}