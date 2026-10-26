import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Info } from 'lucide-react-native';

import { COLORS } from '../../constants/theme';
import { HelpBlock } from '../../constants/helpContent';
import { HelpCodeBlock } from './HelpCodeBlock';

interface HelpBlockRendererProps {
  block: HelpBlock;
}

export function HelpBlockRenderer({ block }: HelpBlockRendererProps) {
  switch (block.type) {
    case 'paragraph':
      return <Text style={styles.paragraph}>{block.text}</Text>;

    case 'steps':
      return (
        <View style={styles.stepsContainer}>
          {block.items.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      );

    case 'bullets':
      return (
        <View style={styles.bulletsContainer}>
          {block.items.map((item, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      );

    case 'code':
      return <HelpCodeBlock code={block.code} caption={block.caption} />;

    case 'table':
      return (
        <View style={styles.tableContainer}>
          {/* Header */}
          <View style={styles.tableHeader}>
            {block.headers.map((h, i) => (
              <Text
                key={i}
                style={[
                  styles.tableHeaderText,
                  i === 0 ? styles.tableColRole : styles.tableColDesc,
                ]}
              >
                {h}
              </Text>
            ))}
          </View>

          {/* Rows */}
          {block.rows.map((row, rIdx) => (
            <View
              key={rIdx}
              style={[
                styles.tableRow,
                rIdx === block.rows.length - 1 && styles.tableRowLast,
              ]}
            >
              <Text style={[styles.tableCellRole]}>{row[0]}</Text>
              <Text style={[styles.tableCellDesc]}>{row[1]}</Text>
            </View>
          ))}
        </View>
      );

    case 'note':
      return (
        <View style={styles.noteContainer}>
          <Info size={16} color={COLORS.accent} style={styles.noteIcon} />
          <Text style={styles.noteText}>{block.text}</Text>
        </View>
      );

    case 'faq':
      return (
        <View style={styles.faqContainer}>
          {block.items.map((item, idx) => (
            <View key={idx} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            </View>
          ))}
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  paragraph: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 22,
    marginVertical: 6,
  },

  stepsContainer: {
    marginVertical: 8,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent + '25',
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepNumber: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },

  bulletsContainer: {
    marginVertical: 8,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },

  tableContainer: {
    marginVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#121212',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    color: COLORS.foreground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableColRole: {
    width: 105,
  },
  tableColDesc: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCellRole: {
    width: 105,
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 13,
    paddingRight: 6,
  },
  tableCellDesc: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 19,
  },

  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    padding: 12,
    marginVertical: 8,
  },
  noteIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  noteText: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  faqContainer: {
    marginVertical: 8,
    gap: 14,
  },
  faqItem: {
    backgroundColor: '#141414',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262626',
  },
  faqQuestion: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  faqAnswer: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
});
