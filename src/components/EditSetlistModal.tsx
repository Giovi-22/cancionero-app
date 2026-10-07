import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    ArrowLeft,
    CheckSquare,
    ChevronRight,
    Folder,
    Search,
    Square,
    X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';
import { DatePickerField } from './common/DatePickerField';
import { StorageService } from '../services/StorageService';
import { SongMetadata } from '../types';

const EditSetlistModal = () => {
    const {
        isEditSetlistOpen,
        setIsEditSetlistOpen,
        activeSetlist,
        libraries,
        handleSaveSetlistSongs,
    } = useAppContext();

    const [name, setName] = useState('');
    const [date, setDate] = useState<Date | undefined>(
        undefined
    );
    const [notes, setNotes] = useState('');
    const [selectedSongIds, setSelectedSongIds] =
        useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [currentFolder, setCurrentFolder] =
        useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [librarySongs, setLibrarySongs] = useState<SongMetadata[]>([]);
    const [isLoadingSongs, setIsLoadingSongs] = useState(false);

    const insets = useSafeAreaInsets();

    const currentLibrary = useMemo(() => {
        if (!activeSetlist?.libraryId) return null;
        return libraries.find(lib => lib.id === activeSetlist.libraryId) || null;
    }, [libraries, activeSetlist?.libraryId]);

    // Cargar canciones estrictamente de la biblioteca a la que pertenece el setlist
    useEffect(() => {
        if (isEditSetlistOpen && activeSetlist?.libraryId) {
            setIsLoadingSongs(true);
            StorageService.getAllSongs(activeSetlist.libraryId)
                .then(songsList => {
                    setLibrarySongs(songsList);
                    // Solo conservamos songIds que realmente pertenecen a esta biblioteca
                    const validIds = new Set(songsList.map(s => s.id));
                    setSelectedSongIds(activeSetlist.songIds.filter(id => validIds.has(id)));
                })
                .catch(err => {
                    console.error('[EditSetlistModal] Error cargando canciones:', err);
                    setLibrarySongs([]);
                })
                .finally(() => {
                    setIsLoadingSongs(false);
                });
        }
    }, [isEditSetlistOpen, activeSetlist?.libraryId, activeSetlist?.id]);

    useEffect(() => {
        if (isEditSetlistOpen && activeSetlist) {
            const cleanName =
                activeSetlist.name.split(' - ')[0];

            setName(cleanName);

            setDate(
                activeSetlist.date
                    ? new Date(activeSetlist.date)
                    : undefined
            );

            setNotes(activeSetlist.notes || '');
            setCurrentFolder(null);
            setSearchQuery('');
        }
    }, [isEditSetlistOpen, activeSetlist]);

    const folders = useMemo(() => {
        const names = new Set<string>();

        librarySongs.forEach(song => {
            if (song.folderName) {
                names.add(song.folderName);
            }
        });

        return Array.from(names)
            .map(name => ({
                name,
                songCount: librarySongs.filter(
                    song => song.folderName === name
                ).length,
            }))
            .sort((a, b) =>
                a.name.localeCompare(
                    b.name,
                    'es',
                    { sensitivity: 'base' }
                )
            );
    }, [librarySongs]);

    const displaySongs = useMemo(() => {
        let list = [...librarySongs];

        if (searchQuery.trim().length > 0) {
            list = list.filter(song =>
                song.name
                    .toLowerCase()
                    .includes(
                        searchQuery.toLowerCase()
                    )
            );
        } else {
            list = list.filter(song => {
                if (currentFolder === null) {
                    return !song.folderName;
                }

                return (
                    song.folderName === currentFolder
                );
            });
        }

        return list.sort((a, b) =>
            a.name.localeCompare(
                b.name,
                'es',
                { sensitivity: 'base' }
            )
        );
    }, [librarySongs, searchQuery, currentFolder]);

    if (!isEditSetlistOpen || !activeSetlist) {
        return null;
    }

    const handleToggleSong = (songId: string) => {
        setSelectedSongIds(prev =>
            prev.includes(songId)
                ? prev.filter(id => id !== songId)
                : [...prev, songId]
        );
    };

    const handleSave = async () => {
        if (isSaving) {
            return;
        }

        setIsSaving(true);

        try {
            await handleSaveSetlistSongs(
                name,
                date,
                selectedSongIds,
                notes
            );
        } finally {
            setIsSaving(false);
        }
    };

    const isSearching =
        searchQuery.trim().length > 0;

    const handleClose = () => {
        if (isSaving) {
            return;
        }

        setIsEditSetlistOpen(false);
    };

    return (
        <Modal
            visible={isEditSetlistOpen}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View
                style={[
                    styles.container,
                    {
                        paddingTop: insets.top,
                        paddingBottom: insets.bottom,
                    },
                ]}
            >
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>
                            Editar Lista
                        </Text>
                        {currentLibrary && (
                            <Text style={{ fontSize: 13, color: COLORS.accent, marginTop: 2 }}>
                                Biblioteca: {currentLibrary.name}
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={handleClose}
                        style={styles.closeButton}
                        disabled={isSaving}
                    >
                        <X
                            size={24}
                            color="#fff"
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Nombre de la lista..."
                        placeholderTextColor={
                            COLORS.mutedForeground
                        }
                        value={name}
                        onChangeText={setName}
                        editable={!isSaving}
                    />

                    <TextInput
                        style={[
                            styles.input,
                            styles.notesInput,
                        ]}
                        placeholder="Notas / Observaciones de la lista..."
                        placeholderTextColor={
                            COLORS.mutedForeground
                        }
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={2}
                        editable={!isSaving}
                    />

                    <DatePickerField
                        value={date}
                        onChange={setDate}
                        disabled={isSaving}
                    />

                    <View style={styles.searchRow}>
                        <View style={styles.searchContainer}>
                            <Search
                                size={18}
                                color={
                                    COLORS.mutedForeground
                                }
                                style={styles.searchIcon}
                            />

                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar canción..."
                                placeholderTextColor={
                                    COLORS.mutedForeground
                                }
                                value={searchQuery}
                                onChangeText={
                                    setSearchQuery
                                }
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isSaving}
                            />

                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() =>
                                        setSearchQuery('')
                                    }
                                    style={
                                        styles.clearSearchButton
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
                    </View>
                </View>

                <ScrollView
                    style={styles.list}
                    contentContainerStyle={[
                        styles.listContent,
                        {
                            paddingBottom:
                                100 +
                                insets.bottom,
                        },
                    ]}
                >
                    {!isSearching &&
                        currentFolder !== null && (
                            <View
                                style={
                                    styles.breadcrumbContainer
                                }
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        setCurrentFolder(
                                            null
                                        )
                                    }
                                    style={
                                        styles.backButton
                                    }
                                >
                                    <ArrowLeft
                                        size={20}
                                        color={
                                            COLORS.accent
                                        }
                                    />
                                </TouchableOpacity>

                                <Text
                                    style={
                                        styles.breadcrumbText
                                    }
                                >
                                    Inicio /{' '}
                                    <Text
                                        style={
                                            styles.breadcrumbCurrent
                                        }
                                    >
                                        {currentFolder}
                                    </Text>
                                </Text>
                            </View>
                        )}

                    {!isSearching &&
                        currentFolder === null &&
                        folders.length > 0 && (
                            <View
                                style={
                                    styles.foldersContainer
                                }
                            >
                                {folders.map(folder => (
                                    <TouchableOpacity
                                        key={folder.name}
                                        style={
                                            styles.folderRow
                                        }
                                        onPress={() =>
                                            setCurrentFolder(
                                                folder.name
                                            )
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={
                                                styles.folderIconContainer
                                            }
                                        >
                                            <Folder
                                                size={22}
                                                color={
                                                    COLORS.accent
                                                }
                                            />
                                        </View>

                                        <View
                                            style={
                                                styles.folderInfo
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.folderNameText
                                                }
                                            >
                                                {folder.name}
                                            </Text>

                                            <Text
                                                style={
                                                    styles.folderMetaText
                                                }
                                            >
                                                {
                                                    folder.songCount
                                                }{' '}
                                                canciones
                                            </Text>
                                        </View>

                                        <ChevronRight
                                            size={20}
                                            color={
                                                COLORS.mutedForeground
                                            }
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                    {!isSearching &&
                        currentFolder === null &&
                        folders.length > 0 &&
                        displaySongs.length > 0 && (
                            <View
                                style={
                                    styles.sectionHeader
                                }
                            >
                                <Text
                                    style={
                                        styles.sectionHeaderText
                                    }
                                >
                                    Canciones
                                </Text>
                            </View>
                        )}

                    {displaySongs.map(song => {
                        const isSelected =
                            selectedSongIds.includes(
                                song.id
                            );

                        return (
                            <TouchableOpacity
                                key={song.id}
                                style={[
                                    styles.songItem,
                                    isSelected &&
                                    styles.songItemActive,
                                ]}
                                onPress={() =>
                                    handleToggleSong(
                                        song.id
                                    )
                                }
                                disabled={isSaving}
                            >
                                <View
                                    style={
                                        styles.songInfo
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.songName,
                                            isSelected &&
                                            styles.songNameActive,
                                        ]}
                                    >
                                        {song.name}
                                    </Text>
                                </View>

                                {isSelected ? (
                                    <CheckSquare
                                        size={24}
                                        color={
                                            COLORS.accent
                                        }
                                    />
                                ) : (
                                    <Square
                                        size={24}
                                        color={
                                            COLORS.mutedForeground
                                        }
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View
                    style={[
                        styles.footer,
                        {
                            paddingBottom:
                                Math.max(
                                    insets.bottom,
                                    16
                                ),
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            isSaving &&
                            styles.saveButtonDisabled,
                        ]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator
                                size="small"
                                color="#fff"
                            />
                        ) : (
                            <Text
                                style={
                                    styles.saveButtonText
                                }
                            >
                                Guardar Lista
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default EditSetlistModal;
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.background,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: 'bold',
    },

    closeButton: {
        padding: 5,
    },

    form: {
        padding: 20,
        backgroundColor: COLORS.surface,
    },

    input: {
        backgroundColor: COLORS.card,
        color: COLORS.foreground,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontSize: 15,
        marginBottom: 10,
    },

    notesInput: {
        height: 60,
        textAlignVertical: 'top',
    },

    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        gap: 10,
    },

    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    searchIcon: {
        marginRight: 8,
    },

    searchInput: {
        flex: 1,
        color: COLORS.foreground,
        paddingVertical: 10,
        fontSize: 15,
    },

    clearSearchButton: {
        padding: 5,
    },

    list: {
        flex: 1,
    },

    listContent: {
        padding: 20,
    },

    breadcrumbContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${COLORS.accent}12`,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
        gap: 12,
    },

    backButton: {
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

    foldersContainer: {
        gap: 10,
        marginBottom: 15,
    },

    folderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 14,
    },

    folderIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: `${COLORS.accent}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },

    folderInfo: {
        flex: 1,
        gap: 4,
    },

    folderNameText: {
        color: COLORS.foreground,
        fontSize: 16,
        fontWeight: '600',
    },

    folderMetaText: {
        color: COLORS.mutedForeground,
        fontSize: 13,
    },

    sectionHeader: {
        paddingHorizontal: 4,
        paddingTop: 10,
        paddingBottom: 10,
    },

    sectionHeaderText: {
        color: COLORS.mutedForeground,
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    songItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    songItemActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.surface + '80',
    },

    songInfo: {
        flex: 1,
        marginRight: 10,
    },

    songName: {
        color: COLORS.mutedForeground,
        fontSize: 15,
    },

    songNameActive: {
        color: COLORS.foreground,
        fontWeight: 'bold',
    },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },

    saveButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },

    saveButtonDisabled: {
        opacity: 0.7,
    },

    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});