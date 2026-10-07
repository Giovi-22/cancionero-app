/**
 * PedalService
 *
 * Fachada/orquestador central del sistema de pedal.
 *
 * Responsabilidad:
 *   Ocultar los adapters concretos (Bluetooth, WiFi) del resto de la aplicación.
 *   Exponer una API unificada e independiente del transporte.
 *
 * Regla de dependencias:
 *   UI / React → usePedal → PedalService → adapters
 *
 * INVARIANTES:
 * - connect() NUNCA hace discover() automáticamente.
 * - discover() escucha pasivamente el broadcast UDP del ESP32 (puerto 4444).
 * - No se inventa ningún protocolo que el firmware no soporta.
 * - Los eventos de ambos adapters se fanout a todos los listeners registrados.
 */
import {
    PedalDevice,
    PedalEvent,
} from '../types/pedal';

import { bluetoothPedalAdapter } from './pedal/BluetoothPedalAdapter';
import { wifiPedalAdapter } from './pedal/WifiPedalAdapter';

export type PedalEventListener = (event: PedalEvent) => void;
export type PedalConnectionListener = (connected: boolean) => void;
export type PedalDeviceListener = (device: PedalDevice | null) => void;

class PedalServiceClass {
    private eventListeners = new Set<PedalEventListener>();
    private connectionListeners = new Set<PedalConnectionListener>();
    private deviceListeners = new Set<PedalDeviceListener>();

    constructor() {
        // Fan-out de eventos de ambos adapters a todos los listeners del servicio
        bluetoothPedalAdapter.onEvent(event => this.emitEvent(event));
        wifiPedalAdapter.onEvent(event => this.emitEvent(event));

        // Fan-out de cambios de conexión
        bluetoothPedalAdapter.onConnectionChange(connected =>
            this.emitConnectionChange(connected)
        );
        wifiPedalAdapter.onConnectionChange(connected =>
            this.emitConnectionChange(connected)
        );
    }

    // ──────────────────────────────────────────────────────────
    // Eventos unificados
    // ──────────────────────────────────────────────────────────

    private emitEvent(event: PedalEvent): void {
        this.eventListeners.forEach(listener => listener(event));
    }

    private emitConnectionChange(connected: boolean): void {
        this.connectionListeners.forEach(listener => listener(connected));
    }

    /**
     * Suscribe a eventos normalizados del pedal (de cualquier transporte).
     * Retorna una función para cancelar la suscripción.
     */
    onEvent(listener: PedalEventListener): () => void {
        this.eventListeners.add(listener);
        return () => {
            this.eventListeners.delete(listener);
        };
    }

    /** @deprecated Alias de onEvent para compatibilidad con código existente. */
    addEventListener(listener: PedalEventListener): () => void {
        return this.onEvent(listener);
    }

    /**
     * Suscribe a cambios de conexión de cualquier transporte.
     * Retorna una función para cancelar la suscripción.
     */
    onConnectionChange(listener: PedalConnectionListener): () => void {
        this.connectionListeners.add(listener);
        return () => {
            this.connectionListeners.delete(listener);
        };
    }

    /** @deprecated Alias de onConnectionChange para compatibilidad con código existente. */
    addConnectionListener(listener: PedalConnectionListener): () => void {
        return this.onConnectionChange(listener);
    }

    /**
     * Suscribe a cambios en el dispositivo detectado.
     * Retorna una función para cancelar la suscripción.
     */
    onDeviceChange(listener: PedalDeviceListener): () => void {
        this.deviceListeners.add(listener);
        return () => {
            this.deviceListeners.delete(listener);
        };
    }

    /** @deprecated Alias de onDeviceChange para compatibilidad con código existente. */
    addDeviceListener(listener: PedalDeviceListener): () => void {
        return this.onDeviceChange(listener);
    }

    private emitDeviceChange(device: PedalDevice | null): void {
        this.deviceListeners.forEach(listener => listener(device));
    }

    // ──────────────────────────────────────────────────────────
    // Bluetooth HID
    // ──────────────────────────────────────────────────────────

    /**
     * Entrega una tecla HID al adaptador Bluetooth.
     * Llamado exclusivamente desde BluetoothInputBridge.
     */
    handleRawKey(key: string): void {
        bluetoothPedalAdapter.handleRawKey(key);
    }

    /**
     * Notifica al adaptador Bluetooth si el puente HID está activo.
     * Llamado exclusivamente desde BluetoothInputBridge.
     */
    setBtBridgeActive(active: boolean): void {
        bluetoothPedalAdapter.setBridgeActive(active);
    }

    /**
     * Recarga los mappings del adaptador Bluetooth desde el almacenamiento.
     * Llamado desde BluetoothInputBridge cuando la app vuelve a primer plano.
     */
    loadBtMappings(): Promise<void> {
        return bluetoothPedalAdapter.loadMappings();
    }

    // ──────────────────────────────────────────────────────────
    // WiFi — Discovery
    // ──────────────────────────────────────────────────────────

    /**
     * Escucha pasivamente el broadcast UDP del ESP32 en el puerto 4444.
     * El ESP32 envía {"ip":"...","port":8080} cada ~3 segundos.
     * NUNCA envía {"type":"discover"} — el firmware no lo soporta.
     */
    async discover(timeoutMs?: number): Promise<PedalDevice | null> {
        const found = await wifiPedalAdapter.discover(timeoutMs);
        if (found) {
            this.emitDeviceChange(found);
        }
        return found;
    }

    // ──────────────────────────────────────────────────────────
    // WiFi — Conexión TCP
    // ──────────────────────────────────────────────────────────

    /**
     * Conecta al pedal WiFi por TCP :8080.
     * NUNCA llama discover() internamente.
     * Si no se especifica target ni hay un device descubierto, lanza error.
     */
    async connect(device?: PedalDevice): Promise<void> {
        return wifiPedalAdapter.connect(device);
    }

    /**
     * Desconecta el socket TCP WiFi.
     */
    disconnect(): void {
        wifiPedalAdapter.disconnect();
    }

    // ──────────────────────────────────────────────────────────
    // Estado
    // ──────────────────────────────────────────────────────────

    getDevice(): PedalDevice | null {
        return wifiPedalAdapter.getDiscoveredDevice();
    }

    isConnected(): boolean {
        return wifiPedalAdapter.isConnected() || bluetoothPedalAdapter.isConnected();
    }

    isConnecting(): boolean {
        return wifiPedalAdapter.isConnecting();
    }

    isDiscovering(): boolean {
        return wifiPedalAdapter.isDiscovering();
    }
}

export const PedalService = new PedalServiceClass();