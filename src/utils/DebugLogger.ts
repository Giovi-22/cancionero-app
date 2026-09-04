/**
 * DebugLogger
 *
 * Logger centralizado de la aplicación.
 *
 * Permite:
 * - Activar / desactivar logs.
 * - Filtrar por nivel.
 * - Filtrar por módulo.
 * - Mantener errores visibles aunque el debug esté apagado.
 *
 * Ejemplo:
 *
 *   import { logger } from '../utils/DebugLogger';
 *
 *   logger.debug('Band', 'Cargando bandas...');
 *   logger.info('Band', 'Banda seleccionada', band);
 *   logger.warn('Auth', 'Token no disponible');
 *   logger.error('Director', 'Error iniciando sesión', error);
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export interface DebugLoggerConfig {
    enabled: boolean;
    level: LogLevel;
    enabledModules?: string[];
    disabledModules?: string[];
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 99,
};

class DebugLogger {
    private enabled = true;

    private level: LogLevel = 'debug';

    private enabledModules: Set<string> = new Set();

    private disabledModules: Set<string> = new Set();

    /**
     * Configuración general.
     */
    configure(config: Partial<DebugLoggerConfig>) {
        if (config.enabled !== undefined) {
            this.enabled = config.enabled;
        }

        if (config.level !== undefined) {
            this.level = config.level;
        }

        if (config.enabledModules !== undefined) {
            this.enabledModules = new Set(config.enabledModules);
        }

        if (config.disabledModules !== undefined) {
            this.disabledModules = new Set(config.disabledModules);
        }
    }

    /**
     * Activa o desactiva completamente el logger.
     *
     * Los errores siguen mostrándose mediante console.error
     * aunque el logger esté desactivado.
     */
    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    /**
     * Cambia el nivel mínimo que se muestra.
     */
    setLevel(level: LogLevel) {
        this.level = level;
    }

    /**
     * Activa un módulo.
     */
    enableModule(module: string) {
        this.enabledModules.add(module);
        this.disabledModules.delete(module);
    }

    /**
     * Desactiva un módulo.
     */
    disableModule(module: string) {
        this.disabledModules.add(module);
        this.enabledModules.delete(module);
    }

    /**
     * Limpia todos los filtros de módulos.
     */
    clearModuleFilters() {
        this.enabledModules.clear();
        this.disabledModules.clear();
    }

    /**
     * Devuelve la configuración actual.
     */
    getConfig(): DebugLoggerConfig {
        return {
            enabled: this.enabled,
            level: this.level,
            enabledModules: Array.from(this.enabledModules),
            disabledModules: Array.from(this.disabledModules),
        };
    }

    /**
     * Log DEBUG.
     */
    debug(module: string, message: string, ...data: any[]) {
        this.log('debug', module, message, data);
    }

    /**
     * Log INFO.
     */
    info(module: string, message: string, ...data: any[]) {
        this.log('info', module, message, data);
    }

    /**
     * Log WARNING.
     */
    warn(module: string, message: string, ...data: any[]) {
        this.log('warn', module, message, data);
    }

    /**
     * Log ERROR.
     */
    error(module: string, message: string, ...data: any[]) {
        this.log('error', module, message, data);
    }

    private log(
        level: Exclude<LogLevel, 'none'>,
        module: string,
        message: string,
        data: any[],
    ) {
        /*
         * Los errores se mantienen visibles aunque el logger
         * esté desactivado.
         */
        if (level === 'error') {
            console.error(`[${module}] ${message}`, ...data);
            return;
        }

        if (!this.enabled) {
            return;
        }

        if (this.level === 'none') {
            return;
        }

        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
            return;
        }

        if (this.disabledModules.has(module)) {
            return;
        }

        /*
         * Si hay una whitelist de módulos, solamente mostramos
         * los módulos incluidos.
         */
        if (
            this.enabledModules.size > 0 &&
            !this.enabledModules.has(module)
        ) {
            return;
        }

        const prefix = `[${module}]`;

        switch (level) {
            case 'debug':
                console.log(prefix, message, ...data);
                break;

            case 'info':
                console.info(prefix, message, ...data);
                break;

            case 'warn':
                console.warn(prefix, message, ...data);
                break;
        }
    }
}

/**
 * Instancia global.
 *
 * Se utiliza en toda la aplicación:
 *
 *   import { logger } from '../utils/DebugLogger';
 */
export const logger = new DebugLogger();
