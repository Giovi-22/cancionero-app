import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Dimensions
} from 'react-native';
import { ChevronLeft, RotateCcw, Plus, Minus, Play, Pause, Settings as SettingsIcon } from 'lucide-react-native';
import { cleanSongText, transposeText, trimCommonIndentation, parseSongToBlocks } from '../utils/chordUtils';
import { PedalHandler } from './PedalHandler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  background: '#020617',
  foreground: '#f8fafc',
  accent: '#8b5cf6',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  chord: '#a78bfa', // Lighter purple for chords
};

interface SongViewerProps {
  content: string;
  title: string;
  onBack: () => void;
}

export const SongViewer: React.FC<SongViewerProps> = ({ content, title, onBack }) => {
  const [transpose, setTranspose] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<'all' | 'lyrics'>('all');

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPosRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Core parsing logic (same as web)
  const parsedLines = useMemo(() => {
    const cleaned = cleanSongText(content);
    const transposed = transposeText(cleaned, transpose);
    const trimmed = trimCommonIndentation(transposed);
    return parseSongToBlocks(trimmed);
  }, [content, transpose]);

  // Auto-scroll logic adapted for React Native
  useEffect(() => {
    if (isScrolling) {
      const scrollStep = () => {
        scrollPosRef.current += (scrollSpeed * 0.5);
        scrollViewRef.current?.scrollTo({
          y: scrollPosRef.current,
          animated: false,
        });
        animationFrameRef.current = requestAnimationFrame(scrollStep);
      };
      animationFrameRef.current = requestAnimationFrame(scrollStep);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isScrolling, scrollSpeed]);

  const handleScroll = (event: any) => {
    // Update our internal reference if the user scrolls manually
    if (!isScrolling) {
      scrollPosRef.current = event.nativeEvent.contentOffset.y;
    }
  };

  const handlePedalScroll = (direction: number) => {
    scrollPosRef.current += (direction * 100); // Scroll 100px per press
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, scrollPosRef.current),
      animated: true,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <PedalHandler 
        onScrollDown={() => handlePedalScroll(1)}
        onScrollUp={() => handlePedalScroll(-1)}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ChevronLeft size={28} color={COLORS.foreground} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <SettingsIcon size={24} color={COLORS.foreground} />
        </TouchableOpacity>
      </View>

      {/* Song Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.songContainer}>
          {parsedLines.map((line, lIndex) => {
            const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
            
            return (
              <View 
                key={lIndex} 
                style={[
                  styles.line,
                  line.type === 'section' && !isTitle ? styles.sectionLine : null,
                  isTitle ? styles.titleLine : null
                ]}
              >
                {line.blocks.map((block, bIndex) => (
                  <View key={bIndex} style={[styles.block, isTitle ? styles.titleBlock : null]}>
                    {block.chord && viewMode === 'all' && (
                      <Text style={[styles.chord, { fontSize: fontSize * 0.9 }]}>
                        {block.chord}
                      </Text>
                    )}
                    <Text style={[
                      styles.text, 
                      { fontSize: isTitle ? fontSize * 1.5 : fontSize },
                      line.type === 'section' ? styles.sectionText : null,
                      line.type === 'chords-lyrics' ? styles.chordsLyricsText : null
                    ]}>
                      {isTitle ? block.text.replace(/\[TITULO\]/i, '').trim() : block.text}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Controls Bar */}
      <View style={styles.controlsBar}>
        <View style={styles.controlGroup}>
          <TouchableOpacity onPress={() => setTranspose(t => t - 1)} style={styles.controlBtn}>
            <Minus size={20} color={COLORS.foreground} />
          </TouchableOpacity>
          <View style={styles.transposeBadge}>
            <Text style={styles.transposeText}>{transpose > 0 ? `+${transpose}` : transpose}</Text>
          </View>
          <TouchableOpacity onPress={() => setTranspose(t => t + 1)} style={styles.controlBtn}>
            <Plus size={20} color={COLORS.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity 
          onPress={() => setIsScrolling(!isScrolling)} 
          style={[styles.scrollToggle, isScrolling && styles.scrollToggleActive]}
        >
          {isScrolling ? (
            <Pause size={24} color={COLORS.foreground} />
          ) : (
            <Play size={24} color={COLORS.foreground} />
          )}
          <Text style={styles.scrollLabel}>
            {isScrolling ? `${scrollSpeed.toFixed(1)}x` : 'Scroll'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.controlGroup}>
          <TouchableOpacity onPress={() => setFontSize(s => Math.max(10, s - 2))} style={styles.controlBtn}>
            <Text style={styles.fontControlText}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFontSize(s => Math.min(30, s + 2))} style={styles.controlBtn}>
            <Text style={styles.fontControlText}>A+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.muted,
  },
  backButton: {
    padding: 8,
  },
  settingsButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 150, // More space for controls
  },
  songContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  sectionLine: {
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    paddingBottom: 5,
  },
  titleLine: {
    justifyContent: 'center',
    marginBottom: 30,
  },
  block: {
    flexDirection: 'column',
    minWidth: 1,
  },
  titleBlock: {
    alignItems: 'center',
    width: '100%',
  },
  chord: {
    color: COLORS.accent,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    height: 20,
  },
  text: {
    color: COLORS.foreground,
    fontFamily: 'monospace',
  },
  chordsLyricsText: {
    // In React Native, monospace is usually necessary for alignment
  },
  sectionText: {
    color: '#fbbf24', // Amber for sections
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  transposeBadge: {
    minWidth: 35,
    alignItems: 'center',
  },
  transposeText: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  scrollToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  scrollToggleActive: {
    backgroundColor: COLORS.accent,
  },
  scrollLabel: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
  },
  fontControlText: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
  }
});
