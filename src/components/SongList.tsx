import React, {
  useEffect,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
} from 'react-native-reanimated';
import {
  Music,
  FileText,
  Check,
  X,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SongMetadata } from '../types';
import { COLORS } from '../constants/theme';
import { SongCard, SONG_CARD_HEIGHT } from './SongCard';

// ── Song availability ───────────────────────────────────────────────────────

export type SongAvailabilityStatus =
  | 'available'
  | 'offline'
  | 'downloading'
  | 'unavailable';

// ── Props ───────────────────────────────────────────────────────────────────

interface SongListProps {
  songs: SongMetadata[];

  onSongPress: (
    song: SongMetadata
  ) => void;

  /**
   * Se utiliza únicamente cuando la lista está vacía
   * y NO estamos en modo setlist.
   */
  onSyncPress?: () => void;

  onHowToCreatePress?: () => void;

  isSetlistMode?: boolean;

  /**
   * Indica si el usuario puede modificar el repertorio.
   *
   * Owner/director: true
   * Member: false
   */
  canManageSetlist?: boolean;

  onRemoveFromSetlist?: (
    songId: string
  ) => void;

  onAddSongsPress?: () => void;

  onReorder?: (
    fromIndex: number,
    toIndex: number
  ) => void;

  scrollEnabled?: boolean;

  loadingSongId?: string | null;

  /**
   * Estados de disponibilidad de las canciones.
   *
   * songId -> estado
   *
   * Es opcional para mantener SongList compatible
   * con la biblioteca personal.
   */
  songStatuses?: Record<
    string,
    SongAvailabilityStatus
  >;

  /**
   * Notas asociadas a las canciones.
   * La estructura es songId -> nota.
   */
  songNotes?: Record<string, string>;

  /**
   * Persistencia de una nota.
   * SongList solamente maneja la UI.
   */
  onSaveSongNote?: (
    songId: string,
    note: string
  ) => Promise<void>;

  /**
   * Eliminación de una nota.
   * SongList solamente maneja la UI.
   */
  onDeleteSongNote?: (
    songId: string
  ) => Promise<void>;
}

// SortableItem fue extraído a SongCard.tsx — ver src/components/SongCard.tsx

// ── SongList ────────────────────────────────────────────────────────────────

export const SongList: React.FC<
  SongListProps
