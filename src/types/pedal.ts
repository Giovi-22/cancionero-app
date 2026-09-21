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