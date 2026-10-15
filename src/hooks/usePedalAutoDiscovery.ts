import { useCallback, useEffect, useState } from 'react';

import { StorageService } from '../services/StorageService';

const SETTING_KEY = 'pedal_wifi_auto_discovery';

/**
 * Preferencia "buscar pedal WiFi automáticamente".
 *
 * Es un store a nivel de módulo (no estado de React) para que todas las
 * pantallas (Inicio y pantalla del Pedal WiFi) vean el mismo valor al instante.
 * Por defecto está APAGADO: la app no escanea la red hasta que el usuario
 * lo pida (switch o botón "Buscar ahora").
 */
let currentValue = false;
let loaded = false;
let loadingPromise: Promise<void> | null = null;
const listeners = new Set<(value: boolean) => void>();

const emit = () => listeners.forEach(l => l(currentValue));

const ensureLoaded = (): Promise<void> => {
    if (loaded) return Promise.resolve();
    if (!loadingPromise) {
        loadingPromise = StorageService.getSetting<boolean>(SETTING_KEY)
            .then(saved => {
                currentValue = saved === true;
            })
            .finally(() => {
                loaded = true;
                emit();
            });
    }
    return loadingPromise;
};

export const usePedalAutoDiscovery = () => {
    const [enabled, setEnabledState] = useState(currentValue);
    const [ready, setReady] = useState(loaded);

    useEffect(() => {
        listeners.add(setEnabledState);
        ensureLoaded().then(() => {
            setEnabledState(currentValue);
            setReady(true);
        });
        return () => {
            listeners.delete(setEnabledState);
        };
    }, []);

    const setEnabled = useCallback(async (value: boolean) => {
        currentValue = value;
        emit();
        try {
            await StorageService.saveSetting(SETTING_KEY, value);
        } catch (e) {
            console.error('[usePedalAutoDiscovery] No se pudo guardar:', e);
        }
    }, []);

    return { enabled, setEnabled, ready };
};
