import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { Code, X } from 'lucide-react-native';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface ChordProModalProps {
  visible: boolean;
  onClose: () => void;
  content: string;
}

export const ChordProModal: React.FC<ChordProModalProps> = ({
  visible,
  onClose,
  content,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Code size={20} color={COLORS.foreground} />
            <Text style={styles.title}>Código ChordPro</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.contentScroll}>
            <Text style={styles.codeText}>
              {content}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    marginTop: 60,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  contentScroll: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  codeText: {
    color: COLORS.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  },
});
