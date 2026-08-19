import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, Minus, Plus, Clock, AlertTriangle, Edit2 } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};
const NOTES_DISPLAY = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_LABELS: Record<string, string> = {
  'C#': 'C#/D♭', 'D#': 'D#/E♭', 'F#': 'F#/G♭', 'G#': 'G#/A♭', 'A#': 'A#/B♭'
};

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  capo: number;
  setCapo: (capo: number) => void;
  soundingKeySemitone: number | null;
  soundingKeyName: string | null;
  isMetronomeActive: boolean;
  setIsMetronomeActive: (active: boolean) => void;
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
  timeSignature: number;
  setTimeSignature: (ts: number) => void;
  metronomeMuted: boolean;
  setMetronomeMuted: React.Dispatch<React.SetStateAction<boolean>>;
  beatCountRef: React.MutableRefObject<number>;
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  scrollSpeed: number;
  setScrollSpeed: React.Dispatch<React.SetStateAction<number>>;
  pedalSpeed: number;
  setPedalSpeed: React.Dispatch<React.SetStateAction<number>>;
  theme: any;
  onOpenColorPicker: () => void;
  viewMode: 'all' | 'lyrics';
  setViewMode: (mode: 'all' | 'lyrics') => void;
  isDebugMode: boolean;
  setIsDebugMode: (debug: boolean) => void;
  isEditToolActive: boolean;
  setIsEditToolActive: (active: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  capo,
  setCapo,
  soundingKeySemitone,
  soundingKeyName,
  isMetronomeActive,
  setIsMetronomeActive,
  bpm,
  setBpm,
  timeSignature,
  setTimeSignature,
  metronomeMuted,
  setMetronomeMuted,
  beatCountRef,
  fontSize,
  setFontSize,
  scrollSpeed,
  setScrollSpeed,
  pedalSpeed,
  setPedalSpeed,
  theme,
  onOpenColorPicker,
  viewMode,
  setViewMode,
  isDebugMode,
  setIsDebugMode,
  isEditToolActive,
  setIsEditToolActive,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.settingsSheet}>
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Ajustes de Canción</Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color={COLORS.foreground} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Capo */}
        <Text style={styles.settingLabel}>Capodastro</Text>
        <View style={styles.capoGrid}>
          {[0, 1, 2, 3, 4, 5].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.capoBtn, capo === val && styles.capoBtnActive]}
              onPress={() => setCapo(val)}
            >
              <Text style={[styles.capoText, capo === val && styles.capoTextActive]}>
                {val === 0 ? 'Off' : val}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calculadora de Capo */}
        {soundingKeySemitone !== null ? (
          <>
            <View style={styles.capoCalcHeader}>
              <Text style={[styles.settingLabel, { marginTop: 20, marginBottom: 0, flex: 1 }]}>
                Calculadora de Capo
              </Text>
              <View style={styles.capoCalcKeyBadge}>
                <Text style={styles.capoCalcKeyBadgeText}>
                  Suena en {soundingKeyName}
                </Text>
              </View>
            </View>
            <Text style={styles.capoCalcSubtitle}>
              Tocá en la tonalidad que quieras — el capo se ajusta solo.
            </Text>
            <View style={styles.capoCalcGrid}>
              {NOTES_DISPLAY.map(note => {
                const targetSemitone = NOTE_SEMITONES[note];
                const fret = (soundingKeySemitone - targetSemitone + 12) % 12;
                const isPractical = fret >= 1 && fret <= 7;
                const isCurrent = fret === 0;
                const isActive = capo === fret && !isCurrent;
                return (
                  <TouchableOpacity
                    key={note}
                    style={[
                      styles.capoCalcBtn,
                      isCurrent && styles.capoCalcBtnCurrent,
                      isActive && styles.capoCalcBtnActive,
                      !isPractical && !isCurrent && styles.capoCalcBtnDim,
                    ]}
                    onPress={() => setCapo(fret)}
                  >
                    <Text style={[
                      styles.capoCalcNote,
                      isCurrent && { color: COLORS.accent },
                      isActive && { color: '#fff' },
                      !isPractical && !isCurrent && { color: COLORS.mutedForeground },
                    ]}>
                      {NOTE_LABELS[note] || note}
                    </Text>
                    <Text style={[
                      styles.capoCalcFret,
                      isPractical && !isCurrent && { color: '#4ade80' },
                      isCurrent && { color: COLORS.accent },
                      isActive && { color: '#fff' },
                      !isPractical && !isCurrent && { color: COLORS.mutedForeground },
                    ]}>
                      {isCurrent ? 'sin capo' : `traste ${fret}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.capoCalcWarning}>
            <AlertTriangle size={16} color="#fbbf24" style={{ marginRight: 8 }} />
            <Text style={styles.capoCalcWarningText}>
              La calculadora de capo no está disponible porque esta canción no tiene especificado su tono original (Tono:).
            </Text>
          </View>
        )}

        {/* Metrónomo */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Metrónomo</Text>
        <View style={styles.controlGroup}>
          <TouchableOpacity
            onPress={() => setIsMetronomeActive(!isMetronomeActive)}
            style={[styles.smallBtn, isMetronomeActive && { backgroundColor: COLORS.accent }]}
          >
            <Clock size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBpm(p => Math.max(40, p - 5))} style={styles.smallBtn}>
            <Minus size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBpm(p => Math.max(40, p - 1))} style={[styles.smallBtn, { width: 28 }]}>
            <Text style={{ color: '#fff', fontSize: 12 }}>-1</Text>
          </TouchableOpacity>
          <Text style={styles.ctrlText}>{bpm} BPM</Text>
          <TouchableOpacity onPress={() => setBpm(p => Math.min(250, p + 1))} style={[styles.smallBtn, { width: 28 }]}>
            <Text style={{ color: '#fff', fontSize: 12 }}>+1</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBpm(p => Math.min(250, p + 5))} style={styles.smallBtn}>
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Compás y silencio */}
        <View style={[styles.controlGroup, { marginTop: 10 }]}>
          <Text style={[styles.ctrlText, { fontSize: 13, marginRight: 8 }]}>Compás:</Text>
          {[2, 3, 4, 6].map(ts => (
            <TouchableOpacity
              key={ts}
              onPress={() => { setTimeSignature(ts); beatCountRef.current = 0; }}
              style={[styles.smallBtn, timeSignature === ts && { backgroundColor: '#f59e0b' }]}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{ts}/4</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setMetronomeMuted(m => !m)}
            style={[styles.smallBtn, { marginLeft: 8 }, metronomeMuted && { backgroundColor: '#ef4444' }]}
          >
            <Text style={{ color: '#fff', fontSize: 11 }}>{metronomeMuted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tamaño letra */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Tamaño Letra</Text>
        <View style={styles.controlGroup}>
          <TouchableOpacity onPress={() => setFontSize(p => Math.max(10, p - 2))} style={styles.smallBtn}>
            <Minus size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.ctrlText}>{fontSize}px</Text>
          <TouchableOpacity onPress={() => setFontSize(p => Math.min(40, p + 2))} style={styles.smallBtn}>
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Auto-scroll speed */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Velocidad Auto-scroll</Text>
        <View style={styles.controlGroup}>
          <TouchableOpacity onPress={() => setScrollSpeed(p => Math.max(0.1, +(p - 0.1).toFixed(1)))} style={styles.smallBtn}>
            <Minus size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.ctrlText}>{scrollSpeed}x</Text>
          <TouchableOpacity onPress={() => setScrollSpeed(p => Math.min(10, +(p + 0.1).toFixed(1)))} style={styles.smallBtn}>
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Pedal speed */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Velocidad Pedal</Text>
        <View style={styles.controlGroup}>
          <TouchableOpacity onPress={() => setPedalSpeed(p => Math.max(0.1, +(p - 0.1).toFixed(1)))} style={styles.smallBtn}>
            <Minus size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.ctrlText}>{pedalSpeed}x</Text>
          <TouchableOpacity onPress={() => setPedalSpeed(p => Math.min(10, +(p + 0.1).toFixed(1)))} style={styles.smallBtn}>
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Colores */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Colores (Globales)</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 10, alignItems: 'center' }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.background, borderWidth: 1, borderColor: COLORS.border }} />
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.lyrics, borderWidth: 1, borderColor: COLORS.border }} />
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.chords, borderWidth: 1, borderColor: COLORS.border }} />
          <TouchableOpacity
            onPress={onOpenColorPicker}
            style={{ marginLeft: 'auto', backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Personalizar</Text>
          </TouchableOpacity>
        </View>

        {/* Vista */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Vista</Text>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'all' && styles.toggleBtnActive]}
            onPress={() => setViewMode('all')}
          >
            <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>Todo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'lyrics' && styles.toggleBtnActive]}
            onPress={() => setViewMode('lyrics')}
          >
            <Text style={[styles.toggleText, viewMode === 'lyrics' && styles.toggleTextActive]}>Solo Letra</Text>
          </TouchableOpacity>
        </View>

        {/* Modo Depuración */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Modo Depuración (Alineación)</Text>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isDebugMode && styles.toggleBtnActive]}
            onPress={() => setIsDebugMode(false)}
          >
            <Text style={[styles.toggleText, !isDebugMode && styles.toggleTextActive]}>Apagado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isDebugMode && styles.toggleBtnActive]}
            onPress={() => setIsDebugMode(true)}
          >
            <Text style={[styles.toggleText, isDebugMode && styles.toggleTextActive]}>Encendido</Text>
          </TouchableOpacity>
        </View>

        {/* Herramientas Adicionales */}
        <Text style={[styles.settingLabel, { marginTop: 20 }]}>Herramientas</Text>
        <TouchableOpacity
          style={[
            { backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
            isEditToolActive && { backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 1, borderColor: COLORS.accent }
          ]}
          onPress={() => {
            setIsEditToolActive(!isEditToolActive);
            onClose();
          }}
        >
          <Edit2 size={18} color={isEditToolActive ? COLORS.accent : COLORS.foreground} />
          <Text style={{ color: isEditToolActive ? COLORS.accent : COLORS.foreground, fontWeight: 'bold', fontSize: 13 }}>
            {isEditToolActive ? 'Desactivar Editor Visual' : '✏️ Herramienta Editor Visual de Acordes'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneBtnText}>Listo</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  settingsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 90,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  settingsTitle: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: 'bold',
  },
  settingLabel: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  capoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  capoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
  },
  capoCalcKeyBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 20,
  },
  capoCalcKeyBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  capoCalcSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 4,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    marginTop: 15,
  },
  capoCalcWarningText: {
    color: '#fbbf24',
    fontSize: 12,
    flex: 1,
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
    minWidth: 40,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.surface,
  },
  toggleText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: 'bold',
  },
  toggleTextActive: {
    color: COLORS.foreground,
  },
  doneBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
