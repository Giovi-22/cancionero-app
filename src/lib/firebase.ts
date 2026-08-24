// @ts-ignore
import authModule, { getAuth, GoogleAuthProvider as RNFBGoogleAuthProvider } from '@react-native-firebase/auth';
// @ts-ignore
import firestoreModule, { getFirestore } from '@react-native-firebase/firestore';

const authFn = () => {
  if (typeof authModule === 'function') {
    return authModule();
  }
  if (authModule && typeof authModule.default === 'function') {
    return authModule.default();
  }
  if (typeof getAuth === 'function') {
    return getAuth();
  }
  throw new Error('[Firebase] Auth module not initialized');
};

// Adjuntar GoogleAuthProvider a la función auth para retrocompatibilidad
(authFn as any).GoogleAuthProvider = RNFBGoogleAuthProvider;

export const auth: any = authFn;

export const firestore: any = () => {
  if (typeof firestoreModule === 'function') {
    return firestoreModule();
  }
  if (firestoreModule && typeof firestoreModule.default === 'function') {
    return firestoreModule.default();
  }
  if (typeof getFirestore === 'function') {
    return getFirestore();
  }
  throw new Error('[Firebase] Firestore module not initialized');
};

export { RNFBGoogleAuthProvider as GoogleAuthProvider };
