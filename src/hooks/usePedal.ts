import {
    useCallback,
    useEffect,
    useState,
} from 'react';

import {
    PedalDevice,
    PedalEvent,
} from '../types/pedal';

import { PedalService } from '../services/PedalService';

interface UsePedalResult {
    connected: boolean;
    connecting: boolean;
    device: PedalDevice | null;
    lastEvent: PedalEvent | null;

    connect: () => Promise<void>;
    disconnect: () => void;
}

export const usePedal =
    (): UsePedalResult => {
        const [connected, setConnected] =
            useState(
                PedalService.isConnected()
            );

        const [connecting, setConnecting] =
            useState(
                PedalService.isConnecting()
            );

        const [device, setDevice] =
            useState<PedalDevice | null>(
                PedalService.getDevice()
            );

        const [lastEvent, setLastEvent] =
            useState<PedalEvent | null>(
                null
            );

        useEffect(() => {
            const removeEventListener =
                PedalService.addEventListener(
                    event => {
                        setLastEvent(event);
                    }
                );

            const removeConnectionListener =
                PedalService.addConnectionListener(
                    isConnected => {
                        setConnected(
                            isConnected
                        );

                        setConnecting(false);
                    }
                );

            return () => {
                removeEventListener();
                removeConnectionListener();
            };
        }, []);

        const connect =
            useCallback(async () => {
                setConnecting(true);

                try {
                    await PedalService.connect();

                    setDevice(
                        PedalService.getDevice()
                    );

                    setConnected(true);
                } catch (error) {
                    setConnecting(false);

                    throw error;
                }
            }, []);

        const disconnect =
            useCallback(() => {
                PedalService.disconnect();

                setConnected(false);
                setConnecting(false);
            }, []);

        return {
            connected,
            connecting,
            device,
            lastEvent,
            connect,
            disconnect,
        };
    };