import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Band, Invitation, UserProfile } from '../types/band';
import { InvitationService } from '../services/InvitationService';
import { UserService } from '../services/UserService';

type BandRole = 'owner' | 'director' | 'member';

export function useBandInvitations(
  bandId?: string | null,
  bandRole?: BandRole | null
) {
  const { user } = useAppContext();

  // Invitaciones que recibió el usuario
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);

  // Invitaciones que fueron enviadas desde la banda seleccionada
  const [sentPendingInvitations, setSentPendingInvitations] = useState<Invitation[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userEmail = user?.email || user?.user_metadata?.email || '';

  // ============================================================
  // INVITACIONES RECIBIDAS
  // ============================================================

  useEffect(() => {
    if (!userEmail) {
      setPendingInvitations([]);
      return;
    }

    setLoading(true);

    const unsubscribe =
      InvitationService.subscribeToPendingInvitations(
        userEmail,
        invitations => {
          setPendingInvitations(invitations);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [userEmail]);

  // ============================================================
  // INVITACIONES ENVIADAS POR LA BANDA
  // ============================================================

  useEffect(() => {
    // Solo Owner y Director pueden consultar
    // las invitaciones administrativas de una banda.
    const canManageInvitations =
      bandRole === 'owner' ||
      bandRole === 'director';

    if (!bandId || !canManageInvitations) {
      setSentPendingInvitations([]);
      return;
    }

    const unsubscribe =
      InvitationService.subscribeToPendingBandInvitations(
        bandId,
        invitations => {
          setSentPendingInvitations(invitations);
          setError(null);
        },
        error => {
          console.error(
            '[useBandInvitations] Error sincronizando invitaciones enviadas:',
            error
          );

          setError(
            error.message ||
            'No se pudieron sincronizar las invitaciones enviadas.'
          );
        }
      );

    return () => unsubscribe();
  }, [bandId, bandRole]);

  // ============================================================
  // ENVIAR INVITACIÓN
  // ============================================================

  const sendInvitation = useCallback(
    async (
      band: Band,
      invitedEmail: string,
      role: 'member' | 'director'
    ) => {
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const inviterProfile: UserProfile = {
        uid: user.uid || user.id,
        email: user.email || '',
        displayName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          'Usuario',
        photoURL: user.user_metadata?.avatar_url || null,
      };

      return await InvitationService.createInvitation(
        band,
        inviterProfile,
        invitedEmail,
        role
      );
    },
    [user]
  );

  // ============================================================
  // ACEPTAR INVITACIÓN
  // ============================================================

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
          displayName:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email ||
            'Usuario',
          photoURL: user.user_metadata?.avatar_url || null,
        };

        console.log('[useBandInvitations] Aceptando invitación:', {
          invitationId,
          uid: userProfile.uid,
          email: userProfile.email,
        });

        console.log('[useBandInvitations] Sincronizando perfil...');

        await UserService.syncUserProfile(userProfile);

        console.log(
          '[useBandInvitations] Perfil sincronizado. Llamando a InvitationService...'
        );

        await InvitationService.acceptInvitation(
          invitationId,
          userProfile
        );

        console.log(
          '[useBandInvitations] ✅ Invitación aceptada correctamente.'
        );
      } catch (err: any) {
        console.error(
          '[useBandInvitations] Error al aceptar invitación:',
          err
        );

        setError(
          err.message || 'No se pudo aceptar la invitación'
        );

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  // ============================================================
  // RECHAZAR INVITACIÓN
  // ============================================================

  const rejectInvitation = useCallback(
    async (invitationId: string) => {
      if (!userEmail) {
        throw new Error('Usuario no autenticado');
      }

      setLoading(true);
      setError(null);

      try {
        await InvitationService.rejectInvitation(
          invitationId,
          userEmail
        );
      } catch (err: any) {
        console.error(
          '[useBandInvitations] Error al rechazar invitación:',
          err
        );

        setError(
          err.message || 'No se pudo rechazar la invitación'
        );

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userEmail]
  );

  // ============================================================
  // CANCELAR INVITACIÓN ENVIADA
  // ============================================================

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await InvitationService.cancelInvitation(invitationId);
      } catch (err: any) {
        console.error(
          '[useBandInvitations] Error al cancelar invitación:',
          err
        );

        throw err;
      }
    },
    []
  );

  return {
    // Recibidas
    pendingInvitations,

    // Enviadas por la banda seleccionada
    sentPendingInvitations,

    loading,
    error,

    sendInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
  };
}