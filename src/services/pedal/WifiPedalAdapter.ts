import { createSocket } from '@isvend/expo-udp';
import TcpSocket from 'react-native-tcp-socket';

import {
    PedalDevice,
    PedalEvent,
    PedalEventType,
    PedalFirmwareMode,
    PedalTransportType,
    WifiConfigMessage,
    WifiHelloReport,
    WifiMinVisibleMessage,
    WifiPositionMessage,
    WifiSectionCause,
    WifiSectionMessage,
    WifiSectionRef,
} from '../../types/pedal';
import { IPedalAdapter } from './IPedalAdapter';

const DISCOVERY_PORT = 4444;
const TCP_PORT = 8080;
const DEFAULT_DISCOVERY_TIMEOUT = 5000;
const CONNECT_TIMEOUT = 5000;

/** Si el pedal no contesta el `getcfg` en este tiempo, se lo trata como firmware viejo. */
const PROTOCOL_DETECT_TIMEOUT = 1500;

/** Límites del protocolo v1 (tienen que coincidir con el firmware). */
const MAX_SECTIONS = 32;
const MAX_LABEL_BYTES = 20;

const SECTION_CAUSES: WifiSectionCause[] = [
    'next',
    'prev',
    'home',
    'end',
    'join',
    'resync',
    'mode',
    'reset',
    'page',
];

/** Estos mensajes repiten el seq vigente (no son un cambio nuevo). */
const SNAPSHOT_CAUSES: WifiSectionCause[] = ['join', 'resync'];

/**
 * 'unknown': recién conectado, todavía no se sabe qué entiende el pedal.
 * 'v1':      firmware nuevo, habla JSON (cfg, sec, setmode...).
 * 'legacy':  firmware viejo: solo el protocolo de texto (HELLO/POS/CFG).
 */
type WifiProtocol = 'unknown' | 'v1' | 'legacy';

/** Recorta un texto a `maxBytes` bytes de UTF-8 sin partir un carácter. */
const truncateUtf8 = (text: string, maxBytes: number): string => {
    const bytes = new TextEncoder().encode(text);

    if (bytes.length <= maxBytes) return text;

    let end = maxBytes;

    // Si el byte que queda afuera es de continuación, el carácter anterior
    // quedaría cortado: se retrocede hasta un byte de inicio.
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) {
        end--;
    }

    return new TextDecoder().decode(bytes.slice(0, end));
};

const toSectionRef = (value: any): WifiSectionRef | null => {
    if (!value || typeof value !== 'object') return null;

    const index = Number(value.i);
    const line = Number(value.line);

    if (!Number.isFinite(index) || !Number.isFinite(line)) return null;

    return {
        index,
        line,
        label: typeof value.label === 'string' ? value.label : '',
    };
};

const VALID_EVENTS: PedalEventType[] = [
    'UP_PRESS',
    'UP_RELEASE',
    'DOWN_PRESS',
    'DOWN_RELEASE',
    'HOME',
    'END',
];

export class WifiPedalAdapter implements IPedalAdapter {
    readonly transport: PedalTransportType = 'wifi';

    private tcpClient: any = null;
    private connecting = false;
    private discovering = false;
    private lastDiscoveredDevice: PedalDevice | null = null;
    private receiveBuffer = '';

    private eventListeners = new Set<(event: PedalEvent) => void>();
    private connectionListeners = new Set<(connected: boolean) => void>();
    private positionListeners = new Set<(message: WifiPositionMessage) => void>();
    private configListeners = new Set<(message: WifiConfigMessage) => void>();
    private minVisibleListeners = new Set<
        (message: WifiMinVisibleMessage) => void
    >();
    private sectionListeners = new Set<
        (message: WifiSectionMessage) => void
    >();

    // ── Negociación de protocolo ──
    private protocol: WifiProtocol = 'unknown';
    private protocolTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingHello: WifiHelloReport | null = null;
    private pendingMode: {
        mode: PedalFirmwareMode;
        overlapPercent: number;
    } | null = null;

    /** Último `seq` de secciones recibido por canción (detecta pérdidas). */
    private lastSeq = new Map<string, number>();

    isConnected(): boolean {
        return this.tcpClient !== null;
    }

    isConnecting(): boolean {
        return this.connecting;
    }

    isDiscovering(): boolean {
        return this.discovering;
    }

    getDiscoveredDevice(): PedalDevice | null {
        return this.lastDiscoveredDevice;
    }

    private stopDiscoveryFn: (() => void) | null = null;

