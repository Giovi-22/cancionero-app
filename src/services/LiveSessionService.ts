import { supabase } from '../lib/supabase';

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

  static async fetchLiveSessions(): Promise<LiveSession[]> {
    try {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as LiveSession[]) || [];
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
      if (existingSessionId) {
        const { data } = await supabase
          .from('live_sessions')
          .update({
            setlist_id: setlistId,
            setlist_name: setlistName,
            status: 'live',
            started_at: new Date().toISOString(),
          })
          .eq('id', existingSessionId)
          .select()
          .single();
        return data as LiveSession | null;
      }

      const { data } = await supabase
        .from('live_sessions')
        .insert({
          setlist_id: setlistId,
          setlist_name: setlistName,
          director_email: userEmail,
          director_name: userName,
          status: 'live',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      return data as LiveSession | null;
    } catch (e) {
      console.error('LiveSessionService.startShow:', e);
      return null;
    }
  }

  static async endShow(sessionId: string): Promise<void> {
    try {
      await supabase.from('live_sessions').delete().eq('id', sessionId);
    } catch (e) {
      console.error('LiveSessionService.endShow:', e);
    }
  }

  static async updateCurrentSong(sessionId: string, songId: string): Promise<void> {
    try {
      await supabase
        .from('live_sessions')
        .update({ current_song_id: songId })
        .eq('id', sessionId);
    } catch (e) {
      console.warn('LiveSessionService.updateCurrentSong (offline?):', e);
    }
  }

  /**
   * Suscribirse a cambios de canción de una sesión.
   * Devuelve una función para cancelar la suscripción.
   */
  static subscribeToSession(
    sessionId: string,
    onSongChange: (newSongId: string) => void
  ): () => void {
    const channel = supabase
      .channel(`live_follow_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newSongId = payload.new?.current_song_id;
          if (newSongId) onSongChange(newSongId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Suscribirse a TODAS las sesiones live (para el banner del Home).
   * Devuelve función para cancelar.
   */
  static subscribeToAllSessions(
    onUpdate: (sessions: LiveSession[]) => void
  ): () => void {
    const channel = supabase
      .channel('live_sessions_global_mobile')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        async () => {
          const sessions = await this.fetchLiveSessions();
          onUpdate(sessions);
        }
      )
      .subscribe();

    // Fetch inicial
    this.fetchLiveSessions().then(onUpdate);

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