> = ({
  songs,
  onSongPress,
  onSyncPress,
  onHowToCreatePress,
  isSetlistMode,
  canManageSetlist = false,
  onRemoveFromSetlist,
  onAddSongsPress,
  onReorder,
  scrollEnabled = true,
  loadingSongId,
  songStatuses,
  songNotes,
  onSaveSongNote,
  onDeleteSongNote,
}) => {
    const insets =
      useSafeAreaInsets();

    const scrollRef =
      useAnimatedRef<
        Animated.ScrollView
      >();

    const scrollY =
      useSharedValue(0);

    const [
      editingSong,
      setEditingSong,
    ] =
      React.useState<SongMetadata | null>(
        null
      );

    const [
      songNoteText,
      setSongNoteText,
    ] = React.useState('');

    const [
      isSavingNote,
      setIsSavingNote,
    ] = React.useState(false);

    // ── Notes ────────────────────────────────────────────────

    const handleOpenSongNote = (
      song: SongMetadata
    ) => {
      if (!canManageSetlist) {
        return;
      }

      setEditingSong(song);

      const existing =
        songNotes?.[song.id] || '';

      setSongNoteText(existing);
    };

    const handleSaveSongNote =
      async () => {
        if (
          !editingSong ||
          !onSaveSongNote ||
          !canManageSetlist
        ) {
          return;
        }

        setIsSavingNote(true);

        try {
          await onSaveSongNote(
            editingSong.id,
            songNoteText
          );

          setEditingSong(null);
        } finally {
          setIsSavingNote(false);
        }
      };

    const handleDeleteSongNote =
      async () => {
        if (
          !editingSong ||
          !onDeleteSongNote ||
          !canManageSetlist
        ) {
          return;
        }

        setIsSavingNote(true);

        try {
          await onDeleteSongNote(
            editingSong.id
          );

          setEditingSong(null);
        } finally {
          setIsSavingNote(false);
        }
      };

    const scrollHandler =
      useAnimatedScrollHandler({
        onScroll: (e) => {
          scrollY.value =
            e.contentOffset.y;
        },
      });

    const initialPositions =
      useMemo(() => {
        return songs.reduce(
          (acc, song, i) => {
            acc[song.id] = i;

            return acc;
          },
          {} as Record<
            string,
            number
          >
        );
      }, [songs]);

    const positions =
      useSharedValue<
        Record<string, number>
      >(initialPositions);

    useEffect(() => {
      positions.value =
        initialPositions;
    }, [initialPositions]);

    const handleReorder = (
      from: number,
      to: number
    ) => {
      if (!canManageSetlist) {
        return;
      }

      onReorder?.(from, to);
    };

    // ── Empty state ──────────────────────────────────────────

    if (songs.length === 0) {
      return (
        <View
          style={
            styles.emptyState
          }
        >
          <Music
            size={64}
            color={COLORS.border}
          />

          <Text
            style={
              styles.emptyText
            }
          >
            {isSetlistMode
              ? 'La lista está vacía.'
              : 'No hay canciones guardadas.'}
          </Text>

          {isSetlistMode ? (
            canManageSetlist &&
            onAddSongsPress && (
              <TouchableOpacity
                style={
                  styles.syncButton
                }
                onPress={
                  onAddSongsPress
                }
              >
                <Text
                  style={
                    styles.syncButtonText
                  }
                >
                  Agregar canciones
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <>
              {onSyncPress && (
                <TouchableOpacity
                  style={
                    styles.syncButton
                  }
                  onPress={
                    onSyncPress
                  }
                >
                  <Text
                    style={
                      styles.syncButtonText
                    }
                  >
                    Sincronizar ahora
                  </Text>
                </TouchableOpacity>
              )}

              {onHowToCreatePress && (
                <TouchableOpacity
                  style={
                    styles.howToCreateButton
                  }
                  onPress={
                    onHowToCreatePress
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={
                      styles.howToCreateButtonText
                    }
                  >
                    Cómo crear mis canciones
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      );
    }

    const listHeight =
      songs.length *
      SONG_CARD_HEIGHT +
      100;

    return (
      <>
        <Animated.ScrollView
          key={songs
            .map((s) => s.id)
            .join(',')}
          ref={scrollRef}
          style={
            styles.container
          }
          onScroll={
            scrollHandler
          }
          scrollEventThrottle={16}
          scrollEnabled={
            scrollEnabled
          }
          contentContainerStyle={{
            height: listHeight,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              height: listHeight,
              position: 'relative',
            }}
          >
            {songs.map(
              (song, i) => (
                <SongCard
                  key={song.id}
                  song={song}
                  initialIndex={i}
                  positions={positions}
                  scrollY={scrollY}
                  scrollRef={scrollRef}
                  total={songs.length}
                  isSetlistMode={isSetlistMode}
                  canManageSetlist={canManageSetlist}
                  onSongPress={onSongPress}
                  onRemoveFromSetlist={onRemoveFromSetlist}
                  onReorder={handleReorder}
                  onEditSongNote={
                    canManageSetlist &&
                      (onSaveSongNote || onDeleteSongNote)
                      ? handleOpenSongNote
                      : undefined
                  }
                  songNote={
                    isSetlistMode
                      ? songNotes?.[song.id]
                      : undefined
                  }
                  loadingSongId={loadingSongId}
                  songStatus={songStatuses?.[song.id]}
                />
              )
            )}
          </View>
        </Animated.ScrollView>

        {/* ── Modal para editar nota ───────────────────────── */}

        <Modal
          visible={
            !!editingSong
          }
          transparent
          animationType="fade"
          onRequestClose={() =>
            setEditingSong(null)
          }
        >
          <TouchableOpacity
            style={[
              styles.songNoteModalOverlay,
              {
                paddingTop:
                  insets.top + 10,
                paddingBottom:
                  insets.bottom + 10,
              },
            ]}
            activeOpacity={1}
            onPress={() =>
              setEditingSong(null)
            }
          >
            <View
              style={
                styles.songNoteModalCard
              }
              onStartShouldSetResponder={() =>
                true
              }
            >
              <View
                style={
                  styles.songNoteModalHeader
                }
              >
                <View
                  style={{
                    flexDirection:
                      'row',
                    alignItems:
                      'center',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <FileText
                    size={18}
                    color={
                      COLORS.accent
                    }
                  />

                  <Text
                    style={
                      styles.songNoteModalTitle
                    }
                    numberOfLines={1}
                  >
                    Nota:{' '}
                    {editingSong?.name}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setEditingSong(
                      null
                    )
                  }
                  style={{
                    padding: 4,
                  }}
                >
                  <X
                    size={20}
                    color={
                      COLORS.foreground
                    }
                  />
                </TouchableOpacity>
              </View>

              <TextInput
                style={
                  styles.songNoteInput
                }
                value={
                  songNoteText
                }
                onChangeText={
                  setSongNoteText
                }
                placeholder="Ej: Entrar directo al coro, tono F#, sin intro..."
                placeholderTextColor={
                  COLORS.mutedForeground
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />

              <View
                style={
                  styles.songNoteModalActions
                }
              >
                {songNotes?.[
                  editingSong?.id ||
                  ''
                ] ? (
                  <TouchableOpacity
                    style={
                      styles.deleteSongNoteBtn
                    }
                    onPress={
                      handleDeleteSongNote
                    }
                    disabled={
                      isSavingNote ||
                      !onDeleteSongNote ||
                      !canManageSetlist
                    }
                  >
                    <Trash2
                      size={16}
                      color="#ef4444"
                    />

                    <Text
                      style={
                        styles.deleteSongNoteBtnText
                      }
                    >
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      flex: 1,
                    }}
                  />
                )}

                <TouchableOpacity
                  style={
                    styles.saveSongNoteBtn
                  }
                  onPress={
                    handleSaveSongNote
                  }
                  disabled={
                    isSavingNote ||
                    !onSaveSongNote ||
                    !canManageSetlist
                  }
                >
                  {isSavingNote ? (
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                    />
                  ) : (
                    <>
                      <Check
                        size={16}
                        color="#fff"
                      />

                      <Text
                        style={
                          styles.saveSongNoteBtnText
                        }
                      >
                        Guardar
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  };

// ── Styles ──────────────────────────────────────────────────────────────────

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    emptyState: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 100,
    },

    emptyText: {
      color:
        COLORS.mutedForeground,
      fontSize: 16,
      marginTop: 20,
      marginBottom: 30,
    },

    syncButton: {
      backgroundColor:
        COLORS.accent,
      paddingHorizontal: 25,
      paddingVertical: 12,
      borderRadius: 12,
    },

    syncButtonText: {
      color:
        COLORS.foreground,
      fontWeight: '600',
      fontSize: 16,
    },

    howToCreateButton: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    },

    howToCreateButtonText: {
      color: COLORS.accent,
      fontWeight: '600',
      fontSize: 14,
    },

    songNoteModalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.7)',
      justifyContent:
        'center',
      alignItems:
        'center',
      padding: 24,
    },

    songNoteModalCard: {
      width: '100%',
      backgroundColor:
        COLORS.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    songNoteModalHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 14,
    },

    songNoteModalTitle: {
      color:
        COLORS.foreground,
      fontSize: 16,
      fontWeight:
        'bold',
    },

    songNoteInput: {
      backgroundColor:
        COLORS.background,
      color:
        COLORS.foreground,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      minHeight: 100,
      marginBottom: 16,
    },

    songNoteModalActions: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      gap: 10,
    },

    deleteSongNoteBtn: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor:
        '#ef444415',
      borderWidth: 1,
      borderColor:
        '#ef444430',
    },

    deleteSongNoteBtnText: {
      color: '#ef4444',
      fontSize: 13,
      fontWeight:
        '600',
    },

    saveSongNoteBtn: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor:
        COLORS.accent,
    },

    saveSongNoteBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight:
        'bold',
    },
  });