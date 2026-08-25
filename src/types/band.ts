export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type BandRole = 'owner' | 'director' | 'member';

export interface BandMember {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: BandRole;
  invitationId?: string;
  joinedAt: string;
}

export interface Band {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface Invitation {
  id: string;
  bandId: string;
  bandName: string;
  invitedEmail: string;
  invitedUserId?: string | null;
  invitedByUserId: string;
  invitedByName: string;
  role: BandRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

export type DirectorSessionStatus = 'active' | 'ended';

export interface DirectorSession {
  id: string;
  bandId: string;
  directorId: string;
  directorName: string;
  setlistId: string;
  setlistName: string;
  currentSongId: string | null;
  status: DirectorSessionStatus;
  startedAt: string;
  endedAt?: string | null;
}
