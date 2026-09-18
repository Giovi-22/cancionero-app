export type PedalEvent =
    | 'UP_PRESS'
    | 'UP_RELEASE'
    | 'DOWN_PRESS'
    | 'DOWN_RELEASE'
    | 'HOME'
    | 'END';

export interface PedalDevice {
    ip: string;
    port: number;
}

export interface PedalConnectionState {
    connected: boolean;
    connecting: boolean;
    device: PedalDevice | null;
}