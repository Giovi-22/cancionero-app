import { useState, useEffect, useCallback, useMemo } from 'react';
import { DirectorSession, DirectorEvent, DirectorEventType } from '../types/band';
import { DirectorSessionService } from '../services/DirectorSessionService';
import { useUserContext } from '../context/UserContext';

export function useDirectorSession(bandId: string | null) {
  const { user } = useUserContext();
  const [activeSession, setActiveSession] = useState<DirectorSession | null>(null);
  const [latestEvent, setLatestEvent] = useState<DirectorEvent | null>(null);
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

  useEffect(() => {
    if (!bandId || !activeSession) {
      setLatestEvent(null);
      return;
    }

    const unsubEvents = DirectorSessionService.subscribeToSessionEvents(
      bandId,
      activeSession.id,
      (event) => {
        // Ignorar eventos emitidos por el propio usuario para evitar bucles Director -> Firebase -> Director
        if (event.senderId === userId) return;
        setLatestEvent(event);
      }
    );

    return () => {
      unsubEvents();
    };
  }, [bandId, activeSession?.id, userId]);

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

  const sendEvent = useCallback(
    async (type: DirectorEventType, payload?: any) => {
      if (!bandId || !activeSession) return;
      try {
        await DirectorSessionService.sendDirectorEvent(bandId, activeSession.id, type, payload);
      } catch (e: any) {
        console.error('[useDirectorSession] Error enviando evento:', e);
      }
    },
    [bandId, activeSession?.id]
  );

  return {
    activeSession,
    isDirectorOfSession,
    latestEvent,
    loading,
    error,
    startSession,
    endSession,
    updateCurrentSong,
    sendEvent,
  };
}
