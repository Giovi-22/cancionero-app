import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Band, Invitation, UserProfile } from '../types/band';
import { InvitationService } from '../services/InvitationService';
import { UserService } from '../services/UserService';

export function useBandInvitations() {
  const { user } = useAppContext();
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userEmail = user?.email || user?.user_metadata?.email || '';

  // Escuchar invitaciones pendientes en tiempo real para el correo del usuario
  useEffect(() => {
    if (!userEmail) {
      setPendingInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = InvitationService.subscribeToPendingInvitations(
      userEmail,
      invitations => {
        setPendingInvitations(invitations);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userEmail]);

  // Enviar una invitación
  const sendInvitation = useCallback(
    async (band: Band, invitedEmail: string, role: 'member' | 'director') => {
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const inviterProfile: UserProfile = {
        uid: user.uid || user.id,
        email: user.email || '',
        displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuario',
        photoURL: user.user_metadata?.avatar_url || null,
      };

      return await InvitationService.createInvitation(band, inviterProfile, invitedEmail, role);
    },
    [user]
  );

  // Aceptar una invitación
  const acceptInvitation = useCallback(
    async (invitationId: string) => {
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      setLoading(true);
      setError(null);
      try {
        const userProfile: UserProfile = {
          uid: user.uid || user.id,
          email: user.email || '',
          displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuario',
          photoURL: user.user_metadata?.avatar_url || null,
        };

        // Garantizar que el usuario exista en Firestore (users/{uid})
        await UserService.syncUserProfile(userProfile);

        await InvitationService.acceptInvitation(invitationId, userProfile);
      } catch (err: any) {
        console.error('[useBandInvitations] Error al aceptar invitación:', err);
        setError(err.message || 'No se pudo aceptar la invitación');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  // Rechazar una invitación
  const rejectInvitation = useCallback(
    async (invitationId: string) => {
      if (!userEmail) {
        throw new Error('Usuario no autenticado');
      }

      setLoading(true);
      setError(null);
      try {
        await InvitationService.rejectInvitation(invitationId, userEmail);
      } catch (err: any) {
        console.error('[useBandInvitations] Error al rechazar invitación:', err);
        setError(err.message || 'No se pudo rechazar la invitación');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userEmail]
  );

  // Cancelar una invitación emitida
  const cancelInvitation = useCallback(async (invitationId: string) => {
    try {
      await InvitationService.cancelInvitation(invitationId);
    } catch (err: any) {
      console.error('[useBandInvitations] Error al cancelar invitación:', err);
      throw err;
    }
  }, []);

  return {
    pendingInvitations,
    loading,
    error,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
  };
}
