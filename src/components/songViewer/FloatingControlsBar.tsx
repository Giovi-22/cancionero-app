import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Plus, Play, Pause, Settings } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface FloatingControlsBarProps {
  transpose: number;
  onTransposeDecrease: () => void;
  onTransposeIncrease: () => void;
  isScrolling: boolean;
  scrollSpeed: number;
  onToggleScroll: () => void;
  onOpenSettings: () => void;
  bottomInset: number;
}

export const FloatingControlsBar: React.FC<FloatingControlsBarProps> = ({
  transpose,
  onTransposeDecrease,
  onTransposeIncrease,
  isScrolling,
  scrollSpeed,
  onToggleScroll,
  onOpenSettings,
  bottomInset,
}) => {
  return (
    <View style={[styles.floatingBar, { bottom: Math.max(bottomInset, 20) + 10 }]}>
      <View style={styles.controlGroup}>
        <TouchableOpacity onPress={onTransposeDecrease} style={styles.smallBtn}>
          <Minus size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: COLORS.mutedForeground, fontSize: 9, fontWeight: 'bold', marginBottom: 1 }}>TONO</Text>
          <Text style={[styles.ctrlText, { minWidth: 30, fontSize: 14 }]}>{transpose > 0 ? `+${transpose}` : transpose}</Text>
        </View>
        <TouchableOpacity onPress={onTransposeIncrease} style={styles.smallBtn}>
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.playBtn, isScrolling && styles.playBtnActive]}
        onPress={onToggleScroll}
      >
        {isScrolling ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
        <Text style={styles.playText}>{isScrolling ? `${scrollSpeed}x` : 'Scroll'}</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity onPress={onOpenSettings} style={styles.headerBtn}>
        <Settings size={24} color={COLORS.foreground} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingBar: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 90,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  ctrlText: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playBtnActive: {
    backgroundColor: '#ef4444',
  },
  playText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
