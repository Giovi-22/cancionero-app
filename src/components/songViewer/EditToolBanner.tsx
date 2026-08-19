import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface EditToolBannerProps {
  onClose: () => void;
  accentColor?: string;
  foregroundColor?: string;
}

export const EditToolBanner: React.FC<EditToolBannerProps> = ({
  onClose,
  accentColor = '#3b82f6',
  foregroundColor = '#ffffff',
}) => {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
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
      <Text style={{ color: foregroundColor, fontSize: 12, fontWeight: 'bold', flex: 1, marginRight: 10 }}>
        ✏️ HERRAMIENTA EDICIÓN: Tocá cualquier línea para ajustar acordes o corregir letra.
      </Text>
      <Text style={{ color: accentColor, fontSize: 12, fontWeight: 'bold' }}>Cerrar</Text>
    </TouchableOpacity>
  );
};
