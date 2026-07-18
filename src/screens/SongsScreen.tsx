import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { ArrowLeft, Plus, Edit2, Play, Radio, Search, X, ArrowUpDown, Check } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { SongList } from '../components/SongList';
import { COLORS } from '../constants/theme';
import { SongMetadata } from '../types';
import { router } from 'expo-router';
import { AppHeader } from '../components/layout/AppHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const SongsScreen = () => {
  const {
    songs,
    searchQuery,
    setSearchQuery,
    handleSongPress,
    handleSync,
    user,
    isSyncing
  } = useAppContext();

  const [sortBy, setSortBy] = useState<'default' | 'az' | 'za'>('default');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [pendingSort, setPendingSort] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const handleSelectSort = (value: 'default' | 'az' | 'za') => {
    setPendingSort(value);
    setTimeout(() => {
      setSortBy(value);
      setPendingSort(null);
      setIsSortOpen(false);
    }, 350);
  };

  const getDisplaySongs = (): SongMetadata[] => {
    let list: SongMetadata[] = [...songs];

    if (searchQuery.trim().length > 0) {
      list = list.filter(song =>
        song.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortBy === 'az') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    } else if (sortBy === 'za') {
      list.sort((a, b) => b.name.localeCompare(a.name, 'es', { sensitivity: 'base' }));
    }

    return list;
  };

  const handleSortPress = () => {
    setIsSortOpen(true);
  };

  const displaySongs = getDisplaySongs();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Canciones"
        isSyncing={isSyncing}
        onSync={handleSync}
        onSettings={() => router.push("/(tabs)/user")}
        hasUser={!!user}
      />

      {/* Buscador y Ordenamiento */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar canción..."
            placeholderTextColor={COLORS.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={16} color={COLORS.foreground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.sortButton} onPress={handleSortPress}>
          <ArrowUpDown size={20} color={sortBy !== 'default' ? COLORS.accent : COLORS.foreground} />
        </TouchableOpacity>
      </View>

      {/* Listado de canciones */}
      <SongList
        songs={displaySongs}
        onSongPress={handleSongPress}
        onSyncPress={handleSync}
        isSetlistMode={false}
      />

      {/* Modal de Ordenamiento */}
      <Modal
        visible={isSortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSortOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsSortOpen(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ordenar Canciones</Text>
              <TouchableOpacity onPress={() => setIsSortOpen(false)} style={styles.closeBtn}>
                <X size={20} color={COLORS.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsContainer}>
              {(['default', 'az', 'za'] as const).map((option) => {
                const labels = { default: 'Por defecto', az: 'Alfabético (A-Z)', za: 'Alfabético (Z-A)' };
                const isActive = sortBy === option;
                const isPending = pendingSort === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionRow, (isActive || isPending) && styles.optionRowActive]}
                    onPress={() => handleSelectSort(option)}
                    disabled={pendingSort !== null}
                  >
                    <Text style={[styles.optionText, (isActive || isPending) && styles.optionTextActive]}>
                      {labels[option]}
                    </Text>
                    {isPending ? (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : isActive ? (
                      <Check size={18} color={COLORS.accent} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  activeSetlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeSetlistBtn: {
    padding: 5,
  },
  activeSetlistTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  editSetlistBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startShowHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  startShowHeaderBtnActive: {
    backgroundColor: '#ef4444',
  },
  startShowHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 15,
    marginBottom: 5,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortButton: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
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
  clearSearchBtn: {
    padding: 5,
  },
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
  optionsContainer: {
    gap: 8,
  },
  optionRow: {
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
  optionRowActive: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}10`,
  },
  optionText: {
    color: COLORS.mutedForeground,
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
});
