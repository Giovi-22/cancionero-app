import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Music, Hash, FastForward, Activity, ChevronDown, X, RotateCcw, Plus, Minus } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
  cardBg: '#18181b',
  cardBorder: '#27272a'
};

const CHROMATIC_SCALE = [
  { name: 'C' },
  { name: 'C#' },
  { name: 'D' },
  { name: 'Eb' },
  { name: 'E' },
  { name: 'F' },
  { name: 'F#' },
  { name: 'G' },
  { name: 'Ab' },
  { name: 'A' },
  { name: 'Bb' },
  { name: 'B' },
];

function getBaseNoteIndex(noteStr: string | null): number {
  if (!noteStr) return -1;
  const clean = noteStr.replace(/m$/i, '').trim();
  const equivalents: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };
  return equivalents[clean] !== undefined ? equivalents[clean] : -1;
}

function calculateSemitoneOffset(originalNote: string, targetNoteIndex: number): number {
  const origIdx = getBaseNoteIndex(originalNote);
  if (origIdx === -1) return 0;
  let diff = targetNoteIndex - origIdx;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

interface SongViewerInfoBarProps {
  originalTone: string | null;
  transposedTone: string | null;
  transpose: number;
  onTransposeChange?: (newTranspose: number) => void;
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
  onTransposeChange,
  capo,
  isScrolling,
  scrollSpeed,
  isMetronomeActive,
  setIsMetronomeActive,
  beat,
  beatCount,
  bpm,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <>
      <View style={styles.infoBar}>
        {/* Tono */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onTransposeChange && setIsPickerOpen(true)}
          style={[
            styles.infoBadge,
            (!originalTone && transpose === 0) && styles.infoBadgeInactive,
            transpose !== 0 && { borderColor: COLORS.accent, borderWidth: 1, backgroundColor: 'rgba(59, 130, 246, 0.12)' }
          ]}
        >
          <Music size={12} color={transpose !== 0 ? COLORS.accent : (originalTone ? COLORS.foreground : COLORS.mutedForeground)} />
          <Text style={[
            styles.infoBadgeText,
            (!originalTone && transpose === 0) && styles.infoBadgeTextInactive,
            transpose !== 0 && { color: COLORS.accent }
          ]}>
            {originalTone
              ? (transposedTone && transposedTone !== originalTone ? `${originalTone} → ${transposedTone}` : originalTone)
              : (transpose !== 0 ? `Tono (${transpose > 0 ? `+${transpose}` : transpose})` : 'Tono')}
          </Text>
          {onTransposeChange && (
            <ChevronDown size={10} color={transpose !== 0 ? COLORS.accent : (originalTone ? COLORS.foreground : COLORS.mutedForeground)} style={{ marginLeft: 1 }} />
          )}
        </TouchableOpacity>

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

      {/* Modal Desplegable de Selección de Tono */}
      {onTransposeChange && (
        <Modal
          visible={isPickerOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsPickerOpen(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setIsPickerOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              {/* Header del Modal */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Music size={16} color={COLORS.accent} />
                  <Text style={styles.modalTitle}>Tonalidad de la canción</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {transpose !== 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        onTransposeChange(0);
                        setIsPickerOpen(false);
                      }}
                      style={styles.resetButton}
                    >
                      <RotateCcw size={12} color={COLORS.accent} />
                      <Text style={styles.resetText}>Original</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setIsPickerOpen(false)} style={styles.closeButton}>
                    <X size={16} color={COLORS.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Subtítulo informativo */}
              <Text style={styles.modalSubtitle}>
                {originalTone 
                  ? `Original: ${originalTone}${transposedTone && transposedTone !== originalTone ? `  →  Transp: ${transposedTone}` : ''}`
                  : 'Selecciona la tonalidad deseada:'}
              </Text>

              {/* Grilla de Tonalidades (12 Tonalidades) */}
              <View style={styles.keysGrid}>
                {CHROMATIC_SCALE.map((item, index) => {
                  const isMinor = originalTone ? originalTone.toLowerCase().endsWith('m') : false;
                  const noteLabel = `${item.name}${isMinor ? 'm' : ''}`;
                  
                  const isSelected = originalTone 
                    ? (transposedTone?.toLowerCase() === noteLabel.toLowerCase())
                    : (transpose === calculateSemitoneOffset('C', index));

                  const offset = originalTone ? calculateSemitoneOffset(originalTone, index) : 0;
                  const offsetLabel = offset === 0 ? 'Orig.' : (offset > 0 ? `+${offset}` : `${offset}`);

                  return (
                    <TouchableOpacity
                      key={item.name}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (originalTone) {
                          const newSemitones = calculateSemitoneOffset(originalTone, index);
                          onTransposeChange(newSemitones);
                        } else {
                          onTransposeChange(index - 6);
                        }
                        setIsPickerOpen(false);
                      }}
                      style={[
                        styles.keyCard,
                        isSelected && styles.keyCardSelected
                      ]}
                    >
                      <Text style={[styles.keyText, isSelected && styles.keyTextSelected]}>
                        {noteLabel}
                      </Text>
                      {originalTone && (
                        <Text style={[styles.offsetText, isSelected && styles.offsetTextSelected]}>
                          {offsetLabel}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Ajuste Fino (+ / - Semitonos) */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Ajuste por semitonos:</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity 
                    onPress={() => onTransposeChange(transpose - 1)}
                    style={styles.stepperBtn}
                  >
                    <Minus size={14} color={COLORS.foreground} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>
                    {transpose > 0 ? `+${transpose}` : `${transpose}`} st
                  </Text>
                  <TouchableOpacity 
                    onPress={() => onTransposeChange(transpose + 1)}
                    style={styles.stepperBtn}
                  >
                    <Plus size={14} color={COLORS.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
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

  // Estilos del Modal de Tonalidad
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginBottom: 14,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  resetText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  keysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keyCard: {
    width: '31%',
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  keyCardSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
  keyText: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: 'bold',
  },
  keyTextSelected: {
    color: '#60a5fa',
  },
  offsetText: {
    color: COLORS.mutedForeground,
    fontSize: 10,
    marginTop: 2,
  },
  offsetTextSelected: {
    color: '#93c5fd',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  stepperLabel: {
    color: COLORS.mutedForeground,
    fontSize: 12,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  stepperValue: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: 'bold',
    minWidth: 45,
    textAlign: 'center',
  },
});
