import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { ChevronRight, Radio } from 'lucide-react-native';
import { router } from 'expo-router';

import { Band, DirectorSession } from '../../types/band';
import { DirectorSessionService } from '../../services/DirectorSessionService';
import { COLORS } from '../../constants/theme';

interface ActiveDirectorSessionsBannerProps {
    bands: Band[];
}

export const ActiveDirectorSessionsBanner = ({
    bands,
}: ActiveDirectorSessionsBannerProps) => {
    const [sessions, setSessions] = useState<DirectorSession[]>([]);

    useEffect(() => {
        const activeBands = bands.filter(
            band => !!band.activeSessionId
        );

        // No hay bandas con Director Mode activo
        if (activeBands.length === 0) {
            setSessions([]);
            return;
        }

        const sessionsMap = new Map<string, DirectorSession>();

        // Inicializamos solamente con las bandas actualmente activas.
        // Esto evita conservar sesiones de bandas que dejaron de estar activas.
        setSessions([]);

        const unsubscribes = activeBands.map(band =>
            DirectorSessionService.subscribeToActiveSession(
                band.id,
                session => {
                    if (session) {
                        sessionsMap.set(band.id, session);
                    } else {
                        sessionsMap.delete(band.id);
                    }

                    setSessions(Array.from(sessionsMap.values()));
                }
            )
        );

        return () => {
            unsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [bands]);

    if (sessions.length === 0) {
        return null;
    }

    const handleSessionPress = (session: DirectorSession) => {
        router.push({
            pathname: '/setlist-player/[setlistId]',
            params: {
                setlistId: session.setlistId,
                bandId: session.bandId,
            },
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Radio size={18} color="#ef4444" />
                <Text style={styles.sectionTitle}>
                    Sesiones activas
                </Text>
            </View>

            {sessions.map(session => {
                const band = bands.find(
                    b => b.id === session.bandId
                );

                return (
                    <TouchableOpacity
                        key={session.id}
                        style={styles.card}
                        onPress={() => handleSessionPress(session)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                        </View>

                        <View style={styles.content}>
                            <Text style={styles.modeLabel}>
                                DIRECTOR MODE
                            </Text>

                            <Text
                                style={styles.bandName}
                                numberOfLines={1}
                            >
                                {band?.name || 'Banda'}
                            </Text>

                            <Text
                                style={styles.setlistName}
                                numberOfLines={1}
                            >
                                {session.setlistName}
                            </Text>

                            <Text
                                style={styles.directorName}
                                numberOfLines={1}
                            >
                                Dirige {session.directorName}
                            </Text>
                        </View>

                        <ChevronRight
                            size={22}
                            color={COLORS.mutedForeground}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 25,
    },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#18181b',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#ef444460',
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
    },

    liveIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ef444415',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },

    liveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },

    content: {
        flex: 1,
    },

    modeLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#ef4444',
        letterSpacing: 0.8,
        marginBottom: 2,
    },

    bandName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.foreground,
    },

    setlistName: {
        fontSize: 11,
        color: COLORS.mutedForeground,
        marginTop: 2,
    },

    directorName: {
        fontSize: 11,
        color: COLORS.mutedForeground,
        marginTop: 2,
    },
});