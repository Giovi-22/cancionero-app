import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ChevronLeft, Edit2, Share2, Code, StickyNote } from 'lucide-react-native';
import { features } from '../../config/features';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

interface SongViewerHeaderProps {
  topInset: number;
  headerFg: string;
  displayTitle: string;
  onClose: () => void;
  isEditToolActive: boolean;
  onToggleEditTool: () => void;
  isGeneratingPdf: boolean;
  onSharePdf: () => void;
  onOpenChordPro: () => void;
  isStageMode: boolean;
  onToggleStageMode: () => void;
}

export const SongViewerHeader: React.FC<SongViewerHeaderProps> = ({
  topInset,
  headerFg,
  displayTitle,
  onClose,
  isEditToolActive,
  onToggleEditTool,
  isGeneratingPdf,
  onSharePdf,
  onOpenChordPro,
  isStageMode,
  onToggleStageMode,
}) => {
  return (
    <View style={[styles.header, { paddingTop: Math.max(topInset, 20) + 5 }]}>
      <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
        <ChevronLeft size={28} color={headerFg} />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 10 }}>
        <Text style={[styles.title, { color: headerFg }]} numberOfLines={1}>
          {displayTitle}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={onToggleEditTool}
          style={[styles.headerBtn, { marginRight: 6 }]}
        >
          <Edit2 size={22} color={isEditToolActive ? COLORS.accent : headerFg} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSharePdf}
          style={[styles.headerBtn, { marginRight: 8 }]}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Share2 size={22} color={headerFg} />
          )}
        </TouchableOpacity>
        {features.debugTools && (
          <TouchableOpacity onPress={onOpenChordPro} style={[styles.headerBtn, { marginRight: 8 }]}>
            <Code size={24} color={headerFg} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onToggleStageMode}
          style={[
            styles.headerBtn,
            !isStageMode && { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
          ]}
        >
          <StickyNote size={22} color={!isStageMode ? COLORS.accent : headerFg} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
