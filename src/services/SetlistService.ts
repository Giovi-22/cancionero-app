import { auth } from '../lib/firebase';
import { StorageService } from './StorageService';
import { Setlist } from '../types';

export class SetlistService {
  private static instance: SetlistService;

  private constructor() { }

  public static getInstance(): SetlistService {
    if (!SetlistService.instance) {
      SetlistService.instance = new SetlistService();
    }

    return SetlistService.instance;
  }

  /**
   * Obtiene los setlists personales del usuario.
   *
   * La fuente local es SQLite.
   * StorageService se encarga de sincronizar cada setlist
   * con Firestore cuando corresponde.
   *
   * Los setlists personales NO dependen de ninguna banda.
   */
  public async getSetlists(libraryId: string): Promise<Setlist[]> {
    if (!libraryId || !libraryId.trim()) {
      return [];
    }

    const localSetlists = await StorageService.getAllSetlists(libraryId.trim());

    const user = auth().currentUser;

    if (!user) {
      return localSetlists as Setlist[];
    }

    return localSetlists as Setlist[];
  }

  /**
   * Crea un nuevo setlist personal para una biblioteca específica.
   *
   * La persistencia queda delegada completamente en StorageService.
   */
  public async createSetlist(
    name: string,
    libraryId: string,
    date?: string,
    notes?: string
  ): Promise<Setlist> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error('El nombre del setlist no puede estar vacío.');
    }

    if (!libraryId || !libraryId.trim()) {
      throw new Error('El setlist debe pertenecer obligatoriamente a una biblioteca.');
    }

    const newSetlist: Setlist = {
      id: Date.now().toString(),
      name: trimmedName,
      songIds: [],
      isPublic: false,
      date: date || undefined,
      notes: notes || undefined,
      songNotes: {},
      lastUpdated: new Date().toISOString(),
      libraryId: libraryId.trim(),
    };

    await StorageService.saveSetlist(newSetlist);

    return newSetlist;
  }

  /**
   * Actualiza un setlist personal.
   */
  public async updateSetlist(setlist: Setlist): Promise<void> {
    if (!setlist?.id) {
      throw new Error('No se puede actualizar un setlist sin ID.');
    }

    if (!setlist.libraryId || !setlist.libraryId.trim()) {
      throw new Error('No se puede actualizar un setlist sin libraryId.');
    }

    if (!setlist.name?.trim()) {
      throw new Error('El nombre del setlist no puede estar vacío.');
    }

    const updatedSetlist: Setlist = {
      ...setlist,
      name: setlist.name.trim(),
      libraryId: setlist.libraryId.trim(),
      lastUpdated: new Date().toISOString(),
    };

    await StorageService.saveSetlist(updatedSetlist);
  }

  /**
   * Elimina un setlist personal.
   *
   * StorageService se ocupa de eliminarlo localmente
   * y de Firestore.
   */
  public async deleteSetlist(id: string): Promise<void> {
    if (!id) {
      throw new Error('No se puede eliminar un setlist sin ID.');
    }

    await StorageService.deleteSetlistLocal(id);
  }
}

export const setlistService = SetlistService.getInstance();