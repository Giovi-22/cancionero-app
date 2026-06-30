import React, { useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet, AppState, AppStateStatus } from 'react-native';

interface PedalHandlerProps {
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onScrollStop?: () => void;
  enabled?: boolean;
}

/**
 * A hidden component that captures hardware keyboard events (Bluetooth pedals)
 * using a focused TextInput.
 *
 * Key mapping (hardcoded):
 *   '1' → scroll_up   (botón izquierdo, press continuo)
 *   '2' → scroll_down (botón derecho,   press continuo)
 *
 * MODELO WATCHDOG:
 * Cuando llega un evento de tecla, señalamos "scroll activo" (onScrollUp/Down)
 * y reiniciamos un timer de 150ms. Si no llegan más eventos en ese tiempo,
 * asumimos que el botón fue soltado y llamamos onScrollStop.
 * Esto permite que SongViewer maneje el scroll a 60fps de forma fluida,
 * completamente desacoplado de la tasa de llegada de eventos BT.
 *
 * PROBLEMA ANDROID + HID BT:
 * Ciclo blur→focus periódico para forzar al OS a re-enrutar eventos HID
 * cuando el pedal se reconecta.
 */
export const PedalHandler: React.FC<PedalHandlerProps> = ({
  onScrollUp,
  onScrollDown,
  onScrollStop,
  enabled = true,
}) => {
  const inputRef = useRef<TextInput>(null);

  // ── Re-enrutamiento HID (fix Android BT reconnect) ────────────────────────
  const reaquireFocus = () => {
    if (!inputRef.current) return;
    inputRef.current.blur();
    setTimeout(() => { inputRef.current?.focus(); }, 50);
  };

  useEffect(() => {
    if (!enabled) return;
    const initialTimer = setTimeout(() => { inputRef.current?.focus(); }, 100);
    const interval = setInterval(reaquireFocus, 2000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') reaquireFocus();
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [enabled]);

  // ── Watchdog por dirección ─────────────────────────────────────────────────
  const watchdogRef = useRef<any>(null);
  const activeDirectionRef = useRef<'up' | 'down' | null>(null);

  /**
   * Llamado cada vez que llega un evento de la tecla dada.
   * - Si la dirección cambió: para el scroll anterior y arranca el nuevo.
   * - Si es la misma dirección: solo resetea el watchdog.
   * - El watchdog dispara onScrollStop si no llegan eventos en WATCHDOG_MS.
   */
  const WATCHDOG_MS = 150; // ms sin eventos → botón suelto

  const handleKeyDetected = (key: string) => {
    let direction: 'up' | 'down' | null = null;
    if (key === '1') direction = 'up';
    else if (key === '2') direction = 'down';
    else return;

    // Si cambió la dirección, notificar stop antes de arrancar la nueva
    if (activeDirectionRef.current !== null && activeDirectionRef.current !== direction) {
      onScrollStop?.();
      activeDirectionRef.current = null;
    }

    // Arrancar solo si no estaba activo en esta dirección
    if (activeDirectionRef.current === null) {
      activeDirectionRef.current = direction;
      if (direction === 'up') onScrollUp?.();
      else onScrollDown?.();
    }

    // Resetear watchdog: si no llegan más eventos → botón fue soltado
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      onScrollStop?.();
      activeDirectionRef.current = null;
    }, WATCHDOG_MS);
  };

  // Limpiar watchdog al desmontar o deshabilitar
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  const handleKeyPress = (e: any) => {
    handleKeyDetected(e.nativeEvent.key);
  };

  const handleTextChange = (text: string) => {
    if (text && text.length > 0) {
      handleKeyDetected(text.charAt(text.length - 1));
    }
  };

  if (!enabled) return null;

  return (
    <View style={styles.container}>
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
