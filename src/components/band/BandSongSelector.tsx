import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
    Check,
    ChevronLeft,
    Music2,
    Search,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '../../context/AppContext';
import { useBandSetlists } from '../../hooks/useBandSetlists';
import { SongMetadata } from '../../types';
import { COLORS } from '../../constants/theme';

export default function BandSongSelector() {
    const insets = useSafeAreaInsets();

    const {
        id: setlistId,
    } = useLocalSearchParams<{ id: string }>();

    const {
        songs,
        activeBandId,
    } = useAppContext();

    const {
        setlists: bandSetlists,
        loading,
        error,
        updateSetlist: updateBandSetlist,
    } = useBandSetlists(activeBandId);

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set()
    );
    const [isSaving, setIsSaving] = useState(false);

    /**
     * Busca el repertorio actual.
     */
    const setlist = useMemo(() => {
        if (!setlistId) {
            return null;
        }

        return (
            bandSetlists.find(
                item => item.id === setlistId
            ) || null
        );
    }, [bandSetlists, setlistId]);

    /**
     * IDs que ya forman parte del repertorio.
     */
    const existingSongIds = useMemo(() => {
        return new Set(setlist?.songIds ?? []);
    }, [setlist]);

    /**
     * Inicializa la selección con las canciones
     * que ya forman parte del repertorio.
     *
     * Esto permite entrar al selector y ver
     * inmediatamente qué canciones están seleccionadas.
     */
    useEffect(() => {
        if (!setlist) {
            return;
        }

        setSelectedIds(new Set(setlist.songIds));
    }, [setlist]);

    /**
     * Canciones disponibles.
     *
     * Ahora mostramos TODAS las canciones de la biblioteca,
     * incluyendo las que ya están en el repertorio.
     */
    const availableSongs = useMemo(() => {
        const normalizedSearch = search
            .trim()
            .toLowerCase();

        return songs.filter(song => {
            if (!normalizedSearch) {
                return true;
            }

            const name =
                song.name?.toLowerCase() || '';

            return name.includes(normalizedSearch);
        });
    }, [
        songs,
        search,
    ]);

    /**
     * Alterna la selección de una canción.
     */
    const toggleSong = (songId: string) => {
        setSelectedIds(current => {
            const next = new Set(current);

            if (next.has(songId)) {
                next.delete(songId);
            } else {
                next.add(songId);
            }

            return next;
        });
    };

    /**
     * Guarda el estado completo del repertorio.
     *
     * Las canciones existentes que siguen seleccionadas
     * permanecen.
     *
     * Las existentes que fueron deseleccionadas se eliminan.
     *
     * Las nuevas seleccionadas se agregan al final,
     * respetando el orden de la biblioteca.
     */
    const handleAddSongs = async () => {
        if (!setlist || isSaving) {
            return;
        }

        try {
            setIsSaving(true);

            /**
             * Primero conservamos el orden actual del setlist,
             * pero solamente para las canciones que continúan
             * seleccionadas.
             */
            const existingSelectedIds = setlist.songIds.filter(
                songId => selectedIds.has(songId)
            );

            /**
             * Después agregamos las canciones nuevas seleccionadas,
             * recorriendo `songs` para mantener el orden de la biblioteca.
             */
            const newSelectedIds = songs
                .filter(song =>
                    selectedIds.has(song.id) &&
                    !existingSongIds.has(song.id)
                )
                .map(song => song.id);

            const newSongIds = [
                ...existingSelectedIds,
                ...newSelectedIds,
            ];

            await updateBandSetlist({
                ...setlist,
                songIds: newSongIds,
            });

            router.back();
        } catch (err: any) {
            console.error(
                '[BandSongSelector] Error actualizando canciones:',
                err
            );

            Alert.alert(
                'Error',
                err?.message ||
                'No se pudieron actualizar las canciones.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Render de cada canción.
     */
    const renderSong = ({
        item,
    }: {
        item: SongMetadata;
    }) => {
        const isSelected = selectedIds.has(item.id);
        const wasExisting = existingSongIds.has(item.id);

        return (
            <TouchableOpacity
                style={[
                    styles.songItem,
                    isSelected &&
                    styles.songItemSelected,
                ]}
                activeOpacity={0.7}
                onPress={() =>
                    toggleSong(item.id)
                }
                disabled={isSaving}
            >
                <View style={styles.songIcon}>
                    {isSelected ? (
                        <Check
                            size={20}
                            color={COLORS.accent}
                        />
                    ) : (
                        <Music2
                            size={20}
                            color={
                                COLORS.mutedForeground
                            }
                        />
                    )}
                </View>

                <View style={styles.songInfo}>
                    <Text
                        style={styles.songName}
                        numberOfLines={1}
                    >
                        {item.name}
                    </Text>

                    {wasExisting && (
                        <Text style={styles.existingLabel}>
                            En el repertorio
                        </Text>
                    )}
                </View>

                <View
                    style={[
                        styles.checkbox,
                        isSelected &&
                        styles.checkboxSelected,
                    ]}
                >
                    {isSelected && (
                        <Check
                            size={16}
                            color={
                                COLORS.background
                            }
                        />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    /**
     * Sin banda activa.
     */
    if (!activeBandId) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        paddingTop:
                            insets.top,
                    },
                ]}
            >
                <Header
                    title="Editar canciones"
                    onBack={() => router.back()}
                />

                <View style={styles.centerContainer}>
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text style={styles.emptyTitle}>
                        No hay una banda seleccionada
                    </Text>

                    <Text style={styles.emptyText}>
                        No se pudo determinar la banda
                        de este repertorio.
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Cargando repertorios.
     */
    if (loading && !setlist) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        paddingTop:
                            insets.top,
                    },
                ]}
            >
                <Header
                    title="Editar canciones"
                    onBack={() => router.back()}
                />

                <View style={styles.centerContainer}>
                    <ActivityIndicator
                        size="large"
                        color={COLORS.accent}
                    />

                    <Text style={styles.loadingText}>
                        Cargando repertorio...
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Error.
     */
    if (error && !setlist) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        paddingTop:
                            insets.top,
                    },
                ]}
            >
                <Header
                    title="Editar canciones"
                    onBack={() => router.back()}
                />

                <View style={styles.centerContainer}>
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text style={styles.emptyTitle}>
                        No se pudo cargar el repertorio
                    </Text>

                    <Text style={styles.emptyText}>
                        {error}
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Repertorio inexistente.
     */
    if (!setlist) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        paddingTop:
                            insets.top,
                    },
                ]}
            >
                <Header
                    title="Editar canciones"
                    onBack={() => router.back()}
                />

                <View style={styles.centerContainer}>
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text style={styles.emptyTitle}>
                        Repertorio no encontrado
                    </Text>

                    <Text style={styles.emptyText}>
                        El repertorio puede haber sido
                        eliminado o ya no estar
                        disponible.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                },
            ]}
        >
            <Header
                title="Editar canciones"
                onBack={() => router.back()}
            />

            {/* Información */}
            <View style={styles.infoContainer}>
                <Text
                    style={styles.setlistName}
                    numberOfLines={1}
                >
                    {setlist.name}
                </Text>

                <Text style={styles.infoText}>
                    Seleccioná las canciones que querés
                    mantener en el repertorio.
                </Text>
            </View>

            {/* Buscador */}
            <View style={styles.searchContainer}>
                <Search
                    size={20}
                    color={
                        COLORS.mutedForeground
                    }
                />

                <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar canción..."
                    placeholderTextColor={
                        COLORS.mutedForeground
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {search.length > 0 && (
                    <TouchableOpacity
                        onPress={() =>
                            setSearch('')
                        }
                    >
                        <Text
                            style={
                                styles.clearSearch
                            }
                        >
                            ×
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Contador */}
            <View style={styles.selectionInfo}>
                <Text
                    style={
                        styles.selectionText
                    }
                >
                    {selectedIds.size}{' '}
                    {selectedIds.size === 1
                        ? 'canción seleccionada'
                        : 'canciones seleccionadas'}
                </Text>
            </View>

            {/* Lista */}
            <FlatList
                data={availableSongs}
                keyExtractor={item => item.id}
                renderItem={renderSong}
                contentContainerStyle={[
                    styles.listContent,
                    availableSongs.length === 0 &&
                    styles.emptyListContent,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Music2
                            size={40}
                            color={
                                COLORS.mutedForeground
                            }
                        />

                        <Text
                            style={
                                styles.listEmptyTitle
                            }
                        >
                            {search
                                ? 'No se encontraron canciones'
                                : 'No hay canciones en tu biblioteca'}
                        </Text>

                        <Text
                            style={
                                styles.listEmptyText
                            }
                        >
                            {search
                                ? 'Probá con otro nombre de canción.'
                                : 'No hay canciones disponibles para este repertorio.'}
                        </Text>
                    </View>
                }
            />

            {/* Botón inferior */}
            <View
                style={[
                    styles.bottomBar,
                    {
                        paddingBottom:
                            Math.max(
                                insets.bottom,
                                12
                            ),
                    },
                ]}
            >
                <TouchableOpacity
                    style={styles.cancelButton}
                    activeOpacity={0.8}
                    onPress={() =>
                        router.back()
                    }
                    disabled={isSaving}
                >
                    <Text
                        style={
                            styles.cancelButtonText
                        }
                    >
                        Cancelar
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={
                        styles.confirmButton
                    }
                    activeOpacity={0.8}
                    onPress={handleAddSongs}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator
                            size="small"
                            color={
                                COLORS.background
                            }
                        />
                    ) : (
                        <Check
                            size={19}
                            color={
                                COLORS.background
                            }
                        />
                    )}

                    <Text
                        style={
                            styles.confirmButtonText
                        }
                    >
                        {isSaving
                            ? 'Guardando...'
                            : 'Guardar cambios'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/**
 * Header reutilizable dentro de esta pantalla.
 */
interface HeaderProps {
    title: string;
    onBack: () => void;
}

function Header({
    title,
    onBack,
}: HeaderProps) {
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.7}
                onPress={onBack}
            >
                <ChevronLeft
                    size={24}
                    color={COLORS.foreground}
                />
            </TouchableOpacity>

            <Text
                style={styles.headerTitle}
                numberOfLines={1}
            >
                {title}
            </Text>

            <View style={styles.headerSpacer} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        minHeight: 68,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: 10,
    },

    backButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
    },

    headerTitle: {
        flex: 1,
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '700',
    },

    headerSpacer: {
        width: 42,
    },

    infoContainer: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
    },

    setlistName: {
        color: COLORS.foreground,
        fontSize: 16,
        fontWeight: '700',
    },

    infoText: {
        marginTop: 4,
        color: COLORS.mutedForeground,
        fontSize: 13,
        lineHeight: 18,
    },

    searchContainer: {
        marginHorizontal: 16,
        marginBottom: 10,
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 13,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 9,
    },

    searchInput: {
        flex: 1,
        color: COLORS.foreground,
        fontSize: 14,
        paddingVertical: 0,
    },

    clearSearch: {
        color: COLORS.mutedForeground,
        fontSize: 25,
        lineHeight: 25,
        paddingHorizontal: 3,
    },

    selectionInfo: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },

    selectionText: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: '600',
    },

    listContent: {
        paddingHorizontal: 12,
        paddingBottom: 20,
    },

    emptyListContent: {
        flexGrow: 1,
    },

    songItem: {
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginBottom: 6,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    songItemSelected: {
        borderColor: COLORS.accent,
    },

    songIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },

    songInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: 10,
    },

    songName: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '600',
    },

    existingLabel: {
        marginTop: 2,
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '500',
    },

    checkbox: {
        width: 24,
        height: 24,
        marginLeft: 10,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },

    checkboxSelected: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },

    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        gap: 10,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },

    cancelButton: {
        height: 46,
        paddingHorizontal: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    cancelButtonText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '600',
    },

    confirmButton: {
        flex: 1,
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        borderRadius: 12,
        backgroundColor: COLORS.accent,
    },

    confirmButtonText: {
        color: COLORS.background,
        fontSize: 14,
        fontWeight: '700',
    },

    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },

    emptyTitle: {
        marginTop: 16,
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },

    emptyText: {
        marginTop: 8,
        color: COLORS.mutedForeground,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },

    loadingText: {
        marginTop: 12,
        color: COLORS.mutedForeground,
        fontSize: 14,
    },

    listEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
        paddingVertical: 60,
    },

    listEmptyTitle: {
        marginTop: 14,
        color: COLORS.foreground,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },

    listEmptyText: {
        marginTop: 7,
        color: COLORS.mutedForeground,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
});