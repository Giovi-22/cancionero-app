import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Radio, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SongMetadata } from '../../types';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface SetlistNavSubHeaderProps {
  isDirector: boolean;
  followSessionId?: string;
  setlistSongs: SongMetadata[];
  songId: string;
  onDirectorPrev?: () => void;
  onDirectorNext?: () => void;
}

export const SetlistNavSubHeader: React.FC<SetlistNavSubHeaderProps> = ({
  isDirector,
  followSessionId,
  setlistSongs,
  songId,
  onDirectorPrev,
  onDirectorNext,
}) => {
  if (!isDirector && !followSessionId && setlistSongs.length === 0) {
    return null;
  }

  const idx = setlistSongs.findIndex(s => s.id === songId);
  const isFollower = !!followSessionId && !isDirector;

  return (
    <View style={styles.subHeader}>
      {/* Badge de modo */}
      <View style={[styles.subHeaderBadge, isFollower ? styles.followerBadge : isDirector ? styles.directorBadge : styles.localBadge]}>
        <Radio size={10} color="#fff" />
        <Text style={styles.subHeaderBadgeText}>
          {isFollower ? 'SEGUIDOR' : isDirector ? 'DIRECTOR' : 'LISTA'}
        </Text>
      </View>

      {/* Controles de navegación */}
      <TouchableOpacity
        onPress={onDirectorPrev}
        style={[styles.subNavBtn, idx <= 0 && styles.subNavBtnDisabled]}
        disabled={idx <= 0 || isFollower}
      >
        <ChevronLeft size={20} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.subHeaderCounter}>{idx + 1} / {setlistSongs.length}</Text>

      <TouchableOpacity
        onPress={onDirectorNext}
        style={[styles.subNavBtn, idx >= setlistSongs.length - 1 && styles.subNavBtnDisabled]}
        disabled={idx >= setlistSongs.length - 1 || isFollower}
      >
        <ChevronRight size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(26,26,26,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  directorBadge: {
    backgroundColor: '#dc2626',
  },
  followerBadge: {
    backgroundColor: '#2563eb',
  },
  localBadge: {
    backgroundColor: '#4b5563',
  },
  subHeaderBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  subNavBtnDisabled: {
    opacity: 0.3,
  },
  subHeaderCounter: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: 'bold',
  },
});
