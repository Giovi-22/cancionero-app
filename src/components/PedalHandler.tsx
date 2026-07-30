import React, { useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { StorageService } from '../services/StorageService';

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
 * Key mapping: cargado dinámicamente desde StorageService 'pedal_mappings'.
 *   Teclas mapeadas a 'scroll_up'   → onScrollUp
 *   Teclas mapeadas a 'scroll_down' → onScrollDown
 *
 * Si no hay mappings guardados, usa los valores por defecto:
 *   '1' / 'ArrowUp' / 'PageUp'   → scroll_up
 *   '2' / 'ArrowDown' / 'PageDown' → scroll_down
 *
 * MODELO WATCHDOG:
 * Cuando llega un evento de tecla, señalamos "scroll activo" (onScrollUp/Down)
 * y reiniciamos un timer de 200ms. Si no llegan más eventos en ese tiempo,
 * asumimos que el botón fue suelto y llamamos onScrollStop.
 *
 * PROBLEMA ANDROID + HID BT:
 * Ciclo blur→focus periódico para forzar al OS a re-enrutar eventos HID
 * cuando el pedal se reconecta.
 */

const DEFAULT_MAPPINGS: Record<string, string> = {
  '1': 'scroll_up',
  '2': 'scroll_down',
  'ArrowUp': 'scroll_up',
  'ArrowDown': 'scroll_down',
  'PageUp': 'scroll_up',
  'PageDown': 'scroll_down',
  'ArrowRight': 'next_page',
  'ArrowLeft': 'prev_page',
};

export const PedalHandler: React.FC<PedalHandlerProps> = ({
  onScrollUp,
  onScrollDown,
  onScrollStop,
  enabled = true,
}) => {
  const inputRef = useRef<TextInput>(null);

  // Ref que siempre tiene el mapping vigente (evita stale closure en watchdog/handlers)
  const mappingsRef = useRef<Record<string, string>>(DEFAULT_MAPPINGS);

  const loadMappings = async () => {
    try {
      const saved = await StorageService.getSetting<Record<string, string>>('pedal_mappings');
      if (saved && Object.keys(saved).length > 0) {
        mappingsRef.current = saved;
      } else {
        mappingsRef.current = DEFAULT_MAPPINGS;
      }
    } catch {
      mappingsRef.current = DEFAULT_MAPPINGS;
    }
  };

  // Cargar mappings al montar
  useEffect(() => {
    loadMappings();
  }, []);

  // ── Re-enrutamiento HID (fix Android BT reconnect) ────────────────────────
  const reaquireFocus = () => {
    if (!inputRef.current || activeDirectionRef.current !== null) return;
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
      if (nextState === 'active') {
        // Recargar mappings por si el usuario volvió de pedal-config
        loadMappings();
        reaquireFocus();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [enabled]);

  // ── Watchdog por dirección ─────────────────────────────────────────────────
  const watchdogRef = useRef<any>(null);
  const activeDirectionRef = useRef<'up' | 'down' | null>(null);

  /**
   * Llamado cada vez que llega un evento de la tecla dada.
   * - Resuelve la tecla a una acción usando pedal_mappings (dinámico).
   * - Si la dirección cambió: para el scroll anterior y arranca el nuevo.
   * - Si es la misma dirección: solo resetea el watchdog (sin interrumpir el rAF).
   * - El watchdog dispara onScrollStop si no llegan eventos en WATCHDOG_MS.
   */
  const WATCHDOG_MS = 700; // ms sin eventos → botón suelto

  const handleKeyDetected = (key: string) => {
    const action = mappingsRef.current[key];
    if (!action) return; // Tecla no mapeada → ignorar

    let direction: 'up' | 'down' | null = null;
    if (action === 'scroll_up') direction = 'up';
    else if (action === 'scroll_down') direction = 'down';
    else return; // Otras acciones (next_page, etc.) no las maneja este componente

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

  // Limpiar watchdog al desmontar
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
