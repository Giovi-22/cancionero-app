import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  Activity,
  Clock,
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

interface MetronomeModalProps {
  visible: boolean;
  onClose: () => void;

  isMetronomeActive: boolean;
  setIsMetronomeActive: (active: boolean) => void;

  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;

  timeSignature: number;
  setTimeSignature: (ts: number) => void;

  metronomeMuted: boolean;
  setMetronomeMuted: React.Dispatch<React.SetStateAction<boolean>>;
}

// ============================================================
// COMPONENTE
// ============================================================

export const MetronomeModal: React.FC<MetronomeModalProps> = ({
  visible,
  onClose,
  isMetronomeActive,
  setIsMetronomeActive,
  bpm,
  setBpm,
  timeSignature,
  setTimeSignature,
  metronomeMuted,
  setMetronomeMuted,
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
              <Activity
                size={isTablet ? 20 : 16}
                color={COLORS.accent}
              />

              <Text style={[styles.title, isTablet && styles.titleTablet]}>
                Metrónomo
              </Text>
            </View>

            <View style={styles.headerRight}>
              {/* Toggle on/off */}
              <TouchableOpacity
                onPress={() =>
                  setIsMetronomeActive(!isMetronomeActive)
                }
                style={[
                  styles.toggleBtn,
                  isTablet && styles.toggleBtnTablet,
                  isMetronomeActive && styles.toggleBtnOn,
                ]}
              >
                <Clock
                  size={isTablet ? 16 : 14}
                  color={isMetronomeActive ? '#fff' : COLORS.mutedForeground}
                />

                <Text
                  style={[
                    styles.toggleText,
                    isTablet && styles.toggleTextTablet,
                    isMetronomeActive && styles.toggleTextOn,
                  ]}
                >
                  {isMetronomeActive ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={isTablet ? 20 : 16} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* BPM */}
          <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Tempo</Text>

          <View style={[styles.bpmRow, isTablet && styles.bpmRowTablet]}>
            <TouchableOpacity
              onPress={() => setBpm(p => Math.max(40, p - 5))}
              style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Minus size={stepIconSize} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBpm(p => Math.max(40, p - 1))}
              style={[
                styles.stepBtn,
                styles.stepBtnSmall,
                isTablet && styles.stepBtnSmallTablet,
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.stepBtnSmallText, isTablet && styles.stepBtnSmallTextTablet]}>-1</Text>
            </TouchableOpacity>

            <View style={[styles.bpmDisplay, isTablet && styles.bpmDisplayTablet]}>
              <Text style={[styles.bpmValue, isTablet && styles.bpmValueTablet]}>{bpm}</Text>
              <Text style={[styles.bpmUnit, isTablet && styles.bpmUnitTablet]}>BPM</Text>
            </View>

            <TouchableOpacity
              onPress={() => setBpm(p => Math.min(250, p + 1))}
              style={[
                styles.stepBtn,
                styles.stepBtnSmall,
                isTablet && styles.stepBtnSmallTablet,
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.stepBtnSmallText, isTablet && styles.stepBtnSmallTextTablet]}>+1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBpm(p => Math.min(250, p + 5))}
              style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Plus size={stepIconSize} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Compás + Silencio */}
          <View style={[styles.bottomRow, isTablet && styles.bottomRowTablet]}>
            <View style={styles.timeSignatureGroup}>
              <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Compás</Text>

              <View style={styles.tsRow}>
                {[2, 3, 4, 6].map(ts => (
                  <TouchableOpacity
                    key={ts}
                    onPress={() => setTimeSignature(ts)}
                    style={[
                      styles.tsBtn,
                      isTablet && styles.tsBtnTablet,
                      timeSignature === ts && styles.tsBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tsBtnText,
                        isTablet && styles.tsBtnTextTablet,
                        timeSignature === ts && styles.tsBtnTextActive,
                      ]}
                    >
                      {ts}/4
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.muteGroup}>
              <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Audio</Text>

              <TouchableOpacity
                onPress={() => setMetronomeMuted(m => !m)}
                style={[
                  styles.muteBtn,
                  isTablet && styles.muteBtnTablet,
                  metronomeMuted && styles.muteBtnActive,
                ]}
              >
                <Text style={[styles.muteBtnText, isTablet && styles.muteBtnTextTablet]}>
                  {metronomeMuted ? '🔇 Mudo' : '🔊 Activo'}
                </Text>
              </TouchableOpacity>
            </View>
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
    maxWidth: 340,
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

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  title: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: 'bold',
  },

  titleTablet: {
    fontSize: 18,
  },

  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  toggleBtnTablet: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 6,
  },

  toggleBtnOn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  toggleText: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    fontWeight: 'bold',
  },

  toggleTextTablet: {
    fontSize: 13,
  },

  toggleTextOn: {
    color: '#fff',
  },

  closeBtn: {
    padding: 4,
  },

  sectionLabel: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  sectionLabelTablet: {
    fontSize: 13,
    marginBottom: 12,
  },

  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },

  bpmRowTablet: {
    gap: 10,
    marginBottom: 24,
  },

  bpmDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },

  bpmDisplayTablet: {
    minWidth: 110,
  },

  bpmValue: {
    color: COLORS.foreground,
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 36,
  },

  bpmValueTablet: {
    fontSize: 44,
    lineHeight: 48,
  },

  bpmUnit: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    fontWeight: 'bold',
  },

  bpmUnitTablet: {
    fontSize: 13,
  },

  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  stepBtnTablet: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  stepBtnSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  stepBtnSmallTablet: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  stepBtnSmallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  stepBtnSmallTextTablet: {
    fontSize: 13,
  },

  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },

  bottomRowTablet: {
    gap: 16,
    paddingTop: 18,
  },

  timeSignatureGroup: {
    flex: 1,
  },

  tsRow: {
    flexDirection: 'row',
    gap: 6,
  },

  tsBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#27272a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },

  tsBtnTablet: {
    paddingVertical: 12,
    borderRadius: 10,
  },

  tsBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },

  tsBtnText: {
    color: COLORS.foreground,
    fontSize: 12,
    fontWeight: 'bold',
  },

  tsBtnTextTablet: {
    fontSize: 14,
  },

  tsBtnTextActive: {
    color: '#fff',
  },

  muteGroup: {
    alignItems: 'flex-start',
  },

  muteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },

  muteBtnTablet: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },

  muteBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },

  muteBtnText: {
    color: COLORS.foreground,
    fontSize: 12,
    fontWeight: 'bold',
  },

  muteBtnTextTablet: {
    fontSize: 14,
  },
});
