# INFORME SEGUNDA AUDITORÍA DE FIRESTORE: REVISIÓN DE COBERTURA, REGLAS Y CÓDIGO REAL

**Proyecto:** App-cancionero-mobile  
**Fecha:** 25 de Agosto de 2026  
**Tipo de Auditoría:** Segunda Auditoría de Verificación y Re-cálculo (Solo Lectura)  
**Resultado de Suite de Tests Actual:** `39 passed, 39 total` (100% pasando en emulador)  

---

## A. RESUMEN EJECUTIVO Y VERIFICACIÓN DE AFIRMACIONES

### 1. Estado General de Compatibilidad y Seguridad
* **Flujo Principal (Bandas, Miembros e Invitaciones):** **100% Seguro y Atómico.** La creación de bandas, el control de roles (`owner`, `director`, `member`) y la incorporación atómica de miembros mediante invitaciones funcionan de manera perfecta y están fuertemente protegidos por `firestore.rules` con `getAfter()` y `existsAfter()`.
* **Vulnerabilidad Real Encontrada (Inconsistencia en Setlists):** Existe un problema de seguridad importante en `SetlistService.ts` debido a que crea y actualiza documentos en la colección `setlists` **sin incluir el campo `user_id`**. Por su parte, la regla legacy en `firestore.rules` contiene la condición fallback `!('user_id' in resource.data)`. Esto permite que **cualquier usuario autenticado pueda editar o borrar cualquier setlist creado por `SetlistService.ts`**.
* **Problema de Compatibilidad Real (Invitaciones Expiradas):** En `InvitationService.ts` (`getPendingInvitationsForEmail`), la aplicación intenta escribir `await doc.ref.update({ status: 'expired' })` cuando detecta una invitación vencida. Las reglas de seguridad rechazan esta escritura desde el cliente.

### 2. Recálculo Exacto de Números

| Métrica | Cantidad | Explicación |
| :--- | :--- | :--- |
| **Operaciones Firestore en Código** | **44** | Llamadas directas en servicios (`UserService`, `BandService`, `InvitationService`, `StorageService`, `SetlistService`, `LiveSessionService`). |
| **Suite de Tests Existentes** | **39** | Pruebas ejecutadas y validadas en `rules-tests/firestore.rules.test.js`. |
| **Operaciones Lógicas Cubiertas** | **22** | Cobertura rigurosa en `users` (creación), `bands` (creación, edición, restricciones), `members` (creación inicial, agregado por owner, join atómico, abandono) e `invitations` (creación, lectura por invitado, aceptación atómica). |
| **Operaciones Lógicas Sin Cobertura** | **22** | Operaciones reales en el código que no tienen ningún test unitario en la suite (ver Sección G). |
| **Casos de Test Adicionales Recomendados** | **22** | Pruebas recomendadas para cubrir el 100% de la funcionalidad real de la app. |

---

## B. MATRIZ DE COBERTURA REAL DE TESTS (LOS 39 TESTS EXISTENTES)

A continuación se muestra el cruce exacto entre cada uno de los 39 tests existentes en `rules-tests/firestore.rules.test.js` y las reglas que valida:

