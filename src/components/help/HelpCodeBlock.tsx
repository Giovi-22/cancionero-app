import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

interface HelpCodeBlockProps {
  code: string;
  caption?: string;
}

export function HelpCodeBlock({ code, caption }: HelpCodeBlockProps) {
  return (
    <View style={styles.container}>
      {caption && <Text style={styles.caption}>{caption}</Text>}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text selectable style={styles.codeText}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 12,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  caption: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    color: COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  scroll: {
    maxHeight: 340,
  },
  scrollContent: {
    padding: 14,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    lineHeight: 19,
    color: '#e5e7eb',
  },
});
