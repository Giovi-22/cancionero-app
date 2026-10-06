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
  if (!visible) return null;

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
          style={styles.card}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Activity
                size={16}
                color={COLORS.accent}
              />

              <Text style={styles.title}>
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
                  isMetronomeActive && styles.toggleBtnOn,
                ]}
              >
                <Clock
                  size={14}
                  color={isMetronomeActive ? '#fff' : COLORS.mutedForeground}
                />

                <Text
                  style={[
                    styles.toggleText,
                    isMetronomeActive && styles.toggleTextOn,
                  ]}
                >
                  {isMetronomeActive ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
              >
                <X size={16} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* BPM */}
          <Text style={styles.sectionLabel}>Tempo</Text>

          <View style={styles.bpmRow}>
            <TouchableOpacity
              onPress={() => setBpm(p => Math.max(40, p - 5))}
              style={styles.stepBtn}
            >
              <Minus size={14} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBpm(p => Math.max(40, p - 1))}
              style={[styles.stepBtn, styles.stepBtnSmall]}
            >
              <Text style={styles.stepBtnSmallText}>-1</Text>
            </TouchableOpacity>

            <View style={styles.bpmDisplay}>
              <Text style={styles.bpmValue}>{bpm}</Text>
              <Text style={styles.bpmUnit}>BPM</Text>
            </View>

            <TouchableOpacity
              onPress={() => setBpm(p => Math.min(250, p + 1))}
              style={[styles.stepBtn, styles.stepBtnSmall]}
            >
              <Text style={styles.stepBtnSmallText}>+1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBpm(p => Math.min(250, p + 5))}
              style={styles.stepBtn}
            >
              <Plus size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Compás + Silencio */}
          <View style={styles.bottomRow}>
            <View style={styles.timeSignatureGroup}>
              <Text style={styles.sectionLabel}>Compás</Text>

              <View style={styles.tsRow}>
                {[2, 3, 4, 6].map(ts => (
                  <TouchableOpacity
                    key={ts}
                    onPress={() => setTimeSignature(ts)}
                    style={[
                      styles.tsBtn,
                      timeSignature === ts && styles.tsBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tsBtnText,
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
              <Text style={styles.sectionLabel}>Audio</Text>

              <TouchableOpacity
                onPress={() => setMetronomeMuted(m => !m)}
                style={[
                  styles.muteBtn,
                  metronomeMuted && styles.muteBtnActive,
                ]}
              >
                <Text style={styles.muteBtnText}>
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

  toggleBtnOn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  toggleText: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    fontWeight: 'bold',
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

  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },

  bpmDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },

  bpmValue: {
    color: COLORS.foreground,
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 36,
  },

  bpmUnit: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    fontWeight: 'bold',
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

  stepBtnSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  stepBtnSmallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
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

  tsBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },

  tsBtnText: {
    color: COLORS.foreground,
    fontSize: 12,
    fontWeight: 'bold',
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

  muteBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },

  muteBtnText: {
    color: COLORS.foreground,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
