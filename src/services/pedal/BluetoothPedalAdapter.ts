import {
    PedalEvent,
    PedalTransportType,
} from '../../types/pedal';
import { IPedalAdapter } from './IPedalAdapter';
import { StorageService } from '../StorageService';

const DEFAULT_MAPPINGS: Record<string, string> = {
    '1': 'scroll_up',
    '2': 'scroll_down',
    'ArrowUp': 'scroll_up',
    'ArrowDown': 'scroll_down',
    'PageUp': 'scroll_up',
    'PageDown': 'scroll_down',
    'ArrowRight': 'next_page',
    'ArrowLeft': 'prev_page',
    'h': 'home',
    'Home': 'home',
    'e': 'end',
    'End': 'end',
};

const WATCHDOG_MS = 700;

export class BluetoothPedalAdapter implements IPedalAdapter {
    readonly transport: PedalTransportType = 'bluetooth';

    private activeDirection: 'up' | 'down' | null = null;
    private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    private mappings: Record<string, string> = DEFAULT_MAPPINGS;
    private isBridgeActive = false;

    private eventListeners = new Set<(event: PedalEvent) => void>();
    private connectionListeners = new Set<(connected: boolean) => void>();

    constructor() {
        this.loadMappings();
    }

    async loadMappings(): Promise<void> {
        try {
            const saved = await StorageService.getSetting<Record<string, string>>(
                'pedal_mappings'
            );
            if (saved && Object.keys(saved).length > 0) {
                // Combinar los guardados asegurando soporte de 'h' y 'e' si no estaban explícitos
                this.mappings = {
                    ...DEFAULT_MAPPINGS,
                    ...saved,
                };
            } else {
                this.mappings = DEFAULT_MAPPINGS;
            }
        } catch {
            this.mappings = DEFAULT_MAPPINGS;
        }
    }

    setBridgeActive(active: boolean): void {
        if (this.isBridgeActive !== active) {
            this.isBridgeActive = active;
            this.notifyConnection(active);
            if (!active) {
                this.resetWatchdog();
            }
        }
    }

    isConnected(): boolean {
        return this.isBridgeActive;
    }

    isConnecting(): boolean {
        return false;
    }

    async connect(): Promise<void> {
        await this.loadMappings();
        this.setBridgeActive(true);
    }

    disconnect(): void {
        this.setBridgeActive(false);
        this.resetWatchdog();
    }

    private resetWatchdog(): void {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }
        if (this.activeDirection !== null) {
            const releaseType =
                this.activeDirection === 'up' ? 'UP_RELEASE' : 'DOWN_RELEASE';
            this.activeDirection = null;
            this.emitEvent({
                type: releaseType,
                timestamp: Date.now(),
                source: 'bluetooth',
            });
        }
    }

    /**
     * Recibe teclas físicas ya deduplicadas desde BluetoothInputBridge.
     */
    handleRawKey(key: string): void {
        if (!key) return;

        let action = this.mappings[key];

        // Fallback para mayúsculas/minúsculas de HOME/END
        if (!action) {
            if (key === 'h' || key === 'H' || key === 'Home') action = 'home';
            else if (key === 'e' || key === 'E' || key === 'End') action = 'end';
        }

        if (!action) return;

        const now = Date.now();

        // 1. Manejo discreto de HOME
        if (action === 'home') {
            this.emitEvent({
                type: 'HOME',
                timestamp: now,
                source: 'bluetooth',
            });
            return;
        }

        // 2. Manejo discreto de END
        if (action === 'end') {
            this.emitEvent({
                type: 'END',
                timestamp: now,
                source: 'bluetooth',
            });
            return;
        }

        // 3. Manejo continuo de SCROLL UP / DOWN
        let direction: 'up' | 'down' | null = null;
        if (action === 'scroll_up') direction = 'up';
        else if (action === 'scroll_down') direction = 'down';
        else return; // Otras acciones (next_page, etc.) se preservan fuera de este adaptador

        // Si cambió la dirección, liberar la anterior antes de iniciar la nueva
        if (
            this.activeDirection !== null &&
            this.activeDirection !== direction
        ) {
            const previousRelease =
                this.activeDirection === 'up' ? 'UP_RELEASE' : 'DOWN_RELEASE';
            this.emitEvent({
                type: previousRelease,
                timestamp: now,
                source: 'bluetooth',
            });
            this.activeDirection = null;
        }

        // Iniciar pulsación si no estaba activo en esta dirección
        if (this.activeDirection === null) {
            this.activeDirection = direction;
            const pressType = direction === 'up' ? 'UP_PRESS' : 'DOWN_PRESS';
            this.emitEvent({
                type: pressType,
                timestamp: now,
                source: 'bluetooth',
            });
        }

        // Resetear Watchdog de 700 ms (al dejar de recibir teclas repetidas -> soltó botón)
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
        }

        this.watchdogTimer = setTimeout(() => {
            if (this.activeDirection !== null) {
                const releaseType =
                    this.activeDirection === 'up'
                        ? 'UP_RELEASE'
                        : 'DOWN_RELEASE';
                this.activeDirection = null;
                this.emitEvent({
                    type: releaseType,
                    timestamp: Date.now(),
                    source: 'bluetooth',
                });
            }
            this.watchdogTimer = null;
        }, WATCHDOG_MS);
    }

    private emitEvent(event: PedalEvent): void {
        this.eventListeners.forEach(listener => listener(event));
    }

    onEvent(listener: (event: PedalEvent) => void): () => void {
        this.eventListeners.add(listener);
        return () => {
            this.eventListeners.delete(listener);
        };
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        this.connectionListeners.add(listener);
        return () => {
            this.connectionListeners.delete(listener);
        };
    }

    private notifyConnection(connected: boolean): void {
        this.connectionListeners.forEach(listener => listener(connected));
    }
}

export const bluetoothPedalAdapter = new BluetoothPedalAdapter();
