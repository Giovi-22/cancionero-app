import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface ColorPickerModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  setTheme: React.Dispatch<React.SetStateAction<any>>;
  onSaveGlobalTheme?: (theme: any) => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  onClose,
  theme,
  setTheme,
  onSaveGlobalTheme,
}) => {
  const [pickerTab, setPickerTab] = useState<'background' | 'lyrics' | 'chords'>('background');
  const [hexInput, setHexInput] = useState(theme[pickerTab]);

  useEffect(() => {
    setHexInput(theme[pickerTab]);
  }, [pickerTab, theme]);

  const SWATCH_SETS: Record<string, string[]> = {
    background: [
      '#0a0a0a','#111827','#1e1e1e','#0d1117',
      '#1a0a2e','#0d1b2a','#0f2027','#1c1c2e',
      '#fdf6e3','#fffff8','#f8f9fa','#ffffff',
      '#f0e6d3','#e8f4f8','#f0f4ff','#fff9e6',
    ],
    lyrics: [
      '#ffffff','#f8f8f8','#e5e7eb','#d1d5db',
      '#9ca3af','#6b7280','#4b5563','#374151',
      '#1f2937','#111827','#657b83','#93a1a1',
      '#ffd700','#ffa500','#98fb98','#87ceeb',
    ],
    chords: [
      '#3b82f6','#2563eb','#1d4ed8','#60a5fa',
      '#ef4444','#dc2626','#f87171','#fca5a5',
      '#10b981','#059669','#34d399','#6ee7b7',
      '#f59e0b','#d97706','#fbbf24','#fde68a',
      '#8b5cf6','#7c3aed','#a78bfa','#c4b5fd',
      '#ec4899','#db2777','#f472b6','#fbcfe8',
      '#06b6d4','#0891b2','#22d3ee','#67e8f9',
      '#f97316','#ea580c','#fb923c','#fed7aa',
    ],
  };

  const swatches = SWATCH_SETS[pickerTab] || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.colorPickerBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.colorPickerContainer} onPress={(e) => e.stopPropagation()}>
          {/* Titulo + Reset */}
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 }}>
            <Text style={[styles.colorPickerTitle, { flex: 1, marginBottom: 0 }]}>Colores del Visor</Text>
            <TouchableOpacity
              onPress={() => {
                const def = { background: COLORS.background, lyrics: COLORS.foreground, chords: COLORS.accent };
                setTheme(def);
                onSaveGlobalTheme?.(def);
              }}
              style={{ backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Restablecer</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs: Fondo / Letra / Acordes */}
          <View style={{ flexDirection: 'row', width: '100%', marginBottom: 20, backgroundColor: COLORS.background, borderRadius: 12, padding: 3 }}>
            {(['background', 'lyrics', 'chords'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setPickerTab(tab)}
                style={[
                  { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
                  pickerTab === tab && { backgroundColor: COLORS.surface }
                ]}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme[tab], borderWidth: 1, borderColor: COLORS.border }} />
                <Text style={{ color: pickerTab === tab ? COLORS.foreground : COLORS.mutedForeground, fontSize: 13, fontWeight: pickerTab === tab ? 'bold' : 'normal' }}>
                  {tab === 'background' ? 'Fondo' : tab === 'lyrics' ? 'Letra' : 'Acordes'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview en vivo */}
          <View style={{ width: '100%', borderRadius: 14, backgroundColor: theme.background, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: COLORS.mutedForeground, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Vista previa</Text>
            {/* Línea con acorde + letra */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 }}>
              <View style={{ marginRight: 4 }}>
                <Text style={{ color: theme.chords, fontSize: 15, fontWeight: 'bold' }}>Am</Text>
                <Text style={{ color: theme.lyrics, fontSize: 16 }}>Santo, </Text>
              </View>
              <View style={{ marginRight: 4 }}>
                <Text style={{ color: theme.chords, fontSize: 15, fontWeight: 'bold' }}>F</Text>
                <Text style={{ color: theme.lyrics, fontSize: 16 }}>Santo, </Text>
              </View>
              <View>
                <Text style={{ color: theme.chords, fontSize: 15, fontWeight: 'bold' }}>G</Text>
                <Text style={{ color: theme.lyrics, fontSize: 16 }}>Santo</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ marginRight: 4 }}>
                <Text style={{ color: theme.chords, fontSize: 15, fontWeight: 'bold' }}>C</Text>
                <Text style={{ color: theme.lyrics, fontSize: 16 }}>es el </Text>
              </View>
              <View>
                <Text style={{ color: theme.chords, fontSize: 15, fontWeight: 'bold' }}>Em</Text>
                <Text style={{ color: theme.lyrics, fontSize: 16 }}>Señor</Text>
              </View>
            </View>
          </View>

          {/* Paleta expandida */}
          <View style={{ width: '100%' }}>
            <Text style={{ color: COLORS.mutedForeground, fontSize: 12, marginBottom: 10 }}>Paleta de colores</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {swatches.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => {
                    const newTheme = { ...theme, [pickerTab]: c };
                    setTheme(newTheme);
                    onSaveGlobalTheme?.(newTheme);
                    setHexInput(c);
                  }}
                  style={[
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: c },
                    theme[pickerTab] === c
                      ? { borderWidth: 3, borderColor: COLORS.accent }
                      : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }
                  ]}
                />
              ))}
            </View>
            <Text style={{ color: COLORS.mutedForeground, fontSize: 12, marginBottom: 8 }}>O ingresá un color hex</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme[pickerTab], borderWidth: 1, borderColor: COLORS.border }} />
              <TextInput
                style={[styles.noteEditInput, { flex: 1, height: 44, marginBottom: 0 }]}
                value={hexInput}
                onChangeText={(val) => {
                  setHexInput(val);
                  const cleaned = val.startsWith('#') ? val : '#' + val;
                  if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
                    const newTheme = { ...theme, [pickerTab]: cleaned };
                    setTheme(newTheme);
                    onSaveGlobalTheme?.(newTheme);
                  }
                }}
                maxLength={7}
                autoCapitalize="none"
                placeholder="#3b82f6"
                placeholderTextColor={COLORS.mutedForeground}
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.doneBtn, { width: '100%', marginTop: 20 }]} onPress={onClose}>
            <Text style={styles.doneBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  colorPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  colorPickerContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  colorPickerTitle: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: 'bold',
  },
  noteEditInput: {
    backgroundColor: COLORS.background,
    color: COLORS.foreground,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  doneBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
