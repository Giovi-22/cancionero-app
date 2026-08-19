import React from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { StickyNote, X } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface NoteEditOverlayProps {
  editingNote: { id: string; text: string } | null;
  setEditingNote: React.Dispatch<React.SetStateAction<{ id: string; text: string } | null>>;
  onSaveNote: () => void;
  onCancelNote: () => void;
}

export const NoteEditOverlay: React.FC<NoteEditOverlayProps> = ({
  editingNote,
  setEditingNote,
  onSaveNote,
  onCancelNote,
}) => {
  if (!editingNote) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.noteOverlayBackdrop}
        activeOpacity={1}
        onPress={onCancelNote}
      />
      <View style={styles.noteEditSheet}>
        <View style={styles.noteEditHeader}>
          <StickyNote size={16} color={COLORS.accent} />
          <Text style={styles.noteEditTitle}>Nota de músico</Text>
          <TouchableOpacity onPress={onCancelNote} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={COLORS.mutedForeground} />
          </TouchableOpacity>
        </View>
        <TextInput
          autoFocus
          style={styles.noteEditInput}
          value={editingNote.text}
          onChangeText={(t) => setEditingNote(prev => prev ? { ...prev, text: t } : null)}
          placeholder="Escribe tu nota aquí..."
          placeholderTextColor={COLORS.mutedForeground}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.noteEditSaveBtn} onPress={onSaveNote}>
          <Text style={styles.noteEditSaveBtnText}>Guardar nota</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  noteOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  noteEditSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 200,
  },
  noteEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteEditTitle: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  noteEditInput: {
    backgroundColor: COLORS.background,
    color: COLORS.foreground,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  noteEditSaveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noteEditSaveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
