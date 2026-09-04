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
    return newBand;
  }

  /**
   * Obtiene la lista de bandas a las que pertenece un usuario.
   *
   * Busca las membresías mediante collectionGroup('members').
   */
  static async getUserBands(userId: string): Promise<UserBandInfo[]> {
    if (!userId) return [];

    try {
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

        if (!bandRef) {
          continue;
        }

        const bandSnap = await bandRef.get();

        if (!bandSnap.exists) {
          continue;
        }

        results.push({
          band: {
            id: bandSnap.id,
            ...bandSnap.data(),
          } as Band,
          role: memberData.role,
        });
      }
      return results;
    } catch (error) {
      console.warn(
        '[BandService] Error al obtener bandas del usuario:',
        error
      );

      throw error;
    }
  }

  /**
   * Escucha en tiempo real las bandas a las que pertenece un usuario.
   *
   * Detecta:
   * - Nuevas membresías
   * - Membresías eliminadas
   * - Cambios de rol
   *
   * La membresía es la fuente de verdad.
   */
  static subscribeToUserBands(
    userId: string,
    onUpdate: (bands: UserBandInfo[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!userId) {
      onUpdate([]);
      return () => { };
    }

    let cancelled = false;

    // Listeners de cada documento bands/{bandId}
    const bandUnsubscribes = new Map<string, () => void>();

    // Estado actual de las membresías del usuario
    const memberships = new Map<
      string,
      {
        bandId: string;
        role: 'owner' | 'director' | 'member';
      }
    >();

    // Estado actual de cada banda
    const bands = new Map<string, Band>();

    const emitUpdate = () => {
      if (cancelled) return;

      const result: UserBandInfo[] = [];

      memberships.forEach(({ bandId, role }) => {
        const band = bands.get(bandId);

        if (!band) return;

        result.push({
          band,
          role,
        });
      });

      onUpdate(result);
    };

    const membersQuery = firestore()
      .collectionGroup('members')
      .where('userId', '==', userId);

    const unsubscribeMembers = membersQuery.onSnapshot(
      snapshot => {
        if (cancelled) return;

        const currentBandIds = new Set<string>();

        snapshot.docs.forEach(doc => {
          const memberData = doc.data() as BandMember;
          const bandRef = doc.ref.parent.parent;

          if (!bandRef) return;

          const bandId = bandRef.id;

          currentBandIds.add(bandId);

          memberships.set(bandId, {
            bandId,
            role: memberData.role,
          });

          // Si todavía no tenemos listener para esta banda,
          // creamos uno.
          if (!bandUnsubscribes.has(bandId)) {
            const unsubscribeBand = bandRef.onSnapshot(
              bandSnapshot => {
                if (cancelled) return;

                if (!bandSnapshot.exists) {
                  bands.delete(bandId);
                  emitUpdate();
                  return;
                }

                bands.set(bandId, {
                  id: bandSnapshot.id,
                  ...bandSnapshot.data(),
                } as Band);

                emitUpdate();
              },
              error => {
                if (cancelled) return;

                console.warn(
                  `[BandService] Error escuchando banda ${bandId}:`,
                  error
                );

                if (onError) {
                  onError(
                    error instanceof Error
                      ? error
                      : new Error('No se pudo sincronizar una banda.')
                  );
                }
              }
            );

            bandUnsubscribes.set(bandId, unsubscribeBand);
          }
        });

        // Detectar bandas que el usuario ya no tiene.
        for (const bandId of Array.from(memberships.keys())) {
          if (!currentBandIds.has(bandId)) {
            memberships.delete(bandId);
            bands.delete(bandId);

            const unsubscribeBand = bandUnsubscribes.get(bandId);

            if (unsubscribeBand) {
              unsubscribeBand();
              bandUnsubscribes.delete(bandId);
            }
          }
        }

        emitUpdate();
      },
      error => {
        if (cancelled) return;

        console.warn(
          '[BandService] Error en suscripción de bandas del usuario:',
          error
        );

        if (onError) {
          onError(
            error instanceof Error
              ? error
              : new Error('No se pudieron sincronizar las bandas.')
          );
        }
      }
    );

    return () => {
      cancelled = true;

      unsubscribeMembers();

      bandUnsubscribes.forEach(unsubscribe => {
        unsubscribe();
      });

      bandUnsubscribes.clear();
      memberships.clear();
      bands.clear();
    };
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

      return snapshot.docs.map(
        (doc: any) => doc.data() as BandMember
      );
    } catch (error) {
      console.warn(
        '[BandService] Error al obtener miembros de la banda:',
        error
      );

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
    if (!bandId) return () => { };

    return firestore()
      .collection(this.COLLECTION)
      .doc(bandId)
      .collection('members')
      .onSnapshot((snapshot: any) => {
        if (!snapshot) return;

        const members = snapshot.docs.map(
          (doc: any) => doc.data() as BandMember
        );

        onUpdate(members);
      });
  }

  /**
   * Actualiza el rol de un miembro de la banda.
   * Solamente autorizado para el Owner mediante Security Rules.
   */
  static async updateMemberRole(
    bandId: string,
    memberUserId: string,
    newRole: 'member' | 'director'
  ): Promise<void> {
    if (!bandId || !memberUserId) return;

    if (newRole !== 'member' && newRole !== 'director') {
      throw new Error(
        'Solo se puede asignar el rol de Miembro o Director.'
      );
    }

    const memberRef = firestore()
      .collection(this.COLLECTION)
      .doc(bandId)
      .collection('members')
      .doc(memberUserId);

    await memberRef.update({
      role: newRole,
    });
  }

  /**
   * Elimina a un miembro de la banda o permite que un usuario abandone la banda.
   */
  static async removeMember(
    bandId: string,
    memberUserId: string
  ): Promise<void> {
    if (!bandId || !memberUserId) return;

    const memberRef = firestore()
      .collection(this.COLLECTION)
      .doc(bandId)
      .collection('members')
      .doc(memberUserId);

    await memberRef.delete();

  }
}