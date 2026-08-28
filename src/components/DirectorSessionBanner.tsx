/**
 * DirectorSessionBanner
 *
 * Muestra el estado de la sesión activa de Director Mode de la banda seleccionada.
 * Reemplaza al antiguo LiveSessionBanners que usaba la colección legacy `live_sessions`.
 *
 * Para que el banner aparezca, el usuario debe:
 * - Pertenecer a una banda (bandId disponible vía prop)
 * - Tener una sesión activa en bands/{bandId}/sessions/{sessionId}
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Radio, StopCircle } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { useDirectorSession } from '../hooks/useDirectorSession';
import { DirectorSession } from '../types/band';

interface Props {
  bandId: string | null;
  onPressDirectorBanner?: (session: DirectorSession) => void;
  onEndSession?: () => void;
}

export const DirectorSessionBanner = ({ bandId, onPressDirectorBanner, onEndSession }: Props) => {
  const { activeSession, isDirectorOfSession, endSession, loading } = useDirectorSession(bandId);

  if (loading || !activeSession) return null;

  const handleEndPress = async () => {
    if (onEndSession) {
      onEndSession();
    } else {
      await endSession();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.banner, isDirectorOfSession ? styles.directorBanner : styles.followerBanner]}
        onPress={() => onPressDirectorBanner?.(activeSession)}
        activeOpacity={0.85}
      >
        <View style={styles.bannerLeft}>
          <Radio size={18} color="#fff" />
          <View>
            <Text style={styles.bannerTitle}>
              {isDirectorOfSession ? '🎬 Director Mode' : '📡 Sesión en vivo'}
            </Text>
            <Text style={styles.bannerSub}>
              {isDirectorOfSession
                ? `Dirigiendo: ${activeSession.setlistName}`
                : `Director: ${activeSession.directorName} · ${activeSession.setlistName}`}
            </Text>
          </View>
        </View>

        {isDirectorOfSession && (
          <TouchableOpacity onPress={handleEndPress} style={styles.endBtn}>
            <StopCircle size={16} color="#fff" />
            <Text style={styles.endBtnText}>Terminar</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 15,
  },
  banner: {
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  directorBanner: {
    backgroundColor: COLORS.accent,
  },
  followerBanner: {
    backgroundColor: '#8b5cf6',
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
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
