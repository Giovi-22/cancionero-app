import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import {
  Music,
  Hash,
  FastForward,
  Activity,
  ChevronDown,
  X,
  RotateCcw,
  Plus,
  Minus,
  AlertTriangle,
} from 'lucide-react-native';
import { MetronomeModal } from './MetronomeModal';
import { ScrollPedalModal } from './ScrollPedalModal';

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

// Notas para la calculadora de capo. El índice del array es el semitono (C = 0 ... B = 11).
const CAPO_NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const CAPO_NOTE_LABELS: Record<string, string> = {
  'C#': 'C#/D♭',
  'D#': 'D#/E♭',
  'F#': 'F#/G♭',
  'G#': 'G#/A♭',
  'A#': 'A#/B♭',
};

// Trastes que se ofrecen en la selección manual (0 = sin capo)
const CAPO_FRETS = [0, 1, 2, 3, 4, 5];

function getBaseNoteIndex(noteStr: string | null): number {
  if (!noteStr) return -1;

  const clean = noteStr.replace(/m$/i, '').trim();

  const equivalents: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };

  return equivalents[clean] !== undefined
    ? equivalents[clean]
    : -1;
}

function calculateSemitoneOffset(
  originalNote: string,
  targetNoteIndex: number
): number {
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
  onCapoChange?: (newCapo: number) => void;

  /**
   * Semitono (0-11) de la tonalidad en la que suena la canción
   * (tono original + transposición). null si la canción no tiene "Tono:".
   * Lo usa la calculadora de capo.
   */
  soundingKeySemitone: number | null;
  soundingKeyName: string | null;

  isScrolling: boolean;
  onToggleScroll?: () => void;
  scrollSpeed: number;
  setScrollSpeed: React.Dispatch<React.SetStateAction<number>>;

  pedalSpeed: number;
  setPedalSpeed: React.Dispatch<React.SetStateAction<number>>;

  isMetronomeActive: boolean;
  setIsMetronomeActive: (active: boolean) => void;

  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;

  timeSignature: number;
  setTimeSignature: (ts: number) => void;

  metronomeMuted: boolean;
  setMetronomeMuted: React.Dispatch<React.SetStateAction<boolean>>;

  /**
   * Beat actual del metrónomo.
   *
   * 0 = primer tiempo
   * 1 = segundo tiempo
   * 2 = tercer tiempo
   * 3 = cuarto tiempo
   */
  beat: number;
}

export const SongViewerInfoBar: React.FC<
  SongViewerInfoBarProps
