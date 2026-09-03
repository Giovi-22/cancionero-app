import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useAppContext } from '../../src/context/AppContext';
import { useDirectorSession } from '../../src/hooks/useDirectorSession';
import { useBandSetlists } from '../../src/hooks/useBandSetlists';

import { SongViewer } from '../../src/components/SongViewer';
import { FileSystemService } from '../../src/services/FileSystemService';
import { StorageService } from '../../src/services/StorageService';

import { SongMetadata } from '../../src/types';
import { COLORS } from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SongPage {
  song: SongMetadata;
  content: string | null;
  settings: any;
  loaded: boolean;
}

export default function SetlistPlayerScreen() {
  const { setlistId, bandId: bandIdParam } = useLocalSearchParams<{
    setlistId: string;
    bandId?: string;
  }>();

  const {
    songs,
    activeLibrary,
    activeBandId,
    handleFollowSongChange,
    handleSaveSongSettings,
    setSetlistSongs,
    globalTheme,
    handleSaveGlobalTheme,
  } = useAppContext();

  /**
   * La banda se obtiene primero del parámetro de la ruta
   * y como fallback del contexto global.
   */
  const resolvedBandId = bandIdParam || activeBandId || null;
  console.log('[SetlistPlayer] Params:', {
    setlistId,
    bandIdParam,
    activeBandId,
    resolvedBandId,
  });
  /**
   * Los setlists de este player son los de la banda,
   * no los setlists personales del AppContext.
   */
  const {
    setlists: bandSetlists,
    loading: bandSetlistsLoading,
    error: bandSetlistsError,
  } = useBandSetlists(resolvedBandId);

  /**
   * Director Mode
   */
  const {
    activeSession,
    isDirectorOfSession,
    latestEvent,
    sendEvent,
  } = useDirectorSession(resolvedBandId);

  const isDirector = isDirectorOfSession;

  const flatListRef = useRef<FlatList>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [pages, setPages] = useState<SongPage[]>([]);
  const [ready, setReady] = useState(false);

  /**
   * Busca el BandSetlist y arma las páginas del reproductor.
   */
  useEffect(() => {
    if (!setlistId) {
      return;
    }

    if (bandSetlistsLoading) {
      return;
    }
    console.log('[SetlistPlayer] BandSetlists:', {
      setlistId,
      resolvedBandId,
      bandSetlistsLoading,
      bandSetlistsCount: bandSetlists.length,
      bandSetlistIds: bandSetlists.map(item => item.id),
    });
    const setlist = bandSetlists.find(
      (item) => item.id === setlistId
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

    /**
     * BandSetlist.songIds define el orden de las canciones.
     * Las metadata reales de las canciones siguen viniendo
     * del almacenamiento/local library.
     */
    const songsOfList = setlist.songIds
      .map((id) => songs.find((song) => song.id === id))
      .filter(Boolean) as SongMetadata[];

    if (songsOfList.length === 0) {
      console.warn(
        '[SetlistPlayer] El setlist no contiene canciones disponibles:',
        setlistId
      );

      router.back();
      return;
    }

    const initialPages: SongPage[] = songsOfList.map((song) => ({
      song,
      content: null,
      settings: null,
      loaded: false,
    }));

    setPages(initialPages);
    setCurrentIndex(0);
    setReady(true);

    /**
     * Mantiene sincronizado el listado de canciones que utiliza
     * el resto de la aplicación / SongViewer.
     */
    setSetlistSongs(songsOfList);
  }, [
    setlistId,
    bandSetlists,
    bandSetlistsLoading,
    bandSetlistsError,
    songs,
    setSetlistSongs,
  ]);

  /**
   * Carga el contenido y configuración de una canción.
   */
  const loadPage = useCallback(
    async (index: number, allPages: SongPage[]) => {
      if (index < 0 || index >= allPages.length) {
        return;
      }

      if (allPages[index].loaded) {
        return;
      }

      const { song } = allPages[index];

      try {
        const content = await FileSystemService.getSongContent(song.id);

        const libId = activeLibrary?.id || 'default';

        let settings = await StorageService.getSetting(
          `song_settings_${libId}_${song.id}`
        );

        /**
         * Compatibilidad con configuraciones antiguas
         * almacenadas sin libraryId.
         */
        if (!settings && libId === 'default') {
          settings = await StorageService.getSetting(
            `song_settings_${song.id}`
          );
        }

        await StorageService.incrementSongViewCount(song.id);

        setPages((prev) => {
          const updated = [...prev];

          if (!updated[index]) {
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
   * Precarga la canción actual, siguiente y anterior.
   */
  useEffect(() => {
    if (!ready || pages.length === 0) {
      return;
    }

    loadPage(currentIndex, pages);
    loadPage(currentIndex + 1, pages);
    loadPage(currentIndex - 1, pages);
  }, [currentIndex, ready, pages.length, loadPage]);

  /**
   * Cierra el player.
   */
  const handleClose = useCallback(() => {
    setSetlistSongs([]);
    router.back();
  }, [setSetlistSongs]);

  /**
   * Avanza a la siguiente canción.
   */
  const handleNext = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      const nextIndex = currentIndex + 1;

      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });

      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, pages.length]);

  /**
   * Retrocede a la canción anterior.
   */
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;

      flatListRef.current?.scrollToIndex({
        index: prevIndex,
        animated: true,
      });

      setCurrentIndex(prevIndex);
    }
  }, [currentIndex]);

  /**
   * Cambio de canción recibido por Director Mode.
   *
   * Esto se utiliza en los followers:
   * cuando llega SONG_CHANGED, buscamos la canción dentro
   * del setlist y desplazamos el FlatList hasta ella.
   */
  const handleFollowSongChangeLocal = useCallback(
    async (newSongId: string) => {
      await handleFollowSongChange(newSongId);

      const idx = pages.findIndex(
        (page) => page.song.id === newSongId
      );

      if (idx >= 0 && idx !== currentIndex) {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
        });

        setCurrentIndex(idx);
      }
    },
    [
      pages,
      currentIndex,
      handleFollowSongChange,
    ]
  );

  /**
   * Guarda la configuración de una canción.
   */
  const handleSaveSettings = useCallback(
    (data: any) => {
      handleSaveSongSettings(data);

      setPages((prev) => {
        const updated = [...prev];

        const idx = updated.findIndex(
          (page) => page.song.id === data.songId
        );

        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            settings: data.settings,
          };
        }

        return updated;
      });
    },
    [handleSaveSongSettings]
  );

  /**
   * Render de cada canción.
   */
  const renderPage = ({
    item,
  }: {
    item: SongPage;
    index: number;
  }) => {
    if (!item.loaded || !item.content) {
      return (
        <View style={styles.pageContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={COLORS.accent}
            />

            <Text style={styles.loadingText}>
              {item.song.name}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.pageContainer}>
        <SongViewer
          title={item.song.name}
          songId={item.song.id}
          content={item.content}
          onClose={handleClose}
          initialSettings={item.settings}
          onSaveSettings={handleSaveSettings}
          globalTheme={globalTheme}
          onSaveGlobalTheme={handleSaveGlobalTheme}

          /**
           * Director Mode
           */
          isDirector={isDirector}
          isFollower={!isDirector && !!activeSession}

          onSendDirectorEvent={
            isDirector
              ? sendEvent
              : undefined
          }

          incomingDirectorEvent={
            !isDirector
              ? latestEvent
              : null
          }

          onFollowSongChange={
            !isDirector
              ? handleFollowSongChangeLocal
              : undefined
          }

          /**
           * Setlist navigation
           */
          setlistSongs={pages.map(
            (page) => page.song
          )}

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
   * Detecta el cambio de página del FlatList.
   */
  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const newIndex = Math.round(
        e.nativeEvent.contentOffset.x / SCREEN_WIDTH
      );

      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    },
    [currentIndex]
  );

  /**
   * Mientras cargamos los BandSetlists todavía no podemos
   * determinar qué canciones contiene el setlist.
   */
  if (bandSetlistsLoading || !ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.accent}
        />
      </View>
    );
  }

  /**
   * Si terminó de cargar pero no encontramos el setlist,
   * mostramos un mensaje en lugar de dejar un spinner infinito.
   */
  if (bandSetlistsError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          No se pudo cargar el repertorio.
        </Text>
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          No se encontraron canciones en este repertorio.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={pages}
      renderItem={renderPage}
      keyExtractor={(item) => item.song.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumScrollEnd}
      getItemLayout={(_, index) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
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
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  loadingText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
  },

  errorText: {
    color: COLORS.mutedForeground,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});