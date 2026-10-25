/** Modo de operación del pedal */
export type PedalMode = 'scroll' | 'sections';

/**
 * Configuración del modo "salto por secciones".
 * `overlapFraction`: fracción del viewport que queda visible
 * por encima de la nueva sección (contexto del verso anterior).
 * Valor por defecto: 0.3 (30%).
 */
export interface SectionJumpConfig {
    overlapFraction: number;
}

export type PedalEventType =
    | 'UP_PRESS'
    | 'UP_RELEASE'
    | 'DOWN_PRESS'
    | 'DOWN_RELEASE'
    | 'HOME'
    | 'END';

export interface PedalEvent {
    type: PedalEventType;
    timestamp: number;
    source: 'bluetooth' | 'wifi';
}

export type PedalTransportType = 'bluetooth' | 'wifi' | 'none';

/**
 * Reporte que la app le manda al ESP32 al abrir una canción
 * (o cuando cambia su pantalla / tamaño de letra).
 */
export interface WifiHelloReport {
    /**
     * Secciones de la canción (sin el título). `line` es el índice de línea
     * lógica (parsedLines). Las usa el ESP32 para llevar la sección activa
     * compartida entre todos los dispositivos.
     */
    sections?: { line: number; label: string }[];
    /** Identifica la canción y su contenido (ver utils/songKey). */
    songKey: string;
    /** Líneas lógicas que entran enteras en esta pantalla (peor caso). */
    visibleLines: number;
    /** Cantidad total de líneas lógicas de la canción. */
    totalLines: number;
    /** Posición actual en líneas; solo la usa el ESP32 si es el primero en abrirla. */
    pos: number;
}

/** Posición compartida de una canción, publicada por el ESP32. */
export interface WifiPositionMessage {
    songKey: string;
    pos: number;
    /** true mientras el pedal está en movimiento; false = posición final. */
    moving: boolean;
}

/**
 * Cuántas líneas entran, como mínimo, en las pantallas que tienen abierta
 * esta canción (la pantalla más chica manda). 0 = ningún dispositivo la reportó.
 */
export interface WifiMinVisibleMessage {
    songKey: string;
    minVisible: number;
}

/** Nombre del modo en el firmware ('lines' equivale a 'scroll' en la app). */
export type PedalFirmwareMode = 'lines' | 'sections';

/**
 * Configuración del pedal. `mode` y `overlapPercent` solo llegan de un
 * firmware con protocolo v1: son la configuración REAL del pedal y mandan
 * sobre lo que haya guardado la app.
 */
export interface WifiConfigMessage {
    linesPerSec: number;
    rampMs: number;
    mode?: PedalFirmwareMode;
    overlapPercent?: number;
}

/** Una sección tal como la describe el ESP32. */
export interface WifiSectionRef {
    /** Índice de la sección dentro de la lista que mandó la app. */
    index: number;
    /** Índice de línea lógica donde está la etiqueta. */
    line: number;
    label: string;
}

/** Por qué el ESP32 mandó un estado de secciones. */
export type WifiSectionCause =
    | 'next'
    | 'prev'
    | 'home'
    | 'end'
    | 'join'
    | 'resync'
    | 'mode'
    | 'reset'
    | 'page';

/**
 * Estado de secciones publicado por el ESP32 (mensaje `sec`).
 * `index` = -1 significa "antes de la primera sección".
 * `count` = 0 es una canción sin secciones: se navega por páginas con `pos`.
 */
export interface WifiSectionMessage {
    songKey: string;
    seq: number;
    cause: WifiSectionCause;
    changed: boolean;
    index: number;
    count: number;
    pos: number;
    prev: WifiSectionRef | null;
    cur: WifiSectionRef | null;
    next: WifiSectionRef | null;
}

export interface PedalDevice {
    ip: string;
    port: number;
    name?: string;
}

export interface PedalStatus {
    connected: boolean;
    connecting: boolean;
    discovering: boolean;
    transport: PedalTransportType;
    device: PedalDevice | null;
}

/**
 * Mantenido para retrocompatibilidad con componentes existentes.
 */
export interface PedalConnectionState {
    connected: boolean;
    connecting: boolean;
    device: PedalDevice | null;
}