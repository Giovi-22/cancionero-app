import { BandRole } from '../types/band';

export interface BandPermissions {
  canEditBand: boolean;
  canDeleteBand: boolean;
  canManageMembers: boolean;
  canInviteMembers: boolean;
  canChangeMemberRole: boolean;
  canRemoveMembers: boolean;
  canCreateDirectorSession: boolean;
  canControlDirectorSession: boolean;
  canManageSetlists: boolean;
}

/**
 * Mapea explícitamente el rol del usuario en una banda a un conjunto granular de permisos.
 * Garantiza que ROLE -> PERMISSIONS -> FEATURES coincida con las Firestore Security Rules.
 */
export function getBandPermissions(role: BandRole | null): BandPermissions {
  switch (role) {
    case 'owner':
      return {
        canEditBand: true,
        canDeleteBand: true,
        canManageMembers: true,
        canInviteMembers: true,
        canChangeMemberRole: true,
        canRemoveMembers: true,
        canCreateDirectorSession: true,
        canControlDirectorSession: true,
        canManageSetlists: true,
      };
    case 'director':
      return {
        canEditBand: false,
        canDeleteBand: false,
        canManageMembers: false,
        canInviteMembers: false,
        canChangeMemberRole: false,
        canRemoveMembers: false,
        canCreateDirectorSession: true,
        canControlDirectorSession: true,
        canManageSetlists: true,
      };
    case 'member':
    default:
      return {
        canEditBand: false,
        canDeleteBand: false,
        canManageMembers: false,
        canInviteMembers: false,
        canChangeMemberRole: false,
        canRemoveMembers: false,
        canCreateDirectorSession: false,
        canControlDirectorSession: false,
        canManageSetlists: false,
      };
  }
}
