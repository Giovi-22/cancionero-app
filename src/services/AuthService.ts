import { auth } from '../lib/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const GOOGLE_WEB_CLIENT_ID = '947725534425-2po3cmv389vgo9uo9saabotu9rltqseq.apps.googleusercontent.com';

// Configurar Google Sign-In con los scopes de Drive y Docs
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ],
  offlineAccess: true,
});

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Inicia sesión nativa con Google y autentica en Firebase
   */
  public async signInWithGoogle(): Promise<any> {
    try {
      // Verificar disponibilidad de Play Services (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Obtener credenciales de Google
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;

      if (!idToken) {
        throw new Error('No se pudo obtener idToken de Google Sign-In');
      }

      // Autenticar en Firebase Auth
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      console.log('[AuthService] Autenticación Firebase exitosa para:', userCredential.user.email);
      return userCredential.user;
    } catch (error) {
      console.error('[AuthService] Error durante signInWithGoogle:', error);
      throw error;
    }
  }

  /**
   * Obtiene el Access Token de Google (válido para APIs de Google Drive y Docs).
   * GoogleSignin.getTokens() refresca automáticamente el token si expiró.
   */
  public async getGoogleAccessToken(): Promise<string | null> {
    try {
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken) {
        return tokens.accessToken;
      }
      return null;
    } catch (e) {
      console.warn('[AuthService] Error al obtener Google Access Token:', e);
      return null;
    }
  }

  /**
   * Cierra sesión en Firebase y Google Sign-In
   */
  public async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      console.warn('[AuthService] Error en GoogleSignin.signOut:', e);
    }
    try {
      await auth().signOut();
      console.log('[AuthService] Sesión de Firebase cerrada exitosamente.');
    } catch (e) {
      console.error('[AuthService] Error en auth().signOut:', e);
    }
  }

  /**
   * Devuelve el usuario actualmente autenticado en Firebase
   */
  public async getCurrentUser(): Promise<any> {
    const user = auth().currentUser;
    if (!user) return null;

    // Retornamos una estructura compatible con el resto de la app
    return {
      id: user.uid,
      uid: user.uid,
      email: user.email,
      user_metadata: {
        full_name: user.displayName || user.email,
        name: user.displayName || user.email,
        avatar_url: user.photoURL,
      },
    };
  }

  /**
   * Listener para cambios de estado de autenticación (onAuthStateChanged)
   */
  public onAuthStateChanged(callback: (user: any) => void) {
    return auth().onAuthStateChanged((user: any) => {
      if (user) {
        callback({
          id: user.uid,
          uid: user.uid,
          email: user.email,
          user_metadata: {
            full_name: user.displayName || user.email,
            name: user.displayName || user.email,
            avatar_url: user.photoURL,
          },
        });
      } else {
        callback(null);
      }
    });
  }
}

export const authService = AuthService.getInstance();
