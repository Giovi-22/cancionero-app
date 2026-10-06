import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface NoteModeBannerProps {
  onClose: () => void;
  accentColor?: string;
  foregroundColor?: string;
}

export const NoteModeBanner: React.FC<NoteModeBannerProps> = ({
  onClose,
  accentColor = '#f59e0b',
  foregroundColor = '#ffffff',
}) => {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: accentColor,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      onPress={onClose}
    >
      <Text
        style={{
          color: foregroundColor,
          fontSize: 12,
          fontWeight: 'bold',
          flex: 1,
          marginRight: 10,
        }}
      >
        📌 NOTAS DE MÚSICO: Tocá cualquier línea para agregar una nota y arrastrala para posicionarla donde quieras.
      </Text>
      <Text style={{ color: accentColor, fontSize: 12, fontWeight: 'bold' }}>
        Cerrar
      </Text>
    </TouchableOpacity>
  );
};
