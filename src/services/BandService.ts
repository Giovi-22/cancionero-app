import { firestore } from '../lib/firebase';
import { Band, BandMember, UserProfile } from '../types/band';

export interface UserBandInfo {
  band: Band;
  role: 'owner' | 'director' | 'member';
}

export class BandService {
  private static COLLECTION = 'bands';
  private static BATCH_SIZE = 450;

  /**
   * Bandas que están siendo eliminadas desde esta instancia de la app.
   * Se utiliza para evitar manejar como error algunos eventos de listeners
   * durante el proceso de eliminación.
   */
  private static deletingBands = new Set<string>();

  static isBandBeingDeleted(bandId: string): boolean {
    return this.deletingBands.has(bandId);
  }

  /**
   * Crea una nueva banda y asigna al usuario creador como 'owner'.
   * Ejecuta un batch atómico para cumplir con las Firestore Security Rules.
   */
  static async createBand(
    name: string,
    description: string = '',
    driveFolderId: string,
    driveFolderName: string,
    userProfile: UserProfile
  ): Promise<Band> {
    if (!driveFolderId) {
      throw new Error(
        'Debes seleccionar una carpeta de Google Drive para la banda'
      );
    }

    if (!driveFolderName?.trim()) {
      throw new Error(
        'La carpeta de canciones seleccionada no es válida'
      );
    }
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
      driveFolderId,
      driveFolderName: driveFolderName.trim(),
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
 * Actualiza los datos editables de una banda.
 *
 * Solamente autorizado para el Owner mediante Security Rules.
 *
 * Campos editables:
 * - name
 * - description
 * - driveFolderId
 * - driveFolderName
 */
  static async updateBand(
    bandId: string,
    data: {
      name: string;
      description?: string;
      driveFolderId: string;
      driveFolderName: string;
    }
  ): Promise<void> {
    if (!bandId) {
      throw new Error(
        'Falta el identificador de la banda.'
      );
    }

    if (!data.name?.trim()) {
      throw new Error(
        'El nombre de la banda no puede estar vacío.'
      );
    }

    if (!data.driveFolderId) {
      throw new Error(
        'Debes seleccionar una carpeta de Google Drive para la banda.'
      );
    }

    if (!data.driveFolderName?.trim()) {
      throw new Error(
        'La carpeta de canciones seleccionada no es válida.'
      );
    }

    const bandRef = firestore()
      .collection(this.COLLECTION)
      .doc(bandId);

    await bandRef.update({
      name: data.name.trim(),
      description:
        data.description?.trim() ?? '',
      driveFolderId:
        data.driveFolderId,
      driveFolderName:
        data.driveFolderName.trim(),
      updatedAt:
        new Date().toISOString(),
    });
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
            const subscribeToBand = (retryCount: number = 0) => {
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

                  /*
                   * Si el usuario perdió acceso a la banda porque fue
                   * eliminado de members, Firestore puede devolver
                   * permission-denied al listener del documento.
                   *
                   * Puede ocurrir también como condición de carrera al
                   * crear la banda: el listener se suscribe antes de que
                   * Firestore propague la membresía. En ese caso
                   * reintentamos hasta 3 veces con un delay creciente.
                   */
                  const errorCode =
                    error &&
                      typeof error === 'object' &&
                      'code' in error
                      ? String(error.code)
                      : '';

                  if (
                    errorCode === 'permission-denied' ||
                    errorCode === 'firestore/permission-denied'
                  ) {
                    const MAX_RETRIES = 3;
                    const RETRY_DELAY_MS = 2000;

                    if (retryCount < MAX_RETRIES && memberships.has(bandId)) {
                      console.warn(
                        `[BandService] Permiso denegado al escuchar banda ${bandId}. Reintentando en ${RETRY_DELAY_MS}ms (intento ${retryCount + 1}/${MAX_RETRIES})...`
                      );

                      // Cancelar el listener actual antes de reintentar
                      bandUnsubscribes.delete(bandId);

                      setTimeout(() => {
                        if (cancelled || !memberships.has(bandId)) return;
                        subscribeToBand(retryCount + 1);
                      }, RETRY_DELAY_MS);

                      return;
                    }

                    console.warn(
                      `[BandService] Permiso denegado al escuchar banda ${bandId}. Se mantiene la membresía y se remueve listener de documento:`,
                      error
                    );

                    bands.delete(bandId);

                    const unsubscribe =
                      bandUnsubscribes.get(bandId);

                    if (unsubscribe) {
                      unsubscribe();
                      bandUnsubscribes.delete(bandId);
                    }

                    emitUpdate();
                    return;
                  }

                /*
                 * Si la banda está siendo eliminada desde esta misma
                 * instancia, no propagamos el error como fallo de
                 * sincronización.
                 */
                if (this.deletingBands.has(bandId)) {
                  return;
                }

                console.warn(
                  `[BandService] Error escuchando banda ${bandId}:`,
                  error
                );

                if (onError) {
                  onError(
                    error instanceof Error
                      ? error
                      : new Error(
                        'No se pudo sincronizar una banda.'
                      )
                  );
                }
              }
            );

              // Registrar el nuevo listener (reemplaza al anterior en reintentos)
              bandUnsubscribes.set(bandId, unsubscribeBand);
            };