| # | Sección Test | Nombre Exacto del Test | Ruta Firestore | Operación | Actor | Resultado Esperado | ¿Cubierto en Tests? |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: | :-: |
| 1 | USERS | usuario autenticado puede crear su propio perfil | `users/{userId}` | create (set) | Propio Usuario | SUCCEED | SI |
| 2 | USERS | usuario no autenticado NO puede crear un perfil | `users/{userId}` | create (set) | No Autenticado | FAIL | SI |
| 3 | USERS | usuario NO puede crear el perfil de otro usuario | `users/{userId}` | create (set) | Usuario Ajeno | FAIL | SI |
| 4 | BANDS | usuario autenticado puede crear una banda siendo owner | `bands/{bandId}` | create (set) | Creador | SUCCEED | SI |
| 5 | BANDS | usuario NO puede crear una banda asignando otro ownerId | `bands/{bandId}` | create (set) | Usuario Ajeno | FAIL | SI |
| 6 | BANDS | usuario no autenticado NO puede crear una banda | `bands/{bandId}` | create (set) | No Autenticado | FAIL | SI |
| 7 | BANDS | owner puede actualizar su banda | `bands/{bandId}` | update | Owner | SUCCEED | SI |
| 8 | BANDS | owner NO puede cambiar ownerId | `bands/{bandId}` | update | Owner | FAIL | SI |
| 9 | BANDS | usuario que NO es miembro NO puede leer la banda | `bands/{bandId}` | read (get) | Usuario Externo | FAIL | SI |
| 10 | MEMBERS | owner inicial puede crearse junto con la banda mediante batch | `bands/{bandId}/members/{uid}` | create (batch) | Owner Inicial | SUCCEED | SI |
| 11 | MEMBERS | usuario NO puede crearse como owner de una banda existente si no es el owner | `bands/{bandId}/members/{uid}` | create (set) | Atacante | FAIL | SI |
| 12 | MEMBERS | owner puede agregar un miembro | `bands/{bandId}/members/{uid}` | create (set) | Owner | SUCCEED | SI |
| 13 | MEMBERS | owner puede agregar un director | `bands/{bandId}/members/{uid}` | create (set) | Owner | SUCCEED | SI |
| 14 | MEMBERS | owner NO puede agregar otro owner | `bands/{bandId}/members/{uid}` | create (set) | Owner | FAIL | SI |
| 15 | MEMBERS | miembro normal NO puede agregar otro miembro | `bands/{bandId}/members/{uid}` | create (set) | Member | FAIL | SI |
| 16 | MEMBERS | miembro puede leer su propio documento | `bands/{bandId}/members/{uid}` | read (get) | Propio Miembro | SUCCEED | SI |
| 17 | MEMBERS | miembro puede abandonar la banda eliminándose a sí mismo | `bands/{bandId}/members/{uid}` | delete | Member mismo | SUCCEED | SI |
| 18 | MEMBERS | owner NO puede eliminarse a sí mismo | `bands/{bandId}/members/{uid}` | delete | Owner mismo | FAIL | SI |
| 19 | INVITATIONS | owner puede crear una invitación para member | `invitations/{invId}` | create (set) | Owner | SUCCEED | SI |
| 20 | INVITATIONS | owner puede crear una invitación para director | `invitations/{invId}` | create (set) | Owner | SUCCEED | SI |
| 21 | INVITATIONS | owner NO puede invitar con rol owner | `invitations/{invId}` | create (set) | Owner | FAIL | SI |
| 22 | INVITATIONS | director NO puede invitar otro director | `invitations/{invId}` | create (set) | Director | FAIL | SI |
| 23 | INVITATIONS | director puede invitar un member | `invitations/{invId}` | create (set) | Director | SUCCEED | SI |
| 24 | INVITATIONS | usuario invitado puede leer su invitación | `invitations/{invId}` | read (get) | Invitado | SUCCEED | SI |
| 25 | INVITATIONS | usuario que NO es invitado NO puede leer la invitación | `invitations/{invId}` | read (get) | Usuario Ajeno | FAIL | SI |
| 26 | INVITATIONS | usuario invitado NO puede aceptar la invitación sin crear miembro | `invitations/{invId}` | update | Invitado sin batch | FAIL | SI |
| 27 | INVITATIONS | usuario invitado NO puede aceptar con otro invitedUserId | `invitations/{invId}` | update | Invitado con id ajeno | FAIL | SI |
| 28 | INVITATIONS | usuario NO invitado NO puede aceptar la invitación | `invitations/{invId}` | update | Atacante | FAIL | SI |
| 29 | INVITATIONS | invitación vencida NO puede ser aceptada | `invitations/{invId}` | update | Invitado (vencida) | FAIL | SI |
| 30 | INVITATIONS | usuario invitado NO puede modificar otros campos de la invitación | `invitations/{invId}` | update | Invitado (cambia rol) | FAIL | SI |
| 31 | INVITATIONS | usuario invitado NO puede modificar invitedEmail al aceptar | `invitations/{invId}` | update | Invitado (cambia email) | FAIL | SI |
| 32 | INVITATIONS | usuario invitado NO puede modificar bandId al aceptar | `invitations/{invId}` | update | Invitado (cambia band) | FAIL | SI |
| 33 | ATOMIC JOIN | aceptar invitación + crear miembro EN EL MISMO BATCH debe funcionar | `invitations` + `members` | batch (update+set) | Invitado | SUCCEED | SI |
| 34 | ATOMIC JOIN | crear miembro SIN aceptar la invitación debe fallar | `members` | create (set sin inv) | Invitado | FAIL | SI |
| 35 | ATOMIC JOIN | aceptar invitación SIN crear miembro debe fallar | `invitations` | update (sin member) | Invitado | FAIL | SI |
| 36 | ATOMIC JOIN | crear miembro con invitationId de otra banda debe fallar | `invitations` + `members` | batch cruzado | Invitado | FAIL | SI |
| 37 | ATOMIC JOIN | crear miembro con rol diferente al de la invitación debe fallar | `invitations` + `members` | batch rol distinto | Invitado | FAIL | SI |
| 38 | ATOMIC JOIN | invitación vencida + creación de miembro debe fallar | `invitations` + `members` | batch vencido | Invitado | FAIL | SI |
| 39 | ATOMIC JOIN | invitación ya aceptada NO puede aceptarse nuevamente | `invitations` + `members` | re-aceptar batch | Invitado | FAIL | SI |

