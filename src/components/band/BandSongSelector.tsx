import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    router,
    useLocalSearchParams,
} from 'expo-router';
import {
    ArrowLeft,
    ArrowUpDown,
    Check,
    ChevronLeft,
    ChevronRight,
    Folder,
    Music2,
    Search,
    X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBandSetlists } from '../../hooks/useBandSetlists';
import { useBandSongs } from '../../hooks/useBandSongs';
import { BandSong } from '../../types/band';
import { COLORS } from '../../constants/theme';
import AppModal from '../common/AppModal';
import { useBandContext } from '../../context/BandContext';

type FeedbackModalType =
    | 'danger'
    | 'warning'
    | 'success'
    | 'info';

interface FeedbackModalState {
    visible: boolean;
    type: FeedbackModalType;
    title: string;
    message: string;
}

export default function BandSongSelector() {
    const insets = useSafeAreaInsets();

    const {
        id: setlistId,
    } = useLocalSearchParams<{ id: string }>();

    const { selectedBand } =
        useBandContext();

    const activeBandId =
        selectedBand?.id ?? null;

    /**
     * Canciones disponibles en la carpeta de Drive
     * configurada para la banda.
     *
     * La fuente ya no es la biblioteca personal.
     */
    const {
        songs: bandSongs,
        loading: loadingBandSongs,
        error: bandSongsError,
    } = useBandSongs();

    const {
        setlists: bandSetlists,
        loading,
        error,
        updateSetlist: updateBandSetlist,
    } = useBandSetlists(activeBandId);

    const [search, setSearch] =
        useState('');

    const [selectedIds, setSelectedIds] =
        useState<Set<string>>(new Set());

    const [isSaving, setIsSaving] =
        useState(false);

    const [sortBy, setSortBy] =
        useState<'default' | 'az' | 'za'>('default');

    const [isSortOpen, setIsSortOpen] =
        useState(false);

    const [pendingSort, setPendingSort] =
        useState<string | null>(null);

    const [currentFolder, setCurrentFolder] =
        useState<string | null>(null);

    const [feedbackModal, setFeedbackModal] =
        useState<FeedbackModalState>({
            visible: false,
            type: 'info',
            title: '',
            message: '',
        });

    const showFeedbackModal = (
        type: FeedbackModalType,
        title: string,
        message: string
    ) => {
        setFeedbackModal({
            visible: true,
            type,
            title,
            message,
        });
    };

    const closeFeedbackModal = () => {
        setFeedbackModal(prev => ({
            ...prev,
            visible: false,
        }));
    };

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
    }, [
        bandSetlists,
        setlistId,
    ]);

    /**
     * IDs que ya forman parte del repertorio.
     */
    const existingSongIds = useMemo(() => {
        return new Set(
            setlist?.songIds ?? []
        );
    }, [setlist]);

    /**
     * Inicializa la selección con las canciones
     * que ya forman parte del repertorio.
     */
    useEffect(() => {
        if (!setlist) {
            return;
        }

        setSelectedIds(
            new Set(setlist.songIds)
        );
    }, [setlist]);

    /**
     * Carpetas únicas disponibles en las canciones de la banda.
     */
    const folders = useMemo(() => {
        const names = new Set<string>();
        bandSongs.forEach(song => {
            if (song.folderName) {
                names.add(song.folderName);
            }
        });
        return Array.from(names)
            .map(name => ({
                name,
                songCount: bandSongs.filter(
                    s => s.folderName === name
                ).length,
            }))
            .sort((a, b) =>
                a.name.localeCompare(b.name, 'es', {
                    sensitivity: 'base',
                })
            );
    }, [bandSongs]);

    /**
     * Canciones disponibles para la banda.
     *
     * Cuando hay búsqueda activa muestra todas.
     * Cuando no, filtra por carpeta activa (igual que SongsScreen).
     */
    const availableSongs = useMemo(() => {
        const normalizedSearch =
            search.trim().toLowerCase();

        let list = bandSongs.filter(song => {
            if (normalizedSearch) {
                return (
                    song.name?.toLowerCase() || ''
                ).includes(normalizedSearch);
            }
            if (currentFolder === null) {
                return !song.folderName;
            }
            return song.folderName === currentFolder;
        });

        if (sortBy === 'az') {
            list = [...list].sort((a, b) =>
                a.name.localeCompare(b.name, 'es', {
                    sensitivity: 'base',
                })
            );
        } else if (sortBy === 'za') {
            list = [...list].sort((a, b) =>
                b.name.localeCompare(a.name, 'es', {
                    sensitivity: 'base',
                })
            );
        }

        return list;
    }, [
        bandSongs,
        search,
        sortBy,
        currentFolder,
    ]);

    const handleSelectSort = (
        value: 'default' | 'az' | 'za'
    ) => {
        setPendingSort(value);
        setTimeout(() => {
            setSortBy(value);
            setPendingSort(null);
            setIsSortOpen(false);
        }, 350);
    };

    const isSearching = search.trim().length > 0;

    /**
     * Alterna la selección de una canción.
     */
    const toggleSong = (
        songId: string
    ) => {
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
     * permanecen en su posición actual.
     *
     * Las existentes que fueron deseleccionadas
     * se eliminan.
     *
     * Las nuevas seleccionadas se agregan al final,
     * respetando el orden de las canciones de la banda.
     */
    const handleAddSongs = async () => {
        if (!setlist || isSaving) {
            return;
        }

        try {
            setIsSaving(true);

            /**
             * Primero conservamos el orden actual
             * del setlist, pero solamente para las
             * canciones que continúan seleccionadas.
             */
            const existingSelectedIds =
                setlist.songIds.filter(
                    songId =>
                        selectedIds.has(
                            songId
                        )
                );

            /**
             * Después agregamos las canciones nuevas
             * seleccionadas, recorriendo las canciones
             * disponibles de la banda.
             */
            const newSelectedIds =
                bandSongs
                    .filter(
                        song =>
                            selectedIds.has(
                                song.id
                            ) &&
                            !existingSongIds.has(
                                song.id
                            )
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
        } catch (err: unknown) {
            console.error(
                '[BandSongSelector] Error actualizando canciones:',
                err
            );

            const message =
                err instanceof Error
                    ? err.message
                    : 'No se pudieron actualizar las canciones.';

            showFeedbackModal(
                'danger',
                'Error',
                message
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
        item: BandSong;
    }) => {
        const isSelected =
            selectedIds.has(item.id);

        const wasExisting =
            existingSongIds.has(item.id);

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
                            color={
                                COLORS.accent
                            }
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
                        style={
                            styles.songName
                        }
                        numberOfLines={1}
                    >
                        {item.name}
                    </Text>

                    {wasExisting && (
                        <Text
                            style={
                                styles.existingLabel
                            }
                        >
                            En el repertorio
                        </Text>
                    )}

                    {item.folderName && (
                        <Text
                            style={
                                styles.folderLabel
                            }
                            numberOfLines={1}
                        >
                            {item.folderName}
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
                    onBack={() =>
                        router.back()
                    }
                />

                <View
                    style={
                        styles.centerContainer
                    }
                >
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text
                        style={
                            styles.emptyTitle
                        }
                    >
                        No hay una banda
                        seleccionada
                    </Text>

                    <Text
                        style={
                            styles.emptyText
                        }
                    >
                        No se pudo determinar
                        la banda de este
                        repertorio.
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Cargando repertorio o canciones de Drive.
     */
    if (
        (loading && !setlist) ||
        loadingBandSongs
    ) {
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
                    onBack={() =>
                        router.back()
                    }
                />

                <View
                    style={
                        styles.centerContainer
                    }
                >
                    <ActivityIndicator
                        size="large"
                        color={
                            COLORS.accent
                        }
                    />

                    <Text
                        style={
                            styles.loadingText
                        }
                    >
                        {loadingBandSongs
                            ? 'Cargando canciones de la banda...'
                            : 'Cargando repertorio...'}
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Error del repertorio.
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
                    onBack={() =>
                        router.back()
                    }
                />

                <View
                    style={
                        styles.centerContainer
                    }
                >
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text
                        style={
                            styles.emptyTitle
                        }
                    >
                        No se pudo cargar el
                        repertorio
                    </Text>

                    <Text
                        style={
                            styles.emptyText
                        }
                    >
                        {error}
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Error cargando las canciones de la banda.
     */
    if (bandSongsError) {
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
                    onBack={() =>
                        router.back()
                    }
                />

                <View
                    style={
                        styles.centerContainer
                    }
                >
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text
                        style={
                            styles.emptyTitle
                        }
                    >
                        No se pudieron cargar
                        las canciones
                    </Text>

                    <Text
                        style={
                            styles.emptyText
                        }
                    >
                        {bandSongsError}
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
                    onBack={() =>
                        router.back()
                    }
                />

                <View
                    style={
                        styles.centerContainer
                    }
                >
                    <Music2
                        size={48}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <Text
                        style={
                            styles.emptyTitle
                        }
                    >
                        Repertorio no
                        encontrado
                    </Text>

                    <Text
                        style={
                            styles.emptyText
                        }
                    >
                        El repertorio puede
                        haber sido eliminado
                        o ya no estar
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
                    paddingTop:
                        insets.top,
                },
            ]}
        >
            <Header
                title="Editar canciones"
                onBack={() =>
                    router.back()
                }
            />

            {/* Información */}
            <View
                style={
                    styles.infoContainer
                }
            >
                <Text
                    style={
                        styles.setlistName
                    }
                    numberOfLines={1}
                >
                    {setlist.name}
                </Text>

                <Text
                    style={
                        styles.infoText
                    }
                >
                    Seleccioná las canciones
                    de la banda que querés
                    mantener en el repertorio.
                </Text>

                <Text
                    style={
                        styles.sourceText
                    }
                    numberOfLines={1}
                >
                    Fuente:{' '}
                    {selectedBand?.driveFolderName ??
                        'Carpeta de Google Drive'}
                </Text>
            </View>

            {/* Buscador + botón ordenar */}
            <View style={styles.searchRow}>
                <View
                    style={
                        styles.searchContainer
                    }
                >
                    <Search
                        size={20}
                        color={
                            COLORS.mutedForeground
                        }
                    />

                    <TextInput
                        style={
                            styles.searchInput
                        }
                        value={search}
                        onChangeText={
                            setSearch
                        }
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
                            <X
                                size={16}
                                color={
                                    COLORS.foreground
                                }
                            />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() =>
                        setIsSortOpen(true)
                    }
                >
                    <ArrowUpDown
                        size={20}
                        color={
                            sortBy !== 'default'
                                ? COLORS.accent
                                : COLORS.foreground
                        }
                    />
                </TouchableOpacity>
            </View>

            {/* Contador */}
            <View
                style={
                    styles.selectionInfo
                }
            >
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

            {/* Contenido: carpetas + lista */}
            {isSearching ? (
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
                                color={COLORS.mutedForeground}
                            />
                            <Text style={styles.listEmptyTitle}>
                                No se encontraron canciones
                            </Text>
                            <Text style={styles.listEmptyText}>
                                Probá con otro nombre de canción.
                            </Text>
                        </View>
                    }
                />
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Breadcrumb */}
                    {currentFolder !== null && (
                        <View style={styles.breadcrumbContainer}>
                            <TouchableOpacity
                                onPress={() =>
                                    setCurrentFolder(null)
                                }
                                style={styles.breadcrumbBack}
                            >
                                <ArrowLeft
                                    size={20}
                                    color={COLORS.accent}
                                />
                            </TouchableOpacity>
                            <Text style={styles.breadcrumbText}>
                                Inicio /{' '}
                                <Text
                                    style={styles.breadcrumbCurrent}
                                >
                                    {currentFolder}
                                </Text>
                            </Text>
                        </View>
                    )}

                    {/* Carpetas (sólo en raíz) */}
                    {currentFolder === null &&
                        folders.length > 0 && (
                        <View style={styles.foldersContainer}>
                            {folders.map(folder => (
                                <TouchableOpacity
                                    key={folder.name}
                                    style={styles.folderRow}
                                    activeOpacity={0.7}
                                    onPress={() =>
                                        setCurrentFolder(
                                            folder.name
                                        )
                                    }
                                >
                                    <View
                                        style={
                                            styles.folderIconContainer
                                        }
                                    >
                                        <Folder
                                            size={22}
                                            color={COLORS.accent}
                                        />
                                    </View>
                                    <View style={styles.folderInfo}>
                                        <Text
                                            style={styles.folderNameText}
                                        >
                                            {folder.name}
                                        </Text>
                                        <Text
                                            style={styles.folderMetaText}
                                        >
                                            {folder.songCount} canciones
                                        </Text>
                                    </View>
                                    <ChevronRight
                                        size={20}
                                        color={COLORS.mutedForeground}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Canciones del nivel actual */}
                    {availableSongs.length > 0 ? (
                        <FlatList
                            data={availableSongs}
                            keyExtractor={item => item.id}
                            renderItem={renderSong}
                            contentContainerStyle={styles.listContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            scrollEnabled={false}
                        />
                    ) : (
                        (currentFolder !== null ||
                            folders.length === 0) && (
                            <View style={styles.listEmpty}>
                                <Music2
                                    size={40}
                                    color={COLORS.mutedForeground}
                                />
                                <Text style={styles.listEmptyTitle}>
                                    No hay canciones aquí
                                </Text>
                                <Text style={styles.listEmptyText}>
                                    No hay canciones disponibles en la
                                    fuente de Google Drive configurada
                                    para esta banda.
                                </Text>
                            </View>
                        )
                    )}
                </ScrollView>
            )}

            {/* Modal de ordenamiento */}
            <Modal
                visible={isSortOpen}
                transparent
                animationType="fade"
                onRequestClose={() =>
                    setIsSortOpen(false)
                }
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsSortOpen(false)}
                >
                    <View
                        style={styles.modalCard}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Ordenar canciones
                            </Text>
                            <TouchableOpacity
                                onPress={() =>
                                    setIsSortOpen(false)
                                }
                                style={styles.closeBtn}
                            >
                                <X
                                    size={20}
                                    color={COLORS.foreground}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.sortOptions}>
                            {(
                                [
                                    'default',
                                    'az',
                                    'za',
                                ] as const
                            ).map(option => {
                                const labels = {
                                    default: 'Por defecto',
                                    az: 'Alfabético (A-Z)',
                                    za: 'Alfabético (Z-A)',
                                };
                                const isActive = sortBy === option;
                                const isPending =
                                    pendingSort === option;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.sortOption,
                                            (isActive || isPending) &&
                                            styles.sortOptionActive,
                                        ]}
                                        onPress={() =>
                                            handleSelectSort(option)
                                        }
                                        disabled={
                                            pendingSort !== null
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.sortOptionText,
                                                (isActive || isPending) &&
                                                styles.sortOptionTextActive,
                                            ]}
                                        >
                                            {labels[option]}
                                        </Text>
                                        {isPending ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={COLORS.accent}
                                            />
                                        ) : isActive ? (
                                            <Check
                                                size={18}
                                                color={COLORS.accent}
                                            />
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

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
                    style={
                        styles.cancelButton
                    }
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
                    onPress={
                        handleAddSongs
                    }
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

            {/* Modal de feedback */}
            <AppModal
                visible={
                    feedbackModal.visible
                }
                type={
                    feedbackModal.type
                }
                title={
                    feedbackModal.title
                }
                message={
                    feedbackModal.message
                }
                confirmText="Aceptar"
                onConfirm={
                    closeFeedbackModal
                }
            />
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
        <View
            style={styles.header}
        >
            <TouchableOpacity
                style={
                    styles.backButton
                }
                activeOpacity={0.7}
                onPress={onBack}
            >
                <ChevronLeft
                    size={24}
                    color={
                        COLORS.foreground
                    }
                />
            </TouchableOpacity>

            <Text
                style={
                    styles.headerTitle
                }
                numberOfLines={1}
            >
                {title}
            </Text>

            <View
                style={
                    styles.headerSpacer
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor:
            COLORS.background,
    },

    header: {
        minHeight: 68,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor:
            COLORS.border,
        gap: 10,
    },

    backButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            COLORS.surface,
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
        color:
            COLORS.mutedForeground,
        fontSize: 13,
        lineHeight: 18,
    },

    sourceText: {
        marginTop: 6,
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '500',
    },

    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 10,
        gap: 10,
    },

    searchContainer: {
        flex: 1,
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 13,
        borderRadius: 12,
        backgroundColor:
            COLORS.surface,
        borderWidth: 1,
        borderColor:
            COLORS.border,
        gap: 9,
    },

    searchInput: {
        flex: 1,
        color: COLORS.foreground,
        fontSize: 14,
        paddingVertical: 0,
    },

    sortButton: {
        width: 46,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    // Breadcrumb
    breadcrumbContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${COLORS.accent}12`,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: 12,
        marginBottom: 6,
    },

    breadcrumbBack: {
        padding: 4,
    },

    breadcrumbText: {
        fontSize: 15,
        color: COLORS.mutedForeground,
        fontWeight: '500',
    },

    breadcrumbCurrent: {
        color: COLORS.accent,
        fontWeight: '700',
    },

    // Folders
    foldersContainer: {
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 8,
    },

    folderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
    },

    folderIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: `${COLORS.accent}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },

    folderInfo: {
        flex: 1,
        gap: 3,
    },

    folderNameText: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '600',
    },

    folderMetaText: {
        color: COLORS.mutedForeground,
        fontSize: 12,
    },

    // Sort modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },

    modalCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        width: '100%',
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },

    modalTitle: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: 'bold',
    },

    closeBtn: {
        padding: 4,
    },

    sortOptions: {
        gap: 8,
    },

    sortOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: 'transparent',
    },

    sortOptionActive: {
        borderColor: COLORS.accent,
        backgroundColor: `${COLORS.accent}10`,
    },

    sortOptionText: {
        color: COLORS.mutedForeground,
        fontSize: 15,
        fontWeight: '500',
    },

    sortOptionTextActive: {
        color: COLORS.accent,
        fontWeight: '600',
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
        backgroundColor:
            COLORS.surface,
        borderWidth: 1,
        borderColor:
            COLORS.border,
    },

    songItemSelected: {
        borderColor:
            COLORS.accent,
    },

    songIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            COLORS.background,
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

    folderLabel: {
        marginTop: 2,
        color:
            COLORS.mutedForeground,
        fontSize: 10,
    },

    checkbox: {
        width: 24,
        height: 24,
        marginLeft: 10,
        borderRadius: 7,
        borderWidth: 2,
        borderColor:
            COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },

    checkboxSelected: {
        backgroundColor:
            COLORS.accent,
        borderColor:
            COLORS.accent,
    },

    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        gap: 10,
        backgroundColor:
            COLORS.background,
        borderTopWidth: 1,
        borderTopColor:
            COLORS.border,
    },

    cancelButton: {
        height: 46,
        paddingHorizontal: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            COLORS.surface,
        borderWidth: 1,
        borderColor:
            COLORS.border,
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
        backgroundColor:
            COLORS.accent,
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
        color:
            COLORS.mutedForeground,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },

    loadingText: {
        marginTop: 12,
        color:
            COLORS.mutedForeground,
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
        color:
            COLORS.mutedForeground,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
});