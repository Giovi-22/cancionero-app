import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Plus, Play, Pause, Settings } from 'lucide-react-native';
import { useResponsive } from '../../hooks/useResponsive';

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
  const { isTablet } = useResponsive();

  const stepIconSize = isTablet ? 22 : 18;
  const playIconSize = isTablet ? 24 : 20;
  const settingsIconSize = isTablet ? 28 : 24;

  return (
    <View
      style={[
        styles.floatingBar,
        isTablet && styles.floatingBarTablet,
        { bottom: Math.max(bottomInset, 20) + (isTablet ? 16 : 10) },
      ]}
    >
      <View style={styles.controlGroup}>
        <TouchableOpacity
          onPress={onTransposeDecrease}
          style={[styles.smallBtn, isTablet && styles.smallBtnTablet]}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Minus size={stepIconSize} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={[
              { color: COLORS.mutedForeground, fontSize: isTablet ? 11 : 9, fontWeight: 'bold', marginBottom: 1 },
            ]}
          >
            TONO
          </Text>
          <Text
            style={[
              styles.ctrlText,
              isTablet && styles.ctrlTextTablet,
              { minWidth: isTablet ? 36 : 30 },
            ]}
          >
            {transpose > 0 ? `+${transpose}` : transpose}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onTransposeIncrease}
          style={[styles.smallBtn, isTablet && styles.smallBtnTablet]}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Plus size={stepIconSize} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.divider, isTablet && styles.dividerTablet]} />

      <TouchableOpacity
        style={[
          styles.playBtn,
          isTablet && styles.playBtnTablet,
          isScrolling && styles.playBtnActive,
        ]}
        onPress={onToggleScroll}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {isScrolling ? <Pause size={playIconSize} color="#fff" /> : <Play size={playIconSize} color="#fff" />}
        <Text style={[styles.playText, isTablet && styles.playTextTablet]}>
          {isScrolling ? `${scrollSpeed}x` : 'Scroll'}
        </Text>
      </TouchableOpacity>

      <View style={[styles.divider, isTablet && styles.dividerTablet]} />

      <TouchableOpacity
        onPress={onOpenSettings}
        style={[styles.headerBtn, isTablet && styles.headerBtnTablet]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Settings size={settingsIconSize} color={COLORS.foreground} />
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
  floatingBarTablet: {
    borderRadius: 38,
    paddingHorizontal: 22,
    paddingVertical: 13,
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
  smallBtnTablet: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginHorizontal: 6,
  },
  ctrlText: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  ctrlTextTablet: {
    fontSize: 16,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  dividerTablet: {
    height: 30,
    marginHorizontal: 16,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playBtnTablet: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
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
  playTextTablet: {
    fontSize: 15,
    marginLeft: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
