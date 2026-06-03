import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Music, List, TrendingUp, Star, Play, Radio, BookOpen, Heart, Settings, Folder, Mic, Headphones, Bookmark, Volume2 } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { LiveSessionBanners } from '../components/LiveSessionBanners';
import { COLORS } from '../constants/theme';
import { AppHeader } from '../components/layout/AppHeader';
import { router } from 'expo-router';

export const HomeScreen = () => {
  const {
    user,
    songs,
    topSongs,
    setlists,
    activeLibrary,
    handleSongPress,
    handleStartSetlistLocally,
    handleStartShow,
    myDirectorSession,
    setActiveSetlist,
    isSyncing,
    handleSync
  } = useAppContext();

  const handleSetlistPress = (setlist: any) => {
    setActiveSetlist(setlist);
    router.push('/(tabs)/songs');
  };

  const renderLibraryIcon = (iconName: string, color: string) => {
    const size = 18;
    switch (iconName) {
      case 'music': return <Music size={size} color={color} />;
      case 'star': return <Star size={size} color={color} />;
      case 'heart': return <Heart size={size} color={color} />;
      case 'settings': return <Settings size={size} color={color} />;
      case 'folder': return <Folder size={size} color={color} />;
      case 'mic': return <Mic size={size} color={color} />;
      case 'headphones': return <Headphones size={size} color={color} />;
      case 'radio': return <Radio size={size} color={color} />;
      case 'bookmark': return <Bookmark size={size} color={color} />;
      case 'list': return <List size={size} color={color} />;
      case 'play': return <Play size={size} color={color} />;
      case 'volume2': return <Volume2 size={size} color={color} />;
      case 'book-open':
      default:
        return <BookOpen size={size} color={color} />;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <AppHeader
        title="Cancionero"
        isSyncing={isSyncing}
        onSync={handleSync}
        onSettings={() => router.push("/(tabs)/user")}
        hasUser={!!user}
      />
      {/* SECCIÓN DE BIENVENIDA */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeLeft}>
          <Text style={styles.welcomeTitle}>
            ¡Hola, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Invitado'}!
          </Text>
          {!user ? (
            <View style={styles.connectionWarning}>
              <Text style={styles.connectionWarningText}>Sin conexión a Google Drive</Text>
            </View>
          ) : (
            <Text style={styles.welcomeSub}>¿Qué vamos a tocar hoy?</Text>
          )}
        </View>

        {/* Badge Biblioteca Activa */}
        {activeLibrary && (
          <View style={[styles.libraryBadge, { borderColor: activeLibrary.color || COLORS.accent }]}>
            {renderLibraryIcon(activeLibrary.icon || 'book-open', activeLibrary.color || COLORS.accent)}
            <Text style={[styles.libraryBadgeText, { color: activeLibrary.color || COLORS.accent }]}>
              {activeLibrary.name}
            </Text>
          </View>
        )}
      </View>

      {/* Banners de sesiones live en vivo */}
      <LiveSessionBanners />

      {/* ESTADÍSTICAS RÁPIDAS */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/songs')}>
          <Music size={24} color={activeLibrary?.color || COLORS.accent} />
          <Text style={styles.statValue}>{songs.length}</Text>
          <Text style={styles.statLabel}>Canciones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/setlists')}>
          <List size={24} color="#10b981" />
          <Text style={styles.statValue}>{setlists.length}</Text>
          <Text style={styles.statLabel}>Listas</Text>
        </TouchableOpacity>
      </View>

      {/* MÁS ELEGIDAS */}
      <View style={styles.sectionHeader}>
        <TrendingUp size={20} color={activeLibrary?.color || COLORS.accent} />
        <Text style={styles.sectionTitle}>Más Elegidas</Text>
      </View>

      <View style={styles.topSongsList}>
        {topSongs.map((song, index) => (
          <TouchableOpacity
            key={song.id}
            style={styles.topSongItem}
            onPress={() => handleSongPress(song)}
          >
            <View style={styles.topSongRank}>
              <Text style={styles.topSongRankText}>{index + 1}</Text>
            </View>
            <Text style={styles.topSongName} numberOfLines={1}>{song.name}</Text>
          </TouchableOpacity>
        ))}
        {topSongs.length === 0 && (
          <Text style={styles.emptyText}>Sincroniza tus canciones para empezar.</Text>
        )}
      </View>

      {/* LISTAS RECIENTES */}
      <View style={styles.sectionHeader}>
        <Star size={20} color="#fbbf24" />
        <Text style={styles.sectionTitle}>Listas Recientes</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentSetlists} contentContainerStyle={{ paddingRight: 20 }}>
        {setlists.slice(0, 5).map((setlist) => (
          <View key={setlist.id} style={styles.setlistCard}>
            <TouchableOpacity onPress={() => handleSetlistPress(setlist)}>
              <View style={styles.setlistCardIcon}>
                <List size={24} color="#fff" />
              </View>
              <Text style={styles.setlistCardName} numberOfLines={2}>
                {setlist.name}
              </Text>
              <Text style={styles.setlistCardCount}>{setlist.songIds.length} temas</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.startShowBtn, { marginTop: 0, flex: 1, justifyContent: 'center' }]}
                onPress={() => handleStartSetlistLocally(setlist)}
              >
                <Play size={12} color="#fff" />
                <Text style={styles.startShowText}>Iniciar</Text>
              </TouchableOpacity>
              {user && (
                <TouchableOpacity
                  style={[
                    styles.startShowBtn,
                    myDirectorSession?.setlist_id === setlist.id && styles.startShowBtnActive,
                    { marginTop: 0, flex: 1, justifyContent: 'center' }
                  ]}
                  onPress={() => handleStartShow(setlist)}
                >
                  <Radio size={12} color="#fff" />
                  <Text style={styles.startShowText} numberOfLines={1}>
                    {myDirectorSession?.setlist_id === setlist.id ? 'Vivo' : 'Show'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {setlists.length === 0 && (
          <Text style={styles.emptyTextHorizontal}>No hay listas creadas recientemente.</Text>
        )}
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  welcomeLeft: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  welcomeSub: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  connectionWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  connectionWarningText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  libraryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  libraryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 25,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  topSongsList: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 25,
  },
  topSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  topSongRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topSongRankText: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: 'bold',
  },
  topSongName: {
    flex: 1,
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    color: COLORS.mutedForeground,
    textAlign: 'center',
    paddingVertical: 15,
    fontSize: 13,
  },
  emptyTextHorizontal: {
    color: COLORS.mutedForeground,
    paddingVertical: 20,
    paddingLeft: 10,
    fontSize: 13,
  },
  recentSetlists: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  setlistCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    width: 140,
    marginRight: 12,
  },
  setlistCardIcon: {
    backgroundColor: COLORS.accent,
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  setlistCardName: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: 'bold',
    height: 36,
  },
  setlistCardCount: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    marginTop: 4,
  },
  startShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  startShowBtnActive: {
    backgroundColor: '#ef4444',
  },
  startShowText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
