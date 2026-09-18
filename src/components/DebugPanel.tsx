import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    LogLevel,
} from '../utils/DebugLogger';

import {
    useDebugContext,
} from '../context/DebugContext';

import { COLORS } from '../constants/theme';
import { Button } from './common/Button';
import { router } from 'expo-router';

const MODULES = [
    'Auth',
    'User',
    'Band',
    'Setlist',
    'Director',
    'SongViewer',
    'Drive',
    'Storage',
    'Sync',
    'App',
];

const LEVELS: LogLevel[] = [
    'debug',
    'info',
    'warn',
    'error',
    'none',
];

export function DebugPanel() {
    const {
        enabled,
        level,
        disabledModules,
        isLoading,

        setEnabled,
        setLevel,

        enableModule,
        disableModule,

        clearModuleFilters,
        reset,
    } = useDebugContext();

    if (isLoading) {
        return null;
    }

    const handlePress = () => {
        router.push('/user/settings/debug/udp-test');
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            <Text style={styles.title}>
                Debug
            </Text>

            <Text style={styles.description}>
                Configuración global de logs de la aplicación.
            </Text>

            {/* GLOBAL */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Logging
                </Text>

                <View style={styles.row}>
                    <View style={styles.rowText}>
                        <Text style={styles.label}>
                            Logs globales
                        </Text>

                        <Text style={styles.secondary}>
                            Activa o desactiva debug, info y warnings.
                        </Text>
                    </View>

                    <Switch
                        value={enabled}
                        onValueChange={setEnabled}
                        trackColor={{
                            false: COLORS.border,
                            true: COLORS.accent,
                        }}
                    />
                </View>
            </View>

            {/* LEVEL */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Nivel mínimo
                </Text>

                <View style={styles.levelContainer}>
                    {LEVELS.map(item => {
                        const selected = level === item;

                        return (
                            <TouchableOpacity
                                key={item}
                                style={[
                                    styles.levelButton,
                                    selected &&
                                    styles.levelButtonSelected,
                                ]}
                                onPress={() => setLevel(item)}
                            >
                                <Text
                                    style={[
                                        styles.levelText,
                                        selected &&
                                        styles.levelTextSelected,
                                    ]}
                                >
                                    {item.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* MODULES */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Módulos
                    </Text>

                    <TouchableOpacity
                        onPress={clearModuleFilters}
                    >
                        <Text style={styles.actionText}>
                            Todos
                        </Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.secondary}>
                    Desactivá módulos específicos para reducir
                    el ruido de la consola.
                </Text>

                {MODULES.map(module => {
                    const isDisabled =
                        disabledModules.includes(module);

                    return (
                        <View
                            key={module}
                            style={styles.row}
                        >
                            <Text style={styles.label}>
                                {module}
                            </Text>

                            <Switch
                                value={!isDisabled}
                                onValueChange={value => {
                                    if (value) {
                                        enableModule(module);
                                    } else {
                                        disableModule(module);
                                    }
                                }}
                                trackColor={{
                                    false: COLORS.border,
                                    true: COLORS.accent,
                                }}
                            />
                        </View>
                    );
                })}
            </View>

            {/* RESET */}
            <TouchableOpacity
                style={styles.resetButton}
                onPress={reset}
            >
                <Text style={styles.resetText}>
                    Restablecer configuración
                </Text>
            </TouchableOpacity>

            <Button
                onPress={handlePress}
                title='UDP Test'
                variant='secondary'
                style={{ marginTop: 10 }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    content: {
        padding: 20,
        paddingBottom: 40,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 6,
    },

    description: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        marginBottom: 24,
    },

    section: {
        marginBottom: 28,
    },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },

    sectionTitle: {
        color: COLORS.foreground,
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 10,
    },

    row: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },

    rowText: {
        flex: 1,
        paddingRight: 16,
    },

    label: {
        color: COLORS.foreground,
        fontSize: 16,
        fontWeight: '500',
    },

    secondary: {
        color: COLORS.mutedForeground,
        fontSize: 13,
        marginTop: 3,
    },

    levelContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    levelButton: {
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    levelButtonSelected: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.accent,
    },

    levelText: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        fontWeight: '600',
    },

    levelTextSelected: {
        color: COLORS.foreground,
    },

    actionText: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: '600',
    },

    resetButton: {
        marginTop: 10,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    resetText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
});