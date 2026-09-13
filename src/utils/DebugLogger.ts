/**
 * DebugLogger
 *
 * Logger global de la aplicación.
 *
 * Permite:
 * - Activar / desactivar logs.
 * - Filtrar por nivel.
 * - Filtrar por módulo.
 * - Mantener errores visibles.
 *
 * Uso:
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
    enabledModules: string[];
    disabledModules: string[];
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 99,
};

const DEFAULT_CONFIG: DebugLoggerConfig = {
    enabled: true,
    level: 'debug',
    enabledModules: [],
    disabledModules: [],
};

class DebugLogger {
    private config: DebugLoggerConfig = {
        ...DEFAULT_CONFIG,
        enabledModules: [],
        disabledModules: [],
    };

    /**
     * Configura el logger.
     */
    configure(config: Partial<DebugLoggerConfig>) {
        this.config = {
            ...this.config,
            ...config,
            enabledModules:
                config.enabledModules ?? this.config.enabledModules,
            disabledModules:
                config.disabledModules ?? this.config.disabledModules,
        };
    }

    /**
     * Activa/desactiva los logs globalmente.
     */
    setEnabled(enabled: boolean) {
        this.config.enabled = enabled;
    }

    /**
     * Cambia el nivel mínimo de log.
     */
    setLevel(level: LogLevel) {
        this.config.level = level;
    }

    /**
     * Activa un módulo específico.
     */
    enableModule(module: string) {
        this.config.enabledModules = [
            ...this.config.enabledModules.filter(m => m !== module),
        ];

        this.config.disabledModules =
            this.config.disabledModules.filter(m => m !== module);
    }

    /**
     * Desactiva un módulo específico.
     */
    disableModule(module: string) {
        this.config.disabledModules = [
            ...this.config.disabledModules.filter(m => m !== module),
            module,
        ];

        this.config.enabledModules =
            this.config.enabledModules.filter(m => m !== module);
    }

    /**
     * Limpia todos los filtros de módulos.
     */
    clearModuleFilters() {
        this.config.enabledModules = [];
        this.config.disabledModules = [];
    }

    /**
     * Obtiene una copia de la configuración actual.
     */
    getConfig(): DebugLoggerConfig {
        return {
            ...this.config,
            enabledModules: [...this.config.enabledModules],
            disabledModules: [...this.config.disabledModules],
        };
    }

    debug(module: string, message: string, ...data: any[]) {
        this.log('debug', module, message, data);
    }

    info(module: string, message: string, ...data: any[]) {
        this.log('info', module, message, data);
    }

    warn(module: string, message: string, ...data: any[]) {
        this.log('warn', module, message, data);
    }

    error(module: string, message: string, ...data: any[]) {
        /*
         * Los errores siempre se muestran.
         *
         * Esto es intencional: aunque el usuario desactive
         * el modo debug, no queremos esconder errores reales.
         */
        console.error(`[${module}] ${message}`, ...data);
    }

    private log(
        level: Exclude<LogLevel, 'none'>,
        module: string,
        message: string,
        data: any[],
    ) {
        if (!this.config.enabled) {
            return;
        }

        if (this.config.level === 'none') {
            return;
        }

        if (
            LEVEL_PRIORITY[level] <
            LEVEL_PRIORITY[this.config.level]
        ) {
            return;
        }

        /*
         * Si el módulo está explícitamente desactivado,
         * no mostramos sus logs.
         */
        if (this.config.disabledModules.includes(module)) {
            return;
        }

        /*
         * Si existe una whitelist de módulos,
         * solamente mostramos esos módulos.
         */
        if (
            this.config.enabledModules.length > 0 &&
            !this.config.enabledModules.includes(module)
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

export const logger = new DebugLogger();