import { createSocket } from '@isvend/expo-udp';
import TcpSocket from 'react-native-tcp-socket';

import {
    PedalDevice,
    PedalEvent,
    PedalEventType,
    PedalTransportType,
} from '../../types/pedal';
import { IPedalAdapter } from './IPedalAdapter';

const DISCOVERY_PORT = 4444;
const TCP_PORT = 8080;
const DEFAULT_DISCOVERY_TIMEOUT = 5000;
const CONNECT_TIMEOUT = 5000;

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

                setTimeout(() => {
                    subscription.remove();
                    finish(null);
                }, timeoutMs);
            });
        } catch (error) {
            console.error('[WifiPedalAdapter] Error en discovery UDP:', error);
            this.discovering = false;
            return null;
        } finally {
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
