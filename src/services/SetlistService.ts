import { supabase } from '../lib/supabase';
import { StorageService } from './StorageService';

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  isPublic?: boolean;
}

export class SetlistService {
  private static instance: SetlistService;

  private constructor() {}

  public static getInstance(): SetlistService {
    if (!SetlistService.instance) {
      SetlistService.instance = new SetlistService();
    }
    return SetlistService.instance;
  }

  public async getSetlists(userEmail?: string): Promise<Setlist[]> {
    // 1. Try local first
    let localSetlists = await StorageService.getAllSetlists();

    // 2. If logged in, sync with cloud
    if (userEmail) {
      try {
        const { data, error } = await supabase
          .from('setlists')
          .select('*')
          .eq('user_email', userEmail);

        if (!error && data) {
          const cloudSetlists: Setlist[] = data.map(s => ({
            id: s.id,
            name: s.name,
            songIds: s.song_ids,
            isPublic: s.is_public
          }));

          // Simple sync: overwrite local with cloud for now
          await StorageService.saveSetlists(cloudSetlists);
          return cloudSetlists;
        }
      } catch (e) {
        console.error('Failed to sync setlists:', e);
      }
    }

    return localSetlists;
  }

  public async createSetlist(name: string, userEmail?: string): Promise<Setlist> {
    const newSetlist: Setlist = {
      id: Date.now().toString(),
      name,
      songIds: [],
    };

    if (userEmail) {
      const { data, error } = await supabase
        .from('setlists')
        .insert({
          user_email: userEmail,
          name: newSetlist.name,
          song_ids: newSetlist.songIds,
          is_public: false
        })
        .select()
        .single();

      if (!error && data) {
        const created = {
          id: data.id,
          name: data.name,
          songIds: data.song_ids,
          isPublic: data.is_public
        };
        await StorageService.saveSetlists([created]);
        return created;
      }
    }

    await StorageService.saveSetlists([newSetlist]);
    return newSetlist;
  }

  public async updateSetlist(setlist: Setlist, userEmail?: string) {
    await StorageService.saveSetlists([setlist]);

    if (userEmail && setlist.id.includes('-')) {
      await supabase
        .from('setlists')
        .update({
          name: setlist.name,
          song_ids: setlist.songIds,
          is_public: !!setlist.isPublic,
          updated_at: new Date().toISOString()
        })
        .eq('id', setlist.id);
    }
  }

  public async deleteSetlist(id: string, userEmail?: string) {
    await StorageService.deleteSetlistLocal(id);

    if (userEmail && id.includes('-')) {
      await supabase.from('setlists').delete().eq('id', id);
    }
  }
}

export const setlistService = SetlistService.getInstance();
