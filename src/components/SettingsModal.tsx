import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  X,
  Edit2,
  Minus,
  Plus,
} from 'lucide-react-native';
import { features } from '../config/features';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
};

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;

  fontSize: number;
  setFontSize: React.Dispatch<
    React.SetStateAction<number>
  >;

  theme: any;
  onOpenColorPicker: () => void;

  viewMode: 'all' | 'lyrics';
  setViewMode: (
    mode: 'all' | 'lyrics'
  ) => void;

  isDebugMode: boolean;
  setIsDebugMode: (
    debug: boolean
  ) => void;

  isEditToolActive: boolean;
  setIsEditToolActive: (
    active: boolean
  ) => void;
}

export const SettingsModal: React.FC<
  SettingsModalProps
> = ({
  visible,
  onClose,
  fontSize,
  setFontSize,
  theme,
  onOpenColorPicker,
  viewMode,
  setViewMode,
  isDebugMode,
  setIsDebugMode,
  isEditToolActive,
  setIsEditToolActive,
}) => {
    if (!visible) return null;

    return (
      <View style={styles.settingsSheet}>
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>
            Ajustes de Canción
          </Text>

          <TouchableOpacity onPress={onClose}>
            <X
              size={24}
              color={COLORS.foreground}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
        >
          {/* Tamaño letra */}
          <Text
            style={[
              styles.settingLabel,
              { marginTop: 20 },
            ]}
          >
            Tamaño Letra
          </Text>

          <View
            style={styles.controlGroup}
          >
            <TouchableOpacity
              onPress={() =>
                setFontSize(p =>
                  Math.max(10, p - 2)
                )
              }
              style={styles.smallBtn}
            >
              <Minus
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            <Text
              style={styles.ctrlText}
            >
              {fontSize}px
            </Text>

            <TouchableOpacity
              onPress={() =>
                setFontSize(p =>
                  Math.min(40, p + 2)
                )
              }
              style={styles.smallBtn}
            >
              <Plus
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Colores */}
          <Text
            style={[
              styles.settingLabel,
              { marginTop: 20 },
            ]}
          >
            Colores (Globales)
          </Text>

          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              marginTop: 8,
              marginBottom: 10,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor:
                  theme.background,
                borderWidth: 1,
                borderColor:
                  COLORS.border,
              }}
            />

            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor:
                  theme.lyrics,
                borderWidth: 1,
                borderColor:
                  COLORS.border,
              }}
            />

            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor:
                  theme.chords,
                borderWidth: 1,
                borderColor:
                  COLORS.border,
              }}
            />

            <TouchableOpacity
              onPress={onOpenColorPicker}
              style={{
                marginLeft: 'auto',
                backgroundColor:
                  COLORS.accent,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 'bold',
                }}
              >
                Personalizar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Vista */}
          <Text
            style={[
              styles.settingLabel,
              { marginTop: 20 },
            ]}
          >
            Vista
          </Text>

          <View
            style={styles.toggleGroup}
          >
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'all' &&
                styles.toggleBtnActive,
              ]}
              onPress={() =>
                setViewMode('all')
              }
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === 'all' &&
                  styles.toggleTextActive,
                ]}
              >
                Todo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'lyrics' &&
                styles.toggleBtnActive,
              ]}
              onPress={() =>
                setViewMode('lyrics')
              }
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === 'lyrics' &&
                  styles.toggleTextActive,
                ]}
              >
                Solo Letra
              </Text>
            </TouchableOpacity>
          </View>

          {/* Herramientas de debug: solo desarrollo (ver src/config/features.ts) */}
          {features.debugTools && (
            <>
              {/* Debug */}
              <Text
                style={[
                  styles.settingLabel,
                  { marginTop: 20 },
                ]}
              >
                Modo Depuración (Alineación)
              </Text>

              <View
                style={styles.toggleGroup}
              >
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !isDebugMode &&
                    styles.toggleBtnActive,
                  ]}
                  onPress={() =>
                    setIsDebugMode(false)
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !isDebugMode &&
                      styles.toggleTextActive,
                    ]}
                  >
                    Apagado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    isDebugMode &&
                    styles.toggleBtnActive,
                  ]}
                  onPress={() =>
                    setIsDebugMode(true)
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      isDebugMode &&
                      styles.toggleTextActive,
                    ]}
                  >
                    Encendido
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Herramientas */}
              <Text
                style={[
                  styles.settingLabel,
                  { marginTop: 20 },
                ]}
              >
                Herramientas
              </Text>

              <TouchableOpacity
                style={[
                  {
                    backgroundColor:
                      'rgba(255,255,255,0.08)',
                    padding: 12,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 8,
                  },
                  isEditToolActive && {
                    backgroundColor:
                      'rgba(59,130,246,0.2)',
                    borderWidth: 1,
                    borderColor:
                      COLORS.accent,
                  },
                ]}
                onPress={() => {
                  setIsEditToolActive(
                    !isEditToolActive
                  );
                  onClose();
                }}
              >
                <Edit2
                  size={18}
                  color={
                    isEditToolActive
                      ? COLORS.accent
                      : COLORS.foreground
                  }
                />

                <Text
                  style={{
                    color:
                      isEditToolActive
                        ? COLORS.accent
                        : COLORS.foreground,
                    fontWeight: 'bold',
                    fontSize: 13,
                  }}
                >
                  {isEditToolActive
                    ? 'Desactivar Editor Visual'
                    : '✏️ Herramienta Editor Visual de Acordes'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
          >
            <Text
              style={styles.doneBtnText}
            >
              Listo
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

const styles = StyleSheet.create({
  settingsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 90,
  },

  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  settingsTitle: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: 'bold',
  },

  settingLabel: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor:
      'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },

  ctrlText: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    minWidth: 40,
  },

  toggleGroup: {
    flexDirection: 'row',
    backgroundColor:
      'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  toggleBtnActive: {
    backgroundColor: COLORS.surface,
  },

  toggleText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: 'bold',
  },

  toggleTextActive: {
    color: COLORS.foreground,
  },

  doneBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },

  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});