import React, { useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

interface PedalHandlerProps {
  onNext?: () => void;
  onPrev?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  enabled?: boolean;
}

/**
 * A hidden component that captures hardware keyboard events (Bluetooth pedals)
 * using a focused TextInput.
 */
export const PedalHandler: React.FC<PedalHandlerProps> = ({
  onNext,
  onPrev,
  onScrollUp,
  onScrollDown,
  enabled = true,
}) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (enabled) {
      const interval = setInterval(() => {
        if (inputRef.current && !inputRef.current.isFocused()) {
          inputRef.current.focus();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [enabled]);

  const handleKeyPress = (e: any) => {
    const key = e.nativeEvent.key;
    
    switch (key) {
      case 'ArrowRight':
        onNext?.();
        break;
      case 'ArrowLeft':
        onPrev?.();
        break;
      case 'ArrowUp':
        onScrollUp?.();
        break;
      case 'ArrowDown':
        onScrollDown?.();
        break;
      case 'PageUp':
        onScrollUp?.();
        break;
      case 'PageDown':
        onScrollDown?.();
        break;
    }
  };

  if (!enabled) return null;

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        showSoftInputOnFocus={false} // Don't show the virtual keyboard
        onKeyPress={handleKeyPress}
        autoFocus={true}
        caretHidden={true}
        value=""
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
  hiddenInput: {
    width: 1,
    height: 1,
  },
});
