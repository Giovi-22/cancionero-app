import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ChevronLeft, Edit2, Share2, Code, StickyNote } from 'lucide-react-native';
import { features } from '../../config/features';
import { useResponsive } from '../../hooks/useResponsive';

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
  const { isTablet } = useResponsive();

  const backIconSize = isTablet ? 34 : 28;
  const actionIconSize = isTablet ? 26 : 22;
  const codeIconSize = isTablet ? 28 : 24;

  return (
    <View
      style={[
        styles.header,
        isTablet && styles.headerTablet,
        { paddingTop: Math.max(topInset, 20) + (isTablet ? 10 : 5) },
      ]}
    >
      <TouchableOpacity
        onPress={onClose}
        style={[styles.headerBtn, isTablet && styles.headerBtnTablet]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronLeft size={backIconSize} color={headerFg} />
      </TouchableOpacity>

      <View style={{ flex: 1, alignItems: 'center', marginHorizontal: isTablet ? 16 : 10 }}>
        <Text
          style={[styles.title, isTablet && styles.titleTablet, { color: headerFg }]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={onToggleEditTool}
          style={[
            styles.headerBtn,
            isTablet && styles.headerBtnTablet,
            { marginRight: isTablet ? 10 : 6 },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Edit2 size={actionIconSize} color={isEditToolActive ? COLORS.accent : headerFg} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSharePdf}
          style={[
            styles.headerBtn,
            isTablet && styles.headerBtnTablet,
            { marginRight: isTablet ? 10 : 8 },
          ]}
          disabled={isGeneratingPdf}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          {isGeneratingPdf ? (
            <ActivityIndicator size={isTablet ? "small" : "small"} color={COLORS.accent} />
          ) : (
            <Share2 size={actionIconSize} color={headerFg} />
          )}
        </TouchableOpacity>

        {features.debugTools && (
          <TouchableOpacity
            onPress={onOpenChordPro}
            style={[
              styles.headerBtn,
              isTablet && styles.headerBtnTablet,
              { marginRight: isTablet ? 10 : 8 },
            ]}
          >
            <Code size={codeIconSize} color={headerFg} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onToggleStageMode}
          style={[
            styles.headerBtn,
            isTablet && styles.headerBtnTablet,
            !isStageMode && { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <StickyNote size={actionIconSize} color={!isStageMode ? COLORS.accent : headerFg} />
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
  headerTablet: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnTablet: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  titleTablet: {
    fontSize: 22,
  },
});