            subscribeToBand();
          }
        });

        // Detectar bandas que el usuario ya no tiene.
        for (const bandId of Array.from(memberships.keys())) {
          if (!currentBandIds.has(bandId)) {
            memberships.delete(bandId);
            bands.delete(bandId);

            const unsubscribeBand =
              bandUnsubscribes.get(bandId);

            if (unsubscribeBand) {
              unsubscribeBand();
              bandUnsubscribes.delete(bandId);
            }
          }
        }

        // ============================================================
        // Emisión condicional desde el listener de membresías
        // ============================================================
        // Si el usuario no tiene ninguna membresía (0 bandas), emitimos [] inmediatamente.
        // Si existen membresías pero alguna de ellas todavía no tiene su documento
        // de banda cargado en `bands` (está pendiente de resolución en bandRef.onSnapshot),
        // NO emitimos un estado incompleto ni []. Esperamos a que los listeners de documento
        // resuelvan y llamen a emitUpdate().
        // Si todas las membresías ya están resueltas (ej. cambio de rol o eliminación),
        // emitimos inmediatamente.
        const hasPendingBands = Array.from(memberships.keys()).some(
          id => !bands.has(id)
        );

        if (memberships.size === 0 || !hasPendingBands) {
          emitUpdate();
        }
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
              : new Error(
                'No se pudieron sincronizar las bandas.'
              )
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

  /**
   * Elimina todos los documentos recibidos utilizando batches
   * para no superar el límite de operaciones de Firestore.
   */
  private static async deleteDocumentRefsInBatches(
    refs: any[]
  ): Promise<void> {
    for (
      let index = 0;
      index < refs.length;
      index += this.BATCH_SIZE
    ) {
      const batchRefs = refs.slice(
        index,
        index + this.BATCH_SIZE
      );

      const batch = firestore().batch();

      batchRefs.forEach(ref => {
        batch.delete(ref);
      });

      await batch.commit();
    }
  }

  /**
   * Elimina completamente una banda y todos sus datos asociados.
   *
   * NO elimina datos personales del usuario.
   *
   * Orden:
   * 1. Invitaciones
   * 2. Eventos de sesiones
   * 3. Sesiones
   * 4. Setlists de banda
   * 5. Miembros que no son owner
   * 6. Owner + documento de banda en el mismo batch
   */
  static async deleteBand(
    bandId: string
  ): Promise<void> {
    if (!bandId) {
      throw new Error(
        'Faltan datos necesarios para eliminar la banda.'
      );
    }

    this.deletingBands.add(bandId);

    try {
      console.log(
        `[BandService] Iniciando eliminación completa de la banda ${bandId}`
      );

      const bandRef = firestore()
        .collection(this.COLLECTION)
        .doc(bandId);

      /*
       * Obtener la banda antes de eliminarla para conocer
       * quién es el owner.
       */
      const bandSnapshot = await bandRef.get();

      if (!bandSnapshot.exists) {
        throw new Error(
          'La banda no existe o ya fue eliminada.'
        );
      }

      const bandData =
        bandSnapshot.data() as Band;

      const ownerId = bandData.ownerId;

      if (!ownerId) {
        throw new Error(
          'La banda no tiene un propietario válido.'
        );
      }

      /*
       * 1. Eliminar invitaciones relacionadas con la banda.
       */
      const invitationsSnapshot = await firestore()
        .collection('invitations')
        .where('bandId', '==', bandId)
        .get();

      await this.deleteDocumentRefsInBatches(
        invitationsSnapshot.docs.map(
          doc => doc.ref
        )
      );

      console.log(
        `[BandService] Invitaciones eliminadas: ${invitationsSnapshot.size}`
      );

      /*
       * 2. Eliminar sesiones y sus eventos.
       */
      const sessionsSnapshot = await bandRef
        .collection('sessions')
        .get();

      const sessionRefs: any[] = [];

      for (const sessionDoc of sessionsSnapshot.docs) {
        const eventsSnapshot =
          await sessionDoc.ref
            .collection('events')
            .get();

        await this.deleteDocumentRefsInBatches(
          eventsSnapshot.docs.map(
            doc => doc.ref
          )
        );

        sessionRefs.push(sessionDoc.ref);
      }

      await this.deleteDocumentRefsInBatches(
        sessionRefs
      );

      console.log(
        `[BandService] Sesiones eliminadas: ${sessionsSnapshot.size}`
      );

      /*
       * 3. Eliminar setlists de la banda.
       */
      const setlistsSnapshot = await bandRef
        .collection('setlists')
        .get();

      await this.deleteDocumentRefsInBatches(
        setlistsSnapshot.docs.map(
          doc => doc.ref
        )
      );

      console.log(
        `[BandService] Setlists de banda eliminados: ${setlistsSnapshot.size}`
      );

      /*
       * 4. Eliminar miembros que NO son el owner.
       */
      const membersSnapshot = await bandRef
        .collection('members')
        .get();

      const nonOwnerMemberRefs =
        membersSnapshot.docs
          .filter(
            doc => doc.id !== ownerId
          )
          .map(doc => doc.ref);

      await this.deleteDocumentRefsInBatches(
        nonOwnerMemberRefs
      );

      console.log(
        `[BandService] Miembros no-owner eliminados: ${nonOwnerMemberRefs.length}`
      );

      /*
       * 5. Eliminar owner + banda en el mismo batch.
       *
       * Esto es necesario porque las reglas de Firestore
       * permiten eliminar el documento del owner únicamente
       * cuando la banda también se elimina en la misma
       * operación.
       */
      const ownerMemberRef = bandRef
        .collection('members')
        .doc(ownerId);

      const finalBatch =
        firestore().batch();

      finalBatch.delete(ownerMemberRef);
      finalBatch.delete(bandRef);

      await finalBatch.commit();

      console.log(
        `[BandService] Banda ${bandId} eliminada correctamente.`
      );
    } finally {
      this.deletingBands.delete(bandId);
    }
  }
}