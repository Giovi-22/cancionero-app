import {
    useCallback,
    useEffect,
    useState,
} from 'react';

import {
    PedalDevice,
    PedalEvent,
} from '../types/pedal';

import {
    PedalService,
    PedalEventListener,
    PedalDeviceListener,
} from '../services/PedalService';

interface UsePedalResult {
    connected: boolean;
    connecting: boolean;
    discovering: boolean;
    device: PedalDevice | null;

    /**
     * Último evento recibido. Útil para UI/debug.
     * Se actualiza por setState; para lógica crítica usar onEvent().
     */
    lastEvent: PedalEvent | null;

    /**
     * Suscripción directa a eventos del pedal (cualquier transporte).
     * No depende del ciclo de render. Retorna función de unsuscribe.
     */
    onEvent: (listener: PedalEventListener) => () => void;

    /**
     * Suscripción a cambios en el dispositivo detectado (anuncios UDP).
     */
    onDeviceChange: (listener: PedalDeviceListener) => () => void;

    /** Escucha pasivamente el broadcast UDP del ESP32. NUNCA conecta. */
    discover: (timeoutMs?: number) => Promise<PedalDevice | null>;

    /** Conecta por TCP al device dado (o al último descubierto). NUNCA hace discover interno. */
    connect: (device?: PedalDevice) => Promise<void>;

    disconnect: () => void;
}

export const usePedal = (): UsePedalResult => {
    const [connected, setConnected] = useState(
        PedalService.isConnected()
    );

    const [connecting, setConnecting] = useState(
        PedalService.isConnecting()
    );

    const [discovering, setDiscovering] = useState(
        PedalService.isDiscovering()
    );

    const [device, setDevice] = useState<PedalDevice | null>(
        PedalService.getDevice()
    );

    const [lastEvent, setLastEvent] = useState<PedalEvent | null>(null);

    // Actualiza lastEvent y sincroniza conexión
    useEffect(() => {
        const removeEventListener = PedalService.addEventListener(
            event => setLastEvent(event)
        );

        const removeConnectionListener = PedalService.addConnectionListener(
            isConnected => {
                setConnected(isConnected);
                setConnecting(false);
            }
        );

        const removeDeviceListener = PedalService.onDeviceChange(
            dev => setDevice(dev)
        );

        return () => {
            removeEventListener();
            removeConnectionListener();
            removeDeviceListener();
        };
    }, []);

    /**
     * Suscripción directa a eventos del pedal.
     * Estable entre renders — no necesita agregarse como dep de useEffect.
     */
    const onEvent = useCallback(
        (listener: PedalEventListener): (() => void) => {
            return PedalService.onEvent(listener);
        },
        []
    );

    /**
     * Suscripción directa a cambios en el dispositivo detectado.
     */
    const onDeviceChange = useCallback(
        (listener: PedalDeviceListener): (() => void) => {
            return PedalService.onDeviceChange(listener);
        },
        []
    );

    /**
     * Escucha pasivamente el broadcast UDP del ESP32 en el puerto 4444.
     * Actualiza `device` si encuentra uno.
     * NUNCA conecta por TCP.
     */
    const discover = useCallback(
        async (timeoutMs?: number): Promise<PedalDevice | null> => {
            if (PedalService.isDiscovering()) {
                return PedalService.getDevice();
            }
            setDiscovering(true);
            try {
                const found = await PedalService.discover(timeoutMs);
                if (found) {
                    setDevice(found);
                }
                return found;
            } finally {
                setDiscovering(false);
            }
        },
        []
    );

    /**
     * Conecta por TCP al device especificado (o al último descubierto).
     * NUNCA hace discover interno.
     */
    const connect = useCallback(
        async (targetDevice?: PedalDevice): Promise<void> => {
            setConnecting(true);
            try {
                await PedalService.connect(targetDevice);
                setDevice(PedalService.getDevice());
                setConnected(true);
            } catch (error) {
                setConnecting(false);
                throw error;
            }
        },
        []
    );

    const disconnect = useCallback(() => {
        PedalService.disconnect();
        setConnected(false);
        setConnecting(false);
    }, []);

    return {
        connected,
        connecting,
        discovering,
        device,
        lastEvent,
        onEvent,
        onDeviceChange,
        discover,
        connect,
        disconnect,
    };
};