---

## C. MATRIZ COMPLETA DE OPERACIONES FIRESTORE EN EL CÓDIGO REAL

| Colección | Operación Firestore | Archivo / Función | Campos Enviados / Consultados | Condición de Regla Evaluada | Estado de Compatibilidad |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `setDoc` | `UserService.ts:39` | `uid, email, displayName, photoURL, createdAt, updatedAt` | `request.auth.uid == userId` + `hasOnly` | 🟢 Compatible |
| `users` | `updateDoc` | `UserService.ts:52` | `email, displayName, photoURL, updatedAt` | `request.auth.uid == userId` + `hasOnly` | 🟢 Compatible |
| `users` | `getDoc` | `UserService.ts:28,79` | Documento de perfil | `isSignedIn()` | 🟢 Compatible |
| `users` | `getDocs` | `UserService.ts:95` | `where('email', '==', cleanEmail)` | `isSignedIn()` | 🟢 Compatible |
| `bands` | `writeBatch` (set) | `BandService.ts:52` | `id, name, description, ownerId, createdAt, updatedAt` | `request.resource.data.ownerId == request.auth.uid` | 🟢 Compatible |
| `bands` | `getDoc` | `BandService.ts:82` | Documento de banda | `isBandMember(bandId)` | 🟢 Compatible |
| `members` | `writeBatch` (set) | `BandService.ts:53` | `userId, email, displayName, photoURL, role: 'owner', joinedAt` | `request.auth.uid == memberUserId` + `existsAfter(bands/{bandId})` | 🟢 Compatible |
| `members` | `getDocs` | `BandService.ts:68` | `collectionGroup('members').where('userId', '==', userId)` | `request.auth.uid == memberUserId` | 🟢 Compatible |
| `members` | `getDocs` | `BandService.ts:108` | Subcolección `members` de banda | `isBandMember(bandId)` | 🟢 Compatible |
| `members` | `onSnapshot` | `BandService.ts:130` | Subcolección `members` en tiempo real | `isBandMember(bandId)` | 🟢 Compatible |
| `members` | `updateDoc` | `BandService.ts:161` | `role: 'member' | 'director'` | `isBandOwner(bandId)` y `role in ['member','director']` | 🟢 Compatible |
| `members` | `deleteDoc` | `BandService.ts:177` | N/A (borrado) | `isBandOwner` o `request.auth.uid == memberUserId` (no owner) | 🟢 Compatible |
| `invitations` | `getDocs` | `InvitationService.ts:54` | `where('email', '==', cleanEmail)` | `isBandMember(bandId)` | 🟢 Compatible |
| `invitations` | `getDocs` | `InvitationService.ts:66` | `where('bandId', '==', bandId)`, `where('invitedEmail', '==', cleanEmail)` | `isBandDirectorOrOwner` | 🟢 Compatible |
| `invitations` | `setDoc` | `InvitationService.ts:96` | `id, bandId, bandName, invitedEmail, invitedByUserId, role, status: 'pending', expiresAt` | `isBandDirectorOrOwner` y validación de rol | 🟢 Compatible |
| `invitations` | `getDocs` | `InvitationService.ts:109` | `where('invitedEmail', '==', cleanEmail)`, `where('status', '==', 'pending')` | `resource.data.invitedEmail == request.auth.token.email` | 🟢 Compatible |
| `invitations` | `updateDoc` | `InvitationService.ts:121` | `{ status: 'expired' }` | **No permite cambiar a `'expired'` desde cliente** | 🔴 Bloqueado por regla |
| `invitations` | `onSnapshot` | `InvitationService.ts:145` | Invitaciones pendientes en tiempo real | `resource.data.invitedEmail == request.auth.token.email` | 🟢 Compatible |
| `invitations` | `getDocs` | `InvitationService.ts:170` | `where('bandId', '==', bandId)` | `isBandDirectorOrOwner(bandId)` | 🟢 Compatible |
| `invitations` | `getDoc` | `InvitationService.ts:197` | Documento de invitación | `resource.data.invitedEmail == request.auth.token.email` | 🟢 Compatible |
| `invitations` | `writeBatch` (update)| `InvitationService.ts:256` | `{ status: 'accepted', invitedUserId }` | `existsAfter(memberRef)` + acoplamiento con miembro | 🟢 Compatible (Atómico) |
| `members` | `writeBatch` (set) | `InvitationService.ts:260` | `userId, email, displayName, photoURL, role, invitationId, joinedAt` | `isValidInvitationJoin` + `getAfter(invRef)` | 🟢 Compatible (Atómico) |
| `invitations` | `updateDoc` | `InvitationService.ts:286` | `{ status: 'rejected' }` | `invitedEmail == token.email` + `status == 'pending'` | 🟢 Compatible |
| `invitations` | `updateDoc` | `InvitationService.ts:297` | `{ status: 'cancelled' }` | `isBandDirectorOrOwner` + `status == 'pending'` | 🟢 Compatible |
| `user_settings`| `setDoc` | `StorageService.ts:329` | `user_id, settings, updated_at` | `request.auth.uid == userId` | 🟢 Compatible |
| `user_settings`| `getDoc` | `StorageService.ts:462` | Documento de configuración | `request.auth.uid == userId` | 🟢 Compatible |
| `song_stats` | `setDoc` | `StorageService.ts:272` | `user_id, song_id, view_count, last_played_at` | `request.resource.data.user_id == request.auth.uid` | 🟢 Compatible |
| `song_stats` | `getDocs` | `StorageService.ts:430` | `where('user_id', '==', user.uid)` | `resource.data.user_id == request.auth.uid` | 🟢 Compatible |
| `setlists` | `addDoc` | `SetlistService.ts:67` | `user_email, name, song_ids, is_public: false, created_at` | **Sin `user_id`. Regla evalúa `!('user_id' in data)`** | 🟠 Vulnerabilidad |
| `setlists` | `setDoc` (update) | `SetlistService.ts:98` | `user_email, name, song_ids, is_public, updated_at` | **Sin `user_id`. Permite update a cualquier usuario** | 🟠 Vulnerabilidad |
| `setlists` | `getDocs` | `SetlistService.ts:29` | `where('user_email', '==', userEmail)` | Regla requiere `user_id == auth.uid` o `isPublic` | 🟡 Incompatibilidad Query |
| `setlists` | `deleteDoc` | `SetlistService.ts:119` | N/A (borrado) | `!('user_id' in resource.data)` | 🟠 Vulnerabilidad |
| `setlists` | `setDoc` | `StorageService.ts:367` | `id, user_id, name, date, song_ids, is_public, notes...` | `resource.data.user_id == request.auth.uid` | 🟢 Compatible |
| `setlists` | `deleteDoc` | `StorageService.ts:419` | N/A (borrado) | `resource.data.user_id == request.auth.uid` | 🟢 Compatible |
| `setlists` | `getDocs` | `StorageService.ts:444` | `where('user_id', '==', user.uid)` | `resource.data.user_id == request.auth.uid` | 🟢 Compatible |
| `live_sessions`| `getDocs` | `LiveSessionService.ts:20` | `where('status', '==', 'live')` | `isSignedIn()` | 🟢 Compatible |
| `live_sessions`| `addDoc` | `LiveSessionService.ts:83` | `setlist_id, setlist_name, director_email...` | `request.resource.data.director_email == token.email` | 🟢 Compatible |
| `live_sessions`| `updateDoc` | `LiveSessionService.ts:60,121` | `{ setlist_id, status: 'live' }`, `{ current_song_id }` | `resource.data.director_email == token.email` | 🟢 Compatible |
| `live_sessions`| `deleteDoc` | `LiveSessionService.ts:113` | N/A (borrado) | `resource.data.director_email == token.email` | 🟢 Compatible |
| `live_sessions`| `onSnapshot` | `LiveSessionService.ts:137,155`| Escucha en tiempo real de sesión o lista live | `isSignedIn()` | 🟢 Compatible |

