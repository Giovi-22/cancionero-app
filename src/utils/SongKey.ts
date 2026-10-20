/**
 * Clave que identifica "esta canción, con este contenido" ante el ESP32.
 *
 * Dos dispositivos se sincronizan entre sí solo si tienen la misma clave.
 * Incluye un hash del contenido ORIGINAL (sin transponer), así:
 *  - transponer o cambiar el tono no cambia la clave (las líneas son las mismas),
 *  - dos músicos con versiones distintas de la letra NO se mezclan, porque sus
 *    posiciones en líneas no significarían lo mismo.
 *
 * Es una cadena sin espacios y de menos de 40 caracteres (límite del firmware).
 */
export const makeSongKey = (songId: string, content: string): string => {
    const normalized = (content ?? '').replace(/\r\n/g, '\n').trim();

    // FNV-1a de 32 bits
    let hash = 0x811c9dc5;

    for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    const id = String(songId ?? '')
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .slice(0, 24);

    return `${id || 's'}.${(hash >>> 0).toString(36)}`;
};