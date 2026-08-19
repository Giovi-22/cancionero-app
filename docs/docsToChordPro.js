const fs = require('fs');

// ==== 1. FUNCIÓN CONVERSORA (Lógica principal adaptada a JavaScript) ====
function convertGoogleDocToChordPro(contentArray) {
    const lines = [];

    // Extraer todas las líneas del JSON
    for (const item of contentArray) {
        if (item.paragraph && item.paragraph.elements) {
            let paragraphText = "";
            for (const element of item.paragraph.elements) {
                if (element.textRun && element.textRun.content) {
                    paragraphText += element.textRun.content;
                }
            }

            const subLines = paragraphText.replace(/\r/g, "").split("\n");
            if (subLines.length > 1 && subLines[subLines.length - 1] === "") {
                subLines.pop();
            }
            lines.push(...subLines);
        }
    }

    const chordProResult = [];
    let i = 0;

    while (i < lines.length) {
        const currentLine = lines[i];

        if (isChordLine(currentLine)) {
            const nextLine = lines[i + 1];

            if (nextLine !== undefined && !isChordLine(nextLine)) {
                const mergedLine = mergeChordsAndLyrics(currentLine, nextLine);
                chordProResult.push(mergedLine);
                i += 2; // Saltamos ambas líneas procesadas juntas
            } else {
                chordProResult.push(formatStandaloneChordLine(currentLine));
                i++;
            }
        } else {
            chordProResult.push(currentLine);
            i++;
        }
    }

    return chordProResult.join("\n");
}

function isChordLine(line) {
    if (!line || line.trim() === "") return false;
    if (/^(intro|tono|bpm|compás|verso|coro|puente)/i.test(line.trim())) {
        return false;
    }
    const chordRegex = /^[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*(\/[A-G][#b]?)?$/;
    const tokens = line.split(/[\s\-]+/);
    let validTokens = 0;
    for (const token of tokens) {
        if (token === "") continue;
        if (!chordRegex.test(token)) return false;
        validTokens++;
    }
    return validTokens > 0;
}

function mergeChordsAndLyrics(chordLine, lyricLine) {
    const regex = /[^\s\-]+/g;
    let match;
    const chordsToInsert = [];

    while ((match = regex.exec(chordLine)) !== null) {
        chordsToInsert.push({
            index: match.index,
            chord: match[0]
        });
    }

    // Ordenar de atrás hacia adelante para no romper los índices al insertar caracteres
    chordsToInsert.sort((a, b) => b.index - a.index);

    let result = lyricLine;
    for (const item of chordsToInsert) {
        const chordFormatted = `[${item.chord}]`;
        if (item.index <= result.length) {
            result = result.slice(0, item.index) + chordFormatted + result.slice(item.index);
        } else {
            result = result + " " + chordFormatted;
        }
    }
    return result;
}

function formatStandaloneChordLine(line) {
    return line.replace(/[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*(\/[A-G][#b]?)?/g, "[$&]");
}

// ==== 2. SCRIPT DE PRUEBA (Lectura y Escritura de Archivos) ====
try {
    console.log("Leyendo archivo cancion.json...");
    const rawData = fs.readFileSync('cancion.json', 'utf8');
    const docJson = JSON.parse(rawData);

    // Accedemos al array interno de contenido tal como viene en la API de Google Docs
    const contentArray = docJson.body.content;

    console.log("Transformando a formato ChordPro...");
    const resultadoChordPro = convertGoogleDocToChordPro(contentArray);

    // Guardar el resultado en un bloc de notas
    fs.writeFileSync('cancion_chordpro.txt', resultadoChordPro, 'utf8');
    console.log("¡Listo! El archivo convertido se guardó como 'cancion_chordpro.txt'");

    // Mostrar una vista previa corta en la terminal
    console.log("\n--- VISTA PREVIA DEL RESULTADO ---");
    console.log(resultadoChordPro);
    console.log("----------------------------------");

} catch (error) {
    console.error("Hubo un error al procesar el archivo:", error.message);
}