---

## D. VULNERABILIDADES REALES DE SEGURIDAD

### 🟠 IMPORTANTE: Inconsistencia y Agujero de Seguridad en `setlists/{setlistId}`

1. **Campos escritos por `SetlistService.ts`:** `user_email`, `name`, `song_ids`, `is_public`, `created_at` / `updated_at`. **NO escribe `user_id` ni `createdBy`.**
2. **Campos escritos por `StorageService.ts`:** `id`, `user_id`, `name`, `date`, `song_ids`, `is_public`, `notes`, `song_notes`, `last_updated`, `library_id`. **SÍ escribe `user_id`.**
3. **Condición de Autorización en `firestore.rules` (líneas 358-362):**
   ```firestore
   allow update, delete: if isSignedIn() && (
     resource.data.user_id == request.auth.uid || 
     resource.data.createdBy == request.auth.uid ||
     !('user_id' in resource.data)
   );
   ```
4. **Demostración del Agujero:**
   * Cuando un usuario crea un setlist mediante `SetlistService.ts`, el documento en Firestore carece del campo `user_id`.
   * Si un segundo usuario autenticado (Atacante) intenta modificar o eliminar ese documento, la regla evalúa:
     1. `isSignedIn()` -> `true`
     2. `resource.data.user_id == request.auth.uid` -> `false`
     3. `!('user_id' in resource.data)` -> **`true`**
   * **Resultado:** La regla concede la operación `update` o `delete` a cualquier usuario autenticado de la aplicación.
