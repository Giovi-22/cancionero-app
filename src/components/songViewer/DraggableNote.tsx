import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder, StyleSheet } from 'react-native';
import { StickyNote, Edit2, X } from 'lucide-react-native';

interface DraggableNoteProps {
  id: string;
  initialText: string;
  initialX: number;
  initialY: number;
  isStageMode: boolean;
  onRequestEdit: (id: string, text: string) => void;
  onUpdate: (id: string, text: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  setScrollEnabled: (enabled: boolean) => void;
}

export const DraggableNote: React.FC<DraggableNoteProps> = ({
  id, initialText, initialX, initialY, isStageMode, onRequestEdit, onUpdate, onDelete, setScrollEnabled
}) => {
  const pan = useRef(new Animated.ValueXY({ x: initialX || 0, y: initialY || 0 })).current;
  const offset = useRef({ x: initialX || 0, y: initialY || 0 });

  const stateRef = useRef({ id, initialText, onUpdate, setScrollEnabled, isStageMode });
  stateRef.current = { id, initialText, onUpdate, setScrollEnabled, isStageMode };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !stateRef.current.isStageMode,
      onMoveShouldSetPanResponder: (_, g) => !stateRef.current.isStageMode && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
      onPanResponderGrant: () => {
        stateRef.current.setScrollEnabled(false);
        pan.setOffset(offset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        offset.current = { x: (pan.x as any)._value, y: (pan.y as any)._value };
        stateRef.current.onUpdate(
          stateRef.current.id,
          stateRef.current.initialText,
          offset.current.x,
          offset.current.y
        );
        stateRef.current.setScrollEnabled(true);
      }
    })
  ).current;

  useEffect(() => {
    pan.setValue({ x: initialX || 0, y: initialY || 0 });
    offset.current = { x: initialX || 0, y: initialY || 0 };
  }, [initialX, initialY]);

  if (!initialText) return null;

  return (
    <Animated.View
      style={{ position: 'absolute', transform: pan.getTranslateTransform(), zIndex: 100 }}
      {...(isStageMode ? {} : panResponder.panHandlers)}
    >
      <View style={[styles.noteBadge, !isStageMode && { borderColor: '#dc2626', borderWidth: 1 }]}>
        <StickyNote size={12} color="#000" />
        <Text style={styles.noteBadgeText}>{initialText}</Text>
        {!isStageMode && (
          <TouchableOpacity
            onPress={() => onRequestEdit(id, initialText)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 5 }}
          >
            <Edit2 size={12} color="#000" />
          </TouchableOpacity>
        )}
        {!isStageMode && (
          <TouchableOpacity
            onPress={() => onDelete(id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 5 }}
          >
            <X size={14} color="#dc2626" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  noteBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  noteBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});
