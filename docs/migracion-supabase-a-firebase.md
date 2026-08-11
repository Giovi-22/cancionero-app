# Migración: Supabase → Firebase + Firestore

> **Objetivo:** Reemplazar Supabase (auth + realtime) por Firebase Auth y Firestore para integrar la app móvil con la app web del compañero.

---

## Checklist previo (preguntar al compañero)

- [ ] Pasar el objeto `firebaseConfig` del proyecto Firebase (apiKey, projectId, etc.)
- [ ] Confirmar si ya usan **Firebase Auth con Google** en la web app
- [ ] Confirmar si la colección en Firestore se llama `live_sessions` (o como la llamen)
- [ ] Ver si hay reglas de seguridad de Firestore que haya que ajustar para la app móvil
- [ ] Ver si el acceso a **Google Drive** (provider_token con scope) ya está configurado en Firebase

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/supabase.ts` | **Reemplazar** por `src/lib/firebase.ts` |
| `src/services/AuthService.ts` | **Reescribir** usando Firebase Auth |
| `src/services/LiveSessionService.ts` | **Reescribir** usando Firestore |
| `package.json` | **Agregar** Firebase SDK, **quitar** Supabase |
| `.env` | **Reemplazar** vars de Supabase por vars de Firebase |

> El resto de la app (StorageService, DriveService, SyncService, screens) **no toca Supabase** y queda sin cambios.

---

## Paso 1 — Instalar dependencias

```bash
# Instalar Firebase para React Native
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore

# Quitar Supabase
npm uninstall @supabase/supabase-js react-native-url-polyfill
```

> ⚠️ `@react-native-firebase` requiere builds nativos. No funciona en Expo Go; hay que usar **Expo Dev Client** o un build de desarrollo.

---

## Paso 2 — Variables de entorno

Reemplazar en `.env`:

```diff
- EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
- EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

+ EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
+ EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
+ EXPO_PUBLIC_FIREBASE_PROJECT_ID=mi-proyecto
+ EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=mi-proyecto.appspot.com
+ EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
+ EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:android:abc123
```

---

## Paso 3 — Crear `src/lib/firebase.ts`

Reemplaza al actual `src/lib/supabase.ts`.

```typescript
import { initializeApp, getApps } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

export { auth, firestore };
```

---

## Paso 4 — Reescribir `AuthService.ts`

### Lo que cambia

| Supabase | Firebase |
|---|---|
| `supabase.auth.signInWithOAuth({ provider: 'google' })` | `GoogleSignin.signIn()` + `auth().signInWithCredential()` |
| `supabase.auth.getSession()` | `auth().currentUser` |
| `supabase.auth.signOut()` | `auth().signOut()` |
| `supabase.auth.getUser()` | `auth().currentUser` |
| Edge Function `refresh-google-token` | Cloud Function equivalente (o Google OAuth directo) |

### Punto crítico: Google Drive scope

La app actual pide el scope `https://www.googleapis.com/auth/drive.readonly` durante el login de Google. Firebase Auth **soporta scopes adicionales** con `GoogleAuthProvider.addScope(...)`. Hay que verificar que el compañero tenga esto configurado en el proyecto Firebase.

```typescript
// Ejemplo con @react-native-google-signin
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

GoogleSignin.configure({
  webClientId: 'TU_WEB_CLIENT_ID.apps.googleusercontent.com', // del compañero
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  offlineAccess: true, // para obtener refresh token
});

const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const { accessToken, idToken } = await GoogleSignin.getTokens();
  
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);
  
  // accessToken = Google Drive token (guardar en StorageService igual que antes)
  return accessToken;
};
```

> **Dependencia extra necesaria:** `@react-native-google-signin/google-signin`

---

## Paso 5 — Reescribir `LiveSessionService.ts`

### Lo que cambia

| Supabase | Firestore |
|---|---|
| `.from('live_sessions').select(...)` | `.collection('live_sessions').get()` |
| `.insert({...})` | `.collection('live_sessions').add({...})` |
| `.update({...}).eq('id', id)` | `.doc(id).update({...})` |
| `.delete().eq('id', id)` | `.doc(id).delete()` |
| `supabase.channel(...).on('postgres_changes', ...)` | `.doc(id).onSnapshot(...)` |

### Versión Firestore del servicio

```typescript
import firestore from '@react-native-firebase/firestore';

export class LiveSessionService {

  static async fetchLiveSessions(): Promise<LiveSession[]> {
    const snap = await firestore()
      .collection('live_sessions')
      .where('status', '==', 'live')
      .orderBy('created_at', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession));
  }

  static async startShow(setlistId: string, setlistName: string, userEmail: string, userName: string): Promise<LiveSession | null> {
    const ref = await firestore().collection('live_sessions').add({
      setlist_id: setlistId,
      setlist_name: setlistName,
      director_email: userEmail,
      director_name: userName,
      status: 'live',
      started_at: new Date().toISOString(),
      created_at: firestore.FieldValue.serverTimestamp(),
    });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as LiveSession;
  }

  static async endShow(sessionId: string): Promise<void> {
    await firestore().collection('live_sessions').doc(sessionId).delete();
  }

  static async updateCurrentSong(sessionId: string, songId: string): Promise<void> {
    await firestore().collection('live_sessions').doc(sessionId).update({
      current_song_id: songId,
    });
  }

  // onSnapshot reemplaza a supabase.channel()
  static subscribeToSession(sessionId: string, onSongChange: (newSongId: string) => void): () => void {
    return firestore()
      .collection('live_sessions')
      .doc(sessionId)
      .onSnapshot(doc => {
        const newSongId = doc.data()?.current_song_id;
        if (newSongId) onSongChange(newSongId);
      });
  }

  static subscribeToAllSessions(onUpdate: (sessions: LiveSession[]) => void): () => void {
    const unsub = firestore()
      .collection('live_sessions')
      .where('status', '==', 'live')
      .onSnapshot(async snap => {
        const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession));
        onUpdate(sessions);
      });

    // Fetch inicial
    this.fetchLiveSessions().then(onUpdate);
    return unsub;
  }
}
```

---

## Paso 6 — Actualizar imports en toda la app

Buscar y reemplazar todos los imports de Supabase:

```bash
# Buscar todos los archivos que importan supabase
grep -r "from '../lib/supabase'" src/
grep -r "from '../../lib/supabase'" src/
```

Actualmente solo hay 2 archivos:
- `src/services/AuthService.ts` ✅ (ya contemplado arriba)
- `src/services/LiveSessionService.ts` ✅ (ya contemplado arriba)

---

## Paso 7 — Verificar reglas de Firestore

En la consola de Firebase del compañero, las reglas deben permitir lectura/escritura a usuarios autenticados:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /live_sessions/{sessionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

---

## Resumen de dependencias finales

```diff
  # Agregar
+ @react-native-firebase/app
+ @react-native-firebase/auth
+ @react-native-firebase/firestore
+ @react-native-google-signin/google-signin

  # Quitar
- @supabase/supabase-js
- react-native-url-polyfill
```

---

## Notas adicionales

- La sesión de Firebase persiste automáticamente (no necesita el adaptador SQLite custom que tiene Supabase ahora).
- El `webClientId` de Google lo saca el compañero de la consola de Firebase → Autenticación → Proveedores → Google.
- Si la app web y la móvil comparten el mismo proyecto Firebase, los usuarios y sesiones son **automáticamente compartidos**.