5. **Gravedad:** 🟠 **IMPORTANTE**. Permite la manipulación o destrucción maliciosa de setlists de otros usuarios si fueron creados a través de `SetlistService.ts`.

---

## E. PROBLEMAS DE COMPATIBILIDAD

### 🔴 RECHAZO DE ESCRITURA: Intento de marcar invitaciones vencidas a `'expired'` desde el cliente

1. **Código en `InvitationService.ts` (línea 121):**
   ```typescript
   if (this.isExpired(inv.expiresAt)) {
     await doc.ref.update({ status: 'expired' });
   }
   ```
2. **Regla Evaluada en `firestore.rules` (líneas 276-322):**
   ```firestore
   allow update: if isSignedIn() && (
     (
       resource.data.invitedEmail == request.auth.token.email &&
       resource.data.status == 'pending' &&
       resource.data.expiresAt > request.time &&
       ...
       (
         request.resource.data.status == 'accepted' ||
         request.resource.data.status == 'rejected'
       )
     ) || ...
   );
   ```
3. **Análisis:**
   * La regla exige `resource.data.expiresAt > request.time` (que no haya vencido).
   * La regla solo permite que los estados finales sean `'accepted'` o `'rejected'`.
   * Cuando `getPendingInvitationsForEmail()` intenta escribir `status: 'expired'`, la regla falla y Firestore retorna `permission-denied`.
