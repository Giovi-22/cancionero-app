import {
    PedalEvent,
    PedalTransportType,
} from '../../types/pedal';

export interface IPedalAdapter {
    readonly transport: PedalTransportType;

    isConnected(): boolean;
    isConnecting(): boolean;

    connect(target?: any): Promise<void>;
    disconnect(): void;

    onEvent(listener: (event: PedalEvent) => void): () => void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
}
