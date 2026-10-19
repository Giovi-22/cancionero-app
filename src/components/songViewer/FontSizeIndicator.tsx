import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ALargeSmall } from 'lucide-react-native';
import { MIN_FONT_SIZE, MAX_FONT_SIZE } from '../../constants/songViewer';
import { COLORS } from '../../constants/theme';

interface FontSizeIndicatorProps {
  visible: boolean;
  fontSize: number;
  minFontSize?: number;
  maxFontSize?: number;
}

/**
 * Indicador visual flotante que se muestra mientras el usuario hace zoom
 * con dos dedos, mostrando el tamaño exacto en píxeles.
 */
export const FontSizeIndicator: React.FC<FontSizeIndicatorProps> = ({
  visible,
  fontSize,
  minFontSize = MIN_FONT_SIZE,
  maxFontSize = MAX_FONT_SIZE,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  const isMin = fontSize <= minFontSize;
  const isMax = fontSize >= maxFontSize;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={styles.badge}>
        <ALargeSmall size={18} color={COLORS.accent} />
        <Text style={styles.text}>
          {fontSize} px
          {isMin ? ' (Mín)' : isMax ? ' (Máx)' : ''}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    zIndex: 100,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20, 20, 22, 0.92)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