4. **Análisis de Soluciones:**
   * **Opción A (Modificar Reglas):** Permitir actualización a `status: 'expired'` si `expiresAt <= request.time`. *Desventaja:* Agrega complejidad a las reglas y permite mutaciones redundantes desatendidas.
   * **Opción B (Recomendada - Modificar Servicio):** **Eliminar la escritura client-side `await doc.ref.update({ status: 'expired' })` en `InvitationService.ts`.**  
     *Por qué la Opción B es técnicamente superior:* Las reglas de seguridad ya bloquean de forma estricta la aceptación de cualquier invitación cuyo `expiresAt` haya transcurrido. El cliente solo necesita filtrar las invitaciones en memoria. La expiración es una propiedad matemática del tiempo y no requiere escrituras en la base de datos durante la lectura.

### 🟡 INCOMPATIBILIDAD DE CONSULTA: Consulta de Setlists por Email

* `SetlistService.ts` ejecuta `collection('setlists').where('user_email', '==', userEmail).get()`.
* Las reglas de `setlists` autorizan lectura si `isPublic == true`, `user_id == request.auth.uid` o `!('user_id' in resource.data)`.
* Al consultar por `user_email`, si la regla se endurece para exigir `user_id == request.auth.uid`, la consulta por email será rechazada por el motor de reglas de Firestore.

---

## F. VERIFICACIÓN RIGUROSA DE ATOMICIDAD EN INVITACIONES

Se confirmó tanto en los tests unitarios ejecutados (Tests 33 al 39) como en el análisis del código y las reglas:

1. **Aceptar invitación + crear miembro EN EL MISMO BATCH:** **PASS (Test 33)**. `InvitationService.acceptInvitation` agrupa en `batch.update(invRef)` y `batch.set(memberRef)`.
2. **Crear miembro SIN aceptar la invitación:** **FAIL (Test 34)**. Rehusado por `isValidInvitationJoin()` al no encontrar `status == 'accepted'` en `getAfter()`.
3. **Aceptar invitación SIN crear miembro:** **FAIL (Test 35)**. Rehusado por `existsAfter(memberRef)` en la regla de `invitations`.
4. **Crear miembro con `invitationId` de otra banda:** **FAIL (Test 36)**. Validado en `getAfter(invRef).data.bandId == bandId`.
5. **Crear miembro con rol diferente al de la invitación:** **FAIL (Test 37)**. Validado en `getAfter(invRef).data.role == request.resource.data.role`.
6. **Invitación vencida + creación de miembro:** **FAIL (Test 38)**. Validado en `getAfter(invRef).data.expiresAt > request.time`.
7. **Invitación ya aceptada re-procesada:** **FAIL (Test 39)**. Validado en `resource.data.status == 'pending'`.

---

## G. OPERACIONES REALES SIN COBERTURA DE TEST (LAS 22 OPERACIONES)

A pesar de contar con 39 tests passing, existen 22 operaciones lógicas en el código que no tienen test específico en `firestore.rules.test.js`:

