import { auth } from '../lib/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const GOOGLE_WEB_CLIENT_ID =
  '947725534425-2po3cmv389vgo9uo9saabotu9rltqseq.apps.googleusercontent.com';

// Configurar Google Sign-In con los scopes de Drive y Docs
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ],
  offlineAccess: true,
});

export interface AuthenticatedUser {
  id: string;
  uid: string;
  email: string | null;
  user_metadata: {
    full_name: string | null;
    name: string | null;
    avatar_url: string | null;
  };
}

export class AuthService {
  private static instance: AuthService;

  private tokenPromise: Promise<string | null> | null = null;

  private constructor() { }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }

    return AuthService.instance;
  }

  /**
   * Convierte el usuario de Firebase a la estructura
   * que utiliza la aplicación.
   *
   * AuthService solamente se ocupa de autenticación.
   * El perfil Firestore pertenece a UserContext/UserService.
   */
  private mapFirebaseUser(user: any): AuthenticatedUser {
    return {
      id: user.uid,
      uid: user.uid,
      email: user.email,
      user_metadata: {
        full_name: user.displayName || user.email || null,
        name: user.displayName || user.email || null,
        avatar_url: user.photoURL || null,
      },
    };
  }

  /**
   * Inicia sesión nativa con Google y autentica en Firebase.
   */
  public async signInWithGoogle(): Promise<any> {
    try {
      // Verificar disponibilidad de Play Services (Android)
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // Obtener credenciales de Google
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;

      if (!idToken) {
        throw new Error(
          'No se pudo obtener idToken de Google Sign-In'
        );
      }

      // Autenticar en Firebase
      const googleCredential =
        auth.GoogleAuthProvider.credential(idToken);

      const userCredential =
        await auth().signInWithCredential(googleCredential);

      console.log(
        '[AuthService] Autenticación Firebase exitosa para:',
        userCredential.user.email
      );

      return userCredential.user;
    } catch (error) {
      console.error(
        '[AuthService] Error durante signInWithGoogle:',
        error
      );

      throw error;
    }
  }

  /**
   * Obtiene el Access Token de Google válido para
   * Google Drive y Google Docs.
   *
   * GoogleSignin.getTokens() refresca automáticamente
   * el token si expiró.
   *
   * Se evita tener varias llamadas concurrentes porque
   * pueden provocar errores en la librería de Google Sign-In.
   */
  public async getGoogleAccessToken(): Promise<string | null> {
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = (async () => {
      try {
        const tokens = await GoogleSignin.getTokens();

        return tokens.accessToken || null;
      } catch (error) {
        console.warn(
          '[AuthService] Error al obtener Google Access Token:',
          error
        );

        return null;
      } finally {
        this.tokenPromise = null;
      }
    })();

    return this.tokenPromise;
  }

  /**
   * Cierra sesión en Firebase y Google Sign-In.
   */
  public async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.warn(
        '[AuthService] Error en GoogleSignin.signOut:',
        error
      );
    }

    try {
      await auth().signOut();

      console.log(
        '[AuthService] Sesión de Firebase cerrada exitosamente.'
      );
    } catch (error) {
      console.error(
        '[AuthService] Error en auth().signOut:',
        error
      );

      throw error;
    }
  }

  /**
   * Devuelve el usuario actualmente autenticado en Firebase.
   *
   * No sincroniza ningún perfil en Firestore.
   * Esa responsabilidad pertenece a UserContext/UserService.
   */
  public async getCurrentUser(): Promise<AuthenticatedUser | null> {
    const user = auth().currentUser;

    if (!user) {
      return null;
    }

    return this.mapFirebaseUser(user);
  }

  /**
   * Listener para cambios de estado de autenticación.
   *
   * Este listener solamente informa si existe un usuario
   * autenticado. La sincronización del perfil se realiza
   * desde UserContext.
   */
  public onAuthStateChanged(
    callback: (user: AuthenticatedUser | null) => void
  ) {
    return auth().onAuthStateChanged((user: any) => {
      if (user) {
        callback(this.mapFirebaseUser(user));
      } else {
        callback(null);
      }
    });
  }
}

export const authService = AuthService.getInstance();