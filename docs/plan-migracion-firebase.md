# Plan de Migración: Supabase → Firebase

## ¿Qué usa Supabase actualmente?

| Funcionalidad | Servicio Supabase | Equivalente Firebase |
|---|---|---|
| Login con Google | `supabase.auth.signInWithOAuth` (via WebBrowser) | `@react-native-firebase/auth` + Google Sign-In nativo |
| Obtener token Google | `session.provider_token` | `GoogleSignin.getTokens()` directa |
| Refresh automático de token | Edge Function `refresh-google-token` | **No necesario** — Firebase lo maneja solo |
| Sync setlists | `supabase.from('setlists')` | `firestore().collection('setlists')` |
| Sync song stats | `supabase.from('song_stats')` | `firestore().collection('song_stats')` |
| Sync settings | `supabase.from('user_settings')` | `firestore().collection('user_settings')` |
| Live sessions (tiempo real) | `supabase.channel()` + `postgres_changes` | `firestore().onSnapshot()` |
| Sesión persistente | `sqliteStorageAdapter` custom | Automático en Firebase |

---

## Ventajas clave del cambio

- ✅ **Google Sign-In nativo en Android/iOS** — sin WebBrowser, sin redirect URIs
- ✅ **Access token de Google** disponible directamente (para Drive/Docs API)
- ✅ **Sin Edge Functions** — el refresh de tokens lo maneja Firebase Auth automáticamente
- ✅ **Cualquier usuario** puede autenticarse sin configuración extra en Google Cloud
- ✅ **Tiempo real más simple** — `onSnapshot` de Firestore es más directo que Supabase Realtime

---

## FASE 1 — Setup de Firebase (Google Cloud Console + Firebase Console)

### 1.1 En tu proyecto Google Cloud existente (`cancionero-app-505214`)

> **IMPORTANTE:** Tu proyecto de Firebase debe ser el **mismo** proyecto de Google Cloud donde
> habilitaste Google Docs API. Así compartís las credenciales OAuth.

1. Ir a [firebase.google.com/console](https://console.firebase.google.com/)
2. Click **"Agregar proyecto"** → elegir **"Usar proyecto de Google Cloud existente"**
3. Seleccionar `cancionero-app-505214`
4. En el proyecto de Firebase → **"Agregar app"** → elegir **Android**
   - Package name: `com.giovi.cancionero`
   - Descargar `google-services.json` → copiarlo a la raíz del proyecto
5. En Firebase Console → **Authentication** → **Sign-in method** → habilitar **Google**
6. En Firebase Console → **Firestore Database** → **Crear base de datos** → modo Producción

### 1.2 Datos que vas a necesitar anotar

- **Web Client ID** (Firebase Console → Auth → Google → Web client ID)
- El archivo **`google-services.json`** descargado

---

## FASE 2 — Instalación de paquetes

```bash
# Quitar Supabase
npm uninstall @supabase/supabase-js react-native-url-polyfill

# Instalar Firebase
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore

# Google Sign-In
npx expo install @react-native-google-signin/google-signin
```

### Configurar plugins en `app.json`

```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosClientId": "TU_IOS_CLIENT_ID"
        }
      ]
    ]
  }
}
```

---

## FASE 3 — Reemplazar `AuthService.ts`

### Antes (Supabase)
```ts
// Flow complejo: App → WebBrowser → Supabase → Google → token
await supabase.auth.signInWithOAuth({ provider: 'google', ... });
const token = session.provider_token; // frágil, a veces no viene
```

### Después (Firebase)
```ts
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: 'TU_WEB_CLIENT_ID.apps.googleusercontent.com',
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ],
  offlineAccess: true,
});

// Sign In
const { idToken } = await GoogleSignin.signIn();
const googleCredential = auth.GoogleAuthProvider.credential(idToken);
await auth().signInWithCredential(googleCredential);

// Obtener access token para Drive/Docs API (siempre disponible)
const { accessToken } = await GoogleSignin.getTokens();
```

---

## FASE 4 — Reemplazar `src/lib/supabase.ts`

Crear `src/lib/firebase.ts`:
```ts
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export { firebase, auth, firestore };
```

Eliminar completamente `src/lib/supabase.ts`.

---

## FASE 5 — Reemplazar sync de datos en `StorageService.ts`

### Equivalencias de tablas

```
supabase.from('song_stats')     → firestore().collection('song_stats')
supabase.from('setlists')       → firestore().collection('setlists')
supabase.from('user_settings')  → firestore().collection('user_settings')
```

### Patrón upsert

**Antes:**
```ts
await supabase.from('song_stats').upsert({
  user_id: user.id,
  song_id: songId,
  play_count: stats.playCount,
});
```

**Después:**
```ts
const uid = auth().currentUser?.uid;
await firestore()
  .collection('song_stats')
  .doc(`${uid}_${songId}`)
  .set({ userId: uid, songId, playCount: stats.playCount }, { merge: true });
```

### Patrón query

**Antes:**
```ts
const { data: stats } = await supabase.from('song_stats').select('*').eq('user_id', user.id);
```

**Después:**
```ts
const snapshot = await firestore()
  .collection('song_stats')
  .where('userId', '==', uid)
  .get();
const stats = snapshot.docs.map(doc => doc.data());
```

---

## FASE 6 — Reemplazar `LiveSessionService.ts`

**Antes (Supabase Realtime):**
```ts
const channel = supabase.channel(`live_follow_${sessionId}`)
  .on('postgres_changes', { event: 'UPDATE', table: 'live_sessions', filter: `id=eq.${sessionId}` },
    (payload) => onSongChange(payload.new.current_song_id)
  ).subscribe();
```

**Después (Firestore onSnapshot):**
```ts
const unsubscribe = firestore()
  .collection('live_sessions')
  .doc(sessionId)
  .onSnapshot((doc) => {
    const newSongId = doc.data()?.currentSongId;
    if (newSongId) onSongChange(newSongId);
  });

return unsubscribe; // misma interfaz que antes ✅
```

---

## FASE 7 — Eliminar Edge Function `refresh-google-token`

Con Firebase Auth + `@react-native-google-signin`, el refresh es automático:

```ts
// Reemplaza toda la Edge Function + refreshGoogleToken()
const { accessToken } = await GoogleSignin.getTokens();
// getTokens() refresca automáticamente si el token expiró
```

---

## FASE 8 — Reglas de seguridad en Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /song_stats/{docId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }

    match /setlists/{docId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }

    match /user_settings/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid;
    }

    match /live_sessions/{sessionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == resource.data.directorUid;
    }
  }
}
```

---

## Orden de ejecución

| Fase | Tarea | Tiempo estimado |
|---|---|---|
| 1 | Setup Firebase Console + `google-services.json` | 30 min |
| 2 | Instalar paquetes + rebuild APK | 20 min |
| 3 | Nuevo `AuthService.ts` | 1 hora |
| 4 | Crear `firebase.ts`, eliminar `supabase.ts` | 10 min |
| 5 | Sync en `StorageService.ts` | 45 min |
| 6 | Nuevo `LiveSessionService.ts` | 30 min |
| 7 | Eliminar Edge Function | 10 min |
| 8 | Reglas Firestore | 20 min |

> **⚠️ Aviso:** `@react-native-firebase` requiere **build nativo** — no funciona con Expo Go.
> Usá `npx expo run:android` o EAS Build.

> **💡 Tip:** Podés migrar gradualmente. Primero Auth (Fases 1-4), verificar que funciona,
> y después los datos (Fases 5-8). Ambos sistemas pueden coexistir temporalmente.
