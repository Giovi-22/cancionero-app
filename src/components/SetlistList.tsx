import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, Modal, Alert
} from 'react-native';
import { ListMusic, ChevronRight, Plus, Trash2, X } from 'lucide-react-native';
import { Setlist } from '../services/SetlistService';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#f8fafc',
  accent: '#3b82f6',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  border: '#2d3748',
  danger: '#ef4444',
};

interface SetlistListProps {
  setlists: Setlist[];
  onSetlistPress: (setlist: Setlist) => void;
  onCreatePress: () => void;
  onDeleteSetlist?: (setlist: Setlist) => void;
}

export const SetlistList: React.FC<SetlistListProps> = ({
  setlists,
  onSetlistPress,
  onCreatePress,
  onDeleteSetlist
}) => {
  const [pendingDelete, setPendingDelete] = useState<Setlist | null>(null);

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    onDeleteSetlist?.(pendingDelete);
    setPendingDelete(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Listas</Text>
        <TouchableOpacity style={styles.createButton} onPress={onCreatePress}>
          <Plus size={20} color="#fff" />
          <Text style={styles.createButtonText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {setlists.length === 0 ? (
          <View style={styles.emptyState}>
            <ListMusic size={64} color={COLORS.muted} />
            <Text style={styles.emptyText}>No tienes listas creadas.</Text>
            <Text style={styles.emptySubText}>Sincroniza o crea una nueva lista.</Text>
          </View>
        ) : (
          setlists.map((setlist) => (
            <View key={setlist.id} style={styles.setlistRow}>
              <TouchableOpacity
                style={styles.setlistItem}
                onPress={() => onSetlistPress(setlist)}
                activeOpacity={0.7}
              >
                <View style={styles.setlistIconContainer}>
                  <ListMusic size={22} color={COLORS.accent} />
                </View>
                <View style={styles.setlistInfo}>
                  <Text style={styles.setlistName} numberOfLines={1}>{setlist.name}</Text>
                  <Text style={styles.setlistMeta}>{setlist.songIds.length} canciones</Text>
                </View>
                <ChevronRight size={20} color={COLORS.mutedForeground} />
              </TouchableOpacity>

              {/* Botón eliminar */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => setPendingDelete(setlist)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de Confirmación */}
      <Modal
        visible={!!pendingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Trash2 size={32} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>Eliminar Lista</Text>
            <Text style={styles.modalMessage}>
              ¿Estás seguro de que querés eliminar{' '}
              <Text style={styles.modalHighlight}>"{pendingDelete?.name}"</Text>?
              {'\n'}Esta acción no se puede deshacer.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPendingDelete(null)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmDelete}
              >
                <Trash2 size={16} color="#fff" />
                <Text style={styles.confirmBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    color: COLORS.foreground,
    fontSize: 22,
    fontWeight: 'bold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyText: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginTop: 6,
  },
  setlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  setlistItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  setlistIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${COLORS.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  setlistInfo: {
    flex: 1,
  },
  setlistName: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  setlistMeta: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginTop: 3,
  },
  deleteButton: {
    width: 42,
    height: 42,
    backgroundColor: `${COLORS.danger}15`,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.danger}30`,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.danger}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: COLORS.foreground,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    color: COLORS.mutedForeground,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalHighlight: {
    color: COLORS.foreground,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.muted,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.foreground,
    fontWeight: '600',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: COLORS.danger,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
