import { firestore, auth } from '../lib/firebase';
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

  /**
   * Obtiene los setlists del usuario.
   * Primero intenta sincronizar desde Firestore usando user_id (UID de Firebase Auth).
   * Si no hay usuario autenticado, devuelve solamente los setlists locales.
   * El usuario NO necesita pertenecer a ninguna banda para usar esta funcionalidad.
   */
  public async getSetlists(): Promise<Setlist[]> {
    const localSetlists = await StorageService.getAllSetlists();

    const user = auth().currentUser;
    if (user) {
      try {
        const snapshot = await firestore()
          .collection(SetlistService.COLLECTION)
          .where('user_id', '==', user.uid)
          .get();

        if (!snapshot.empty) {
          const cloudSetlists: Setlist[] = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              songIds: data.song_ids || [],
              isPublic: data.is_public ?? false,
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

  /**
   * Crea un nuevo setlist.
   * Si hay usuario autenticado, también lo persiste en Firestore con user_id = auth.uid.
   * No requiere pertenencia a ninguna banda.
   */
  public async createSetlist(name: string): Promise<Setlist> {
    const newSetlist: Setlist = {
      id: Date.now().toString(),
      name,
      songIds: [],
    };

    const user = auth().currentUser;
    if (user) {
      try {
        const docRef = await firestore()
          .collection(SetlistService.COLLECTION)
          .add({
            user_id: user.uid,
            name: newSetlist.name,
            song_ids: newSetlist.songIds,
            is_public: false,
            created_at: new Date().toISOString(),
          });

        const created: Setlist = {
          id: docRef.id,
          name: newSetlist.name,
          songIds: newSetlist.songIds,
          isPublic: false,
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

  /**
   * Actualiza un setlist existente.
   * Si hay usuario autenticado, sincroniza con Firestore manteniendo user_id intacto.
   */
  public async updateSetlist(setlist: Setlist) {
    await StorageService.saveSetlist(setlist);

    const user = auth().currentUser;
    if (user && setlist.id) {
      try {
        await firestore()
          .collection(SetlistService.COLLECTION)
          .doc(setlist.id)
          .set(
            {
              user_id: user.uid,
              name: setlist.name,
              song_ids: setlist.songIds,
              is_public: !!setlist.isPublic,
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          );
      } catch (e) {
        console.error('Failed to update setlist in Firestore:', e);
      }
    }
  }

  /**
   * Elimina un setlist localmente y de Firestore si el usuario está autenticado.
   */
  public async deleteSetlist(id: string) {
    await StorageService.deleteSetlistLocal(id);

    const user = auth().currentUser;
    if (user && id) {
      try {
        await firestore()
          .collection(SetlistService.COLLECTION)
          .doc(id)
          .delete();
      } catch (e) {
        console.error('Failed to delete setlist in Firestore:', e);
      }
    }
  }
}

export const setlistService = SetlistService.getInstance();