    /**
     * Escucha pasivamente en el puerto UDP 4444 los anuncios broadcast del ESP32.
     * NUNCA inicia conexión TCP automáticamente.
     */
    async discover(
        timeoutMs: number = DEFAULT_DISCOVERY_TIMEOUT
    ): Promise<PedalDevice | null> {
        if (this.discovering) {
            console.log('[WifiPedalAdapter] Discovery ya en curso.');
            return this.lastDiscoveredDevice;
        }

        console.log('[WifiPedalAdapter] Iniciando escucha de discovery UDP :4444...');
        this.discovering = true;

        let socket: any = null;

        try {
            socket = await createSocket({
                type: 'udp4',
                reuseAddress: true,
            });

            await socket.bind({
                port: DISCOVERY_PORT,
                address: '0.0.0.0',
            });

            await socket.setBroadcast(true);

            return await new Promise<PedalDevice | null>(resolve => {
                let finished = false;

                const finish = (device: PedalDevice | null) => {
                    if (finished) return;
                    finished = true;
                    this.discovering = false;
                    this.stopDiscoveryFn = null;
                    resolve(device);
                };

                const subscription = socket.addListener(
                    'message',
                    (event: { data: Uint8Array }) => {
                        try {
                            const message = new TextDecoder().decode(event.data);
                            console.log('[WifiPedalAdapter] UDP recibido:', message);

                            const data = JSON.parse(message);

                            if (
                                typeof data.ip !== 'string' ||
                                typeof data.port !== 'number'
                            ) {
                                return;
                            }

                            const device: PedalDevice = {
                                ip: data.ip,
                                port: data.port,
                            };

                            this.lastDiscoveredDevice = device;
                            subscription.remove();
                            finish(device);
                        } catch (error) {
                            console.warn('[WifiPedalAdapter] UDP inválido:', error);
                        }
                    }
                );

                const timer = setTimeout(() => {
                    subscription.remove();
                    finish(null);
                }, timeoutMs);

                this.stopDiscoveryFn = () => {
                    clearTimeout(timer);
                    try {
                        subscription.remove();
                    } catch {
                        // Ignorar
                    }
                    finish(null);
                };
            });
        } catch (error) {
            console.error('[WifiPedalAdapter] Error en discovery UDP:', error);
            this.discovering = false;
            return null;
        } finally {
            this.stopDiscoveryFn = null;
            if (socket) {
                try {
                    await socket.close();
                } catch {
                    // Ignorar error al cerrar socket UDP
                }
            }
        }
    }

    /**
     * Detiene la búsqueda/escucha activa UDP inmediatamente.
     */
    stopDiscover(): void {
        if (this.stopDiscoveryFn) {
            console.log('[WifiPedalAdapter] Deteniendo discovery UDP manual...');
            this.stopDiscoveryFn();
        } else {
            this.discovering = false;
        }
    }

    /**
     * Conecta al pedal por TCP :8080.
     * NUNCA ejecuta discover() internamente. Si no hay target, lanza un error.
     */
    async connect(targetDevice?: PedalDevice): Promise<void> {
        if (this.tcpClient) {
            console.log('[WifiPedalAdapter] Ya existe una conexión TCP activa.');
            return;
        }

        const target = targetDevice ?? this.lastDiscoveredDevice;

        if (!target) {
            throw new Error(
                'No se especificó ningún pedal WiFi para conectar. Realice una búsqueda previa.'
            );
        }

        this.connecting = true;
        this.receiveBuffer = '';

        console.log(`[WifiPedalAdapter] Conectando a ${target.ip}:${target.port}...`);

        return new Promise<void>((resolve, reject) => {
            const client = TcpSocket.createConnection(
                {
                    host: target.ip,
                    port: target.port || TCP_PORT,
                    connectTimeout: CONNECT_TIMEOUT,
                },
                () => {
                    console.log('[WifiPedalAdapter] TCP conectado con éxito.');
                    this.tcpClient = client;
                    this.connecting = false;
                    this.beginProtocolDetection();
                    this.notifyConnection(true);
                    resolve();
                }
            );

            client.on('data', (data: string | Uint8Array) => {
                this.handleData(data);
            });

            client.on('error', (error: any) => {
                console.error('[WifiPedalAdapter] TCP error:', error);
                const wasConnecting = this.connecting;
                this.connecting = false;
                this.cleanupSocket();

                if (wasConnecting) {
                    reject(error);
                }
            });

            client.on('close', () => {
                console.log('[WifiPedalAdapter] TCP socket cerrado.');
                this.connecting = false;
                this.cleanupSocket();
                this.notifyConnection(false);
            });
        });
    }

