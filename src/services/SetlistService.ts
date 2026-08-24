import { firestore } from '../lib/firebase';
import { StorageService } from './StorageService';

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  isPublic?: boolean;
}

export class SetlistService {
  private static instance: SetlistService;
  private static COLLECTION = 'setlists';

  private constructor() {}

  public static getInstance(): SetlistService {
    if (!SetlistService.instance) {
      SetlistService.instance = new SetlistService();
    }
    return SetlistService.instance;
  }

  public async getSetlists(userEmail?: string): Promise<Setlist[]> {
    let localSetlists = await StorageService.getAllSetlists();

    if (userEmail) {
      try {
        const snapshot = await firestore()
          .collection(SetlistService.COLLECTION)
          .where('user_email', '==', userEmail)
          .get();

        if (!snapshot.empty) {
          const cloudSetlists: Setlist[] = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              songIds: data.song_ids || [],
              isPublic: data.is_public ?? false
            };
          });

          for (const s of cloudSetlists) {
            await StorageService.saveSetlist(s);
          }
          return cloudSetlists;
        }
      } catch (e) {
        console.error('Failed to sync setlists with Firestore:', e);
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
      try {
        const docRef = await firestore().collection(SetlistService.COLLECTION).add({
          user_email: userEmail,
          name: newSetlist.name,
          song_ids: newSetlist.songIds,
          is_public: false,
          created_at: new Date().toISOString()
        });

        const created: Setlist = {
          id: docRef.id,
          name: newSetlist.name,
          songIds: newSetlist.songIds,
          isPublic: false
        };

        await StorageService.saveSetlist(created);
        return created;
      } catch (e) {
        console.error('Failed to create setlist in Firestore:', e);
      }
    }

    await StorageService.saveSetlist(newSetlist);
    return newSetlist;
  }

  public async updateSetlist(setlist: Setlist, userEmail?: string) {
    await StorageService.saveSetlist(setlist);

    if (userEmail && setlist.id) {
      try {
        await firestore()
          .collection(SetlistService.COLLECTION)
          .doc(setlist.id)
          .set({
            user_email: userEmail,
            name: setlist.name,
            song_ids: setlist.songIds,
            is_public: !!setlist.isPublic,
            updated_at: new Date().toISOString()
          }, { merge: true });
      } catch (e) {
        console.error('Failed to update setlist in Firestore:', e);
      }
    }
  }

  public async deleteSetlist(id: string, userEmail?: string) {
    await StorageService.deleteSetlistLocal(id);

    if (userEmail && id) {
      try {
        await firestore().collection(SetlistService.COLLECTION).doc(id).delete();
      } catch (e) {
        console.error('Failed to delete setlist in Firestore:', e);
      }
    }
  }
}

export const setlistService = SetlistService.getInstance();
