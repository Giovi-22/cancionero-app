import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    DebugLoggerConfig,
    LogLevel,
    logger,
} from '../utils/DebugLogger';

const STORAGE_KEY = '@app_cancionero/debug_config';

const DEFAULT_CONFIG: DebugLoggerConfig = {
    enabled: true,
    level: 'debug',
    enabledModules: [],
    disabledModules: [],
};

interface DebugContextType {
    enabled: boolean;
    level: LogLevel;

    enabledModules: string[];
    disabledModules: string[];

    isLoading: boolean;

    setEnabled: (enabled: boolean) => void;
    setLevel: (level: LogLevel) => void;

    enableModule: (module: string) => void;
    disableModule: (module: string) => void;

    clearModuleFilters: () => void;

    reset: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(
    undefined
);

interface DebugContextProviderProps {
    children: ReactNode;
}

export function DebugContextProvider({
    children,
}: DebugContextProviderProps) {
    const [config, setConfig] =
        useState<DebugLoggerConfig>(DEFAULT_CONFIG);

    const [isLoading, setIsLoading] = useState(true);

    /*
     * Carga la configuración guardada.
     */
    useEffect(() => {
        let mounted = true;

        const loadConfig = async () => {
            try {
                const stored =
                    await AsyncStorage.getItem(STORAGE_KEY);

                if (stored) {
                    const parsed =
                        JSON.parse(stored) as Partial<DebugLoggerConfig>;

                    const loadedConfig: DebugLoggerConfig = {
                        ...DEFAULT_CONFIG,
                        ...parsed,
                        enabledModules:
                            parsed.enabledModules ?? [],
                        disabledModules:
                            parsed.disabledModules ?? [],
                    };

                    if (mounted) {
                        setConfig(loadedConfig);
                        logger.configure(loadedConfig);
                    }
                } else {
                    logger.configure(DEFAULT_CONFIG);
                }
            } catch (error) {
                console.warn(
                    '[DebugContext] No se pudo cargar la configuración:',
                    error
                );

                logger.configure(DEFAULT_CONFIG);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        loadConfig();

        return () => {
            mounted = false;
        };
    }, []);

    /*
     * Guarda la configuración cada vez que cambia.
     */
    const persistConfig = useCallback(
        async (nextConfig: DebugLoggerConfig) => {
            try {
                await AsyncStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(nextConfig)
                );
            } catch (error) {
                console.warn(
                    '[DebugContext] No se pudo guardar la configuración:',
                    error
                );
            }
        },
        []
    );

    const updateConfig = useCallback(
        (nextConfig: DebugLoggerConfig) => {
            setConfig(nextConfig);
            logger.configure(nextConfig);
            persistConfig(nextConfig);
        },
        [persistConfig]
    );

    const setEnabled = useCallback(
        (enabled: boolean) => {
            updateConfig({
                ...config,
                enabled,
            });
        },
        [config, updateConfig]
    );

    const setLevel = useCallback(
        (level: LogLevel) => {
            updateConfig({
                ...config,
                level,
            });
        },
        [config, updateConfig]
    );

    const enableModule = useCallback(
        (module: string) => {
            const nextConfig: DebugLoggerConfig = {
                ...config,
                enabledModules: config.enabledModules.filter(
                    m => m !== module
                ),
                disabledModules:
                    config.disabledModules.filter(
                        m => m !== module
                    ),
            };

            updateConfig(nextConfig);
        },
        [config, updateConfig]
    );

    const disableModule = useCallback(
        (module: string) => {
            const nextConfig: DebugLoggerConfig = {
                ...config,
                enabledModules:
                    config.enabledModules.filter(
                        m => m !== module
                    ),
                disabledModules: [
                    ...config.disabledModules.filter(
                        m => m !== module
                    ),
                    module,
                ],
            };

            updateConfig(nextConfig);
        },
        [config, updateConfig]
    );

    const clearModuleFilters = useCallback(() => {
        updateConfig({
            ...config,
            enabledModules: [],
            disabledModules: [],
        });
    }, [config, updateConfig]);

    const reset = useCallback(() => {
        updateConfig({
            ...DEFAULT_CONFIG,
            enabledModules: [],
            disabledModules: [],
        });
    }, [updateConfig]);

    return (
        <DebugContext.Provider
            value={{
                enabled: config.enabled,
                level: config.level,
                enabledModules: config.enabledModules,
                disabledModules: config.disabledModules,
                isLoading,

                setEnabled,
                setLevel,

                enableModule,
                disableModule,

                clearModuleFilters,
                reset,
            }}
        >
            {children}
        </DebugContext.Provider>
    );
}

export function useDebugContext() {
    const context = useContext(DebugContext);

    if (!context) {
        throw new Error(
            'useDebugContext debe utilizarse dentro de DebugContextProvider'
        );
    }

    return context;
}