    /**
     * Desconecta el socket TCP.
     * NUNCA inicia discovery ni reconexión automática.
     */
    disconnect(): void {
        if (!this.tcpClient) {
            return;
        }

        console.log('[WifiPedalAdapter] Desconectando TCP...');
        this.cleanupSocket();
        this.notifyConnection(false);
    }

    private cleanupSocket(): void {
        if (this.tcpClient) {
            try {
                this.tcpClient.destroy();
            } catch {
                // Socket ya destruido
            }
            this.tcpClient = null;
        }
        this.connecting = false;
        this.resetProtocol();
    }

    // ─────────────────────────────────────────────
    // Negociación de protocolo
    //
    // Al conectar se pide la configuración (`getcfg`). Un pedal con firmware
    // nuevo contesta un JSON `cfg`; uno viejo ignora el mensaje. Hasta saber
    // cuál es, el `hello` y el cambio de modo quedan en espera.
    // ─────────────────────────────────────────────

    private beginProtocolDetection(): void {
        this.resetProtocol();

        this.sendRaw(JSON.stringify({ t: 'getcfg', v: 1 }));

        this.protocolTimer = setTimeout(() => {
            this.protocolTimer = null;
            console.log(
                '[WifiPedalAdapter] El pedal no contestó getcfg: firmware viejo, se usa el protocolo de texto.'
            );
            this.setProtocol('legacy');
        }, PROTOCOL_DETECT_TIMEOUT);
    }

    private resetProtocol(): void {
        if (this.protocolTimer) {
            clearTimeout(this.protocolTimer);
            this.protocolTimer = null;
        }

        this.protocol = 'unknown';
        this.pendingHello = null;
        this.pendingMode = null;
        this.lastSeq.clear();
    }

    private setProtocol(protocol: WifiProtocol): void {
        if (this.protocol === protocol) return;

        if (this.protocolTimer) {
            clearTimeout(this.protocolTimer);
            this.protocolTimer = null;
        }

        this.protocol = protocol;

        console.log('[WifiPedalAdapter] Protocolo del pedal:', protocol);

        // Se envía lo que estaba esperando.
        const hello = this.pendingHello;
        const mode = this.pendingMode;

        this.pendingHello = null;
        this.pendingMode = null;

        if (mode && protocol === 'v1') {
            this.sendSetMode(mode.mode, mode.overlapPercent);
        }

        if (hello) {
            this.sendHello(hello);
        }
    }

    /** Protocolo detectado: lo usa la app para saber si el modo se sincroniza. */
    getProtocol(): WifiProtocol {
        return this.protocol;
    }

