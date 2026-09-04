// @ts-ignore
import firestoreModule from '@react-native-firebase/firestore';
import { firestore } from '../lib/firebase';
import { Band, Invitation, UserProfile, BandMember } from '../types/band';

export class InvitationService {
  private static COLLECTION = 'invitations';

  /**
   * Genera un Timestamp nativo de Firestore si está disponible.
   */
  private static getFirestoreTimestamp(date: Date): any {
    if (firestoreModule && typeof firestoreModule.Timestamp?.fromDate === 'function') {
      return firestoreModule.Timestamp.fromDate(date);
    }
    return date;
  }

  /**
   * Comprueba si una fecha/timestamp de expiración ya transcurrió.
   */
  private static isExpired(expiresAt: any): boolean {
    if (!expiresAt) return false;
    const now = new Date();
    if (typeof expiresAt.toDate === 'function') {
      return expiresAt.toDate() < now;
    }
    return new Date(expiresAt) < now;
  }

  /**
   * Crea una nueva invitación para un usuario por su email.
   * Restringido a roles 'member' o 'director'. NUNCA 'owner'.
   */
  static async createInvitation(
    band: Band,
    inviter: UserProfile,
    invitedEmail: string,
    role: 'member' | 'director'
  ): Promise<Invitation> {
    const cleanEmail = invitedEmail.trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error('El correo electrónico es obligatorio.');
    }
    // Guardia defensiva: aunque el tipo ya excluye 'owner', protege contra callers JS o casteos.
    if ((role as string) === 'owner') {
      throw new Error('No está permitido enviar invitaciones con rol de Propietario (owner).');
    }
    if (!inviter || !inviter.uid) {
      throw new Error('Usuario emisor no autenticado.');
    }

    // 1. Comprobar si el usuario ya es miembro de la banda
    const membersSnap = await firestore()
      .collection('bands')
      .doc(band.id)
      .collection('members')
      .where('email', '==', cleanEmail)
      .get();

    if (!membersSnap.empty) {
      throw new Error('El usuario con este correo ya es miembro de la banda.');
    }

    // 2. Comprobar si ya existe una invitación pendiente para este email en la misma banda
    const pendingSnap = await firestore()
      .collection(this.COLLECTION)
      .where('bandId', '==', band.id)
      .where('invitedEmail', '==', cleanEmail)
      .where('status', '==', 'pending')
      .get();

    if (!pendingSnap.empty) {
      throw new Error('Ya existe una invitación pendiente para este correo en esta banda.');
    }

    const now = new Date();
    // Expiración por defecto: 7 días almacenado como Timestamp nativo de Firestore
    const expiresAtDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiresAt = this.getFirestoreTimestamp(expiresAtDate);

    const invRef = firestore().collection(this.COLLECTION).doc();
    const newInvitationData = {
      id: invRef.id,
      bandId: band.id,
      bandName: band.name,
      invitedEmail: cleanEmail,
      invitedByUserId: inviter.uid,
      invitedByName: inviter.displayName || inviter.email || 'Miembro de la banda',
      role,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt,
    };

