import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Radio, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SongMetadata } from '../../types';
import { useAppContext } from '../../context/AppContext';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333'
};

interface SetlistNavSubHeaderProps {
  isDirector: boolean;
  isFollower?: boolean;
  setlistSongs: SongMetadata[];
  songId: string;
  onDirectorPrev?: () => void;
  onDirectorNext?: () => void;
  notes?: string;
  songNote?: string;
}

export const SetlistNavSubHeader: React.FC<SetlistNavSubHeaderProps> = ({
  isDirector,
  isFollower = false,
  setlistSongs,
  songId,
  onDirectorPrev,
  onDirectorNext,
  notes: propNotes,
  songNote: propSongNote,
}) => {
  const { activeSetlist } = useAppContext();
  const insets = useSafeAreaInsets();

  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showSongNoteModal, setShowSongNoteModal] = useState(false);

  if (!isDirector && !isFollower && setlistSongs.length === 0) {
    return null;
  }

  const idx = setlistSongs.findIndex(s => s.id === songId);

  // En modo banda llegan por props.
  // En modo personal seguimos usando activeSetlist.
  const effectiveNotes = propNotes || activeSetlist?.notes;

  const effectiveSongNote =
    propSongNote || activeSetlist?.songNotes?.[songId];

  const hasNotes =
    !!effectiveNotes &&
    effectiveNotes.trim().length > 0;

  const hasSongNote =
    !!effectiveSongNote &&
    effectiveSongNote.trim().length > 0;

  return (
    <View style={{ flexDirection: 'column' }}>
      <View style={styles.subHeader}>
        {/* Badge de modo */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <View
            style={[
              styles.subHeaderBadge,
              isFollower
                ? styles.followerBadge
                : isDirector
                  ? styles.directorBadge
                  : styles.localBadge,
            ]}
          >
            <Radio size={10} color="#fff" />

            <Text style={styles.subHeaderBadgeText}>
              {isFollower
                ? 'SEGUIDOR'
                : isDirector
                  ? 'DIRECTOR'
                  : 'LISTA'}
            </Text>
          </View>

          {hasSongNote && (
            <TouchableOpacity
              style={styles.songNoteButton}
              onPress={() => setShowSongNoteModal(true)}
            >
              <FileText size={12} color="#fbbf24" />

              <Text style={styles.songNoteButtonText}>
                Nota Canción
              </Text>
            </TouchableOpacity>
          )}

          {hasNotes && (
            <TouchableOpacity
              style={styles.notesButton}
              onPress={() => setShowNotesModal(true)}
            >
              <FileText size={12} color="#fff" />

              <Text style={styles.notesButtonText}>
                Notas Lista
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Controles de navegación */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <TouchableOpacity
            onPress={onDirectorPrev}
            style={[
              styles.subNavBtn,
              idx <= 0 && styles.subNavBtnDisabled,
            ]}
            disabled={idx <= 0 || isFollower}
          >
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.subHeaderCounter}>
            {idx + 1} / {setlistSongs.length}
          </Text>

          <TouchableOpacity
            onPress={onDirectorNext}
            style={[
              styles.subNavBtn,
              idx >= setlistSongs.length - 1 &&
              styles.subNavBtnDisabled,
            ]}
            disabled={
              idx >= setlistSongs.length - 1 ||
              isFollower
            }
          >
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner Informativo de Nota de Canción si existe */}
      {hasSongNote && (
        <TouchableOpacity
          style={styles.songNoteBanner}
          onPress={() => setShowSongNoteModal(true)}
          activeOpacity={0.8}
        >
          <FileText size={14} color="#fbbf24" />

          <Text
            style={styles.songNoteBannerText}
            numberOfLines={1}
          >
            <Text
              style={{
                fontWeight: 'bold',
                color: '#fbbf24',
              }}
            >
              Nota:{' '}
            </Text>

            {effectiveSongNote}
          </Text>
        </TouchableOpacity>
      )}

      {/* Modal de Notas Generales de Lista */}
      <Modal
        visible={showNotesModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowNotesModal(false)
        }
      >
        <TouchableOpacity
          style={[
            styles.notesModalOverlay,
            {
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + 10,
            },
          ]}
          activeOpacity={1}
          onPress={() => setShowNotesModal(false)}
        >
          <View
            style={styles.notesModalCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.notesModalHeader}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FileText
                  size={18}
                  color={COLORS.accent}
                />

                <Text style={styles.notesModalTitle}>
                  Notas de la Lista
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowNotesModal(false)
                }
                style={{ padding: 4 }}
              >
                <X
                  size={20}
                  color={COLORS.foreground}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.notesModalContent}>
              {effectiveNotes}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Nota Específica de Canción */}
      <Modal
        visible={showSongNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowSongNoteModal(false)
        }
      >
        <TouchableOpacity
          style={[
            styles.notesModalOverlay,
            {
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + 10,
            },
          ]}
          activeOpacity={1}
          onPress={() =>
            setShowSongNoteModal(false)
          }
        >
          <View
            style={styles.notesModalCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.notesModalHeader}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FileText
                  size={18}
                  color="#fbbf24"
                />

                <Text style={styles.notesModalTitle}>
                  Nota de la Canción
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowSongNoteModal(false)
                }
                style={{ padding: 4 }}
              >
                <X
                  size={20}
                  color={COLORS.foreground}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.notesModalContent}>
              {effectiveSongNote}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(26,26,26,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  subHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  directorBadge: {
    backgroundColor: '#dc2626',
  },

  followerBadge: {
    backgroundColor: '#2563eb',
  },

  localBadge: {
    backgroundColor: '#4b5563',
  },

  subHeaderBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  subNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  subNavBtnDisabled: {
    opacity: 0.3,
  },

  subHeaderCounter: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: 'bold',
  },

  notesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },

  notesButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  notesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  notesModalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '70%',
  },

  notesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  notesModalTitle: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: 'bold',
  },

  notesModalContent: {
    color: COLORS.foreground,
    fontSize: 14,
    lineHeight: 22,
  },

  songNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },

  songNoteButtonText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },

  songNoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251, 191, 36, 0.3)',
  },

  songNoteBannerText: {
    color: COLORS.foreground,
    fontSize: 12,
    flex: 1,
  },
});