> = ({
  originalTone,
  transposedTone,
  transpose,
  onTransposeChange,
  capo,
  onCapoChange,
  soundingKeySemitone,
  soundingKeyName,
  isScrolling,
  onToggleScroll,
  scrollSpeed,
  setScrollSpeed,
  pedalSpeed,
  setPedalSpeed,
  isMetronomeActive,
  setIsMetronomeActive,
  bpm,
  setBpm,
  timeSignature,
  setTimeSignature,
  metronomeMuted,
  setMetronomeMuted,
  beat,
}) => {
    const [isPickerOpen, setIsPickerOpen] =
      useState(false);

    const [isCapoPickerOpen, setIsCapoPickerOpen] =
      useState(false);

    const [isMetronomeModalOpen, setIsMetronomeModalOpen] =
      useState(false);

    const [isScrollModalOpen, setIsScrollModalOpen] =
      useState(false);

    const selectCapo = (fret: number) => {
      onCapoChange?.(fret);
      setIsCapoPickerOpen(false);
    };

    const isDownbeat =
      isMetronomeActive && beat === 0;

    return (
      <>
        <View style={styles.infoBar}>
          {/* Tono */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              onTransposeChange &&
              setIsPickerOpen(true)
            }
            style={[
              styles.infoBadge,
              !originalTone &&
              transpose === 0 &&
              styles.infoBadgeInactive,
              transpose !== 0 && {
                borderColor: COLORS.accent,
                borderWidth: 1,
                backgroundColor:
                  'rgba(59, 130, 246, 0.12)',
              },
            ]}
          >
            <Music
              size={12}
              color={
                transpose !== 0
                  ? COLORS.accent
                  : originalTone
                    ? COLORS.foreground
                    : COLORS.mutedForeground
              }
            />

            <Text
              style={[
                styles.infoBadgeText,
                !originalTone &&
                transpose === 0 &&
                styles.infoBadgeTextInactive,
                transpose !== 0 && {
                  color: COLORS.accent,
                },
              ]}
            >
              {originalTone
                ? transposedTone &&
                  transposedTone !== originalTone
                  ? `${originalTone} → ${transposedTone}`
                  : originalTone
                : transpose !== 0
                  ? `Tono (${transpose > 0
                    ? `+${transpose}`
                    : transpose
                  })`
                  : 'Tono'}
            </Text>

            {onTransposeChange && (
              <ChevronDown
                size={10}
                color={
                  transpose !== 0
                    ? COLORS.accent
                    : originalTone
                      ? COLORS.foreground
                      : COLORS.mutedForeground
                }
                style={{ marginLeft: 1 }}
              />
            )}
          </TouchableOpacity>

          {/* Capo */}
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!onCapoChange}
            onPress={() =>
              onCapoChange &&
              setIsCapoPickerOpen(true)
            }
            style={[
              styles.infoBadge,
              capo === 0 &&
              styles.infoBadgeInactive,
            ]}
          >
            <Hash
              size={12}
              color={
                capo > 0
                  ? COLORS.foreground
                  : COLORS.mutedForeground
              }
            />

            <Text
              style={[
                styles.infoBadgeText,
                capo === 0 &&
                styles.infoBadgeTextInactive,
              ]}
            >
              {capo > 0
                ? `Capo ${capo}`
                : 'Capo'}
            </Text>

            {onCapoChange && (
              <ChevronDown
                size={10}
                color={
                  capo > 0
                    ? COLORS.foreground
                    : COLORS.mutedForeground
                }
                style={{ marginLeft: 1 }}
              />
            )}
          </TouchableOpacity>

          {/* Scroll — tap corto: abrir modal de velocidad | tap largo: toggle auto-scroll */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsScrollModalOpen(true)}
            onLongPress={onToggleScroll}
            delayLongPress={400}
            style={[
              styles.infoBadge,
              !isScrolling &&
              styles.infoBadgeInactive,
            ]}
          >
            <FastForward
              size={12}
              color={
                isScrolling
                  ? COLORS.foreground
                  : COLORS.mutedForeground
              }
            />

            <Text
              style={[
                styles.infoBadgeText,
                !isScrolling &&
                styles.infoBadgeTextInactive,
              ]}
            >
              {isScrolling
                ? `${scrollSpeed.toFixed(1)}x`
                : 'Scroll'}
            </Text>

            <ChevronDown
              size={10}
              color={
                isScrolling
                  ? COLORS.foreground
                  : COLORS.mutedForeground
              }
              style={{ marginLeft: 1 }}
            />
          </TouchableOpacity>

          {/* Metrónomo — tap corto: abrir modal | tap largo: toggle on/off */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              setIsMetronomeModalOpen(true)
            }
            onLongPress={() =>
              setIsMetronomeActive(!isMetronomeActive)
            }
            delayLongPress={400}
            style={[
              styles.infoBadge,
              !isMetronomeActive &&
              styles.infoBadgeInactive,
              isDownbeat && {
                borderColor: '#f59e0b',
                borderWidth: 1,
                backgroundColor:
                  'rgba(245,158,11,0.1)',
              },
            ]}
          >
            <Activity
              size={12}
              color={
                !isMetronomeActive
                  ? COLORS.mutedForeground
                  : isDownbeat
                    ? '#f59e0b'
                    : COLORS.accent
              }
            />

            <Text
              style={[
                styles.infoBadgeText,
                !isMetronomeActive &&
                styles.infoBadgeTextInactive,
              ]}
            >
              {isMetronomeActive
                ? `${bpm} BPM`
                : 'BPM'}
            </Text>

            <ChevronDown
              size={10}
              color={
                !isMetronomeActive
                  ? COLORS.mutedForeground
                  : isDownbeat
                    ? '#f59e0b'
                    : COLORS.accent
              }
              style={{ marginLeft: 1 }}
            />
          </TouchableOpacity>
        </View>

        {/* Modal Desplegable de Selección de Tono */}
        {onTransposeChange && (
          <Modal
            visible={isPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() =>
              setIsPickerOpen(false)
            }
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() =>
                setIsPickerOpen(false)
              }
            >
              <TouchableOpacity
                activeOpacity={1}
                style={styles.modalContent}
              >
                <View
                  style={styles.modalHeader}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Music
                      size={16}
                      color={COLORS.accent}
                    />

                    <Text
                      style={styles.modalTitle}
                    >
                      Tonalidad de la canción
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {transpose !== 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          onTransposeChange(0);
                          setIsPickerOpen(false);
                        }}
                        style={
                          styles.resetButton
                        }
                      >
                        <RotateCcw
                          size={12}
                          color={
                            COLORS.accent
                          }
                        />

                        <Text
                          style={
                            styles.resetText
                          }
                        >
                          Original
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() =>
                        setIsPickerOpen(false)
                      }
                      style={
                        styles.closeButton
                      }
                    >
                      <X
                        size={16}
                        color={
                          COLORS.mutedForeground
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  {originalTone
                    ? `Original: ${originalTone}${transposedTone &&
                      transposedTone !==
                      originalTone
                      ? `  →  Transp: ${transposedTone}`
                      : ''
                    }`
                    : 'Selecciona la tonalidad deseada:'}
                </Text>

                <View
                  style={styles.keysGrid}
                >
                  {CHROMATIC_SCALE.map(
                    (item, index) => {
                      const isMinor =
                        originalTone
                          ? originalTone
                            .toLowerCase()
                            .endsWith('m')
                          : false;

                      const noteLabel =
                        `${item.name}${isMinor ? 'm' : ''
                        }`;

                      const isSelected =
                        originalTone
                          ? transposedTone?.toLowerCase() ===
                          noteLabel.toLowerCase()
                          : transpose ===
                          calculateSemitoneOffset(
                            'C',
                            index
                          );

                      const offset =
                        originalTone
                          ? calculateSemitoneOffset(
                            originalTone,
                            index
                          )
                          : 0;

                      const offsetLabel =
                        offset === 0
                          ? 'Orig.'
                          : offset > 0
                            ? `+${offset}`
                            : `${offset}`;

                      return (
                        <TouchableOpacity
                          key={item.name}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (
                              originalTone
                            ) {
                              const newSemitones =
                                calculateSemitoneOffset(
                                  originalTone,
                                  index
                                );

                              onTransposeChange(
                                newSemitones
                              );
                            } else {
                              onTransposeChange(
                                index - 6
                              );
                            }

                            setIsPickerOpen(
                              false
                            );
                          }}
                          style={[
                            styles.keyCard,
                            isSelected &&
                            styles.keyCardSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.keyText,
                              isSelected &&
                              styles.keyTextSelected,
                            ]}
                          >
                            {noteLabel}
                          </Text>

                          {originalTone && (
                            <Text
                              style={[
                                styles.offsetText,
                                isSelected &&
                                styles.offsetTextSelected,
                              ]}
                            >
                              {offsetLabel}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                <View
                  style={styles.stepperRow}
                >
                  <Text
                    style={
                      styles.stepperLabel
                    }
                  >
                    Ajuste por semitonos:
                  </Text>

                  <View
                    style={
                      styles.stepperControls
                    }
                  >
                    <TouchableOpacity
                      onPress={() =>
                        onTransposeChange(
                          transpose - 1
                        )
                      }
                      style={
                        styles.stepperBtn
                      }
                    >
                      <Minus
                        size={14}
                        color={
                          COLORS.foreground
                        }
                      />
                    </TouchableOpacity>

                    <Text
                      style={
                        styles.stepperValue
                      }
                    >
                      {transpose > 0
                        ? `+${transpose}`
                        : `${transpose}`}{' '}
                      st
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        onTransposeChange(
                          transpose + 1
                        )
                      }
                      style={
                        styles.stepperBtn
                      }
                    >
                      <Plus
                        size={14}
                        color={
                          COLORS.foreground
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Modal de Capodastro + Calculadora */}
        {onCapoChange && (
          <Modal
            visible={isCapoPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() =>
              setIsCapoPickerOpen(false)
            }
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() =>
                setIsCapoPickerOpen(false)
              }
            >
              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.modalContent,
                  styles.capoModalContent,
                ]}
              >
                <View style={styles.modalHeader}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Hash
                      size={16}
                      color={COLORS.accent}
                    />

                    <Text style={styles.modalTitle}>
                      Capodastro
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {capo !== 0 && (
                      <TouchableOpacity
                        onPress={() => selectCapo(0)}
                        style={styles.resetButton}
                      >
                        <RotateCcw
                          size={12}
                          color={COLORS.accent}
                        />

                        <Text style={styles.resetText}>
                          Quitar
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() =>
                        setIsCapoPickerOpen(false)
                      }
                      style={styles.closeButton}
                    >
                      <X
                        size={16}
                        color={COLORS.mutedForeground}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalSubtitle}>
                    Elegí el traste donde va el capo:
                  </Text>

                  <View style={styles.capoGrid}>
                    {CAPO_FRETS.map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.capoBtn,
                          capo === val &&
                          styles.capoBtnActive,
                        ]}
                        onPress={() => selectCapo(val)}
                      >
                        <Text
                          style={[
                            styles.capoText,
                            capo === val &&
                            styles.capoTextActive,
                          ]}
                        >
                          {val === 0 ? 'Off' : val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Calculadora de Capo */}
                  {soundingKeySemitone !== null ? (
                    <>
                      <View style={styles.capoCalcHeader}>
                        <Text style={styles.capoCalcTitle}>
                          Calculadora de capo
                        </Text>

                        <View style={styles.capoCalcKeyBadge}>
                          <Text
                            style={
                              styles.capoCalcKeyBadgeText
                            }
                          >
                            Suena en {soundingKeyName}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.capoCalcSubtitle}>
                        Tocá en la tonalidad que quieras —
                        el capo se ajusta solo.
                      </Text>

                      <View style={styles.capoCalcGrid}>
                        {CAPO_NOTES.map(
                          (note, targetSemitone) => {
                            const fret =
                              (soundingKeySemitone -
                                targetSemitone +
                                12) %
                              12;

                            const isPractical =
                              fret >= 1 && fret <= 7;

                            const isCurrent =
                              fret === 0;

                            const isActive =
                              capo === fret &&
                              !isCurrent;

                            return (
                              <TouchableOpacity
                                key={note}
                                style={[
                                  styles.capoCalcBtn,
                                  isCurrent &&
                                  styles.capoCalcBtnCurrent,
                                  isActive &&
                                  styles.capoCalcBtnActive,
                                  !isPractical &&
                                  !isCurrent &&
                                  styles.capoCalcBtnDim,
                                ]}
                                onPress={() =>
                                  selectCapo(fret)
                                }
                              >
                                <Text
                                  style={[
                                    styles.capoCalcNote,
                                    isCurrent && {
                                      color: COLORS.accent,
                                    },
                                    isActive && {
                                      color: '#fff',
                                    },
                                    !isPractical &&
                                    !isCurrent && {
                                      color:
                                        COLORS.mutedForeground,
                                    },
                                  ]}
                                >
                                  {CAPO_NOTE_LABELS[note] ||
                                    note}
                                </Text>

                                <Text
                                  style={[
                                    styles.capoCalcFret,
                                    isPractical &&
                                    !isCurrent && {
                                      color: '#4ade80',
                                    },
                                    isCurrent && {
                                      color: COLORS.accent,
                                    },
                                    isActive && {
                                      color: '#fff',
                                    },
                                    !isPractical &&
                                    !isCurrent && {
                                      color:
                                        COLORS.mutedForeground,
                                    },
                                  ]}
                                >
                                  {isCurrent
                                    ? 'sin capo'
                                    : `traste ${fret}`}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                        )}
                      </View>
                    </>
                  ) : (
                    <View style={styles.capoCalcWarning}>
                      <AlertTriangle
                        size={16}
                        color="#fbbf24"
                        style={{ marginRight: 8 }}
                      />

                      <Text
                        style={styles.capoCalcWarningText}
                      >
                        La calculadora de capo no está
                        disponible porque esta canción no
                        tiene especificado su tono original
                        (Tono:).
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Modal metrónomo */}
        <MetronomeModal
          visible={isMetronomeModalOpen}
          onClose={() => setIsMetronomeModalOpen(false)}
          isMetronomeActive={isMetronomeActive}
          setIsMetronomeActive={setIsMetronomeActive}
          bpm={bpm}
          setBpm={setBpm}
          timeSignature={timeSignature}
          setTimeSignature={setTimeSignature}
          metronomeMuted={metronomeMuted}
          setMetronomeMuted={setMetronomeMuted}
        />

        {/* Modal scroll + pedal */}
        <ScrollPedalModal
          visible={isScrollModalOpen}
          onClose={() => setIsScrollModalOpen(false)}
          scrollSpeed={scrollSpeed}
          setScrollSpeed={setScrollSpeed}
          pedalSpeed={pedalSpeed}
          setPedalSpeed={setPedalSpeed}
        />
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
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
    backgroundColor:
      'rgba(59, 130, 246, 0.15)',
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
    backgroundColor:
      'rgba(59, 130, 246, 0.25)',
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

  capoModalContent: {
    maxHeight: '90%',
  },

  capoGrid: {
    flexDirection: 'row',
    gap: 8,
  },

  capoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#27272a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },

  capoBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  capoText: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 13,
  },

  capoTextActive: {
    color: '#fff',
  },

  capoCalcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },

  capoCalcTitle: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: 'bold',
  },

  capoCalcKeyBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  capoCalcKeyBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },

  capoCalcSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
  },

  capoCalcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  capoCalcBtn: {
    width: '23%',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#27272a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },

  capoCalcBtnCurrent: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },

  capoCalcBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  capoCalcBtnDim: {
    opacity: 0.4,
  },

  capoCalcNote: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 13,
  },

  capoCalcFret: {
    fontSize: 10,
    marginTop: 2,
  },

  capoCalcWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
  },

  capoCalcWarningText: {
    color: '#fbbf24',
    fontSize: 12,
    flex: 1,
  },
});