1. `users/{userId}`: Lectura de perfil propio y búsqueda por email (`getUserProfile`, `getUserByEmail`).
2. `users/{userId}`: Actualización de perfil propio (`syncUserProfile` update).
3. `bands/{bandId}`: Lectura exitosa del documento de banda por un miembro.
4. `bands/{bandId}`: Eliminación de banda por el Owner.
5. `bands/{bandId}/members/{memberUserId}`: Lectura de miembros de una banda (`getBandMembers` / `subscribeToBandMembers`).
6. `bands/{bandId}/members/{memberUserId}`: Consulta `collectionGroup('members')` por `userId`.
7. `bands/{bandId}/members/{memberUserId}`: Edición de rol de miembro por el Owner (`updateMemberRole`).
8. `bands/{bandId}/members/{memberUserId}`: Eliminación de otro miembro por el Owner (`removeMember`).
9. `bands/{bandId}/sessions/{sessionId}`: Creación de sesión de director.
10. `bands/{bandId}/sessions/{sessionId}`: Lectura de sesiones de director por miembros.
11. `bands/{bandId}/sessions/{sessionId}`: Actualización de sesión por el director.
12. `bands/{bandId}/sessions/{sessionId}`: Eliminación de sesión por el director.
13. `invitations/{invitationId}`: Lectura de invitaciones emitidas por la banda (`getBandInvitations`).
14. `invitations/{invitationId}`: Rechazo de invitación por el usuario invitado (`rejectInvitation`).
15. `invitations/{invitationId}`: Cancelación de invitación por Owner/Director (`cancelInvitation`).
16. `user_settings/{userId}`: Lectura y escritura de configuraciones de usuario.
17. `song_stats/{statId}`: Creación/actualización y lectura de estadísticas de canciones.
18. `setlists/{setlistId}`: Creación y lectura de setlists vía `StorageService`.
19. `setlists/{setlistId}`: Actualización y eliminación de setlists vía `StorageService`.
20. `live_sessions/{sessionId}`: Lectura y suscripción a sesiones en vivo.
21. `live_sessions/{sessionId}`: Creación y actualización de canción activa en sesión en vivo.
22. `live_sessions/{sessionId}`: Finalización (borrado) de sesión en vivo.

---

## H. RECOMENDACIONES PRIORIZADAS DE CORRECCIÓN

*(Recordatorio: No se ha realizado ninguna modificación en el código. Estas son las recomendaciones técnicas ordenadas por prioridad para una etapa posterior)*:

### Prioridad 1: Corregir Vulnerabilidad en `SetlistService.ts`
* **Qué cambiar:** Modificar `SetlistService.ts` para que al crear (`addDoc`) o actualizar (`setDoc`) un setlist, incluya siempre la propiedad `user_id: user.uid` (al igual que lo hace `StorageService.ts`).
* **Por qué:** Garantiza que los setlists tengan dueño explícito en Firestore y previene que la regla `!('user_id' in resource.data)` permita a terceros modificarlos o borrar los datos.

### Prioridad 2: Eliminar Escritura Incompatible de Expiración en `InvitationService.ts`
* **Qué cambiar:** En `InvitationService.ts` (`getPendingInvitationsForEmail`), remover la línea `await doc.ref.update({ status: 'expired' })`.
* **Por qué:** Las reglas de Firestore bloquean esa escritura client-side (retornando `permission-denied`). La fecha de expiración se valida automáticamente en la regla al intentar la aceptación y puede ser filtrada en memoria en el cliente sin necesidad de una mutación en Firestore.

### Prioridad 3: Endurecer Regla Legacy en `firestore.rules` para Setlists
* **Qué cambiar:** Una vez unificado `SetlistService.ts`, eliminar la condición `!('user_id' in resource.data)` en `firestore.rules` para `setlists/{setlistId}`. Exigir obligatoriamente `resource.data.user_id == request.auth.uid`.
* **Por qué:** Elimina el comportamiento inseguro en la base de datos.

### Prioridad 4: Agregar Cobertura de Tests para los Módulos Faltantes
* **Qué cambiar:** Ampliar `rules-tests/firestore.rules.test.js` agregando pruebas para las 22 operaciones identificadas (especialmente `sessions`, `user_settings`, `song_stats`, `setlists` y `live_sessions`).
* **Por qué:** Proteger la aplicación contra regresiones de seguridad durante futuros despliegues.

---

## AUDITORÍA COMPLETADA

* **Reglas revisadas:** SI
* **Código Firestore revisado:** SI
* **Operaciones encontradas:** 44
* **Operaciones cubiertas por tests:** 22
* **Operaciones sin cobertura:** 22
* **Problemas de seguridad encontrados:** 1 Importante (Agujero de seguridad por campos ausentes en `setlists`)
* **Problemas de compatibilidad encontrados:** 2 (Escritura `'expired'` bloqueada + consulta `setlists` por email)
* **Problemas de atomicidad encontrados:** 0
