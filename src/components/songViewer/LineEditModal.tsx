import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet
} from 'react-native';
import { Edit2, X } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface LineEditModalProps {
  visible: boolean;
  lineIndex: number | null;
  editingLineText: string;
  setEditingLineText: (text: string) => void;
  setInputSelection: (sel: { start: number; end: number }) => void;
  insertAtCursor: (chord: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const LineEditModal: React.FC<LineEditModalProps> = ({
  visible,
  lineIndex,
  editingLineText,
  setEditingLineText,
  setInputSelection,
  insertAtCursor,
  onCancel,
  onSave,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Edit2 size={18} color={COLORS.accent} />
            <Text style={styles.title}>
              Editar Línea {(lineIndex || 0) + 1}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <X size={22} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {/* Insertar Acordes Rápidos en la Posición del Cursor */}
            <Text style={styles.sectionLabel}>
              Insertar Acorde en la posición del cursor:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['[C]', '[C#]', '[D]', '[D#]', '[E]', '[F]', '[F#]', '[G]', '[G#]', '[A]', '[A#]', '[B]'].map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => insertAtCursor(c)}
                    style={styles.quickChordBtn}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Acordes Menores y Variantes */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['[Cm]', '[Dm]', '[Em]', '[Fm]', '[Gm]', '[Am]', '[Bm]', '[C7]', '[D7]', '[G7]', '[Cmaj7]', '[Gsus4]'].map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => insertAtCursor(c)}
                    style={styles.quickChordOutlineBtn}
                  >
                    <Text style={{ color: COLORS.foreground, fontSize: 12, fontWeight: 'bold' }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Plantillas de Sección */}
            <Text style={styles.sectionLabel}>
              Etiquetas de Sección:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['[VERSO 1]', '[VERSO 2]', '[CORO]', '[PUENTE]', '[INTRO]', '[OUTRO]', '[SOLO]', '[FINAL]'].map(tag => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setEditingLineText(tag)}
                    style={{
                      backgroundColor: editingLineText === tag ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: editingLineText === tag ? '#000' : '#fff', fontSize: 12, fontWeight: 'bold' }}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Editor de Texto Normal */}
            <Text style={styles.sectionLabel}>
              Texto de la Línea (escribe, borra o haz espacios normalmente):
            </Text>
            <TextInput
              style={styles.textInput}
              value={editingLineText}
              onChangeText={setEditingLineText}
              onSelectionChange={(e) => setInputSelection(e.nativeEvent.selection)}
              placeholder="Escribe letra y acordes, ej: [C]Subo mis [G]manos..."
              placeholderTextColor={COLORS.mutedForeground}
              multiline
              autoCapitalize="sentences"
            />
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={onCancel}
            >
              <Text style={[styles.saveBtnText, { color: COLORS.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1, backgroundColor: COLORS.accent }]}
              onPress={onSave}
            >
              <Text style={styles.saveBtnText}>Guardar Línea</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    maxHeight: '85%',
    width: '94%',
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  sectionLabel: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  quickChordBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickChordOutlineBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  textInput: {
    minHeight: 80,
    fontSize: 16,
    color: COLORS.foreground,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
