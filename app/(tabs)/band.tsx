import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Plus,
  Radio,
  ListMusic,
  UserPlus,
  ChevronRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import { useBands } from '../../src/hooks/useBands';
import { COLORS } from '../../src/constants/theme';
import { CreateBandModal } from '../../src/components/band/CreateBandModal';
import { BandMemberList } from '../../src/components/band/BandMemberList';

export default function BandScreen() {
  const insets = useSafeAreaInsets();
  const {
    bands,
    selectedBand,
    userRole,
    members,
    loading,
    selectBand,
    createBand,
  } = useBands();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const isLeader = userRole === 'owner' || userRole === 'director';

  const handleCreateBand = async (name: string, description: string) => {
    await createBand(name, description);
  };

  const handleUnirseClick = () => {
    Alert.alert(
      'Unirse a una banda',
      'Las invitaciones a bandas aparecerán aquí cuando estén disponibles.'
    );
  };

  const handleDirectorClick = () => {
    if (!isLeader) {
      Alert.alert('Acceso restringido', 'Únicamente el Director u Owner de la banda puede iniciar Director Mode.');
      return;
    }
    Alert.alert('Director Mode', 'Sesión de Director lista para la Fase 5.');
  };

  const handleRepertorioClick = () => {
    Alert.alert('Repertorio de la Banda', 'El repertorio compartido estará disponible en las siguientes fases.');
  };

  const handleInviteClick = () => {
    if (!isLeader) {
      Alert.alert('Acceso restringido', 'Únicamente los administradores pueden enviar invitaciones.');
      return;
    }
    Alert.alert('Invitar miembro', 'El módulo de invitaciones se activará en la Fase 3.');
  };

  if (loading && bands.length === 0) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Cargando bandas...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Users color={COLORS.accent} size={24} />
          <Text style={styles.headerTitle}>Banda</Text>
        </View>

        {bands.length > 0 && (
          <TouchableOpacity
            style={styles.addSmallBtn}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Plus color={COLORS.foreground} size={18} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ESTADO 1: USUARIO SIN BANDAS */}
        {bands.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Users size={36} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>Tu Banda</Text>
            <Text style={styles.emptySubtitle}>
              Todavía no pertenecés a ninguna banda. Creá tu propio grupo o unite
              mediante una invitación.
            </Text>

            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setIsCreateModalOpen(true)}
              >
                <Plus size={18} color="#000" />
                <Text style={styles.primaryBtnText}>Crear banda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleUnirseClick}
              >
                <UserPlus size={18} color={COLORS.foreground} />
                <Text style={styles.secondaryBtnText}>Unirse con invitación</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ESTADO 2: USUARIO CON BANDAS */
          <View>
            {/* Selector de Bandas (Si tiene más de 1) */}
            {bands.length > 1 && (
              <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Mis Bandas</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {bands.map(b => {
                    const isSelected = selectedBand?.id === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => selectBand(b)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {b.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Tarjeta de la Banda Seleccionada */}
            {selectedBand && (
              <View style={styles.bandCard}>
                <View style={styles.bandHeader}>
                  <View style={styles.bandBadgeRow}>
                    <Sparkles size={16} color={COLORS.accent} />
                    <Text style={styles.bandBadgeText}>
                      ROL: {userRole?.toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.bandName}>{selectedBand.name}</Text>
                  {selectedBand.description ? (
                    <Text style={styles.bandDesc}>{selectedBand.description}</Text>
                  ) : null}
                </View>

                {/* Secciones de Funcionalidades */}
                <View style={styles.actionsGrid}>
                  {/* Director Mode */}
                  <TouchableOpacity
                    style={[
                      styles.actionCard,
                      isLeader ? styles.actionCardActive : styles.actionCardDisabled,
                    ]}
                    onPress={handleDirectorClick}
                  >
                    <View style={styles.actionIconCircle}>
                      <Radio size={20} color={isLeader ? COLORS.accent : COLORS.mutedForeground} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={styles.actionTitle}>Director Mode</Text>
                      <Text style={styles.actionSubtitle}>
                        {isLeader ? 'Iniciar o controlar sesión' : 'Solo administradores'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={COLORS.mutedForeground} />
                  </TouchableOpacity>

                  {/* Repertorio */}
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={handleRepertorioClick}
                  >
                    <View style={styles.actionIconCircle}>
                      <ListMusic size={20} color="#3b82f6" />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={styles.actionTitle}>Repertorio Compartido</Text>
                      <Text style={styles.actionSubtitle}>Listas de la banda</Text>
                    </View>
                    <ChevronRight size={18} color={COLORS.mutedForeground} />
                  </TouchableOpacity>

                  {/* Invitar Miembros (Solamente para líderes) */}
                  {isLeader && (
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={handleInviteClick}
                    >
                      <View style={styles.actionIconCircle}>
                        <UserPlus size={20} color="#10b981" />
                      </View>
                      <View style={styles.actionInfo}>
                        <Text style={styles.actionTitle}>Invitar Miembro</Text>
                        <Text style={styles.actionSubtitle}>Enviar invitación por email</Text>
                      </View>
                      <ChevronRight size={18} color={COLORS.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Lista de Miembros */}
                <BandMemberList members={members} />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal para Crear Banda */}
      <CreateBandModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateBand}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: COLORS.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
  addSmallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.foreground,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtnText: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  bandCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bandHeader: {
    marginBottom: 20,
  },
  bandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  bandBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bandName: {
    color: COLORS.foreground,
    fontSize: 24,
    fontWeight: '800',
  },
  bandDesc: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    marginTop: 4,
  },
  actionsGrid: {
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionCardActive: {
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
});
