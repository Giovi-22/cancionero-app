import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Music, Hash, FastForward, Activity } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface SongViewerInfoBarProps {
  originalTone: string | null;
  transposedTone: string | null;
  transpose: number;
  capo: number;
  isScrolling: boolean;
  scrollSpeed: number;
  isMetronomeActive: boolean;
  setIsMetronomeActive: (active: boolean) => void;
  beat: boolean;
  beatCount: number;
  bpm: number;
}

export const SongViewerInfoBar: React.FC<SongViewerInfoBarProps> = ({
  originalTone,
  transposedTone,
  transpose,
  capo,
  isScrolling,
  scrollSpeed,
  isMetronomeActive,
  setIsMetronomeActive,
  beat,
  beatCount,
  bpm,
}) => {
  return (
    <View style={styles.infoBar}>
      {/* Tono */}
      <View style={[
        styles.infoBadge,
        (!originalTone && transpose === 0) && styles.infoBadgeInactive,
        transpose !== 0 && { borderColor: COLORS.accent, borderWidth: 1, backgroundColor: 'transparent' }
      ]}>
        <Music size={12} color={transpose !== 0 ? COLORS.accent : (originalTone ? COLORS.foreground : COLORS.mutedForeground)} />
        <Text style={[
          styles.infoBadgeText,
          (!originalTone && transpose === 0) && styles.infoBadgeTextInactive,
          transpose !== 0 && { color: COLORS.accent }
        ]}>
          {originalTone ? `${originalTone}${transposedTone && transposedTone !== originalTone ? ` → ${transposedTone}` : ''}` : 'Tono'}
          {transpose !== 0 ? ` (${transpose > 0 ? `+${transpose}` : transpose})` : ''}
        </Text>
      </View>

      {/* Capo */}
      <View style={[styles.infoBadge, capo === 0 && styles.infoBadgeInactive]}>
        <Hash size={12} color={capo > 0 ? COLORS.foreground : COLORS.mutedForeground} />
        <Text style={[styles.infoBadgeText, capo === 0 && styles.infoBadgeTextInactive]}>
          {capo > 0 ? `Capo ${capo}` : 'Capo'}
        </Text>
      </View>

      {/* Scroll */}
      <View style={[styles.infoBadge, !isScrolling && styles.infoBadgeInactive]}>
        <FastForward size={12} color={isScrolling ? COLORS.foreground : COLORS.mutedForeground} />
        <Text style={[styles.infoBadgeText, !isScrolling && styles.infoBadgeTextInactive]}>
          {isScrolling ? `${scrollSpeed}x` : 'Scroll'}
        </Text>
      </View>

      {/* Metrónomo */}
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => setIsMetronomeActive(!isMetronomeActive)}
        style={[
          styles.infoBadge,
          !isMetronomeActive && styles.infoBadgeInactive,
          isMetronomeActive && beat && beatCount === 0 && { borderColor: '#f59e0b', borderWidth: 1, backgroundColor: 'rgba(245,158,11,0.1)' },
        ]}
      >
        <Activity size={12} color={
          !isMetronomeActive ? COLORS.mutedForeground
          : beat && beatCount === 0 ? '#f59e0b'
          : beat ? COLORS.accent
          : COLORS.foreground
        } />
        <Text style={[styles.infoBadgeText, !isMetronomeActive && styles.infoBadgeTextInactive]}>
          {isMetronomeActive ? `${bpm} BPM` : 'BPM'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  infoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoBadgeInactive: {
    backgroundColor: 'transparent',
    opacity: 0.4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoBadgeText: {
    color: COLORS.foreground,
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoBadgeTextInactive: {
    color: COLORS.mutedForeground,
  },
});
