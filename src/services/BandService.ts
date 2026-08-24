import { firestore } from '../lib/firebase';
import { Band, BandMember, UserProfile } from '../types/band';

export interface UserBandInfo {
  band: Band;
  role: 'owner' | 'director' | 'member';
}

export class BandService {
  private static COLLECTION = 'bands';

  /**
   * Crea una nueva banda y asigna al usuario creador como 'owner'.
   * Ejecuta un batch atómico para cumplir con las Firestore Security Rules.
   */
  static async createBand(
    name: string,
    description: string = '',
    userProfile: UserProfile
  ): Promise<Band> {
    if (!name.trim()) {
      throw new Error('El nombre de la banda no puede estar vacío');
    }
    if (!userProfile || !userProfile.uid) {
      throw new Error('Usuario no autenticado para crear banda');
    }

    const bandRef = firestore().collection(this.COLLECTION).doc();
    const bandId = bandRef.id;
    const now = new Date().toISOString();

    const newBand: Band = {
      id: bandId,
      name: name.trim(),
      description: description.trim(),
      ownerId: userProfile.uid,
      createdAt: now,
      updatedAt: now,
    };

    const memberRef = bandRef.collection('members').doc(userProfile.uid);
    const ownerMember: BandMember = {
      userId: userProfile.uid,
      email: userProfile.email,
      displayName: userProfile.displayName,
      photoURL: userProfile.photoURL || null,
      role: 'owner',
      joinedAt: now,
    };

    const batch = firestore().batch();
    batch.set(bandRef, newBand);
    batch.set(memberRef, ownerMember);

    await batch.commit();
    console.log('[BandService] Banda creada exitosamente:', newBand.name);
    return newBand;
  }

  /**
   * Obtiene la lista de bandas a las que pertenece un usuario.
   */
  static async getUserBands(userId: string): Promise<UserBandInfo[]> {
    if (!userId) return [];

    try {
      // Consultar subcolección group 'members' donde userId coincide
      const membersSnapshot = await firestore()
        .collectionGroup('members')
        .where('userId', '==', userId)
        .get();

      if (membersSnapshot.empty) {
        return [];
      }

      const results: UserBandInfo[] = [];

      for (const doc of membersSnapshot.docs) {
        const memberData = doc.data() as BandMember;
        const bandRef = doc.ref.parent.parent;

        if (bandRef) {
          const bandSnap = await bandRef.get();
          if (bandSnap.exists) {
            results.push({
              band: { id: bandSnap.id, ...bandSnap.data() } as Band,
              role: memberData.role,
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.warn('[BandService] Error al obtener bandas del usuario:', error);
      return [];
    }
  }

  /**
   * Obtiene todos los miembros pertenecientes a una banda.
   */
  static async getBandMembers(bandId: string): Promise<BandMember[]> {
    if (!bandId) return [];

    try {
      const snapshot = await firestore()
        .collection(this.COLLECTION)
        .doc(bandId)
        .collection('members')
        .get();

      return snapshot.docs.map((doc: any) => doc.data() as BandMember);
    } catch (error) {
      console.warn('[BandService] Error al obtener miembros de la banda:', error);
      return [];
    }
  }

  /**
   * Suscribe a cambios en tiempo real en los miembros de una banda.
   */
  static subscribeToBandMembers(
    bandId: string,
    onUpdate: (members: BandMember[]) => void
  ): () => void {
    if (!bandId) return () => {};

    return firestore()
      .collection(this.COLLECTION)
      .doc(bandId)
      .collection('members')
      .onSnapshot((snapshot: any) => {
        if (!snapshot) return;
        const members = snapshot.docs.map((doc: any) => doc.data() as BandMember);
        onUpdate(members);
      });
  }
}
