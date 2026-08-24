import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Band, BandMember, BandRole, UserProfile } from '../types/band';
import { BandService, UserBandInfo } from '../services/BandService';
import { UserService } from '../services/UserService';

export function useBands() {
  const { user } = useAppContext();
  const [userBandsInfo, setUserBandsInfo] = useState<UserBandInfo[]>([]);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [userRole, setUserRole] = useState<BandRole | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar bandas del usuario
  const loadBands = useCallback(async () => {
    if (!user) {
      setUserBandsInfo([]);
      setSelectedBand(null);
      setUserRole(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userId = user.uid || user.id;
      const bandsInfo = await BandService.getUserBands(userId);
      setUserBandsInfo(bandsInfo);

      if (bandsInfo.length > 0) {
        // Mantener la banda seleccionada previa si sigue existiendo, o seleccionar la primera
        const currentId = selectedBand?.id;
        const matched = currentId ? bandsInfo.find(b => b.band.id === currentId) : null;

        if (matched) {
          setSelectedBand(matched.band);
          setUserRole(matched.role);
        } else {
          setSelectedBand(bandsInfo[0].band);
          setUserRole(bandsInfo[0].role);
        }
      } else {
        setSelectedBand(null);
        setUserRole(null);
      }
    } catch (e: any) {
      console.error('[useBands] Error al cargar bandas:', e);
      setError('No se pudieron cargar las bandas.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedBand?.id]);

  useEffect(() => {
    loadBands();
  }, [user]);

  // Escuchar miembros en tiempo real cuando hay una banda seleccionada
  useEffect(() => {
    if (!selectedBand) {
      setMembers([]);
      return;
    }

    const unsubscribe = BandService.subscribeToBandMembers(selectedBand.id, updatedMembers => {
      setMembers(updatedMembers);
      // Actualizar el rol del usuario si cambió en tiempo real
      const userId = user?.uid || user?.id;
      if (userId) {
        const myMemberDoc = updatedMembers.find(m => m.userId === userId);
        if (myMemberDoc) {
          setUserRole(myMemberDoc.role);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedBand?.id, user]);

  // Seleccionar una banda manualmente
  const selectBand = useCallback((band: Band) => {
    const info = userBandsInfo.find(b => b.band.id === band.id);
    setSelectedBand(band);
    setUserRole(info?.role || null);
  }, [userBandsInfo]);

  // Crear una nueva banda
  const createBand = useCallback(async (name: string, description: string = '') => {
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    setLoading(true);
    try {
      const userProfile: UserProfile = {
        uid: user.uid || user.id,
        email: user.email || '',
        displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuario',
        photoURL: user.user_metadata?.avatar_url || null,
      };

      // Garantizar que el usuario exista en Firestore (users/{uid})
      await UserService.syncUserProfile(userProfile);

      const newBand = await BandService.createBand(name, description, userProfile);
      
      // Recargar lista y seleccionar la nueva banda
      const userId = user.uid || user.id;
      const updatedBands = await BandService.getUserBands(userId);
      setUserBandsInfo(updatedBands);
      setSelectedBand(newBand);
      setUserRole('owner');

      return newBand;
    } catch (e: any) {
      console.error('[useBands] Error al crear banda:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    bands: userBandsInfo.map(b => b.band),
    userBandsInfo,
    selectedBand,
    userRole,
    members,
    loading,
    error,
    selectBand,
    createBand,
    refreshBands: loadBands,
  };
}
