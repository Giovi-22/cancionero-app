import { createSocket } from '@isvend/expo-udp';
import TcpSocket from 'react-native-tcp-socket';

import {
    PedalDevice,
    PedalEvent,
} from '../types/pedal';

const DISCOVERY_PORT = 4444;
const TCP_PORT = 8080;

const DISCOVERY_TIMEOUT = 5000;

type PedalEventListener = (
    event: PedalEvent
) => void;

type ConnectionListener = (
    connected: boolean
) => void;

class PedalServiceClass {
    private tcpClient: any = null;

    private device: PedalDevice | null = null;

    private eventListeners = new Set<PedalEventListener>();

    private connectionListeners =
        new Set<ConnectionListener>();

    private receiveBuffer = '';

    private connecting = false;

    /**
     * Busca el ESP32 mediante UDP broadcast.
     */
    async discover(): Promise<PedalDevice | null> {
        console.log(
            '[PedalService] Iniciando descubrimiento UDP...'
        );

        const socket = await createSocket({
            type: 'udp4',
            reuseAddress: true,
        });

        try {
            await socket.bind({
                port: 0,
                address: '0.0.0.0',
            });

            await socket.setBroadcast(true);

            const devicePromise =
                new Promise<PedalDevice | null>(
                    resolve => {
                        let finished = false;

                        const finish = (
                            device: PedalDevice | null
                        ) => {
                            if (finished) {
                                return;
                            }

                            finished = true;
                            resolve(device);
                        };

                        const subscription =
                            socket.addListener(
                                'message',
                                event => {
                                    try {
                                        const message =
                                            new TextDecoder().decode(
                                                event.data
                                            );

                                        console.log(
                                            '[PedalService] UDP recibido:',
                                            message
                                        );

                                        const data =
                                            JSON.parse(message);

                                        if (
                                            typeof data.ip !==
                                            'string' ||
                                            typeof data.port !==
                                            'number'
                                        ) {
                                            return;
                                        }

                                        const device: PedalDevice = {
                                            ip: data.ip,
                                            port: data.port,
                                        };

                                        this.device =
                                            device;

                                        subscription.remove();

                                        finish(device);
                                    } catch (error) {
                                        console.warn(
                                            '[PedalService] UDP inválido:',
                                            error
                                        );
                                    }
                                }
                            );

                        setTimeout(() => {
                            subscription.remove();

                            finish(null);
                        }, DISCOVERY_TIMEOUT);
                    }
                );

            await socket.send(
                JSON.stringify({
                    type: 'discover',
                }),
                {
                    host: '255.255.255.255',
                    port: DISCOVERY_PORT,
                }
            );

            return await devicePromise;
        } finally {
            await socket.close();
        }
    }

    /**
     * Conecta al ESP32 por TCP.
     */
    async connect(
        device?: PedalDevice
    ): Promise<void> {
        if (this.tcpClient) {
            console.log(
                '[PedalService] Ya existe una conexión TCP.'
            );
            return;
        }

        const target =
            device ??
            this.device ??
            (await this.discover());

        if (!target) {
            throw new Error(
                'No se encontró el pedal.'
            );
        }

        this.connecting = true;

        this.receiveBuffer = '';

        console.log(
            `[PedalService] Conectando a ${target.ip}:${target.port}...`
        );

        return new Promise(
            (resolve, reject) => {
                const client =
                    TcpSocket.createConnection(
                        {
                            host: target.ip,
                            port:
                                target.port ||
                                TCP_PORT,
                            connectTimeout: 5000,
                        },
                        () => {
                            console.log(
                                '[PedalService] TCP conectado.'
                            );

                            this.tcpClient =
                                client;

                            this.connecting =
                                false;

                            this.notifyConnection(
                                true
                            );

                            resolve();
                        }
                    );

                client.on(
                    'data',
                    data => {
                        this.handleData(data);
                    }
                );

                client.on(
                    'error',
                    error => {
                        console.error(
                            '[PedalService] TCP error:',
                            error
                        );

                        this.connecting =
                            false;

                        if (
                            !this.tcpClient
                        ) {
                            reject(error);
                        }
                    }
                );

                client.on(
                    'close',
                    () => {
                        console.log(
                            '[PedalService] TCP cerrado.'
                        );

                        this.tcpClient =
                            null;

                        this.connecting =
                            false;

                        this.notifyConnection(
                            false
                        );
                    }
                );

                this.tcpClient = client;
            }
        );
    }

    /**
     * Desconecta el pedal.
     */
    disconnect(): void {
        if (!this.tcpClient) {
            return;
        }

        console.log(
            '[PedalService] Desconectando pedal...'
        );

        this.tcpClient.destroy();

        this.tcpClient = null;

        this.connecting = false;

        this.notifyConnection(false);
    }

    /**
     * Procesa datos TCP.
     *
     * El ESP32 utiliza println(), por lo que cada
     * evento termina en \\n.
     */
    private handleData(
        data: string | Uint8Array
    ): void {
        const chunk =
            typeof data === 'string'
                ? data
                : new TextDecoder().decode(data);

        this.receiveBuffer += chunk;

        const lines =
            this.receiveBuffer.split('\n');

        this.receiveBuffer =
            lines.pop() ?? '';

        for (const rawLine of lines) {
            const line =
                rawLine.trim();

            if (!line) {
                continue;
            }

            this.handleEvent(line);
        }
    }

    private handleEvent(
        value: string
    ): void {
        const validEvents: PedalEvent[] = [
            'UP_PRESS',
            'UP_RELEASE',
            'DOWN_PRESS',
            'DOWN_RELEASE',
            'HOME',
            'END',
        ];

        if (
            !validEvents.includes(
                value as PedalEvent
            )
        ) {
            console.log(
                '[PedalService] Evento desconocido:',
                value
            );

            return;
        }

        console.log(
            '[PedalService] Evento:',
            value
        );

        for (
            const listener of this.eventListeners
        ) {
            listener(value as PedalEvent);
        }
    }

    /**
     * Suscribe eventos provenientes del pedal.
     */
    addEventListener(
        listener: PedalEventListener
    ): () => void {
        this.eventListeners.add(listener);

        return () => {
            this.eventListeners.delete(
                listener
            );
        };
    }

    /**
     * Suscribe cambios de conexión.
     */
    addConnectionListener(
        listener: ConnectionListener
    ): () => void {
        this.connectionListeners.add(
            listener
        );

        return () => {
            this.connectionListeners.delete(
                listener
            );
        };
    }

    private notifyConnection(
        connected: boolean
    ): void {
        for (
            const listener of
            this.connectionListeners
        ) {
            listener(connected);
        }
    }

    getDevice(): PedalDevice | null {
        return this.device;
    }

    isConnected(): boolean {
        return this.tcpClient !== null;
    }

    isConnecting(): boolean {
        return this.connecting;
    }
}

export const PedalService =
    new PedalServiceClass();