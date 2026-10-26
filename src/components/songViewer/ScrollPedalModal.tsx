import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  FastForward,
  Footprints,
  Minus,
  Plus,
  X,
} from 'lucide-react-native';
import { useResponsive } from '../../hooks/useResponsive';

// ============================================================
// COLORES
// ============================================================

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
  cardBg: '#18181b',
  cardBorder: '#27272a',
};

// ============================================================
// TIPOS
// ============================================================

interface ScrollPedalModalProps {
  visible: boolean;
  onClose: () => void;

  scrollSpeed: number;
  setScrollSpeed: React.Dispatch<React.SetStateAction<number>>;

  pedalSpeed: number;
  setPedalSpeed: React.Dispatch<React.SetStateAction<number>>;
}

// ============================================================
// HELPERS
// ============================================================

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stepSpeed(current: number, delta: number) {
  return +clamp(current + delta, 0.1, 10).toFixed(1);
}

// ============================================================
// COMPONENTE
// ============================================================

export const ScrollPedalModal: React.FC<ScrollPedalModalProps> = ({
  visible,
  onClose,
  scrollSpeed,
  setScrollSpeed,
  pedalSpeed,
  setPedalSpeed,
}) => {
  const { isTablet } = useResponsive();

  if (!visible) return null;

  const stepIconSize = isTablet ? 20 : 14;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.card, isTablet && styles.cardTablet]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FastForward size={isTablet ? 20 : 16} color={COLORS.accent} />
              <Text style={[styles.title, isTablet && styles.titleTablet]}>Scroll y Pedal</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={isTablet ? 20 : 16} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Auto-scroll */}
          <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Velocidad Auto-scroll</Text>

          <View style={styles.speedRow}>
            <TouchableOpacity
              onPress={() => setScrollSpeed(p => stepSpeed(p, -0.1))}
              style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Minus size={stepIconSize} color="#fff" />
            </TouchableOpacity>

            <View style={styles.speedDisplay}>
              <Text style={[styles.speedValue, isTablet && styles.speedValueTablet]}>{scrollSpeed.toFixed(1)}</Text>
              <Text style={[styles.speedUnit, isTablet && styles.speedUnitTablet]}>× velocidad</Text>
            </View>

            <TouchableOpacity
              onPress={() => setScrollSpeed(p => stepSpeed(p, 0.1))}
              style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Plus size={stepIconSize} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Separador */}
          <View style={[styles.divider, isTablet && styles.dividerTablet]} />

          {/* Pedal */}
          <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>
            <Footprints size={isTablet ? 14 : 11} color={COLORS.mutedForeground} />
            {'  '}Velocidad Pedal
          </Text>

          <View style={styles.speedRow}>
            <TouchableOpacity
              onPress={() => setPedalSpeed(p => stepSpeed(p, -0.1))}
              style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Minus size={stepIconSize} color="#fff" />
            </TouchableOpacity>

            <View style={styles.speedDisplay}>
              <Text style={[styles.speedValue, isTablet && styles.speedValueTablet]}>{pedalSpeed.toFixed(1)}</Text>
              <Text style={[styles.speedUnit, isTablet && styles.speedUnitTablet]}>× velocidad</Text>
            </View>

            <TouchableOpacity
              onPress={() => setPedalSpeed(p => stepSpeed(p, 0.1))}
              style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Plus size={stepIconSize} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  card: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },

  cardTablet: {
    maxWidth: 440,
    padding: 24,
    borderRadius: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  title: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: 'bold',
  },

  titleTablet: {
    fontSize: 18,
  },

  closeBtn: {
    padding: 4,
  },

  sectionLabel: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  sectionLabelTablet: {
    fontSize: 13,
    marginBottom: 14,
  },

  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  speedDisplay: {
    flex: 1,
    alignItems: 'center',
  },

  speedValue: {
    color: COLORS.foreground,
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 32,
  },

  speedValueTablet: {
    fontSize: 36,
    lineHeight: 40,
  },

  speedUnit: {
    color: COLORS.mutedForeground,
    fontSize: 11,
  },

  speedUnitTablet: {
    fontSize: 13,
  },

  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  stepBtnTablet: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 14,
  },

  dividerTablet: {
    marginVertical: 18,
  },
});
