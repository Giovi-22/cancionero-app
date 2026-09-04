import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Plus,
    Music2,
    ChevronRight,
    Radio,
    Trash2,
} from 'lucide-react-native';

import {
    BandSetlist,
    DirectorSession,
} from '../../types/band';
import { COLORS } from '../../constants/theme';

interface BandSetlistListProps {
    bandId: string | null;
    setlists: BandSetlist[];
    loading: boolean;
    error: string | null;
    activeSession?: DirectorSession | null;

    onSelectSetlist?: (setlist: BandSetlist) => void;
    onCreateSetlist?: () => void;

    // Eliminación
    canDeleteSetlist?: boolean;
    onDeleteSetlist?: (setlist: BandSetlist) => void;
    deletingSetlistId?: string | null;
}

export function BandSetlistList({
    bandId,
    setlists,
    loading,
    error,
    activeSession,
    onSelectSetlist,
    onCreateSetlist,
    canDeleteSetlist = false,
    onDeleteSetlist,
    deletingSetlistId = null,
}: BandSetlistListProps) {

    /**
     * Estado: sin banda seleccionada.
     */
    if (!bandId) {
        return (
            <View style={styles.centerContainer}>
                <Music2
                    size={40}
                    color={COLORS.mutedForeground}
                />

                <Text style={styles.emptyTitle}>
                    No hay una banda seleccionada
                </Text>

                <Text style={styles.emptyText}>
                    Seleccioná una banda para ver su repertorio.
                </Text>
            </View>
        );
    }

    /**
     * Estado: cargando repertorios.
     */
    if (loading && setlists.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator
                    size="large"
                    color={COLORS.accent}
                />

                <Text style={styles.loadingText}>
                    Cargando repertorio...
                </Text>
            </View>
        );
    }

    /**
     * Estado: error sin datos disponibles.
     */
    if (error && setlists.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Music2
                    size={40}
                    color={COLORS.mutedForeground}
                />

                <Text style={styles.emptyTitle}>
                    No se pudo cargar el repertorio
                </Text>

                <Text style={styles.errorText}>
                    {error}
                </Text>

                <Text style={styles.retryText}>
                    Intentá nuevamente más tarde.
                </Text>
            </View>
        );
    }

    /**
     * Render de cada repertorio.
     */
    const renderSetlist = ({
        item,
    }: {
        item: BandSetlist;
    }) => {
        const isActive =
            activeSession?.setlistId === item.id;

        const isDeleting =
            deletingSetlistId === item.id;

        return (
            <View
                style={[
                    styles.setlistCard,
                    isActive && styles.activeSetlistCard,
                    isDeleting && styles.deletingSetlistCard,
                ]}
            >
                {/* Zona principal del repertorio */}
                <TouchableOpacity
                    style={styles.setlistMainButton}
                    activeOpacity={0.7}
                    disabled={isDeleting}
                    onPress={() =>
                        onSelectSetlist?.(item)
                    }
                >
                    <View
                        style={[
                            styles.iconContainer,
                            isActive &&
                            styles.activeIconContainer,
                        ]}
                    >
                        <Music2
                            size={22}
                            color={COLORS.accent}
                        />
                    </View>

                    <View style={styles.setlistInfo}>
                        <View style={styles.setlistNameRow}>
                            <Text
                                style={styles.setlistName}
                                numberOfLines={1}
                            >
                                {item.name}
                            </Text>

                            {isActive && (
                                <View style={styles.liveBadge}>
                                    <Radio
                                        size={12}
                                        color={
                                            COLORS.background
                                        }
                                    />

                                    <Text
                                        style={
                                            styles.liveBadgeText
                                        }
                                    >
                                        EN VIVO
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.songCount}>
                            {item.songIds?.length ?? 0}{' '}
                            {item.songIds?.length === 1
                                ? 'canción'
                                : 'canciones'}
                        </Text>

                        {item.date && (
                            <Text
                                style={styles.date}
                                numberOfLines={1}
                            >
                                {item.date}
                            </Text>
                        )}
                    </View>

                    {!isDeleting && (
                        <ChevronRight
                            size={22}
                            color={
                                isActive
                                    ? COLORS.accent
                                    : COLORS.mutedForeground
                            }
                        />
                    )}
                </TouchableOpacity>

                {/* Botón eliminar */}
                {canDeleteSetlist &&
                    onDeleteSetlist &&
                    !isActive && (
                        <TouchableOpacity
                            style={styles.deleteButton}
                            activeOpacity={0.7}
                            disabled={isDeleting}
                            onPress={() =>
                                onDeleteSetlist(item)
                            }
                        >
                            {isDeleting ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#ef4444"
                                />
                            ) : (
                                <Trash2
                                    size={19}
                                    color="#ef4444"
                                />
                            )}
                        </TouchableOpacity>
                    )}

                {/* Estado eliminando */}
                {isDeleting && (
                    <View style={styles.deletingOverlay}>
                        <ActivityIndicator
                            size="small"
                            color={COLORS.accent}
                        />

                        <Text
                            style={
                                styles.deletingText
                            }
                        >
                            Eliminando...
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    /**
     * Estado: no hay repertorios.
     */
    if (setlists.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.title}>
                            Repertorio
                        </Text>

                        <Text style={styles.subtitle}>
                            Organizá las canciones de la banda.
                        </Text>
                    </View>

                    {onCreateSetlist && (
                        <TouchableOpacity
                            style={styles.addButton}
                            activeOpacity={0.8}
                            onPress={onCreateSetlist}
                        >
                            <Plus
                                size={20}
                                color={COLORS.background}
                            />

                            <Text
                                style={styles.addButtonText}
                            >
                                Nuevo
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.emptyListContainer}>
                    <Music2
                        size={48}
                        color={COLORS.mutedForeground}
                    />

                    <Text style={styles.emptyTitle}>
                        Todavía no hay repertorios
                    </Text>

                    <Text style={styles.emptyText}>
                        Creá el primer repertorio de la banda
                        para comenzar a organizar las canciones.
                    </Text>

                    {onCreateSetlist && (
                        <TouchableOpacity
                            style={
                                styles.emptyCreateButton
                            }
                            activeOpacity={0.8}
                            onPress={onCreateSetlist}
                        >
                            <Plus
                                size={20}
                                color={COLORS.background}
                            />

                            <Text
                                style={
                                    styles.emptyCreateButtonText
                                }
                            >
                                Crear repertorio
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    /**
     * Estado normal: hay repertorios.
     */
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <Text style={styles.title}>
                        Repertorio
                    </Text>

                    <Text style={styles.subtitle}>
                        {setlists.length === 1
                            ? '1 repertorio'
                            : `${setlists.length} repertorios`}
                    </Text>
                </View>

                {onCreateSetlist && (
                    <TouchableOpacity
                        style={styles.addButton}
                        activeOpacity={0.8}
                        onPress={onCreateSetlist}
                    >
                        <Plus
                            size={20}
                            color={COLORS.background}
                        />

                        <Text style={styles.addButtonText}>
                            Nuevo
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {error && (
                <View style={styles.warningContainer}>
                    <Text style={styles.warningText}>
                        {error}
                    </Text>
                </View>
            )}

            <FlatList
                data={setlists}
                keyExtractor={item => item.id}
                renderItem={renderSetlist}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
    },

    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 16,
        gap: 12,
    },

    headerInfo: {
        flex: 1,
    },

    title: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.foreground,
    },

    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: COLORS.mutedForeground,
    },

    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: COLORS.accent,
    },

    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.background,
    },

    listContent: {
        paddingBottom: 24,
    },

    setlistCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: 'transparent',
        overflow: 'hidden',
    },

    activeSetlistCard: {
        borderColor: COLORS.accent,
    },

    deletingSetlistCard: {
        opacity: 0.7,
    },

    setlistMainButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        minWidth: 0,
    },

    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        marginRight: 12,
    },

    activeIconContainer: {
        borderWidth: 1,
        borderColor: COLORS.accent,
    },

    setlistInfo: {
        flex: 1,
        minWidth: 0,
    },

    setlistNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    setlistName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.foreground,
    },

    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: COLORS.accent,
    },

    liveBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.background,
    },

    songCount: {
        marginTop: 4,
        fontSize: 13,
        color: COLORS.mutedForeground,
    },

    date: {
        marginTop: 2,
        fontSize: 12,
        color: COLORS.mutedForeground,
    },

    deleteButton: {
        width: 48,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: 1,
        borderLeftColor: COLORS.border,
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
    },

    deletingOverlay: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        backgroundColor: COLORS.surface,
    },

    deletingText: {
        fontSize: 12,
        color: COLORS.mutedForeground,
        fontWeight: '600',
    },

    emptyListContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 80,
    },

    emptyTitle: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.foreground,
        textAlign: 'center',
    },

    emptyText: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.mutedForeground,
        textAlign: 'center',
    },

    emptyCreateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: COLORS.accent,
    },

    emptyCreateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.background,
    },

    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.mutedForeground,
    },

    errorText: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.mutedForeground,
        textAlign: 'center',
    },

    retryText: {
        marginTop: 12,
        fontSize: 13,
        color: COLORS.mutedForeground,
        textAlign: 'center',
    },

    warningContainer: {
        marginBottom: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: COLORS.surface,
    },

    warningText: {
        fontSize: 13,
        color: COLORS.mutedForeground,
    },
});