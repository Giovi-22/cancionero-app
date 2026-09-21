import React, { useEffect, useRef } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    AppState,
    AppStateStatus,
    NativeSyntheticEvent,
    TextInputKeyPressEventData,
} from 'react-native';
import { PedalService } from '../services/PedalService';

interface BluetoothInputBridgeProps {
    enabled?: boolean;
    onRawKey?: (key: string) => void;
}

/**
 * Componente puente invisible que captura eventos de teclado físico HID (Bluetooth).
 * - Renderiza el TextInput casi invisible.
 * - Mantiene el foco en Android de forma periódica.
 * - Deduplica eventos con ventana de 150 ms para evitar duplicados de onKeyPress + onChangeText.
 * - Entrega las teclas limpias al BluetoothPedalAdapter.
 */
export const BluetoothInputBridge: React.FC<BluetoothInputBridgeProps> = ({
    enabled = true,
    onRawKey,
}) => {
    const inputRef = useRef<TextInput>(null);
    const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

    // Notificar al adaptador BT (vía PedalService) que el puente está activo
    useEffect(() => {
        PedalService.setBtBridgeActive(enabled);
        if (enabled) {
            PedalService.loadBtMappings();
        }
        return () => {
            PedalService.setBtBridgeActive(false);
        };
    }, [enabled]);

    // ── Re-enrutamiento HID (fix Android BT reconnect) ────────────────────────
    const reacquireFocus = () => {
        if (!inputRef.current) return;
        inputRef.current.blur();
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    useEffect(() => {
        if (!enabled) return;
        const initialTimer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        const interval = setInterval(reacquireFocus, 2000);
        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                PedalService.loadBtMappings();
                reacquireFocus();
            }
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, [enabled]);

    // ── Deduplicación explícita antes de enviar al adaptador ─────────────────
    const handleKeyDetected = (key: string) => {
        if (!key) return;

        const now = Date.now();
        // Evitar que la combinación onKeyPress + onChangeText dispare dos veces la misma tecla
        if (lastKeyRef.current.key === key && now - lastKeyRef.current.time < 150) {
            return;
        }
        lastKeyRef.current = { key, time: now };

        PedalService.handleRawKey(key);
        onRawKey?.(key);
    };

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        handleKeyDetected(e.nativeEvent.key);
    };

    const handleTextChange = (text: string) => {
        if (text && text.length > 0) {
            handleKeyDetected(text.charAt(text.length - 1));
        }
    };

    if (!enabled) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                showSoftInputOnFocus={false}
                onKeyPress={handleKeyPress}
                onChangeText={handleTextChange}
                autoFocus={true}
                caretHidden={true}
                value=""
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        zIndex: -999,
    },
    hiddenInput: {
        width: 10,
        height: 10,
        opacity: 0.01,
        color: 'transparent',
        backgroundColor: 'transparent',
    },
});
