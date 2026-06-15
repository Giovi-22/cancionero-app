import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Radio, Wifi } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';
import { router } from 'expo-router';

export const LiveSessionBanners = () => {
  const {
    user,
    songs,
    liveSessions,
    myDirectorSession,
    followingSession,
    handleJoinSession,
    handleLeaveSession,
    handleEndShow,
    handleSongPress
  } = useAppContext();

  return (
    <View style={styles.container}>
      {/* Banner Show en Vivo - DIRECTOR */}
      {myDirectorSession && (
        <TouchableOpacity
          style={styles.directorBanner}
          onPress={async () => {
            if (!myDirectorSession.setlist_id) return;
            router.push({ pathname: "/setlist-player/[setlistId]", params: { setlistId: myDirectorSession.setlist_id, directorMode: 'true' } } as any);
          }}
        >
          <View style={styles.bannerLeft}>
            <Radio size={18} color="#fff" />
            <View>
              <Text style={styles.bannerTitle}>🎬 Show en Vivo · {myDirectorSession.setlist_name}</Text>
              <Text style={styles.bannerSub}>
                {myDirectorSession.current_song_id
                  ? `▶ ${songs.find(s => s.id === myDirectorSession.current_song_id)?.name || 'Cargando...'}`
                  : 'Toca para abrir la canción actual'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleEndShow} style={styles.endShowBtn}>
            <Text style={styles.endShowText}>Terminar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Otros shows activos para unirse */}
      {liveSessions.filter(s => s.director_email !== user?.email).map(session => (
        <TouchableOpacity
          key={session.id}
          style={[styles.directorBanner, styles.followerBanner]}
          onPress={() => handleJoinSession(session)}
        >
          <View style={styles.bannerLeft}>
            <Wifi size={18} color="#fff" />
            <View>
              <Text style={styles.bannerTitle}>📡 {session.setlist_name}</Text>
              <Text style={styles.bannerSub}>
                {followingSession?.id === session.id
                  ? `Siguiendo · ${songs.find(s => s.id === session.current_song_id)?.name || '...'}`
                  : `Director: ${session.director_name} · Toca para unirte`}
              </Text>
            </View>
          </View>
          {followingSession?.id === session.id && (
            <TouchableOpacity onPress={handleLeaveSession} style={styles.endShowBtn}>
              <Text style={styles.endShowText}>Salir</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    marginBottom: 15,
  },
  directorBanner: {
    backgroundColor: COLORS.accent,
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  followerBanner: {
    backgroundColor: '#8b5cf6', // Violeta para el seguidor
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  endShowBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  endShowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
