import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Dimensions, ActivityIndicator, Text
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppContext } from '../../src/context/AppContext';
import { SongViewer } from '../../src/components/SongViewer';
import { FileSystemService } from '../../src/services/FileSystemService';
import { StorageService } from '../../src/services/StorageService';
import { SongMetadata } from '../../src/types';
import { COLORS } from '../../src/constants/theme';
import { LiveSessionService } from '../../src/services/LiveSessionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SongPage {
  song: SongMetadata;
  content: string | null;
  settings: any;
  loaded: boolean;
}

export default function SetlistPlayerScreen() {
  const { setlistId, directorMode } = useLocalSearchParams<{
    setlistId: string;
    directorMode?: string;
  }>();

  const {
    setlists,
    songs,
    activeLibrary,
    myDirectorSession,
    followingSession,
    handleSaveSongSettings,
    handleFollowSongChange,
  } = useAppContext();

  const isDirector = directorMode === 'true';
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pages, setPages] = useState<SongPage[]>([]);
  const [ready, setReady] = useState(false);

  // Cargar metadata de todas las canciones de la lista
  useEffect(() => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return;

    const songsOfList = setlist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter(Boolean) as SongMetadata[];

    if (songsOfList.length === 0) {
      router.back();
      return;
    }

    const initialPages: SongPage[] = songsOfList.map(song => ({
      song,
      content: null,
      settings: null,
      loaded: false,
    }));
    setPages(initialPages);
    setReady(true);
  }, [setlistId, setlists, songs]);

  // Cargar contenido lazy: solo current + 1 adelante + 1 atrás
  const loadPage = useCallback(async (index: number, allPages: SongPage[]) => {
    if (index < 0 || index >= allPages.length) return;
    if (allPages[index].loaded) return;

    const { song } = allPages[index];
    const content = await FileSystemService.getSongContent(song.id);
    const libId = activeLibrary?.id || 'default';
    let settings = await StorageService.getSetting(`song_settings_${libId}_${song.id}`);
    if (!settings && libId === 'default') {
      settings = await StorageService.getSetting(`song_settings_${song.id}`);
    }
    await StorageService.incrementSongViewCount(song.id);

    setPages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], content, settings, loaded: true };
      return updated;
    });
  }, [activeLibrary]);

  // Cuando cambia el índice, cargar el actual y los adyacentes
  useEffect(() => {
    if (!ready || pages.length === 0) return;
    loadPage(currentIndex, pages);
    loadPage(currentIndex + 1, pages);
    loadPage(currentIndex - 1, pages);
  }, [currentIndex, ready, pages.length]);

  // Notificar al director la canción actual
  useEffect(() => {
    if (isDirector && myDirectorSession && pages[currentIndex]?.song) {
      LiveSessionService.updateCurrentSong(myDirectorSession.id, pages[currentIndex].song.id);
    }
  }, [currentIndex, isDirector, myDirectorSession]);

  const handleClose = () => {
    router.back();
  };

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
      setCurrentIndex(prevIndex);
    }
  };

  const handleSaveSettings = (data: any) => {
    handleSaveSongSettings(data);
    setPages(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(p => p.song.id === data.songId);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], settings: data.settings };
      }
      return updated;
    });
  };

  const renderPage = ({ item, index }: { item: SongPage; index: number }) => {
    if (!item.loaded || !item.content) {
      return (
        <View style={styles.pageContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>{item.song.name}</Text>
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
          isDirector={isDirector}
          directorSessionId={myDirectorSession?.id}
          followSessionId={followingSession?.id}
          onFollowSongChange={handleFollowSongChange}
          setlistSongs={pages.map(p => p.song)}
          onDirectorNext={handleNext}
          onDirectorPrev={handlePrev}
        />
      </View>
    );
  };

  const onMomentumScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  if (!ready || pages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={pages}
      renderItem={renderPage}
      keyExtractor={item => item.song.id}
      horizontal
      pagingEnabled
      scrollEnabled={false}
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
      style={styles.flatList}
    />
  );
}

const styles = StyleSheet.create({
  flatList: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