    await invRef.set(newInvitationData);
    return newInvitationData as Invitation;
  }

  /**
   * Obtiene las invitaciones pendientes asociadas al correo del usuario.
   */
  static async getPendingInvitationsForEmail(email: string): Promise<Invitation[]> {
    if (!email) return [];
    const cleanEmail = email.trim().toLowerCase();

    try {
      const snapshot = await firestore()
        .collection(this.COLLECTION)
        .where('invitedEmail', '==', cleanEmail)
        .where('status', '==', 'pending')
        .get();

      const validInvitations: Invitation[] = [];

      for (const doc of snapshot.docs) {
        const inv = { id: doc.id, ...doc.data() } as Invitation;
        // La expiración se evalúa en memoria: las reglas del servidor ya bloquean
        // la aceptación de invitaciones vencidas (expiresAt > request.time).
        // No es necesario ni posible escribir status:'expired' desde el cliente.
        if (!this.isExpired(inv.expiresAt)) {
          validInvitations.push(inv);
        }
      }

      return validInvitations;
    } catch (error) {
      console.warn('[InvitationService] Error al obtener invitaciones pendientes:', error);
      return [];
    }
  }

  /**
   * Suscribe en tiempo real a las invitaciones pendientes para un correo.
   */
  static subscribeToPendingInvitations(
    email: string,
    onUpdate: (invitations: Invitation[]) => void
  ): () => void {
    if (!email) return () => { };
    const cleanEmail = email.trim().toLowerCase();

    return firestore()
      .collection(this.COLLECTION)
      .where('invitedEmail', '==', cleanEmail)
      .where('status', '==', 'pending')
      .onSnapshot((snapshot: any) => {
        if (!snapshot) return;
        const validInvitations: Invitation[] = [];

        snapshot.docs.forEach((doc: any) => {
          const inv = { id: doc.id, ...doc.data() } as Invitation;
          if (!this.isExpired(inv.expiresAt)) {
            validInvitations.push(inv);
          }
        });

        onUpdate(validInvitations);
      });
  }

  /**
   * Obtiene las invitaciones enviadas para una banda (para vista administrativa).
   */
  static async getBandInvitations(bandId: string): Promise<Invitation[]> {
    if (!bandId) return [];

    try {
      const snapshot = await firestore()
        .collection(this.COLLECTION)
        .where('bandId', '==', bandId)
        .get();

      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Invitation));
    } catch (error) {
      console.warn('[InvitationService] Error al obtener invitaciones de la banda:', error);
      return [];
    }
  }

  /**
 * Escucha en tiempo real las invitaciones pendientes enviadas
 * desde una banda.
 *
 * Detecta automáticamente:
 * - Nuevas invitaciones
 * - Invitaciones aceptadas
 * - Invitaciones rechazadas
 * - Invitaciones canceladas
 */
  static subscribeToPendingBandInvitations(
    bandId: string,
    onUpdate: (invitations: Invitation[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!bandId) {
      onUpdate([]);
      return () => { };
    }

    return firestore()
      .collection(this.COLLECTION)
      .where('bandId', '==', bandId)
      .onSnapshot(
        snapshot => {
          if (!snapshot) {
            onUpdate([]);
            return;
          }

          const pendingInvitations: Invitation[] = [];

          snapshot.docs.forEach((doc: any) => {
            const invitation = {
              id: doc.id,
              ...doc.data(),
            } as Invitation;

            if (
              invitation.status === 'pending' &&
              !this.isExpired(invitation.expiresAt)
            ) {
              pendingInvitations.push(invitation);
            }
          });

          // Más recientes primero
          pendingInvitations.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();

            return dateB - dateA;
          });

          onUpdate(pendingInvitations);
        },
        error => {
          console.warn(
            '[InvitationService] Error en suscripción de invitaciones de banda:',
            error
          );

          if (onError) {
            onError(
              error instanceof Error
                ? error
                : new Error(
                  'No se pudieron sincronizar las invitaciones de la banda.'
                )
            );
          }
        }
      );
  }

  /**
   * Acepta una invitación pendiente y agrega al usuario a la banda.
   * OPERACIÓN ATÓMICA UNIFICADA (WriteBatch de Firestore):
   * 1. invitation -> status: 'accepted', invitedUserId: userProfile.uid
   * 2. member -> bands/{bandId}/members/{userId} (create)
   * 
   * Gracias a getAfter() en Firestore Security Rules, ambas escrituras
   * son validadas y comprometidas en un ÚNICO WriteBatch atómico.
   */
  static async acceptInvitation(invitationId: string, userProfile: UserProfile): Promise<void> {
    if (!userProfile || !userProfile.uid) {
      throw new Error('Usuario no autenticado.');
    }

    const invRef = firestore().collection(this.COLLECTION).doc(invitationId);
    const invSnap = await invRef.get();

    if (!invSnap.exists()) {
      throw new Error('La invitación no existe o ha sido eliminada.');
    }

    const invitation = { id: invSnap.id, ...invSnap.data() } as Invitation;

    if (invitation.status !== 'pending') {
      throw new Error(`La invitación ya fue procesada (${invitation.status}).`);
    }

    const cleanUserEmail = userProfile.email.trim().toLowerCase();
    if (invitation.invitedEmail.toLowerCase() !== cleanUserEmail) {
      throw new Error('Esta invitación no corresponde a tu dirección de correo electrónico.');
    }

    if (this.isExpired(invitation.expiresAt)) {
      // La expiración se valida server-side mediante request.time en las reglas.
      // No se escribe status:'expired' desde el cliente (bloqueado por las reglas).
      throw new Error('La invitación ha expirado.');
    }

    if (invitation.role === 'owner') {
      throw new Error('No es posible unirse con rol de owner mediante invitación.');
    }

    // Verificar si ya existe el miembro en la banda para evitar duplicados
    const memberRef = firestore()
      .collection('bands')
      .doc(invitation.bandId)
      .collection('members')
      .doc(userProfile.uid);

    const memberSnap = await memberRef.get();
    if (memberSnap.exists()) {
      // Ya es miembro, solo actualizar el estado de la invitación
      await invRef.update({
        status: 'accepted',
        invitedUserId: userProfile.uid,
      });
      return;
    }
    const now = new Date().toISOString();

    const newMember: BandMember = {
      userId: userProfile.uid,
      email: userProfile.email,
      displayName: userProfile.displayName || userProfile.email,
      photoURL: userProfile.photoURL || null,
      role: invitation.role,
      invitationId: invitation.id,
      joinedAt: now,
    };

    // OPERACIÓN ATÓMICA EN UN ÚNICO WriteBatch
    const batch = firestore().batch();

    // Paso A: Actualizar estado de la invitación
    batch.update(invRef, {
      status: 'accepted',
      invitedUserId: userProfile.uid,
    });

    // Paso B: Crear el documento de miembro
    batch.set(memberRef, newMember);

    // Comprometer ambas escrituras atómicamente
    await batch.commit();
  }

  /**
   * Rechaza una invitación pendiente.
   */
  static async rejectInvitation(invitationId: string, userEmail: string): Promise<void> {
    const invRef = firestore().collection(this.COLLECTION).doc(invitationId);
    const invSnap = await invRef.get();

    if (!invSnap.exists()) {
      throw new Error('La invitación no existe.');
    }

    const invitation = invSnap.data() as Invitation;
    if (invitation.invitedEmail.toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new Error('No tienes permiso para rechazar esta invitación.');
    }

    await invRef.update({
      status: 'rejected',
    });
  }

  /**
   * Cancela una invitación pendiente (realizado por Owner o Director de la banda).
   */
  static async cancelInvitation(invitationId: string): Promise<void> {
    const invRef = firestore().collection(this.COLLECTION).doc(invitationId);
    await invRef.update({
      status: 'cancelled',
    });
  }
}
