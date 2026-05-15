import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { ListMusic, ChevronRight, Plus } from 'lucide-react-native';
import { Setlist } from '../services/SetlistService';

const COLORS = {
  background: '#020617',
  foreground: '#f8fafc',
  accent: '#8b5cf6',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
};

interface SetlistListProps {
  setlists: Setlist[];
  onSetlistPress: (setlist: Setlist) => void;
  onCreatePress: () => void;
}

export const SetlistList: React.FC<SetlistListProps> = ({ setlists, onSetlistPress, onCreatePress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Listas</Text>
        <TouchableOpacity style={styles.createButton} onPress={onCreatePress}>
          <Plus size={20} color={COLORS.foreground} />
          <Text style={styles.createButtonText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {setlists.length === 0 ? (
          <View style={styles.emptyState}>
            <ListMusic size={64} color={COLORS.muted} />
            <Text style={styles.emptyText}>No tienes listas creadas.</Text>
          </View>
        ) : (
          setlists.map((setlist) => (
            <TouchableOpacity 
              key={setlist.id} 
              style={styles.setlistItem}
              onPress={() => onSetlistPress(setlist)}
            >
              <View style={styles.setlistInfo}>
                <Text style={styles.setlistName}>{setlist.name}</Text>
                <Text style={styles.setlistMeta}>{setlist.songIds.length} canciones</Text>
              </View>
              <ChevronRight size={20} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  createButtonText: {
    color: COLORS.foreground,
    fontWeight: '600',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: COLORS.mutedForeground,
    fontSize: 16,
    marginTop: 20,
  },
  setlistItem: {
    backgroundColor: COLORS.muted,
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  setlistInfo: {
    flex: 1,
  },
  setlistName: {
    color: COLORS.foreground,
    fontSize: 17,
    fontWeight: '600',
  },
  setlistMeta: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginTop: 4,
  },
});
