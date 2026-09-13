import { firestore } from '../lib/firebase';
import { UserProfile } from '../types/band';

export class UserService {
  private static COLLECTION = 'users';

  /**
   * Sincroniza y guarda/actualiza el perfil del usuario autenticado en Firestore (users/{uid}).
   */
  static async syncUserProfile(authUser: any): Promise<UserProfile | null> {
    if (!authUser || (!authUser.uid && !authUser.id)) return null;

    const uid = authUser.uid || authUser.id;
    const rawEmail = authUser.email || '';
    const email = rawEmail.toLowerCase().trim();
    const displayName =
      authUser.displayName ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      email ||
      'Usuario';
    const photoURL = authUser.photoURL || authUser.user_metadata?.avatar_url || null;

    const now = new Date().toISOString();

    try {
      const userDocRef = firestore().collection(this.COLLECTION).doc(uid);
      const docSnapshot = await userDocRef.get();

      if (!docSnapshot.exists()) {
        const newUserProfile: UserProfile = {
          uid,
          email,
          displayName,
          photoURL,
          createdAt: now,
          updatedAt: now,
        };
        await userDocRef.set(newUserProfile);
        return newUserProfile;
      } else {
        const existingData = docSnapshot.data() as UserProfile;
        const updatedProfile: UserProfile = {
          ...existingData,
          uid,
          email,
          displayName: displayName || existingData.displayName,
          photoURL: photoURL || existingData.photoURL,
          updatedAt: now,
        };
        await userDocRef.update({
          email,
          displayName: updatedProfile.displayName,
          photoURL: updatedProfile.photoURL,
          updatedAt: now,
        });
        return updatedProfile;
      }
    } catch (error) {
      console.warn('[UserService] Error al sincronizar perfil en Firestore (¿modo offline?):', error);
      // Retornar fallback estructurado si no hay conexión
      return {
        uid,
        email,
        displayName,
        photoURL,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  /**
   * Obtiene el perfil de un usuario por su UID.
   */
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docSnapshot = await firestore().collection(this.COLLECTION).doc(uid).get();
      if (!docSnapshot.exists()) return null;
      return docSnapshot.data() as UserProfile;
    } catch (error) {
      console.warn('[UserService] Error al obtener usuario por UID:', error);
      return null;
    }
  }

  /**
   * Busca un usuario registrado por su email exacto.
   */
  static async getUserByEmail(email: string): Promise<UserProfile | null> {
    const cleanEmail = email.toLowerCase().trim();
    try {
      const snapshot = await firestore()
        .collection(this.COLLECTION)
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as UserProfile;
    } catch (error) {
      console.warn('[UserService] Error al buscar usuario por email:', error);
      return null;
    }
  }
}
