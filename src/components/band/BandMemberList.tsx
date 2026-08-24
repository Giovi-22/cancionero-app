import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { User, Crown, Radio, Shield } from 'lucide-react-native';
import { BandMember, BandRole } from '../../types/band';
import { COLORS } from '../../constants/theme';

interface BandMemberListProps {
  members: BandMember[];
}

export const BandMemberList: React.FC<BandMemberListProps> = ({ members }) => {
  const getRoleBadge = (role: BandRole) => {
    switch (role) {
      case 'owner':
        return (
          <View style={[styles.badge, styles.ownerBadge]}>
            <Crown size={12} color="#f59e0b" />
            <Text style={[styles.badgeText, { color: '#f59e0b' }]}>OWNER</Text>
          </View>
        );
      case 'director':
        return (
          <View style={[styles.badge, styles.directorBadge]}>
            <Radio size={12} color="#a855f7" />
            <Text style={[styles.badgeText, { color: '#a855f7' }]}>DIRECTOR</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.memberBadge]}>
            <Shield size={12} color={COLORS.mutedForeground} />
            <Text style={[styles.badgeText, { color: COLORS.mutedForeground }]}>MIEMBRO</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Miembros ({members.length})</Text>
      {members.map(member => (
        <View key={member.userId} style={styles.memberCard}>
          <View style={styles.avatarContainer}>
            {member.photoURL ? (
              <Image source={{ uri: member.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={18} color={COLORS.mutedForeground} />
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {member.displayName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {member.email}
            </Text>
          </View>

          <View style={styles.roleContainer}>{getRoleBadge(member.role)}</View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  sectionTitle: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  email: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  roleContainer: {
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  ownerBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  directorBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  memberBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: COLORS.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
