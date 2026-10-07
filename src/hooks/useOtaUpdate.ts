import { useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

// ================================================================
// TIPOS
// ================================================================

export type UpdateCheckResult =
  | 'available'
  | 'none'
  | 'disabled'
  | 'error';

// ================================================================
// FUNCIÓN REUTILIZABLE
// Puede ser llamada desde el hook o desde la UI (botón manual).
// ================================================================

/**
 * Verifica si hay una actualización OTA disponible y, si la hay, la descarga.
 *
 * Devuelve:
 * - `'disabled'`  – expo-updates no está activo (Expo Go, dev client sin OTA)
 * - `'none'`      – ya estás en la última versión
 * - `'available'` – había actualización y fue descargada correctamente
 * - `'error'`     – falló la verificación o la descarga
 */
export async function checkAndFetchUpdate(): Promise<UpdateCheckResult> {
  if (!Updates.isEnabled) {
    return 'disabled';
  }

  try {
    const check = await Updates.checkForUpdateAsync();

    if (!check.isAvailable) {
      return 'none';
    }

    await Updates.fetchUpdateAsync();
    return 'available';
  } catch {
    return 'error';
  }
}

// ================================================================
// HOOK
// ================================================================

/**
 * Ejecuta la lógica automática de OTA:
 * - Al montar (primer arranque)
 * - Cada vez que la app vuelve a primer plano (AppState → active)
 *
 * Cuando `isUpdatePending` pasa a true (la descarga terminó), muestra
 * un Alert una sola vez por actualización.
 *
 * Se debe llamar UNA SOLA VEZ desde el layout raíz de la app.
 */
export function useOtaUpdate(): void {
  // Evita chequeos concurrentes
  const isChecking = useRef(false);

  // Evita mostrar el alert más de una vez por actualización descargada
  const alertShown = useRef(false);

  // ----------------------------------------------------------------
  // Leer el estado reactivo de expo-updates
  // ----------------------------------------------------------------
  const { isUpdatePending } = Updates.useUpdates();

  // ----------------------------------------------------------------
  // Mostrar alert cuando haya una actualización pendiente
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!isUpdatePending) return;
    if (alertShown.current) return;

    alertShown.current = true;

    Alert.alert(
      'Actualización lista',
      'Hay una nueva versión descargada. ¿Reiniciar para aplicarla?',
      [
        {
          text: 'Más tarde',
          style: 'cancel',
          onPress: () => {
            // El usuario postergó; permitir mostrar el alert de nuevo
            // en el próximo ciclo de vida (próximo foreground).
            alertShown.current = false;
          },
        },
        {
          text: 'Reiniciar',
          style: 'default',
          onPress: () => {
            Updates.reloadAsync().catch(() => {
              alertShown.current = false;
            });
          },
        },
      ],
      { cancelable: false }
    );
  }, [isUpdatePending]);

  // ----------------------------------------------------------------
  // Chequear al montar y cada vez que la app vuelve a primer plano
  // ----------------------------------------------------------------
  useEffect(() => {
    async function runCheck(): Promise<void> {
      if (isChecking.current) return;

      isChecking.current = true;

      try {
        await checkAndFetchUpdate();
      } finally {
        isChecking.current = false;
      }
    }

    // Chequeo inicial al montar el layout raíz
    runCheck();

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          runCheck();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);
}