    /**
     * Procesa fragmentos TCP con delimitador '\n'.
     */
    private handleData(data: string | Uint8Array): void {
        const chunk =
            typeof data === 'string'
                ? data
                : new TextDecoder().decode(data);

        this.receiveBuffer += chunk;

        const lines = this.receiveBuffer.split('\n');
        this.receiveBuffer = lines.pop() ?? '';

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            this.handleLine(line);
        }
    }

    private handleLine(value: string): void {
        // Protocolo v1: una línea que empieza con '{' es JSON.
        if (value.charCodeAt(0) === 123) {
            this.handleJson(value);
            return;
        }

        // Mensajes de sincronización del ESP32 (no son eventos de botón).
        // POS llega varias veces por segundo: no se loguea.
        if (value.startsWith('POS ')) {
            this.handlePosition(value);
            return;
        }

        if (value.startsWith('CFG ')) {
            this.handleConfig(value);
            return;
        }

        if (value.startsWith('MINV ')) {
            this.handleMinVisible(value);
            return;
        }

        if (!VALID_EVENTS.includes(value as PedalEventType)) {
            console.log('[WifiPedalAdapter] Evento desconocido ignorado:', value);
            return;
        }

        const event: PedalEvent = {
            type: value as PedalEventType,
            timestamp: Date.now(),
            source: 'wifi',
        };

        console.log('[WifiPedalAdapter] Evento normalizado emitido:', event);

        this.eventListeners.forEach(listener => listener(event));
    }

    private handleJson(value: string): void {
        let message: any;

        try {
            message = JSON.parse(value);
        } catch (error) {
            console.warn('[WifiPedalAdapter] JSON inválido ignorado:', value);
            return;
        }

        if (!message || message.v !== 1 || typeof message.t !== 'string') {
            return;
        }

        // Cualquier mensaje v1 válido confirma que el pedal habla JSON.
        this.setProtocol('v1');

        switch (message.t) {
            case 'cfg':
                this.handleJsonConfig(message);
                break;
            case 'sec':
                this.handleJsonSection(message);
                break;
            default:
                console.log('[WifiPedalAdapter] Mensaje v1 desconocido:', message.t);
        }
    }

    private handleJsonConfig(message: any): void {
        const linesPerSec = Number(message.linesPerSec);
        const rampMs = Number(message.rampMs);

        if (!Number.isFinite(linesPerSec) || !Number.isFinite(rampMs)) return;

        const config: WifiConfigMessage = { linesPerSec, rampMs };

        if (message.mode === 'lines' || message.mode === 'sections') {
            config.mode = message.mode;
        }

        const overlap = Number(message.overlapPercent);

        if (Number.isFinite(overlap) && overlap >= 0 && overlap <= 100) {
            config.overlapPercent = Math.round(overlap);
        }

        console.log('[WifiPedalAdapter] Config del pedal (v1):', config);

        this.configListeners.forEach(listener => listener(config));
    }

    private handleJsonSection(message: any): void {
        const cause = message.cause as WifiSectionCause;

        if (
            typeof message.song !== 'string' ||
            !SECTION_CAUSES.includes(cause)
        ) {
            return;
        }

        const seq = Number(message.seq);
        const index = Number(message.index);
        const count = Number(message.count);
        const pos = Number(message.pos);

        if (
            !Number.isFinite(seq) ||
            !Number.isFinite(index) ||
            !Number.isFinite(count) ||
            !Number.isFinite(pos)
        ) {
            return;
        }

        const songKey: string = message.song;
        const last = this.lastSeq.get(songKey);
        let gap = false;

        if (SNAPSHOT_CAUSES.includes(cause)) {
            // join / resync repiten el seq vigente: se toman siempre.
            this.lastSeq.set(songKey, seq);
        } else if (last !== undefined && seq <= last) {
            // Mensaje repetido o viejo.
            console.log('[WifiPedalAdapter] sec viejo ignorado:', seq, '<=', last);
            return;
        } else {
            gap = last !== undefined && seq > last + 1;
            this.lastSeq.set(songKey, seq);
        }

        const parsed: WifiSectionMessage = {
            songKey,
            seq,
            cause,
            changed: message.changed === true,
            index,
            count,
            pos,
            prev: toSectionRef(message.prev),
            cur: toSectionRef(message.cur),
            next: toSectionRef(message.next),
        };

        console.log(
            `[WifiPedalAdapter] sec #${seq} ${cause} ${index + 1}/${count}`
        );

        this.sectionListeners.forEach(listener => listener(parsed));

        // Se perdió algún mensaje: se pide el estado vigente.
        if (gap) {
            console.warn('[WifiPedalAdapter] Hueco en seq, pidiendo resync.');
            this.requestResync(songKey);
        }
    }

    /** POS <songKey> <pos> <moving> */
    private handlePosition(value: string): void {
        const parts = value.split(' ');

        if (parts.length !== 4) return;

        const pos = Number(parts[2]);

        if (!Number.isFinite(pos)) return;

        const message: WifiPositionMessage = {
            songKey: parts[1],
            pos,
            moving: parts[3] === '1',
        };

        this.positionListeners.forEach(listener => listener(message));
    }

    /** MINV <songKey> <minVisible> */
    private handleMinVisible(value: string): void {
        const parts = value.split(' ');

        if (parts.length !== 3) return;

        const minVisible = Number(parts[2]);

        if (!Number.isFinite(minVisible) || minVisible < 0) return;

        this.minVisibleListeners.forEach(listener =>
            listener({ songKey: parts[1], minVisible })
        );
    }

    /** CFG <linesPerSec> <rampMs> */
    private handleConfig(value: string): void {
        const parts = value.split(' ');

        if (parts.length !== 3) return;

        const linesPerSec = Number(parts[1]);
        const rampMs = Number(parts[2]);

        if (!Number.isFinite(linesPerSec) || !Number.isFinite(rampMs)) return;

        console.log('[WifiPedalAdapter] Config del pedal:', linesPerSec, rampMs);

        this.configListeners.forEach(listener =>
            listener({ linesPerSec, rampMs })
        );
    }

    /**
     * Envía una línea al ESP32. Devuelve false si no hay conexión o falla.
     */
    private sendLine(line: string): boolean {
        if (!this.tcpClient) {
            return false;
        }

        try {
            this.tcpClient.write(`${line}\n`);
            return true;
        } catch (error) {
            console.warn('[WifiPedalAdapter] Error enviando:', error);
            return false;
        }
    }

    /**
     * Avisa al ESP32 que esta canción está abierta, y cuántas líneas
     * entran en esta pantalla.
     */
    sendHello(report: WifiHelloReport): boolean {
        const total = Math.round(report.totalLines);

        if (total < 1 || /\s/.test(report.songKey)) {
            return false;
        }

        if (!this.tcpClient) {
            return false;
        }

        // Todavía no se sabe qué entiende el pedal: queda en espera.
        if (this.protocol === 'unknown') {
            this.pendingHello = report;
            return true;
        }

        const visible = Math.max(0, Math.round(report.visibleLines));
        const pos = Number.isFinite(report.pos) ? report.pos : 0;

        if (this.protocol === 'legacy') {
            return this.sendLine(
                `HELLO ${report.songKey} ${visible} ${total} ${pos.toFixed(2)}`
            );
        }

        // v1: JSON con la lista de secciones.
        const sections = (report.sections ?? [])
            .filter(
                section =>
                    Number.isInteger(section.line) &&
                    section.line >= 0 &&
                    section.line < total
            )
            .slice(0, MAX_SECTIONS)
            .map(section => [
                section.line,
                truncateUtf8(section.label, MAX_LABEL_BYTES),
            ]);

        return this.sendRaw(
            JSON.stringify({
                t: 'hello',
                v: 1,
                song: report.songKey,
                visible,
                total,
                pos: Number(pos.toFixed(2)),
                sections,
            })
        );
    }

    /** Avisa al ESP32 que se cerró la canción. */
    sendLeave(songKey: string): boolean {
        if (/\s/.test(songKey)) {
            return false;
        }

        this.lastSeq.delete(songKey);

        if (this.pendingHello?.songKey === songKey) {
            this.pendingHello = null;
        }

        if (this.protocol === 'unknown') {
            return true;
        }

        if (this.protocol === 'legacy') {
            return this.sendLine(`LEAVE ${songKey}`);
        }

        return this.sendRaw(JSON.stringify({ t: 'leave', v: 1, song: songKey }));
    }

    /**
     * Cambia el modo del pedal. El ESP32 lo aplica, lo guarda en su memoria y
     * avisa a TODAS las apps conectadas con un `cfg` (también a esta).
     * Devuelve false si el pedal tiene firmware viejo (no entiende el mensaje).
     */
    sendSetMode(mode: PedalFirmwareMode, overlapPercent: number): boolean {
        if (!this.tcpClient || this.protocol === 'legacy') {
            return false;
        }

        const overlap = Math.min(60, Math.max(0, Math.round(overlapPercent)));

        if (this.protocol === 'unknown') {
            this.pendingMode = { mode, overlapPercent: overlap };
            return true;
        }

        return this.sendRaw(
            JSON.stringify({
                t: 'setmode',
                v: 1,
                mode,
                overlapPercent: overlap,
            })
        );
    }

    /** Pide el estado vigente de la canción (por ejemplo, tras una pérdida). */
    requestResync(songKey: string): boolean {
        if (this.protocol !== 'v1' || /\s/.test(songKey)) {
            return false;
        }

        return this.sendRaw(
            JSON.stringify({ t: 'resync', v: 1, song: songKey })
        );
    }

    /** Estado de secciones publicado por el ESP32 (protocolo v1). */
    onSection(listener: (message: WifiSectionMessage) => void): () => void {
        this.sectionListeners.add(listener);
        return () => {
            this.sectionListeners.delete(listener);
        };
    }

    /** Envía una línea ya armada (sin esperar a saber el protocolo). */
    private sendRaw(line: string): boolean {
        return this.sendLine(line);
    }

    onPosition(listener: (message: WifiPositionMessage) => void): () => void {
        this.positionListeners.add(listener);
        return () => {
            this.positionListeners.delete(listener);
        };
    }

    onMinVisible(
        listener: (message: WifiMinVisibleMessage) => void
    ): () => void {
        this.minVisibleListeners.add(listener);
        return () => {
            this.minVisibleListeners.delete(listener);
        };
    }

    onConfig(listener: (message: WifiConfigMessage) => void): () => void {
        this.configListeners.add(listener);
        return () => {
            this.configListeners.delete(listener);
        };
    }

    onEvent(listener: (event: PedalEvent) => void): () => void {
        this.eventListeners.add(listener);
        return () => {
            this.eventListeners.delete(listener);
        };
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        this.connectionListeners.add(listener);
        return () => {
            this.connectionListeners.delete(listener);
        };
    }

    private notifyConnection(connected: boolean): void {
        this.connectionListeners.forEach(listener => listener(connected));
    }
}

export const wifiPedalAdapter = new WifiPedalAdapter();