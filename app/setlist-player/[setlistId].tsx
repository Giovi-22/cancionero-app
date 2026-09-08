import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
} from 'react-native';
import {
  useLocalSearchParams,
  router,
} from 'expo-router';

import { useAppContext } from '../../src/context/AppContext';
import { useDirectorSession } from '../../src/hooks/useDirectorSession';
import { useBandSetlists } from '../../src/hooks/useBandSetlists';

import { SongViewer } from '../../src/components/SongViewer';
import { FileSystemService } from '../../src/services/FileSystemService';
import { StorageService } from '../../src/services/StorageService';

import { SongMetadata } from '../../src/types';
import { COLORS } from '../../src/constants/theme';

const { width: SCREEN_WIDTH } =
  Dimensions.get('window');

interface SongPage {
  song: SongMetadata;
  content: string | null;
  settings: any;
  loaded: boolean;
}

export default function SetlistPlayerScreen() {
  const {
    setlistId,
    bandId: bandIdParam,
  } = useLocalSearchParams<{
    setlistId: string;
    bandId?: string;
  }>();

  const {
    songs,
    setlists,
    activeLibrary,
    handleSaveSongSettings,
    setSetlistSongs,
    globalTheme,
    handleSaveGlobalTheme,
  } = useAppContext();

  /**
   * El modo del player se determina por la ruta.
   *
   * Si viene bandId => Band Mode.
   * Si no viene bandId => Setlist personal.
   */
  const isBandMode = !!bandIdParam;

  const resolvedBandId =
    isBandMode ? bandIdParam : null;

  const {
    setlists: bandSetlists,
    loading: bandSetlistsLoading,
    error: bandSetlistsError,
  } = useBandSetlists(
    resolvedBandId
  );

  const {
    activeSession,
    isDirectorOfSession,
    latestEvent,
    sendEvent,
  } = useDirectorSession(
    resolvedBandId
  );

  const isDirector =
    isDirectorOfSession;

  /**
   * Control de seguimiento del Director.
   *
   * Solamente tiene efecto para followers.
   *
   * true  => recibe SONG_CHANGED + SCROLL
   * false => control totalmente local
   */
  const [followDirector, setFollowDirector] =
    useState(true);

  const activeBandSetlist =
    isBandMode
      ? bandSetlists.find(
        item =>
          item.id === setlistId
      )
      : undefined;

  const flatListRef =
    useRef<FlatList>(null);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [pages, setPages] =
    useState<SongPage[]>([]);

  const [ready, setReady] =
    useState(false);

  /**
   * ID del último evento de Director
   * procesado por ESTE SetlistPlayer.
   *
   * Importante:
   * este ref pertenece al player completo,
   * no a cada SongViewer.
   */
  const lastProcessedEventIdRef =
    useRef<string | null>(null);

  /**
   * ID de la última canción que el Director
   * publicó mediante SONG_CHANGED.
   *
   * Esto evita publicar varias veces la misma
   * canción aunque haya renders adicionales.
   */
  const lastSentSongIdRef =
    useRef<string | null>(null);

  /**
   * Reinicia los controles de eventos solamente
   * cuando realmente cambia el setlist o la sesión.
   *
   * NO lo hacemos en el efecto que construye
   * las páginas porque ese efecto puede ejecutarse
   * nuevamente cuando cambia la biblioteca local.
   */
  useEffect(() => {
    lastProcessedEventIdRef.current =
      null;

    lastSentSongIdRef.current =
      null;

    /**
     * Cada nueva sesión/setlist comienza
     * siguiendo al Director.
     */
    setFollowDirector(true);
  }, [
    setlistId,
    activeSession?.id,
  ]);

  /**
   * Busca el setlist correspondiente al modo actual
   * y arma las páginas del reproductor.
   */
  useEffect(() => {
    if (!setlistId) {
      return;
    }

    if (
      isBandMode &&
      bandSetlistsLoading
    ) {
      return;
    }

    let setlist;

    if (isBandMode) {
      setlist =
        bandSetlists.find(
          item =>
            item.id ===
            setlistId
        );

      console.log(
        '[SetlistPlayer] BandSetlists:',
        {
          setlistId,
          resolvedBandId,
          bandSetlistsLoading,
          bandSetlistsCount:
            bandSetlists.length,
          bandSetlistIds:
            bandSetlists.map(
              item => item.id
            ),
        }
      );

      if (!setlist) {
        console.warn(
          '[SetlistPlayer] BandSetlist no encontrado:',
          setlistId
        );

        if (bandSetlistsError) {
          console.error(
            '[SetlistPlayer] Error cargando BandSetlists:',
            bandSetlistsError
          );
        }

        return;
      }
    } else {
      setlist =
        setlists.find(
          item =>
            item.id ===
            setlistId
        );

      if (!setlist) {
        console.warn(
          '[SetlistPlayer] Setlist personal no encontrado:',
          setlistId
        );

        return;
      }
    }

    /**
     * setlist.songIds es la fuente de verdad
     * del orden.
     *
     * Conservamos todas las posiciones aunque
     * una canción todavía no esté descargada
     * localmente.
     */
    const songsOfList: SongMetadata[] =
      setlist.songIds.map(
        id => {
          const localSong =
            songs.find(
              song =>
                song.id === id
            );

          if (localSong) {
            return localSong;
          }

          return {
            id,
            name:
              'Canción no disponible',
            mimeType:
              'text/plain',
          };
        }
      );

    console.log(
      '[SetlistPlayer][SETLIST]',
      isDirector
        ? 'DIRECTOR'
        : 'FOLLOWER',
      {
        setlistId,
        songIds:
          setlist.songIds,
        songsOfList:
          songsOfList.map(
            (
              song,
              index
            ) => ({
              index,
              id: song.id,
              name: song.name,
            })
          ),
      }
    );

    if (
      songsOfList.length === 0
    ) {
      console.warn(
        '[SetlistPlayer] El setlist no contiene canciones:',
        setlistId
      );

      router.back();
      return;
    }

    const initialPages:
      SongPage[] =
      songsOfList.map(
        song => ({
          song,
          content: null,
          settings: null,
          loaded: false,
        })
      );

    setPages(
      initialPages
    );

    setCurrentIndex(0);

    setReady(true);

    /**
     * setlistSongs pertenece al flujo de
     * repertorios personales del AppContext.
     *
     * Un repertorio de banda permanece dentro
     * de este player y no se copia al estado global.
     */
    if (!isBandMode) {
      setSetlistSongs(
        songsOfList
      );
    }
  }, [
    setlistId,
    isBandMode,
    resolvedBandId,
    bandSetlists,
    bandSetlistsLoading,
    bandSetlistsError,
    setlists,
    songs,
    setSetlistSongs,
    isDirector,
  ]);

  /**
   * Carga el contenido y configuración
   * de una canción.
   */
  const loadPage =
    useCallback(
      async (
        index: number,
        allPages: SongPage[]
      ) => {
        if (
          index < 0 ||
          index >=
          allPages.length
        ) {
          return;
        }

        if (
          allPages[index].loaded
        ) {
          return;
        }

        const { song } =
          allPages[index];

        try {
          const content =
            await FileSystemService.getSongContent(
              song.id
            );

          /**
           * La canción puede existir en el
           * repertorio pero no estar descargada
           * localmente en este dispositivo.
           *
           * En ese caso mantenemos la posición
           * del setlist pero no marcamos la página
           * como cargada.
           */
          if (content === null) {
            console.warn(
              '[SetlistPlayer] Canción no disponible localmente:',
              song.id
            );

            return;
          }

          const libId =
            activeLibrary?.id ||
            'default';

          let settings =
            await StorageService.getSetting(
              `song_settings_${libId}_${song.id}`
            );

          if (
            !settings &&
            libId === 'default'
          ) {
            settings =
              await StorageService.getSetting(
                `song_settings_${song.id}`
              );
          }

          await StorageService.incrementSongViewCount(
            song.id
          );

          setPages(prev => {
            const updated =
              [...prev];

            if (
              !updated[index]
            ) {
              return prev;
            }

            updated[index] = {
              ...updated[index],
              content,
              settings,
              loaded: true,
            };

            return updated;
          });
        } catch (error) {
          console.error(
            '[SetlistPlayer] Error cargando canción:',
            song.id,
            error
          );
        }
      },
      [activeLibrary]
    );

  /**
   * Precarga la canción actual,
   * siguiente y anterior.
   */
  useEffect(() => {
    if (
      !ready ||
      pages.length === 0
    ) {
      return;
    }

    loadPage(
      currentIndex,
      pages
    );

    loadPage(
      currentIndex + 1,
      pages
    );

    loadPage(
      currentIndex - 1,
      pages
    );
  }, [
    currentIndex,
    ready,
    pages.length,
    loadPage,
  ]);

  /**
   * Cierra el player.
   */
  const handleClose =
    useCallback(() => {
      /**
       * Solamente limpiamos el estado
       * personal del AppContext.
       *
       * En Band Mode el repertorio vive
       * exclusivamente dentro del player.
       */
      if (!isBandMode) {
        setSetlistSongs([]);
      }

      router.back();
    }, [
      isBandMode,
      setSetlistSongs,
    ]);

  /**
   * Avanza a la siguiente canción.
   *
   * NO modificamos currentIndex acá.
   *
   * Esperamos a que FlatList confirme
   * la página mediante onMomentumScrollEnd.
   */
  const handleNext =
    useCallback(() => {
      if (
        currentIndex >=
        pages.length - 1
      ) {
        return;
      }

      const nextIndex =
        currentIndex + 1;

      console.log(
        '[SetlistPlayer][NEXT]',
        {
          currentIndex,
          nextIndex,
          currentSongId:
            pages[currentIndex]
              ?.song.id,
          nextSongId:
            pages[nextIndex]
              ?.song.id,
          pages:
            pages.map(
              (
                page,
                index
              ) => ({
                index,
                id: page.song.id,
                name: page.song.name,
              })
            ),
        }
      );

      flatListRef.current?.scrollToIndex(
        {
          index: nextIndex,
          animated: true,
        }
      );
    }, [
      currentIndex,
      pages,
    ]);

  /**
   * Retrocede a la canción anterior.
   */
  const handlePrev =
    useCallback(() => {
      if (
        currentIndex <= 0
      ) {
        return;
      }

      const prevIndex =
        currentIndex - 1;

      console.log(
        '[SetlistPlayer][PREV]',
        {
          currentIndex,
          prevIndex,
          currentSongId:
            pages[currentIndex]
              ?.song.id,
          prevSongId:
            pages[prevIndex]
              ?.song.id,
        }
      );

      flatListRef.current?.scrollToIndex(
        {
          index: prevIndex,
          animated: true,
        }
      );
    }, [
      currentIndex,
      pages,
    ]);

  /**
   * Procesamiento CENTRALIZADO de SONG_CHANGED
   * recibidos del Director.
   *
   * Hay una única instancia de este efecto
   * para todo el SetlistPlayer.
   *
   * Los SongViewer individuales NO procesan
   * SONG_CHANGED.
   *
   * IMPORTANTE:
   * Si followDirector está OFF, el evento
   * se ignora completamente.
   */
  useEffect(() => {
    if (
      isDirector ||
      !activeSession ||
      !followDirector ||
      !latestEvent ||
      pages.length === 0
    ) {
      return;
    }

    /**
     * Este efecto solamente procesa
     * SONG_CHANGED.
     *
     * Los eventos SCROLL_UP/DOWN siguen
     * siendo manejados por el SongViewer activo.
     */
    if (
      latestEvent.type !==
      'SONG_CHANGED'
    ) {
      return;
    }

    const eventId =
      latestEvent.id ||
      latestEvent.timestamp;

    if (!eventId) {
      return;
    }

    if (
      lastProcessedEventIdRef.current ===
      eventId
    ) {
      return;
    }

    const newSongId =
      latestEvent.payload
        ?.songId;

    if (!newSongId) {
      return;
    }

    /**
     * Buscamos la canción usando el orden
     * de pages, que viene directamente de
     * setlist.songIds.
     */
    const idx =
      pages.findIndex(
        page =>
          page.song.id ===
          newSongId
      );

    console.log(
      '[SetlistPlayer][FOLLOW_EVENT] RECIBIDO',
      {
        eventId,
        type:
          latestEvent.type,
        currentIndex,
        newSongId,
        followDirector,
        pages:
          pages.map(
            (
              page,
              index
            ) => ({
              index,
              id: page.song.id,
              name: page.song.name,
            })
          ),
      }
    );

    console.log(
      '[SetlistPlayer][FOLLOW_EVENT] RESUELTO',
      {
        eventId,
        newSongId,
        foundIndex: idx,
        currentIndex,
      }
    );

    /**
     * Si todavía no encontramos la canción,
     * NO marcamos el evento como procesado.
     *
     * Esto permite que el efecto vuelva a
     * intentarlo cuando pages termine de cargar.
     */
    if (idx < 0) {
      console.warn(
        '[SetlistPlayer][FOLLOW_EVENT] Canción no encontrada en pages:',
        newSongId
      );

      return;
    }

    /**
     * Ahora sí marcamos el evento como procesado.
     */
    lastProcessedEventIdRef.current =
      eventId;

    /**
     * El contenido de la canción se carga
     * mediante el mecanismo normal de pages.
     *
     * No modificamos selectedSong,
     * songContent ni songSettings del
     * AppContext.
     */
    if (
      !pages[idx].loaded
    ) {
      loadPage(
        idx,
        pages
      );
    }

    /**
     * Si ya estamos en esa canción no
     * necesitamos mover el FlatList.
     */
    if (
      idx === currentIndex
    ) {
      return;
    }

    flatListRef.current?.scrollToIndex(
      {
        index: idx,
        animated: true,
      }
    );

    /**
     * Actualizamos inmediatamente el índice
     * activo para que el SongViewer correcto
     * pase a ser isActive.
     */
    setCurrentIndex(idx);
  }, [
    latestEvent,
    activeSession,
    isDirector,
    followDirector,
    pages,
    currentIndex,
    loadPage,
  ]);

  /**
   * Cuando el follower vuelve a activar
   * "Seguir al director", sincronizamos
   * inmediatamente con la canción que figura
   * actualmente en la sesión.
   *
   * Esto es más robusto que depender de que
   * el último evento recibido haya sido
   * SONG_CHANGED.
   */
  useEffect(() => {
    if (
      isDirector ||
      !activeSession ||
      !followDirector ||
      pages.length === 0 ||
      !activeSession.currentSongId
    ) {
      return;
    }

    const directorSongId =
      activeSession.currentSongId;

    const idx =
      pages.findIndex(
        page =>
          page.song.id ===
          directorSongId
      );

    if (idx < 0) {
      return;
    }

    if (idx === currentIndex) {
      return;
    }

    console.log(
      '[SetlistPlayer][FOLLOW_RESYNC]',
      {
        directorSongId,
        currentIndex,
        targetIndex: idx,
      }
    );

    if (
      !pages[idx].loaded
    ) {
      loadPage(
        idx,
        pages
      );
    }

    flatListRef.current?.scrollToIndex(
      {
        index: idx,
        animated: true,
      }
    );

    setCurrentIndex(idx);
  }, [
    followDirector,
    activeSession?.id,
    activeSession?.currentSongId,
    isDirector,
    pages,
    currentIndex,
    loadPage,
  ]);

  /**
   * Detecta el cambio REAL de página.
   *
   * currentIndex es la fuente de verdad
   * de qué canción está activa en el player.
   */
  const onMomentumScrollEnd =
    useCallback(
      (e: any) => {
        const newIndex =
          Math.round(
            e.nativeEvent
              .contentOffset.x /
            SCREEN_WIDTH
          );

        if (
          newIndex < 0 ||
          newIndex >=
          pages.length
        ) {
          return;
        }

        const previousIndex =
          currentIndex;

        if (
          newIndex !==
          previousIndex
        ) {
          console.log(
            '[SetlistPlayer][PAGE_CHANGED]',
            {
              previousIndex,
              newIndex,
              previousSongId:
                pages[
                  previousIndex
                ]?.song.id,
              newSongId:
                pages[
                  newIndex
                ]?.song.id,
              isDirector,
            }
          );

          setCurrentIndex(
            newIndex
          );
        }
      },
      [
        currentIndex,
        pages,
        isDirector,
      ]
    );

  /**
   * El Director publica SONG_CHANGED
   * basándose exclusivamente en currentIndex.
   *
   * Esto reemplaza:
   *
   * - el envío automático de SongViewer
   * - el envío dentro de onMomentumScrollEnd
   * - el envío especial de canción inicial
   *
   * De esta forma existe UN SOLO lugar
   * responsable de publicar SONG_CHANGED.
   */
  useEffect(() => {
    if (
      !ready ||
      !isDirector ||
      pages.length === 0
    ) {
      return;
    }

    const songId =
      pages[currentIndex]?.song.id;

    if (!songId) {
      return;
    }

    if (
      lastSentSongIdRef.current ===
      songId
    ) {
      return;
    }

    lastSentSongIdRef.current =
      songId;

    console.log(
      '[SetlistPlayer][SEND_SONG_CHANGED]',
      {
        index:
          currentIndex,
        songId,
        title:
          pages[currentIndex]
            ?.song.name,
      }
    );

    sendEvent(
      'SONG_CHANGED',
      {
        songId,
      }
    );
  }, [
    ready,
    isDirector,
    pages,
    currentIndex,
    sendEvent,
  ]);

  /**
   * Guarda la configuración de una canción.
   */
  const handleSaveSettings =
    useCallback(
      (data: any) => {
        handleSaveSongSettings(
          data
        );

        setPages(prev => {
          const updated =
            [...prev];

          const idx =
            updated.findIndex(
              page =>
                page.song.id ===
                data.songId
            );

          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              settings:
                data.settings,
            };
          }

          return updated;
        });
      },
      [
        handleSaveSongSettings,
      ]);

  /**
   * Render de cada canción.
   */
  const renderPage = ({
    item,
    index,
  }: {
    item: SongPage;
    index: number;
  }) => {
    if (
      !item.loaded ||
      !item.content
    ) {
      return (
        <View
          style={
            styles.pageContainer
          }
        >
          <View
            style={
              styles.loadingContainer
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
              {
                item.song.name
              }
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={
          styles.pageContainer
        }
      >
        <SongViewer
          title={
            item.song.name
          }
          songId={
            item.song.id
          }
          content={
            item.content
          }
          onClose={
            handleClose
          }
          initialSettings={
            item.settings
          }
          onSaveSettings={
            handleSaveSettings
          }
          globalTheme={
            globalTheme
          }
          onSaveGlobalTheme={
            handleSaveGlobalTheme
          }

          /**
           * Notas del repertorio.
           */
          setlistNotes={
            activeBandSetlist?.notes
          }
          songNote={
            activeBandSetlist
              ?.songNotes?.[
            item.song.id
            ]
          }

          /**
           * Director Mode.
           */
          isDirector={
            isDirector
          }

          /**
           * Solamente el SongViewer de la
           * canción visible es considerado activo.
           */
          isActive={
            index ===
            currentIndex
          }

          isFollower={
            !isDirector &&
            !!activeSession
          }

          /**
           * Control de seguimiento.
           *
           * El estado pertenece al SetlistPlayer
           * para que sobreviva al cambio de canción.
           */
          followDirector={
            followDirector
          }

          onFollowDirectorChange={
            setFollowDirector
          }

          /**
           * Solamente el Director puede
           * enviar eventos.
           *
           * SongViewer utilizará esto únicamente
           * para SCROLL_UP/DOWN.
           */
          onSendDirectorEvent={
            isDirector
              ? sendEvent
              : undefined
          }

          /**
           * Los eventos siguen llegando al
           * SongViewer para SCROLL_UP/DOWN.
           *
           * SONG_CHANGED NO se procesa allí.
           */
          incomingDirectorEvent={
            !isDirector
              ? latestEvent
              : null
          }

          /**
           * SONG_CHANGED se procesa
           * exclusivamente en este SetlistPlayer.
           *
           * El prop onFollowSongChange ya no
           * participa en el flujo.
           */

          /**
           * Setlist navigation.
           */
          setlistSongs={
            pages.map(
              page =>
                page.song
            )
          }

          onDirectorNext={
            isDirector
              ? handleNext
              : undefined
          }

          onDirectorPrev={
            isDirector
              ? handlePrev
              : undefined
          }
        />
      </View>
    );
  };

  /**
   * Mientras cargamos los BandSetlists
   * todavía no podemos determinar qué
   * canciones contiene el repertorio.
   */
  if (
    (isBandMode &&
      bandSetlistsLoading) ||
    !ready
  ) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color={
            COLORS.accent
          }
        />
      </View>
    );
  }

  /**
   * Los errores de BandSetlists
   * solamente aplican al modo banda.
   */
  if (
    isBandMode &&
    bandSetlistsError
  ) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <Text
          style={
            styles.errorText
          }
        >
          No se pudo cargar
          el repertorio.
        </Text>
      </View>
    );
  }

  if (
    pages.length === 0
  ) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <Text
          style={
            styles.errorText
          }
        >
          No se encontraron
          canciones en este
          repertorio.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={pages}
      renderItem={
        renderPage
      }
      keyExtractor={
        item =>
          item.song.id
      }
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={
        false
      }
      onMomentumScrollEnd={
        onMomentumScrollEnd
      }
      getItemLayout={(
        _,
        index
      ) => ({
        length:
          SCREEN_WIDTH,
        offset:
          SCREEN_WIDTH *
          index,
        index,
      })}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      windowSize={3}
    />
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  loadingText: {
    color:
      COLORS.mutedForeground,
    fontSize: 14,
  },

  errorText: {
    color:
      COLORS.mutedForeground,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
