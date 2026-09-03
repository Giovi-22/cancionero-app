import { firestore, auth } from '../lib/firebase';
import { DirectorEvent, DirectorEventType, DirectorSession } from '../types/band';

export class DirectorSessionService {
  private static BANDS_COLLECTION = 'bands';
  private static SESSIONS_COLLECTION = 'sessions';
  private static EVENTS_COLLECTION = 'events';

  /**
   * Crea e inicia una nueva sesión de director para una banda.
   * Ejecuta una transacción atómica para garantizar que exista como máximo una sesión activa.
   */
  static async createSession(
    bandId: string,
    setlistId: string,
    setlistName: string
  ): Promise<DirectorSession> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Usuario no autenticado para crear una sesión de director');
    }

    const directorId = currentUser.uid;
    const directorName = currentUser.displayName || currentUser.email || 'Director';

    const bandRef = firestore().collection(this.BANDS_COLLECTION).doc(bandId);
    const newSessionRef = bandRef.collection(this.SESSIONS_COLLECTION).doc();
    const sessionId = newSessionRef.id;

    const now = new Date().toISOString();

    const newSession: DirectorSession = {
      id: sessionId,
      bandId,
      directorId,
      directorName,
      setlistId,
      setlistName,
      currentSongId: null,
      status: 'active',
      startedAt: now,
      createdAt: now,
    };

    await firestore().runTransaction(async (transaction: any) => {
      const bandDoc = await transaction.get(bandRef);
      if (!bandDoc.exists) {
        throw new Error('La banda especificada no existe.');
      }

      const activeSessionId = bandDoc.data()?.activeSessionId;
      if (activeSessionId) {
        const activeSessRef = bandRef.collection(this.SESSIONS_COLLECTION).doc(activeSessionId);
        const activeSessDoc = await transaction.get(activeSessRef);
        if (activeSessDoc.exists && activeSessDoc.data()?.status === 'active') {
          throw new Error('Ya existe una sesión activa para esta banda.');
        }
      }

      transaction.set(newSessionRef, newSession);
      transaction.update(bandRef, { activeSessionId: sessionId });
    });

    return newSession;
  }

  /**
   * Finaliza una sesión activa de director en la banda.
   * Ejecuta una transacción atómica para cambiar el status a 'ended' y limpiar activeSessionId.
   */
  static async endSession(bandId: string, sessionId: string): Promise<void> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Usuario no autenticado');
    }

    const bandRef = firestore().collection(this.BANDS_COLLECTION).doc(bandId);
    const sessionRef = bandRef.collection(this.SESSIONS_COLLECTION).doc(sessionId);
    const now = new Date().toISOString();

    await firestore().runTransaction(async (transaction: any) => {
      const sessionDoc = await transaction.get(sessionRef);
      if (!sessionDoc.exists) {
        throw new Error('La sesión especificada no existe.');
      }

      const currentStatus = sessionDoc.data()?.status;
      if (currentStatus === 'ended') {
        return; // Ya finalizada
      }

      transaction.update(sessionRef, {
        status: 'ended',
        endedAt: now,
      });
      transaction.update(bandRef, {
        activeSessionId: null,
      });
    });
  }

  /**
   * Actualiza la canción actual en una sesión activa.
   */
  static async updateCurrentSong(
    bandId: string,
    sessionId: string,
    songId: string
  ): Promise<void> {
    const sessionRef = firestore()
      .collection(this.BANDS_COLLECTION)
      .doc(bandId)
      .collection(this.SESSIONS_COLLECTION)
      .doc(sessionId);

    await sessionRef.update({
      currentSongId: songId,
    });
  }

  /**
   * Envía un evento discreto a la subcolección de la sesión.
   * Si el evento es SONG_CHANGED y posee un songId, ejecuta un WriteBatch atómico
   * que crea el documento de evento y actualiza el campo currentSongId de la sesión en una sola transacción/batch.
   */
  static async sendDirectorEvent(
    bandId: string,
    sessionId: string,
    type: DirectorEventType,
    payload?: any
  ): Promise<DirectorEvent> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Usuario no autenticado');
    }

    const sessionRef = firestore()
      .collection(this.BANDS_COLLECTION)
      .doc(bandId)
      .collection(this.SESSIONS_COLLECTION)
      .doc(sessionId);

    const newEventRef = sessionRef.collection(this.EVENTS_COLLECTION).doc();

    const now = new Date().toISOString();
    const eventPayload = payload || {};

    const eventDataDoc = {
      type,
      senderId: currentUser.uid,
      payload: eventPayload,
      timestamp: now,
    };

    const batch = firestore().batch();
    batch.set(newEventRef, eventDataDoc);

    // Si es un cambio de canción, actualizar el estado persistente de la sesión atómicamente en el mismo batch
    if (type === 'SONG_CHANGED' && eventPayload.songId) {
      batch.update(sessionRef, {
        currentSongId: eventPayload.songId,
      });
    }

    await batch.commit();

    return {
      id: newEventRef.id,
      ...eventDataDoc,
    };
  }

  /**
   * Escucha eventos en tiempo real de la sesión activa.
   */
  static subscribeToSessionEvents(
    bandId: string,
    sessionId: string,
    onEvent: (event: DirectorEvent) => void
  ): () => void {
    if (!bandId || !sessionId) {
      return () => { };
    }

    const eventsRef = firestore()
      .collection(this.BANDS_COLLECTION)
      .doc(bandId)
      .collection(this.SESSIONS_COLLECTION)
      .doc(sessionId)
      .collection(this.EVENTS_COLLECTION);

    return eventsRef.onSnapshot((snapshot: any) => {
      if (!snapshot) return;

      snapshot.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const event: DirectorEvent = {
            id: change.doc.id,
            type: data.type,
            senderId: data.senderId,
            payload: data.payload || {},
            timestamp: data.timestamp || '',
          };
          onEvent(event);
        }
      });
    });
  }

  /**
   * Escucha en tiempo real la sesión activa de una banda.
   * Utiliza la referencia explícita a través de bands/{bandId}.activeSessionId como fuente de verdad.
   */
  static subscribeToActiveSession(
    bandId: string,
    onUpdate: (session: DirectorSession | null) => void
  ): () => void {
    if (!bandId) {
      onUpdate(null);
      return () => { };
    }

    const bandRef = firestore().collection(this.BANDS_COLLECTION).doc(bandId);

    let sessionUnsubscribe: (() => void) | null = null;
    let currentObservedSessionId: string | null = null;

    const bandUnsubscribe = bandRef.onSnapshot((bandDoc: any) => {
      if (!bandDoc || !bandDoc.exists) {
        if (sessionUnsubscribe) {
          sessionUnsubscribe();
          sessionUnsubscribe = null;
        }
        currentObservedSessionId = null;
        onUpdate(null);
        return;
      }

      const activeSessionId = bandDoc.data()?.activeSessionId;

      if (!activeSessionId) {
        if (sessionUnsubscribe) {
          sessionUnsubscribe();
          sessionUnsubscribe = null;
        }
        currentObservedSessionId = null;
        onUpdate(null);
        return;
      }

      // Si cambió el ID de la sesión activa, cambiar la suscripción
      if (activeSessionId !== currentObservedSessionId) {
        if (sessionUnsubscribe) {
          sessionUnsubscribe();
        }

        currentObservedSessionId = activeSessionId;
        const sessionRef = bandRef.collection(this.SESSIONS_COLLECTION).doc(activeSessionId);

        sessionUnsubscribe = sessionRef.onSnapshot((sessDoc: any) => {
          if (!sessDoc || !sessDoc.exists) {
            onUpdate(null);
            return;
          }

          const data = sessDoc.data();
          if (data?.status === 'active') {
            const session: DirectorSession = {
              id: sessDoc.id,
              bandId: data.bandId ?? bandId,
              directorId: data.directorId ?? '',
              directorName: data.directorName ?? '',
              setlistId: data.setlistId ?? '',
              setlistName: data.setlistName ?? '',
              currentSongId: data.currentSongId ?? null,
              status: data.status,
              startedAt: data.startedAt ?? '',
              createdAt: data.createdAt ?? '',
              endedAt: data.endedAt ?? null,
            };
            onUpdate(session);
          } else {
            onUpdate(null);
          }
        });
      }
    });

    return () => {
      if (bandUnsubscribe) bandUnsubscribe();
      if (sessionUnsubscribe) sessionUnsubscribe();
    };
  }
}
