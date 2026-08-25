import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { DirectorSession } from '../types/band';
import { DirectorSessionService } from '../services/DirectorSessionService';

export function useDirectorSession(bandId: string | null) {
  const { user } = useAppContext();
  const [activeSession, setActiveSession] = useState<DirectorSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.uid || user?.id;

  const isDirectorOfSession = useMemo(() => {
    if (!activeSession || !userId) return false;
    return activeSession.directorId === userId;
  }, [activeSession, userId]);

  useEffect(() => {
    if (!bandId) {
      setActiveSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = DirectorSessionService.subscribeToActiveSession(
      bandId,
      (session) => {
        setActiveSession(session);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [bandId]);

  const startSession = useCallback(
    async (setlistId: string, setlistName: string) => {
      if (!bandId) {
        throw new Error('No hay banda seleccionada');
      }

      setLoading(true);
      setError(null);
      try {
        const session = await DirectorSessionService.createSession(
          bandId,
          setlistId,
          setlistName
        );
        return session;
      } catch (e: any) {
        console.error('[useDirectorSession] Error al iniciar sesión:', e);
        setError(e.message || 'Error al iniciar la sesión de director');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [bandId]
  );

  const endSession = useCallback(async () => {
    if (!bandId || !activeSession) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await DirectorSessionService.endSession(bandId, activeSession.id);
    } catch (e: any) {
      console.error('[useDirectorSession] Error al finalizar sesión:', e);
      setError(e.message || 'Error al finalizar la sesión');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [bandId, activeSession]);

  const updateCurrentSong = useCallback(
    async (songId: string) => {
      if (!bandId || !activeSession) {
        return;
      }

      try {
        await DirectorSessionService.updateCurrentSong(bandId, activeSession.id, songId);
      } catch (e: any) {
        console.error('[useDirectorSession] Error al actualizar canción:', e);
        setError(e.message || 'Error al actualizar canción actual');
      }
    },
    [bandId, activeSession]
  );

  return {
    activeSession,
    isDirectorOfSession,
    loading,
    error,
    startSession,
    endSession,
    updateCurrentSong,
  };
}
