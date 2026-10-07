import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
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
    ChevronLeft,
    Plus,
    Edit2,
    Music2,
    FileText,
    Check,
    ChevronDown,
    ChevronUp,
    Radio,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '../../../../src/context/AppContext';
import { useBandContext } from '../../../../src/context/BandContext';
import { useBandSetlists } from '../../../../src/hooks/useBandSetlists';
import { useBandSongs } from '../../../../src/hooks/useBandSongs';
import { useDirectorSession } from '../../../../src/hooks/useDirectorSession';

import { BandSetlist } from '../../../../src/types/band';
import { SongMetadata } from '../../../../src/types';

import {
    SongList,
    SongAvailabilityStatus,
} from '../../../../src/components/SongList';

import { COLORS } from '../../../../src/constants/theme';
import { Button } from '../../../../src/components/common/Button';
import AppModal from '../../../../src/components/common/AppModal';
import EditBandSetlistModal from '../../../../src/components/band/EditBandSetlistModal';

import { BandSongService } from '../../../../src/services/BandSongService';
import { FileSystemService } from '../../../../src/services/FileSystemService';

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

export default function BandSetlistDetailScreen() {
    const { id } =
        useLocalSearchParams<{ id: string }>();

    const insets =
        useSafeAreaInsets();

    const [isSaving, setIsSaving] =
        useState(false);

    const [isEditingNotes, setIsEditingNotes] =
        useState(false);

    const [notesText, setNotesText] =
        useState('');

    const [isNotesExpanded, setIsNotesExpanded] =
        useState(false);

    const [isSavingNotes, setIsSavingNotes] =
        useState(false);

    const [isStartingDirector, setIsStartingDirector] =
        useState(false);

    const [songToRemove, setSongToRemove] =
        useState<SongMetadata | null>(null);

    const [isRemovingSong, setIsRemovingSong] =
        useState(false);

    const [feedbackModal, setFeedbackModal] =
        useState<FeedbackModalState>({
            visible: false,
            type: 'info',
            title: '',
            message: '',
        });

    const [isEditModalOpen, setIsEditModalOpen] =
        useState(false);

    const [loadingSongId, setLoadingSongId] =
        useState<string | null>(null);

    /**
     * Estado de disponibilidad de las canciones
     * dentro del almacenamiento local de Band Mode.
     *
     * available:
     *   Existe en Google Drive, pero todavía no
     *   está descargada localmente.
     *
     * offline:
     *   Ya está descargada localmente.
     *
     * downloading:
     *   Se está obteniendo desde Google Drive.
     *
     * unavailable:
     *   No se pudo obtener el contenido.
     */
    const [songStatuses, setSongStatuses] =
        useState<
            Record<
                string,
                SongAvailabilityStatus
            >
        >({});

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
     * AppContext:
     *
     * Contiene únicamente el estado global de la
     * aplicación que esta pantalla necesita.
     *
     * La banda activa NO se obtiene desde AppContext.
     *
     * Las canciones tampoco se obtienen desde AppContext.
     */
    const {
        setSelectedSong,
        setSongContent,
    } = useAppContext();

    /**
     * BandContext:
     *
     * Es la fuente de verdad para la banda activa
     * y sus permisos.
     */
    const {
        selectedBand,
        permissions,
    } = useBandContext();

    const activeBandId =
        selectedBand?.id ?? null;

    const canManageSetlists =
        permissions.canManageSetlists;

    const canCreateDirectorSession =
        permissions.canCreateDirectorSession;

    const {
        setlists: bandSetlists,
        loading: bandSetlistsLoading,
        error: bandSetlistsError,
        updateSetlist: updateBandSetlist,
    } = useBandSetlists(activeBandId);

    /**
     * Canciones disponibles en la carpeta de
     * Google Drive configurada para la banda.
     */
    const {
        songs: bandSongs,
        loading: bandSongsLoading,
        error: bandSongsError,
    } = useBandSongs();

    const {
        startSession,
        activeSession,
        isDirectorOfSession,
    } = useDirectorSession(activeBandId);

    /**
     * Busca el repertorio actual dentro de los
     * repertorios sincronizados de la banda.
     */
    const setlist =
        useMemo<BandSetlist | null>(() => {
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
     * Determina si este es el repertorio que
     * actualmente está siendo dirigido.
     */
    const isActiveSetlist =
        useMemo(() => {
            if (!activeSession || !setlist) {
                return false;
            }

            return (
                activeSession.setlistId ===
                setlist.id
            );
        }, [activeSession, setlist]);

    /**
     * Determina si existe una sesión activa pero
     * pertenece a otro repertorio.
     */
    const hasAnotherActiveSetlist =
        useMemo(() => {
            if (!activeSession || !setlist) {
                return false;
            }

            return (
                activeSession.setlistId !==
                setlist.id
            );
        }, [activeSession, setlist]);

    useEffect(() => {
        if (setlist) {
            setNotesText(
                setlist.notes || ''
            );

            if (
                setlist.notes &&
                setlist.notes.trim().length > 0
            ) {
                setIsNotesExpanded(true);
            }
        }
    }, [setlist?.id, setlist?.notes]);

    /**
     * Convierte los IDs almacenados en Firestore
     * en canciones disponibles en la carpeta de
     * Google Drive de la banda.
     *
     * Se recorre songIds para conservar exactamente
     * el orden del repertorio.
     */
    const setlistSongs =
        useMemo<SongMetadata[]>(() => {
            if (!setlist) {
                return [];
            }

            const bandSongsById =
                new Map(
                    bandSongs.map(song => [
                        song.id,
                        song,
                    ])
                );

            return setlist.songIds
                .map(
                    (
                        songId
                    ): SongMetadata | null => {
                        const song =
                            bandSongsById.get(
                                songId
                            );

                        if (!song) {
                            return null;
                        }

                        return {
                            id: song.id,
                            name: song.name,
                            mimeType:
                                song.mimeType,
                            modifiedTime:
                                song.modifiedTime,
                            folderName:
                                song.folderName,
                        };
                    }
                )
                .filter(
                    (
                        song
                    ): song is SongMetadata =>
                        song !== null
                );
        }, [setlist, bandSongs]);

    /**
     * Detecta canciones que existen en Firestore
     * pero ya no están disponibles en la carpeta
     * de Google Drive de la banda.
     */
    const missingSongIds =
        useMemo(() => {
            if (!setlist) {
                return [];
            }

            const bandSongIds =
                new Set(
                    bandSongs.map(
                        song => song.id
                    )
                );

            return setlist.songIds.filter(
                songId =>
                    !bandSongIds.has(
                        songId
                    )
            );
        }, [setlist, bandSongs]);

    /**
     * Determina el estado local de cada canción.
     *
     * Si está cacheada:
     *   offline
     *
     * Si existe en Drive pero no está cacheada:
     *   available
     */
    useEffect(() => {
        if (
            !activeBandId ||
            setlistSongs.length === 0
        ) {
            setSongStatuses({});
            return;
        }

        let cancelled = false;

        const loadSongStatuses =
            async () => {
                const statuses: Record<
                    string,
                    SongAvailabilityStatus
                > = {};

                for (const song of setlistSongs) {
                    const exists =
                        await FileSystemService.bandSongExists(
                            activeBandId,
                            song.id
                        );

                    statuses[song.id] =
                        exists
                            ? 'offline'
                            : 'available';
                }

                if (!cancelled) {
                    setSongStatuses(
                        statuses
                    );
                }
            };

        loadSongStatuses();

        return () => {
            cancelled = true;
        };
    }, [
        activeBandId,
        setlistSongs,
    ]);

    /**
     * Abre una canción de Band Mode.
     *
     * El contenido se obtiene exclusivamente
     * mediante BandSongService.
     *
     * BandSongService:
     * 1. Busca primero en cache local.
     * 2. Si no existe, obtiene desde Drive.
     * 3. Guarda la canción localmente.
     */
    const handleBandSongPress =
        async (
            song: SongMetadata
        ) => {
            if (
                loadingSongId ||
                !activeBandId
            ) {
                return;
            }

            const bandSong =
                bandSongs.find(
                    item =>
                        item.id ===
                        song.id
                );

            if (!bandSong) {
                setSongStatuses(
                    prev => ({
                        ...prev,
                        [song.id]:
                            'unavailable',
                    })
                );

                showFeedbackModal(
                    'warning',
                    'Canción no disponible',
                    'Esta canción ya no está disponible en la carpeta de Google Drive de la banda.'
                );

                return;
            }

            /**
             * La marcamos como descargando
             * antes de comenzar la operación.
             */
            const isAlreadyOffline =
                await FileSystemService.bandSongExists(
                    activeBandId,
                    song.id
                );

            if (!isAlreadyOffline) {
                setSongStatuses(
                    prev => ({
                        ...prev,
                        [song.id]:
                            'downloading',
                    })
                );
            }

            setLoadingSongId(song.id);
            try {
                const content =
                    await BandSongService.getSongContent(
                        activeBandId,
                        bandSong
                    );

                if (!content) {
                    setSongStatuses(
                        prev => ({
                            ...prev,
                            [song.id]:
                                'unavailable',
                        })
                    );

                    showFeedbackModal(
                        'warning',
                        'Canción no disponible',
                        'No se pudo obtener el contenido de esta canción desde Google Drive.'
                    );

                    return;
                }

                /**
                 * BandSongService guarda la canción
                 * localmente cuando tuvo que descargarla.
                 *
                 * Por lo tanto, después de una carga
                 * exitosa podemos marcarla como offline.
                 */
                setSongStatuses(
                    prev => ({
                        ...prev,
                        [song.id]:
                            'offline',
                    })
                );

                /**
                 * SongViewer sigue utilizando el estado
                 * global del AppContext para mostrar
                 * la canción.
                 *
                 * El origen del contenido, sin embargo,
                 * es BandSongService.
                 */
                setSongContent(content);
                setSelectedSong(song);

                router.push({
                    pathname:
                        '/song/[id]',
                    params: {
                        id: song.id,
                    },
                } as any);
            } catch (error) {
                console.error(
                    '[BandSetlistDetail] Error abriendo canción de banda:',
                    error
                );

                setSongStatuses(
                    prev => ({
                        ...prev,
                        [song.id]:
                            'unavailable',
                    })
                );

                showFeedbackModal(
                    'danger',
                    'Error',
                    'No se pudo abrir la canción.'
                );
            } finally {
                setLoadingSongId(null);
            }
        };

    /**
     * Entra a la sesión activa.
     */
    const handleGoToActiveSession =
        () => {
            if (
                !activeSession ||
                !activeBandId
            ) {
                return;
            }

            router.push({
                pathname:
                    '/setlist-player/[setlistId]',
                params: {
                    setlistId:
                        activeSession.setlistId,
                    bandId:
                        activeBandId,
                },
            });
        };

    /**
     * Inicia una sesión de Director Mode
     * para este repertorio.
     */
    const handleStartDirectorMode =
        async () => {
            console.log(
                '[BandSetlistDetail] handleStartDirectorMode'
            );

            if (
                !setlist ||
                !activeBandId ||
                isStartingDirector
            ) {
                console.log(
                    '[BandSetlistDetail] return'
                );

                return;
            }

            if (activeSession) {
                if (
                    activeSession.setlistId ===
                    setlist.id
                ) {
                    handleGoToActiveSession();
                    return;
                }

                showFeedbackModal(
                    'warning',
                    'Director Mode activo',
                    `Ya se está dirigiendo "${activeSession.setlistName}".\n\nFinalizá esa sesión antes de iniciar otra.`
                );

                return;
            }

            if (
                !canCreateDirectorSession
            ) {
                showFeedbackModal(
                    'warning',
                    'Acceso restringido',
                    'Únicamente el Director u Owner de la banda puede iniciar Director Mode.'
                );

                return;
            }

            try {
                console.log(
                    '[BandSetlistDetail] try'
                );

                setIsStartingDirector(
                    true
                );

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
                    pathname:
                        '/setlist-player/[setlistId]',
                    params: {
                        setlistId:
                            setlist.id,
                        bandId:
                            activeBandId,
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

                showFeedbackModal(
                    'danger',
                    'No se pudo iniciar Director Mode',
                    err?.message ||
                    'Ocurrió un error al iniciar la sesión.'
                );
            } finally {
                console.log(
                    '[BandSetlistDetail] finally -> setIsStartingDirector(false)'
                );

                setIsStartingDirector(
                    false
                );
            }
        };

    /**
     * Abre la confirmación para quitar
     * una canción.
     */
    const handleRemoveSong = (
        songId: string
    ) => {
        if (
            !canManageSetlists ||
            !setlist ||
            isSaving
        ) {
            return;
        }

        const song =
            setlistSongs.find(
                item =>
                    item.id === songId
            );

        if (!song) {
            return;
        }

        setSongToRemove(song);
    };

    /**
     * Confirma la eliminación de una canción.
     */
    const handleConfirmRemoveSong =
        async () => {
            if (
                !canManageSetlists ||
                !setlist ||
                !songToRemove ||
                isRemovingSong
            ) {
                return;
            }

            try {
                setIsRemovingSong(
                    true
                );

                setIsSaving(true);

                const updatedSongIds =
                    setlist.songIds.filter(
                        currentId =>
                            currentId !==
                            songToRemove.id
                    );

                await updateBandSetlist({
                    ...setlist,
                    songIds:
                        updatedSongIds,
                });

                setSongToRemove(
                    null
                );
            } catch (err: any) {
                console.error(
                    '[BandSetlistDetail] Error quitando canción:',
                    err
                );

                setSongToRemove(
                    null
                );

                showFeedbackModal(
                    'danger',
                    'Error',
                    err?.message ||
                    'No se pudo quitar la canción.'
                );
            } finally {
                setIsRemovingSong(
                    false
                );

                setIsSaving(false);
            }
        };

    /**
     * Reordena canciones.
     *
     * IMPORTANTE:
     *
     * SongList muestra únicamente las canciones
     * disponibles en Drive.
     *
     * Por lo tanto los índices de SongList NO
     * necesariamente coinciden con los índices de
     * setlist.songIds.
     *
     * Ejemplo:
     *
     * Firestore:
     *   [A, B, C, D]
     *
     * Drive:
     *   [A, C, D]
     *
     * Si movemos A -> D desde la UI:
     *
     * visible:
     *   [A, C, D]
     *
     * pasa a:
     *   [C, D, A]
     *
     * pero B debe conservar su posición dentro
     * del array original.
     *
     * Resultado:
     *   [C, B, D, A]
     */
    const handleReorder =
        async (
            fromIndex: number,
            toIndex: number
        ) => {
            if (
                !canManageSetlists ||
                !setlist ||
                fromIndex === toIndex ||
                isSaving
            ) {
                return;
            }

            if (
                fromIndex < 0 ||
                toIndex < 0 ||
                fromIndex >=
                setlistSongs.length ||
                toIndex >=
                setlistSongs.length
            ) {
                return;
            }

            /**
             * IDs visibles actualmente en SongList.
             */
            const visibleSongIds =
                setlistSongs.map(
                    song => song.id
                );

            /**
             * Reordenamos solamente los IDs
             * visibles.
             */
            const reorderedVisibleIds =
                [...visibleSongIds];

            const [
                movedSongId,
            ] =
                reorderedVisibleIds.splice(
                    fromIndex,
                    1
                );

            if (!movedSongId) {
                return;
            }

            reorderedVisibleIds.splice(
                toIndex,
                0,
                movedSongId
            );

            /**
             * Identificamos qué IDs son visibles.
             */
            const visibleSongIdSet =
                new Set(
                    visibleSongIds
                );

            /**
             * Recorremos el array original de
             * Firestore.
             *
             * Los IDs faltantes NO se tocan.
             *
             * Solamente reemplazamos las posiciones
             * que corresponden a canciones visibles.
             */
            let visibleIndex = 0;

            const newSongIds =
                setlist.songIds.map(
                    songId => {
                        if (
                            !visibleSongIdSet.has(
                                songId
                            )
                        ) {
                            return songId;
                        }

                        const replacement =
                            reorderedVisibleIds[
                            visibleIndex
                            ];

                        visibleIndex += 1;

                        return replacement;
                    }
                );

            try {
                setIsSaving(true);

                await updateBandSetlist({
                    ...setlist,
                    songIds:
                        newSongIds,
                });
            } catch (err: any) {
                console.error(
                    '[BandSetlistDetail] Error reordenando canciones:',
                    err
                );

                showFeedbackModal(
                    'danger',
                    'Error',
                    err?.message ||
                    'No se pudo guardar el nuevo orden.'
                );
            } finally {
                setIsSaving(false);
            }
        };

    /**
     * Guarda la nota de una canción.
     */
    const handleSaveSongNote =
        async (
            songId: string,
            note: string
        ) => {
            if (
                !canManageSetlists ||
                !setlist ||
                isSaving
            ) {
                return;
            }

            try {
                setIsSaving(true);

                const currentNotes =
                {
                    ...(setlist.songNotes ||
                        {}),
                };

                const trimmedNote =
                    note.trim();

                if (trimmedNote) {
                    currentNotes[
                        songId
                    ] = trimmedNote;
                } else {
                    delete currentNotes[
                        songId
                    ];
                }

                await updateBandSetlist({
                    ...setlist,
                    songNotes:
                        currentNotes,
                });
            } catch (err: any) {
                console.error(
                    '[BandSetlistDetail] Error guardando nota:',
                    err
                );

                showFeedbackModal(
                    'danger',
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
     * Elimina la nota de una canción.
     */
    const handleDeleteSongNote =
        async (
            songId: string
        ) => {
            if (
                !canManageSetlists ||
                !setlist ||
                isSaving
            ) {
                return;
            }

            try {
                setIsSaving(true);

                const currentNotes =
                {
                    ...(setlist.songNotes ||
                        {}),
                };

                delete currentNotes[
                    songId
                ];

                await updateBandSetlist({
                    ...setlist,
                    songNotes:
                        currentNotes,
                });
            } catch (err: any) {
                console.error(
                    '[BandSetlistDetail] Error eliminando nota:',
                    err
                );

                showFeedbackModal(
                    'danger',
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
    const handleSaveNotes =
        async () => {
            if (
                !canManageSetlists ||
                !setlist ||
                isSavingNotes
            ) {
                return;
            }

            setIsSavingNotes(
                true
            );

            try {
                await updateBandSetlist({
                    ...setlist,
                    notes:
                        notesText.trim(),
                });

                setIsEditingNotes(
                    false
                );

                if (
                    notesText
                        .trim()
                        .length > 0
                ) {
                    setIsNotesExpanded(
                        true
                    );
                }
            } catch (err: any) {
                console.error(
                    '[BandSetlistDetail] Error guardando notas del repertorio:',
                    err
                );

                showFeedbackModal(
                    'danger',
                    'Error',
                    err?.message ||
                    'No se pudieron guardar las notas.'
                );
            } finally {
                setIsSavingNotes(
                    false
                );
            }
        };

    /**
     * Abre el selector de canciones.
     */
    const handleAddSongs =
        () => {
            if (
                !canManageSetlists ||
                !setlist
            ) {
                return;
            }

            router.push({
                pathname:
                    '/(tabs)/band/setlists/add-songs',
                params: {
                    id: setlist.id,
                },
            } as any);
        };

    const handleOpenEditSetlist =
        () => {
            if (
                !canManageSetlists ||
                !setlist
            ) {
                return;
            }

            setIsEditModalOpen(
                true
            );
        };

    const handleSaveSetlist =
        async (
            updatedSetlist: BandSetlist
        ) => {
            if (
                !canManageSetlists
            ) {
                return;
            }

            await updateBandSetlist(
                updatedSetlist
            );

            setIsEditModalOpen(
                false
            );
        };

    const handleGoBack =
        () => {
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
                <View
                    style={
                        styles.header
                    }
                >
                    <TouchableOpacity
                        style={
                            styles.backButton
                        }
                        onPress={
                            handleGoBack
                        }
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
                    >
                        Repertorio
                    </Text>

                    <View
                        style={
                            styles.headerSpacer
                        }
                    />
                </View>

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
                        No se pudo
                        determinar la
                        banda de este
                        repertorio.
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Estado: cargando repertorios.
     *
     * También esperamos las canciones de la banda
     * para evitar mostrar temporalmente todas las
     * canciones como faltantes mientras Drive
     * todavía está cargando.
     */
    if (
        (bandSetlistsLoading &&
            !setlist) ||
        (bandSongsLoading &&
            bandSongs.length === 0)
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
                <View
                    style={
                        styles.header
                    }
                >
                    <TouchableOpacity
                        style={
                            styles.backButton
                        }
                        onPress={
                            handleGoBack
                        }
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
                    >
                        Repertorio
                    </Text>

                    <View
                        style={
                            styles.headerSpacer
                        }
                    />
                </View>

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
                        Cargando
                        repertorio...
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
                <View
                    style={
                        styles.header
                    }
                >
                    <TouchableOpacity
                        style={
                            styles.backButton
                        }
                        onPress={
                            handleGoBack
                        }
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
                    >
                        Repertorio
                    </Text>

                    <View
                        style={
                            styles.headerSpacer
                        }
                    />
                </View>

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
                        No se pudo cargar
                        el repertorio
                    </Text>

                    <Text
                        style={
                            styles.emptyText
                        }
                    >
                        {bandSetlistsError}
                    </Text>
                </View>
            </View>
        );
    }

    /**
     * Estado: el ID recibido no corresponde
     * a ningún repertorio de la banda.
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
                <View
                    style={
                        styles.header
                    }
                >
                    <TouchableOpacity
                        style={
                            styles.backButton
                        }
                        onPress={
                            handleGoBack
                        }
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
                    >
                        Repertorio
                    </Text>

                    <View
                        style={
                            styles.headerSpacer
                        }
                    />
                </View>

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
                        El repertorio
                        puede haber sido
                        eliminado o ya no
                        estar disponible.
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
            {/* Header */}
            <View
                style={
                    styles.header
                }
            >
                <TouchableOpacity
                    style={
                        styles.backButton
                    }
                    activeOpacity={0.7}
                    onPress={
                        handleGoBack
                    }
                >
                    <ChevronLeft
                        size={24}
                        color={
                            COLORS.foreground
                        }
                    />
                </TouchableOpacity>

                <View
                    style={
                        styles.headerInfo
                    }
                >
                    <Text
                        style={
                            styles.headerTitle
                        }
                        numberOfLines={1}
                    >
                        {setlist.name}
                    </Text>

                    <Text
                        style={
                            styles.headerSubtitle
                        }
                    >
                        {setlistSongs.length ===
                            1
                            ? '1 canción'
                            : `${setlistSongs.length} canciones`}
                    </Text>
                </View>

                {canManageSetlists && (
                    <View
                        style={
                            styles.headerActions
                        }
                    >
                        <TouchableOpacity
                            style={
                                styles.headerActionButton
                            }
                            activeOpacity={0.8}
                            onPress={
                                handleAddSongs
                            }
                            disabled={
                                isSaving
                            }
                        >
                            <Plus
                                size={19}
                                color={
                                    COLORS.foreground
                                }
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={
                                styles.headerActionButton
                            }
                            activeOpacity={0.8}
                            onPress={
                                handleOpenEditSetlist
                            }
                            disabled={
                                isSaving
                            }
                        >
                            <Edit2
                                size={18}
                                color={
                                    COLORS.foreground
                                }
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Advertencia de canciones no disponibles */}
            {missingSongIds.length >
                0 && (
                    <View
                        style={
                            styles.warningContainer
                        }
                    >
                        <Text
                            style={
                                styles.warningTitle
                            }
                        >
                            Algunas canciones no
                            están disponibles
                        </Text>

                        <Text
                            style={
                                styles.warningText
                            }
                        >
                            Hay{' '}
                            {
                                missingSongIds.length
                            }{' '}
                            {missingSongIds.length ===
                                1
                                ? 'canción'
                                : 'canciones'}{' '}
                            guardadas en el
                            repertorio que no
                            están disponibles
                            en la carpeta de
                            Google Drive de la
                            banda.
                        </Text>
                    </View>
                )}

            {/* Error no bloqueante */}
            {bandSetlistsError && (
                <View
                    style={
                        styles.warningContainer
                    }
                >
                    <Text
                        style={
                            styles.warningText
                        }
                    >
                        {bandSetlistsError}
                    </Text>
                </View>
            )}

            {/* Error al cargar canciones de la banda */}
            {bandSongsError && (
                <View
                    style={
                        styles.warningContainer
                    }
                >
                    <Text
                        style={
                            styles.warningTitle
                        }
                    >
                        No se pudieron
                        cargar las canciones
                    </Text>

                    <Text
                        style={
                            styles.warningText
                        }
                    >
                        {bandSongsError}
                    </Text>
                </View>
            )}

            {/* Notas del repertorio */}
            <View
                style={
                    styles.notesContainer
                }
            >
                <TouchableOpacity
                    style={
                        styles.notesHeader
                    }
                    onPress={() =>
                        setIsNotesExpanded(
                            !isNotesExpanded
                        )
                    }
                    activeOpacity={0.7}
                >
                    <View
                        style={
                            styles.notesTitleRow
                        }
                    >
                        <FileText
                            size={16}
                            color={
                                COLORS.accent
                            }
                        />

                        <Text
                            style={
                                styles.notesTitle
                            }
                        >
                            Notas del
                            Repertorio
                        </Text>

                        {setlist.notes &&
                            setlist.notes.trim()
                                .length >
                            0 && (
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
                        {canManageSetlists && (
                            <TouchableOpacity
                                style={
                                    styles.editNotesBtn
                                }
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
                        )}

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
                    <View
                        style={
                            styles.notesBody
                        }
                    >
                        {isEditingNotes &&
                            canManageSetlists ? (
                            <View
                                style={
                                    styles.notesEditWrapper
                                }
                            >
                                <TextInput
                                    style={
                                        styles.notesInput
                                    }
                                    value={
                                        notesText
                                    }
                                    onChangeText={
                                        setNotesText
                                    }
                                    placeholder="Escribe notas, recordatorios u observaciones..."
                                    placeholderTextColor={
                                        COLORS.mutedForeground
                                    }
                                    multiline
                                    numberOfLines={
                                        4
                                    }
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
                                                size={
                                                    16
                                                }
                                                color="#fff"
                                            />

                                            <Text
                                                style={
                                                    styles.saveNotesBtnText
                                                }
                                            >
                                                Guardar
                                                Notas
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                {setlist.notes &&
                                    setlist.notes
                                        .trim()
                                        .length >
                                    0 ? (
                                    <Text
                                        style={
                                            styles.notesText
                                        }
                                    >
                                        {
                                            setlist.notes
                                        }
                                    </Text>
                                ) : (
                                    <Text
                                        style={
                                            styles.notesPlaceholder
                                        }
                                    >
                                        Sin notas
                                        para este
                                        repertorio.
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Director Mode */}
            {isActiveSetlist &&
                activeSession && (
                    <TouchableOpacity
                        style={[
                            styles.directorButton,
                            styles.directorButtonActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={
                            handleGoToActiveSession
                        }
                    >
                        <Radio
                            size={19}
                            color={
                                COLORS.background
                            }
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

            {!activeSession &&
                canCreateDirectorSession && (
                    <Button
                        title={
                            isStartingDirector
                                ? 'Iniciando Director Mode...'
                                : 'Iniciar Director Mode'
                        }
                        icon={
                            <Radio
                                size={18}
                            />
                        }
                        onPress={
                            handleStartDirectorMode
                        }
                        loading={
                            isStartingDirector
                        }
                        disabled={
                            setlistSongs.length ===
                            0
                        }
                        style={
                            styles.directorButton
                        }
                    />
                )}

            {hasAnotherActiveSetlist &&
                activeSession && (
                    <View
                        style={
                            styles.otherActiveSessionContainer
                        }
                    >
                        <Radio
                            size={18}
                            color={
                                COLORS.accent
                            }
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
                                Otro repertorio
                                está en
                                Director Mode
                            </Text>

                            <Text
                                style={
                                    styles.otherActiveSessionSubtitle
                                }
                                numberOfLines={1}
                            >
                                {
                                    activeSession.setlistName
                                }
                            </Text>
                        </View>
                    </View>
                )}

            {/* Lista de canciones */}
            <View
                style={
                    styles.listContainer
                }
            >
                <SongList
                    songs={setlistSongs}
                    onSongPress={
                        handleBandSongPress
                    }
                    isSetlistMode
                    onRemoveFromSetlist={
                        handleRemoveSong
                    }
                    onAddSongsPress={
                        handleAddSongs
                    }
                    onReorder={
                        handleReorder
                    }
                    loadingSongId={
                        loadingSongId
                    }
                    scrollEnabled={
                        !isSaving
                    }
                    songNotes={
                        setlist.songNotes ||
                        {}
                    }
                    onSaveSongNote={
                        handleSaveSongNote
                    }
                    onDeleteSongNote={
                        handleDeleteSongNote
                    }
                    canManageSetlist={
                        canManageSetlists
                    }
                    songStatuses={
                        songStatuses
                    }
                />
            </View>

            {/* Indicador de guardado */}
            {isSaving && (
                <View
                    style={
                        styles.savingIndicator
                    }
                >
                    <ActivityIndicator
                        size="small"
                        color={
                            COLORS.accent
                        }
                    />

                    <Text
                        style={
                            styles.savingText
                        }
                    >
                        Guardando...
                    </Text>
                </View>
            )}

            {/* Confirmación: quitar canción */}
            <AppModal
                visible={!!songToRemove}
                type="danger"
                title="Quitar canción"
                message={
                    songToRemove
                        ? `¿Querés quitar "${songToRemove.name}" del repertorio?`
                        : ''
                }
                confirmText="Quitar"
                cancelText="Cancelar"
                onCancel={() =>
                    setSongToRemove(
                        null
                    )
                }
                onConfirm={
                    handleConfirmRemoveSong
                }
                loading={
                    isRemovingSong
                }
            />

            {/* Feedback genérico */}
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

            {canManageSetlists && (
                <EditBandSetlistModal
                    visible={
                        isEditModalOpen
                    }
                    setlist={
                        setlist
                    }
                    onClose={() =>
                        setIsEditModalOpen(
                            false
                        )
                    }
                    onSave={
                        handleSaveSetlist
                    }
                />
            )}
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
        color:
            COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 2,
    },

    headerSpacer: {
        width: 42,
    },

    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },

    headerActionButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            'rgba(255,255,255,0.1)',
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

    warningContainer: {
        marginHorizontal: 16,
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        backgroundColor:
            COLORS.surface,
        borderWidth: 1,
        borderColor:
            COLORS.border,
    },

    warningTitle: {
        color: COLORS.foreground,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },

    warningText: {
        color:
            COLORS.mutedForeground,
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
        backgroundColor:
            COLORS.accent,
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
        color:
            COLORS.background,
        fontSize: 14,
        fontWeight: '700',
    },

    directorButtonSubtitle: {
        marginTop: 2,
        color:
            COLORS.background,
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
        backgroundColor:
            COLORS.surface,
        borderWidth: 1,
        borderColor:
            COLORS.border,
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
        color:
            COLORS.mutedForeground,
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
        backgroundColor:
            COLORS.surface,
        borderWidth: 1,
        borderColor:
            COLORS.border,
    },

    savingText: {
        color: COLORS.foreground,
        fontSize: 12,
        fontWeight: '600',
    },

    notesContainer: {
        marginHorizontal: 15,
        marginTop: 12,
        backgroundColor:
            COLORS.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor:
            COLORS.border,
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
        backgroundColor:
            COLORS.accent,
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
        borderTopColor:
            COLORS.border,
    },

    notesEditWrapper: {
        gap: 10,
    },

    notesInput: {
        backgroundColor:
            COLORS.background,
        color: COLORS.foreground,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        borderWidth: 1,
        borderColor:
            COLORS.border,
        minHeight: 90,
    },

    saveNotesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor:
            COLORS.accent,
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
        color:
            COLORS.mutedForeground,
        fontSize: 13,
        fontStyle: 'italic',
    },
});