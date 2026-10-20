import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, firestore } from '../lib/firebase';
import { StorageService } from './StorageService';
import { Library } from '../types';
import {
  planLibrarySync,
  LocalLibraryInfo,
  RemoteLibraryDoc,
  PlanLibrary,
} from '../utils/librarySyncPlan';

const LIBRARIES_OWNER_KEY = 'libraries_owner_uid';

export class LibraryService {
  /**
   * Guarda una biblioteca localmente en SQLite y dispara la sincronización a Firestore (sin await).
   */
  static async save(library: Library): Promise<void> {
    await StorageService.saveLibrary(library);

    const user = auth().currentUser;
    if (!user) return;

    const docData: RemoteLibraryDoc = {
      id: library.id,
      name: library.name,
      driveFolderId: library.driveFolderId || '',
      syncEnabled: library.syncEnabled ?? true,
      icon: library.icon || 'book-open',
      color: library.color || '#3b82f6',
      createdAt: library.createdAt,
      updatedAt: library.updatedAt,
      deletedAt: null,
    };

    // Escritura a Firestore sin await y con .catch para no bloquear UI
    firestore()
      .collection('users')
      .doc(user.uid)
      .collection('libraries')
      .doc(library.id)
      .set(docData, { merge: true })
      .catch((err: any) => {
        console.warn('[LibraryService] Error saving library to Firestore:', err);
      });
  }

  /**
   * Elimina una biblioteca localmente y registra tombstone en Firestore (sin borrar el doc).
   * Nunca aplica tombstone para 'default'.
   */
  static async remove(id: string): Promise<void> {
    await StorageService.deleteLibrary(id);

    if (id === 'default') {
      return;
    }

    const user = auth().currentUser;
    if (!user) return;

    const now = Date.now();
    firestore()
      .collection('users')
      .doc(user.uid)
      .collection('libraries')
      .doc(id)
      .set(
        {
          deletedAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
      .catch((err: any) => {
        console.warn('[LibraryService] Error writing library tombstone to Firestore:', err);
      });
  }

  /**
   * Sincroniza las bibliotecas locales con Firestore usando planLibrarySync.
   * Devuelve true si cambió algo en el estado local.
   */
  static async syncWithCloud(uid: string): Promise<boolean> {
    if (!uid) return false;

    // a. Aislamiento de cuentas
    try {
      const storedOwner = await AsyncStorage.getItem(LIBRARIES_OWNER_KEY);
      if (storedOwner && storedOwner !== uid) {
        // Los datos locales pertenecen a otra cuenta: limpiar bibliotecas locales
        const currentLibs = await StorageService.getAllLibraries();
        for (const lib of currentLibs) {
          await StorageService.deleteLibrary(lib.id);
        }
        await StorageService.ensureDefaultLibrary();
      }
      await AsyncStorage.setItem(LIBRARIES_OWNER_KEY, uid);
    } catch (e) {
      console.warn('[LibraryService] Error handling account isolation:', e);
    }

    // b. Leer remoto
    let remoteDocs: RemoteLibraryDoc[] = [];
    try {
      const snapshot = await firestore()
        .collection('users')
        .doc(uid)
        .collection('libraries')
        .get();

      remoteDocs = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          driveFolderId: data.driveFolderId || '',
          syncEnabled: data.syncEnabled !== false,
          icon: data.icon || 'book-open',
          color: data.color || '#3b82f6',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : null,
        };
      });
    } catch (e) {
      console.warn('[LibraryService] Network/Firestore read error in syncWithCloud:', e);
      return false;
    }

    // c. Armar local con isPristinePlaceholder
    const allLocal = await StorageService.getAllLibraries();
    const localWithInfo: LocalLibraryInfo[] = [];

    for (const lib of allLocal) {
      let isPristinePlaceholder = false;
      if (lib.id === 'default' && !lib.driveFolderId) {
        const songs = await StorageService.getAllSongs(lib.id);
        const setlists = await StorageService.getAllSetlists(lib.id);
        if (songs.length === 0 && setlists.length === 0) {
          isPristinePlaceholder = true;
        }
      }

      localWithInfo.push({
        id: lib.id,
        name: lib.name,
        driveFolderId: lib.driveFolderId || '',
        syncEnabled: lib.syncEnabled,
        icon: lib.icon,
        color: lib.color,
        createdAt: lib.createdAt,
        updatedAt: lib.updatedAt,
        isPristinePlaceholder,
      });
    }

    // d. Calcular plan
    const plan = planLibrarySync(localWithInfo, remoteDocs);

    // e. Ejecutar el plan EN ESTE ORDEN:
    // 1) saveLocal
    for (const lib of plan.saveLocal) {
      await StorageService.saveLibrary({
        id: lib.id,
        name: lib.name,
        driveFolderId: lib.driveFolderId || '',
        syncEnabled: lib.syncEnabled,
        icon: lib.icon,
        color: lib.color,
        createdAt: lib.createdAt,
        updatedAt: lib.updatedAt,
      });
    }

    // 2) reassign
    for (const r of plan.reassign) {
      await StorageService.reassignLibraryId(r.fromId, r.toId);
    }

    // 3) deleteLocalIds
    for (const id of plan.deleteLocalIds) {
      await StorageService.deleteLibrary(id);
    }

    // 4) pushRemote (sin await y con .catch)
    for (const lib of plan.pushRemote) {
      const docData: RemoteLibraryDoc = {
        id: lib.id,
        name: lib.name,
        driveFolderId: lib.driveFolderId || '',
        syncEnabled: lib.syncEnabled,
        icon: lib.icon,
        color: lib.color,
        createdAt: lib.createdAt,
        updatedAt: lib.updatedAt,
        deletedAt: null,
      };

      firestore()
        .collection('users')
        .doc(uid)
        .collection('libraries')
        .doc(lib.id)
        .set(docData, { merge: true })
        .catch((err: any) => {
          console.warn('[LibraryService] Error pushing library to Firestore:', err);
        });
    }

    // f. Devolver true si saveLocal, reassign o deleteLocalIds tienen elementos
    const localChanged =
      plan.saveLocal.length > 0 ||
      plan.reassign.length > 0 ||
      plan.deleteLocalIds.length > 0;

    return localChanged;
  }
}
