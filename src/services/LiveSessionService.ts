import { firestore } from '../lib/firebase';

export interface LiveSession {
  id: string;
  setlist_id: string;
  setlist_name: string;
  director_email: string;
  director_name: string;
  current_song_id: string | null;
  status: 'scheduled' | 'live';
  started_at: string | null;
  created_at: string;
}

export class LiveSessionService {
  private static COLLECTION = 'live_sessions';

  static async fetchLiveSessions(): Promise<LiveSession[]> {
    try {
      const snapshot = await firestore()
        .collection(this.COLLECTION)
        .where('status', '==', 'live')
        .get();

      const sessions: LiveSession[] = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          setlist_id: data.setlist_id ?? '',
          setlist_name: data.setlist_name ?? '',
          director_email: data.director_email ?? '',
          director_name: data.director_name ?? '',
          current_song_id: data.current_song_id ?? null,
          status: data.status ?? 'live',
          started_at: data.started_at ?? null,
          created_at: data.created_at ?? new Date().toISOString(),
        };
      });

      return sessions;
    } catch (e) {
      console.warn('LiveSessionService.fetchLiveSessions:', e);
      return [];
    }
  }

  static async startShow(
    setlistId: string,
    setlistName: string,
    userEmail: string,
    userName: string,
    existingSessionId?: string
  ): Promise<LiveSession | null> {
    try {
      const now = new Date().toISOString();

      if (existingSessionId) {
        await firestore()
          .collection(this.COLLECTION)
          .doc(existingSessionId)
          .update({
            setlist_id: setlistId,
            setlist_name: setlistName,
            status: 'live',
            started_at: now,
          });

        const doc = await firestore().collection(this.COLLECTION).doc(existingSessionId).get();
        const data = doc.data();
        return {
          id: doc.id,
          setlist_id: data?.setlist_id ?? setlistId,
          setlist_name: data?.setlist_name ?? setlistName,
          director_email: data?.director_email ?? userEmail,
          director_name: data?.director_name ?? userName,
          current_song_id: data?.current_song_id ?? null,
          status: 'live',
          started_at: now,
          created_at: data?.created_at ?? now,
        };
      }

      const docRef = await firestore().collection(this.COLLECTION).add({
        setlist_id: setlistId,
        setlist_name: setlistName,
        director_email: userEmail,
        director_name: userName,
        current_song_id: null,
        status: 'live',
        started_at: now,
        created_at: now,
      });

      return {
        id: docRef.id,
        setlist_id: setlistId,
        setlist_name: setlistName,
        director_email: userEmail,
        director_name: userName,
        current_song_id: null,
        status: 'live',
        started_at: now,
        created_at: now,
      };
    } catch (e) {
      console.error('LiveSessionService.startShow:', e);
      return null;
    }
  }

  static async endShow(sessionId: string): Promise<void> {
    try {
      await firestore().collection(this.COLLECTION).doc(sessionId).delete();
    } catch (e) {
      console.error('LiveSessionService.endShow:', e);
    }
  }

  static async updateCurrentSong(sessionId: string, songId: string): Promise<void> {
    try {
      await firestore()
        .collection(this.COLLECTION)
        .doc(sessionId)
        .update({ current_song_id: songId });
    } catch (e) {
      console.warn('LiveSessionService.updateCurrentSong (offline?):', e);
    }
  }

  /**
   * Suscribirse a cambios de canción de una sesión.
   */
  static subscribeToSession(
    sessionId: string,
    onSongChange: (newSongId: string) => void
  ): () => void {
    return firestore()
      .collection(this.COLLECTION)
      .doc(sessionId)
      .onSnapshot((doc: any) => {
        const data = doc.data();
        if (data?.current_song_id) {
          onSongChange(data.current_song_id);
        }
      });
  }

  /**
   * Suscribirse a TODAS las sesiones live (para el banner del Home).
   */
  static subscribeToAllSessions(
    onUpdate: (sessions: LiveSession[]) => void
  ): () => void {
    return firestore()
      .collection(this.COLLECTION)
      .where('status', '==', 'live')
      .onSnapshot((snapshot: any) => {
        if (!snapshot) return;
        const sessions: LiveSession[] = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            setlist_id: data.setlist_id ?? '',
            setlist_name: data.setlist_name ?? '',
            director_email: data.director_email ?? '',
            director_name: data.director_name ?? '',
            current_song_id: data.current_song_id ?? null,
            status: data.status ?? 'live',
            started_at: data.started_at ?? null,
            created_at: data.created_at ?? new Date().toISOString(),
          };
        });
        onUpdate(sessions);
      });
  }
}
