import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
    ChevronLeft,
    Plus,
    Music2,
    FileText,
    Check,
    ChevronDown,
    ChevronUp,
    Radio,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '../../../../src/context/AppContext';
import { useBandSetlists } from '../../../../src/hooks/useBandSetlists';
import { useBands } from '../../../../src/hooks/useBands';
import { useDirectorSession } from '../../../../src/hooks/useDirectorSession';
import { BandSetlist } from '../../../../src/types/band';
import { SongMetadata } from '../../../../src/types';
import { SongList } from '../../../../src/components/SongList';
import { COLORS } from '../../../../src/constants/theme';

export default function BandSetlistDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();

    const [isSaving, setIsSaving] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState('');
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isStartingDirector, setIsStartingDirector] = useState(false);

    const {
        songs,
        handleSongPress,
        activeBandId,
        loadingSongId,
        user,
    } = useAppContext();

    const {
        permissions,
    } = useBands();

    const {
        setlists: bandSetlists,
        loading: bandSetlistsLoading,
        error: bandSetlistsError,
        updateSetlist: updateBandSetlist,
    } = useBandSetlists(activeBandId);

    const {
        startSession,
        activeSession,
        isDirectorOfSession,
    } = useDirectorSession(activeBandId);
    const userId = user?.uid || user.id;
    useEffect(() => {
        console.log('[BandSetlistDetail] Director Session:', {
            activeBandId,
            setlistId: id,
            activeSessionId: activeSession?.id,
            activeSessionSetlistId: activeSession?.setlistId,
            activeSessionDirectorId: activeSession?.directorId,
            userId,
            isDirectorOfSession,
        });
    }, [
        activeBandId,
        id,
        activeSession,
        userId,
        isDirectorOfSession,
    ]);

    /**
     * Busca el repertorio actual dentro de los repertorios
     * sincronizados de la banda.
     */
    const setlist = useMemo<BandSetlist | null>(() => {
        if (!id) {
            return null;
        }

        return (
            bandSetlists.find(
                item => item.id === id
            ) || null
        );
    }, [bandSetlists, id]);

    /**
     * Determina si este es el repertorio que actualmente
     * está siendo dirigido.
     *
     * activeSession es la fuente de verdad de Director Mode.
     */
    const isActiveSetlist = useMemo(() => {
        if (!activeSession || !setlist) {
            return false;
        }

        return activeSession.setlistId === setlist.id;
    }, [activeSession, setlist]);

    /**
     * Determina si existe una sesión activa pero pertenece
     * a otro repertorio.
     */
    const hasAnotherActiveSetlist = useMemo(() => {
        if (!activeSession || !setlist) {
            return false;
        }

        return activeSession.setlistId !== setlist.id;
    }, [activeSession, setlist]);

    useEffect(() => {
        if (setlist) {
            setNotesText(setlist.notes || '');

            if (
                setlist.notes &&
                setlist.notes.trim().length > 0
            ) {
                setIsNotesExpanded(true);
            }
        }
    }, [setlist?.id, setlist?.notes]);

    /**
     * Convierte los IDs almacenados en Firestore en
     * SongMetadata disponibles localmente.
     *
     * IMPORTANTE:
     * Se recorre songIds y no songs, para conservar
     * exactamente el orden del repertorio.
     */
    const setlistSongs = useMemo<SongMetadata[]>(() => {
        if (!setlist) {
            return [];
        }

        return setlist.songIds
            .map(songId =>
                songs.find(song => song.id === songId)
            )
            .filter(
                (song): song is SongMetadata =>
                    Boolean(song)
            );
    }, [setlist, songs]);

    /**
     * Detecta canciones que existen en el setlist de Firestore
     * pero que no están disponibles actualmente en la biblioteca local.
     */
    const missingSongIds = useMemo(() => {
        if (!setlist) {
            return [];
        }

        const localSongIds = new Set(
            songs.map(song => song.id)
        );

        return setlist.songIds.filter(
            songId => !localSongIds.has(songId)
        );
    }, [setlist, songs]);

    /**
     * Entra a la sesión activa.
     *
     * Esto funciona tanto para el director como para los
     * followers de la banda.
     */
    const handleGoToActiveSession = () => {
        if (!activeSession || !activeBandId) {
            return;
        }

        router.push({
            pathname: '/setlist-player/[setlistId]',
            params: {
                setlistId: activeSession.setlistId,
                bandId: activeBandId,
            },
        });
    };

    /**
     * Inicia una sesión de Director Mode para este repertorio.
     *
     * La sesión se crea antes de navegar al SetlistPlayer.
     * El bandId se pasa explícitamente por route params para
     * no depender únicamente de activeBandId durante la navegación.
     */
    const handleStartDirectorMode = async () => {
        console.log('[BandSetlistDetail] handleStartDirectorMode');

        if (
            !setlist ||
            !activeBandId ||
            isStartingDirector
        ) {
            console.log('[BandSetlistDetail] return');
            return;
        }

        /**
         * Si ya existe una sesión activa, no intentamos crear
         * otra. Si casualmente es este mismo repertorio,
         * simplemente entramos a la sesión existente.
         */
        if (activeSession) {
            if (
                activeSession.setlistId === setlist.id
            ) {
                handleGoToActiveSession();
                return;
            }

            Alert.alert(
                'Director Mode activo',
                `Ya se está dirigiendo "${activeSession.setlistName}".\n\nFinalizá esa sesión antes de iniciar otra.`
            );

            return;
        }

        if (!permissions.canCreateDirectorSession) {
            Alert.alert(
                'Acceso restringido',
                'Únicamente el Director u Owner de la banda puede iniciar Director Mode.'
            );
            return;
        }

        try {
            console.log('[BandSetlistDetail] try');

            setIsStartingDirector(true);

            console.log(
                '[BandSetlistDetail] startSession BEFORE'
            );

            await startSession(
                setlist.id,
                setlist.name
            );

            console.log(
                '[BandSetlistDetail] startSession AFTER'
            );

            console.log(
                '[BandSetlistDetail] router.push BEFORE'
            );

            router.push({
                pathname: '/setlist-player/[setlistId]',
                params: {
                    setlistId: setlist.id,
                    bandId: activeBandId,
                },
            });

            console.log(
                '[BandSetlistDetail] router.push AFTER'
            );
        } catch (err: any) {
            console.error(
                '[BandSetlistDetail] Error iniciando Director Mode:',
                err
            );

            Alert.alert(
                'No se pudo iniciar Director Mode',
                err?.message ||
                'Ocurrió un error al iniciar la sesión.'
            );
        } finally {
            console.log(
                '[BandSetlistDetail] finally -> setIsStartingDirector(false)'
            );

            setIsStartingDirector(false);
        }
    };

    /**
     * Elimina una canción del repertorio.
     */
    const handleRemoveSong = async (songId: string) => {
        if (!setlist || isSaving) {
            return;
        }

        const song = songs.find(
            item => item.id === songId
        );

        Alert.alert(
            'Quitar canción',
            `¿Querés quitar "${song?.name || 'esta canción'}" del repertorio?`,
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Quitar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsSaving(true);

                            const updatedSongIds =
                                setlist.songIds.filter(
                                    currentId =>
                                        currentId !== songId
                                );

                            await updateBandSetlist({
                                ...setlist,
                                songIds: updatedSongIds,
                            });
                        } catch (err: any) {
                            console.error(
                                '[BandSetlistDetail] Error quitando canción:',
                                err
                            );

                            Alert.alert(
                                'Error',
                                err?.message ||
                                'No se pudo quitar la canción.'
                            );
                        } finally {
                            setIsSaving(false);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Reordena canciones.
     *
     * SongList trabaja con índices, mientras que Firestore
     * guarda el orden mediante songIds.
     */
    const handleReorder = async (
        fromIndex: number,
        toIndex: number
    ) => {
        if (
            !setlist ||
            fromIndex === toIndex ||
            isSaving
        ) {
            return;
        }

        const newSongIds = [...setlist.songIds];

        const [movedSongId] =
            newSongIds.splice(fromIndex, 1);

        if (!movedSongId) {
            return;
        }

        newSongIds.splice(
            toIndex,
            0,
            movedSongId
        );

        try {
            setIsSaving(true);

            await updateBandSetlist({
                ...setlist,
                songIds: newSongIds,
            });
        } catch (err: any) {
            console.error(
                '[BandSetlistDetail] Error reordenando canciones:',
                err
            );

            Alert.alert(
                'Error',
                err?.message ||
                'No se pudo guardar el nuevo orden.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Guarda la nota de una canción del repertorio.
     */
    const handleSaveSongNote = async (
        songId: string,
        note: string
    ) => {
        if (!setlist || isSaving) {
            return;
        }

        try {
            setIsSaving(true);

            const currentNotes = {
                ...(setlist.songNotes || {}),
            };

            const trimmedNote = note.trim();

            if (trimmedNote) {
                currentNotes[songId] = trimmedNote;
            } else {
                delete currentNotes[songId];
            }

            await updateBandSetlist({
                ...setlist,
                songNotes: currentNotes,
            });
        } catch (err: any) {
            console.error(
                '[BandSetlistDetail] Error guardando nota:',
                err
            );

            Alert.alert(
                'Error',
                err?.message ||
                'No se pudo guardar la nota.'
            );

            throw err;
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Elimina la nota de una canción del repertorio.
     */
    const handleDeleteSongNote = async (
        songId: string
    ) => {
        if (!setlist || isSaving) {
            return;
        }

        try {
            setIsSaving(true);

            const currentNotes = {
                ...(setlist.songNotes || {}),
            };

            delete currentNotes[songId];

            await updateBandSetlist({
                ...setlist,
                songNotes: currentNotes,
            });
        } catch (err: any) {
            console.error(
                '[BandSetlistDetail] Error eliminando nota:',
                err
            );

            Alert.alert(
                'Error',
                err?.message ||
                'No se pudo eliminar la nota.'
            );

            throw err;
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Guarda la nota general del repertorio.
     */
    const handleSaveNotes = async () => {
        if (!setlist || isSavingNotes) {
            return;
        }

        setIsSavingNotes(true);

        try {
            await updateBandSetlist({
                ...setlist,
                notes: notesText.trim(),
            });

            setIsEditingNotes(false);

            if (notesText.trim().length > 0) {
                setIsNotesExpanded(true);
            }
        } catch (err: any) {
            console.error(
                '[BandSetlistDetail] Error guardando notas del repertorio:',
                err
            );

            Alert.alert(
                'Error',
                err?.message ||
                'No se pudieron guardar las notas.'
            );
        } finally {
            setIsSavingNotes(false);
        }
    };

    /**
     * Abre el selector de canciones.
     */
    const handleAddSongs = () => {
        if (!setlist) {
            return;
        }

        router.push({
            pathname: '/(tabs)/band/setlists/add-songs',
            params: {
                id: setlist.id,
            },
        } as any);
    };

    const handleGoBack = () => {
        router.back();
    };

    /**
     * Estado: todavía no tenemos banda activa.
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
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleGoBack}
                    >
                        <ChevronLeft
                            size={24}
                            color={COLORS.foreground}
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Repertorio
                    </Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.centerContainer}>
                    <Music2
                        size={48}
                        color={COLORS.mutedForeground}
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
     * Estado: cargando repertorios.
     */
    if (
        bandSetlistsLoading &&
        !setlist
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
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleGoBack}
                    >
                        <ChevronLeft
                            size={24}
                            color={COLORS.foreground}
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Repertorio
                    </Text>

                    <View style={styles.headerSpacer} />
                </View>

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
     * Estado: error.
     */
    if (
        bandSetlistsError &&
        !setlist
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
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleGoBack}
                    >
                        <ChevronLeft
                            size={24}
                            color={COLORS.foreground}
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Repertorio
                    </Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.centerContainer}>
                    <Music2
                        size={48}
                        color={COLORS.mutedForeground}
                    />

                    <Text style={styles.emptyTitle}>
                        No se pudo cargar el repertorio
                    </Text>

                    <Text style={styles.emptyText}>
                        {bandSetlistsError}
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Estado: el ID recibido no corresponde a ningún
     * repertorio de la banda.
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
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleGoBack}
                    >
                        <ChevronLeft
                            size={24}
                            color={COLORS.foreground}
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Repertorio
                    </Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.centerContainer}>
                    <Music2
                        size={48}
                        color={COLORS.mutedForeground}
                    />

                    <Text style={styles.emptyTitle}>
                        Repertorio no encontrado
                    </Text>

                    <Text style={styles.emptyText}>
                        El repertorio puede haber sido
                        eliminado o ya no estar disponible.
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
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    activeOpacity={0.7}
                    onPress={handleGoBack}
                >
                    <ChevronLeft
                        size={24}
                        color={COLORS.foreground}
                    />
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                    <Text
                        style={styles.headerTitle}
                        numberOfLines={1}
                    >
                        {setlist.name}
                    </Text>

                    <Text style={styles.headerSubtitle}>
                        {setlistSongs.length === 1
                            ? '1 canción'
                            : `${setlistSongs.length} canciones`}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.addButton}
                    activeOpacity={0.8}
                    onPress={handleAddSongs}
                    disabled={isSaving}
                >
                    <Plus
                        size={19}
                        color={COLORS.background}
                    />

                    <Text style={styles.addButtonText}>
                        Agregar
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Advertencia de canciones no disponibles */}
            {missingSongIds.length > 0 && (
                <View style={styles.warningContainer}>
                    <Text style={styles.warningTitle}>
                        Algunas canciones no están disponibles
                    </Text>

                    <Text style={styles.warningText}>
                        Hay {missingSongIds.length}{' '}
                        {missingSongIds.length === 1
                            ? 'canción'
                            : 'canciones'}{' '}
                        guardadas en el repertorio que no
                        están disponibles en la biblioteca local.
                    </Text>
                </View>
            )}

            {/* Error no bloqueante */}
            {bandSetlistsError && (
                <View style={styles.warningContainer}>
                    <Text style={styles.warningText}>
                        {bandSetlistsError}
                    </Text>
                </View>
            )}

            {/* Notas del repertorio */}
            <View style={styles.notesContainer}>
                <TouchableOpacity
                    style={styles.notesHeader}
                    onPress={() =>
                        setIsNotesExpanded(
                            !isNotesExpanded
                        )
                    }
                    activeOpacity={0.7}
                >
                    <View style={styles.notesTitleRow}>
                        <FileText
                            size={16}
                            color={COLORS.accent}
                        />

                        <Text style={styles.notesTitle}>
                            Notas del Repertorio
                        </Text>

                        {setlist.notes &&
                            setlist.notes.trim().length > 0 && (
                                <View
                                    style={
                                        styles.notesBadge
                                    }
                                >
                                    <Text
                                        style={
                                            styles.notesBadgeText
                                        }
                                    >
                                        1
                                    </Text>
                                </View>
                            )}
                    </View>

                    <View
                        style={
                            styles.notesHeaderActions
                        }
                    >
                        <TouchableOpacity
                            style={styles.editNotesBtn}
                            onPress={() => {
                                if (
                                    !isNotesExpanded
                                ) {
                                    setIsNotesExpanded(
                                        true
                                    );
                                }

                                setIsEditingNotes(
                                    !isEditingNotes
                                );
                            }}
                        >
                            <Text
                                style={
                                    styles.editNotesBtnText
                                }
                            >
                                {isEditingNotes
                                    ? 'Cancelar'
                                    : setlist.notes
                                        ? 'Editar'
                                        : '+ Añadir'}
                            </Text>
                        </TouchableOpacity>

                        {isNotesExpanded ? (
                            <ChevronUp
                                size={18}
                                color={
                                    COLORS.mutedForeground
                                }
                            />
                        ) : (
                            <ChevronDown
                                size={18}
                                color={
                                    COLORS.mutedForeground
                                }
                            />
                        )}
                    </View>
                </TouchableOpacity>

                {isNotesExpanded && (
                    <View style={styles.notesBody}>
                        {isEditingNotes ? (
                            <View
                                style={
                                    styles.notesEditWrapper
                                }
                            >
                                <TextInput
                                    style={
                                        styles.notesInput
                                    }
                                    value={notesText}
                                    onChangeText={
                                        setNotesText
                                    }
                                    placeholder="Escribe notas, recordatorios u observaciones..."
                                    placeholderTextColor={
                                        COLORS.mutedForeground
                                    }
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />

                                <TouchableOpacity
                                    style={
                                        styles.saveNotesBtn
                                    }
                                    onPress={
                                        handleSaveNotes
                                    }
                                    disabled={
                                        isSavingNotes
                                    }
                                >
                                    {isSavingNotes ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#fff"
                                        />
                                    ) : (
                                        <>
                                            <Check
                                                size={16}
                                                color="#fff"
                                            />

                                            <Text
                                                style={
                                                    styles.saveNotesBtnText
                                                }
                                            >
                                                Guardar Notas
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() =>
                                    setIsEditingNotes(
                                        true
                                    )
                                }
                                activeOpacity={0.8}
                            >
                                {setlist.notes &&
                                    setlist.notes.trim().length > 0 ? (
                                    <Text
                                        style={
                                            styles.notesText
                                        }
                                    >
                                        {setlist.notes}
                                    </Text>
                                ) : (
                                    <Text
                                        style={
                                            styles.notesPlaceholder
                                        }
                                    >
                                        Sin notas para este
                                        repertorio. Tocá para
                                        añadir observaciones,
                                        orden del servicio, etc.
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Director Mode */}

            {/*
             * Este repertorio es el que está activo.
             *
             * Lo pueden abrir tanto el director como los followers.
             */}
            {isActiveSetlist && activeSession && (
                <TouchableOpacity
                    style={[
                        styles.directorButton,
                        styles.directorButtonActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleGoToActiveSession}
                >
                    <Radio
                        size={19}
                        color={COLORS.background}
                    />

                    <View
                        style={
                            styles.directorButtonContent
                        }
                    >
                        <Text
                            style={
                                styles.directorButtonText
                            }
                        >
                            {isDirectorOfSession
                                ? 'Volver a Director Mode'
                                : 'Entrar a sesión activa'}
                        </Text>

                        <Text
                            style={
                                styles.directorButtonSubtitle
                            }
                            numberOfLines={1}
                        >
                            {activeSession.directorName
                                ? `Dirige ${activeSession.directorName}`
                                : 'Sesión activa'}
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

            {/*
             * No hay sesión activa.
             *
             * Solamente Director/Owner puede iniciar una.
             */}
            {!activeSession &&
                permissions.canCreateDirectorSession && (
                    <TouchableOpacity
                        style={styles.directorButton}
                        activeOpacity={0.8}
                        onPress={handleStartDirectorMode}
                        disabled={isStartingDirector}
                    >
                        {isStartingDirector ? (
                            <ActivityIndicator
                                size="small"
                                color={COLORS.background}
                            />
                        ) : (
                            <Radio
                                size={18}
                                color={COLORS.background}
                            />
                        )}

                        <Text
                            style={
                                styles.directorButtonText
                            }
                        >
                            {isStartingDirector
                                ? 'Iniciando Director Mode...'
                                : 'Iniciar Director Mode'}
                        </Text>
                    </TouchableOpacity>
                )}

            {/*
             * Hay otra sesión activa en la banda y este no
             * es el repertorio que se está dirigiendo.
             */}
            {hasAnotherActiveSetlist &&
                activeSession && (
                    <View
                        style={
                            styles.otherActiveSessionContainer
                        }
                    >
                        <Radio
                            size={18}
                            color={COLORS.accent}
                        />

                        <View
                            style={
                                styles.otherActiveSessionContent
                            }
                        >
                            <Text
                                style={
                                    styles.otherActiveSessionTitle
                                }
                                numberOfLines={1}
                            >
                                Otro repertorio está en
                                Director Mode
                            </Text>

                            <Text
                                style={
                                    styles.otherActiveSessionSubtitle
                                }
                                numberOfLines={1}
                            >
                                {activeSession.setlistName}
                            </Text>
                        </View>
                    </View>
                )}

            {/* Lista de canciones */}
            <View style={styles.listContainer}>
                <SongList
                    songs={setlistSongs}
                    onSongPress={handleSongPress}
                    isSetlistMode
                    onRemoveFromSetlist={
                        handleRemoveSong
                    }
                    onAddSongsPress={handleAddSongs}
                    onReorder={handleReorder}
                    loadingSongId={loadingSongId}
                    scrollEnabled={!isSaving}
                    songNotes={
                        setlist.songNotes || {}
                    }
                    onSaveSongNote={
                        handleSaveSongNote
                    }
                    onDeleteSongNote={
                        handleDeleteSongNote
                    }
                />
            </View>

            {/* Indicador de guardado */}
            {isSaving && (
                <View style={styles.savingIndicator}>
                    <ActivityIndicator
                        size="small"
                        color={COLORS.accent}
                    />

                    <Text style={styles.savingText}>
                        Guardando...
                    </Text>
                </View>
            )}
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

    headerInfo: {
        flex: 1,
        minWidth: 0,
    },

    headerTitle: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '700',
    },

    headerSubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 2,
    },

    headerSpacer: {
        width: 42,
    },

    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: 13,
        height: 42,
        borderRadius: 12,
        backgroundColor: COLORS.accent,
    },

    addButtonText: {
        color: COLORS.background,
        fontSize: 13,
        fontWeight: '700',
    },

    listContainer: {
        flex: 1,
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

    warningContainer: {
        marginHorizontal: 16,
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    warningTitle: {
        color: COLORS.foreground,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },

    warningText: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        lineHeight: 18,
    },

    directorButton: {
        marginHorizontal: 15,
        marginTop: 12,
        marginBottom: 4,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },

    directorButtonActive: {
        marginBottom: 8,
    },

    directorButtonContent: {
        flex: 1,
        alignItems: 'center',
    },

    directorButtonText: {
        color: COLORS.background,
        fontSize: 14,
        fontWeight: '700',
    },

    directorButtonSubtitle: {
        marginTop: 2,
        color: COLORS.background,
        opacity: 0.8,
        fontSize: 11,
        fontWeight: '500',
    },

    otherActiveSessionContainer: {
        marginHorizontal: 15,
        marginTop: 12,
        marginBottom: 4,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    otherActiveSessionContent: {
        flex: 1,
    },

    otherActiveSessionTitle: {
        color: COLORS.foreground,
        fontSize: 13,
        fontWeight: '700',
    },

    otherActiveSessionSubtitle: {
        marginTop: 2,
        color: COLORS.mutedForeground,
        fontSize: 12,
    },

    savingIndicator: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    savingText: {
        color: COLORS.foreground,
        fontSize: 12,
        fontWeight: '600',
    },

    notesContainer: {
        marginHorizontal: 15,
        marginTop: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },

    notesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor:
            'rgba(255,255,255,0.03)',
    },

    notesTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    notesTitle: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '600',
    },

    notesBadge: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },

    notesBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },

    notesHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    editNotesBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor:
            'rgba(255,255,255,0.08)',
    },

    editNotesBtnText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '600',
    },

    notesBody: {
        padding: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },

    notesEditWrapper: {
        gap: 10,
    },

    notesInput: {
        backgroundColor: COLORS.background,
        color: COLORS.foreground,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        minHeight: 90,
    },

    saveNotesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: COLORS.accent,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 8,
        alignSelf: 'flex-end',
    },

    saveNotesBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },

    notesText: {
        color: COLORS.foreground,
        fontSize: 14,
        lineHeight: 20,
    },

    notesPlaceholder: {
        color: COLORS.mutedForeground,
        fontSize: 13,
        fontStyle: 'italic',
    },
});