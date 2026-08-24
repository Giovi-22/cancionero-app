# Implementación de Bandas y Director Mode — App Cancionero

## Objetivo

Rediseñar el sistema de **Director Mode** para que la aplicación pueda publicarse en Google Play Store y ser utilizada por cualquier usuario, pero permitiendo que las funciones de dirección y sincronización en tiempo real estén restringidas a los miembros autorizados de una banda.

La implementación debe aprovechar la migración actual de **Supabase a Firebase/Firestore**.

La idea central es dejar de pensar Director Mode como una simple función habilitada para determinados emails y pasar a un modelo de **Bandas**, donde los usuarios pertenecen a uno o más grupos musicales y tienen distintos roles y permisos.

---

# 1. Concepto general

La aplicación tendrá dos conceptos separados:

### Listas personales

Un usuario puede tener sus propias canciones/listas y utilizarlas normalmente.

### Bandas

Una banda representa un grupo de usuarios que comparten repertorio y pueden utilizar funciones colaborativas, especialmente Director Mode.

Ejemplo:

```text
Usuario
│
├── Listas personales
│
└── Bandas
    │
    ├── Mi Banda
    │   ├── Miembros
    │   ├── Listas
    │   └── Sesiones de Director
    │
    └── Otra Banda
        ├── Miembros
        ├── Listas
        └── Sesiones de Director
```

Un usuario podrá pertenecer a varias bandas.

---

# 2. Nueva sección / tab "Banda"

Agregar una nueva sección principal de navegación llamada:

**Banda**

Esta sección debe centralizar todo lo relacionado con las bandas del usuario.

La pantalla no debería contener toda la lógica de negocio. Debe ser una pantalla liviana que consuma hooks/servicios/componentes reutilizables.

## Posible estructura

```text
Banda
│
├── Mis bandas
│
├── Crear banda
│
├── Unirse a una banda
│
└── [Banda seleccionada]
     │
     ├── Información
     ├── Miembros
     ├── Listas / Repertorio
     └── Director Mode
```

Si el usuario no pertenece a ninguna banda:

```text
Banda

Todavía no pertenecés a ninguna banda.

[Crear banda]
[Unirse a una banda]
```

---

# 3. Creación de una banda

Un usuario puede crear una banda.

Formulario mínimo:

```text
Nombre de la banda
[________________]

[Crear banda]
```

El creador pasa automáticamente a ser:

```text
role: owner
```

Ejemplo:

```text
Mi Banda

Juan      OWNER
Pedro     MEMBER
Luis      MEMBER
María     MEMBER
```

Más adelante se puede permitir más de un director.

---

# 4. Roles

Definir roles de manera clara.

Roles iniciales:

```text
owner
director
member
```

## Owner

Puede:

- editar información de la banda
- administrar miembros
- invitar miembros
- eliminar miembros
- asignar/quitar permisos de director
- crear/iniciar sesiones de Director
- administrar listas de la banda
- eliminar la banda

## Director

Puede:

- ver la banda
- ver sus miembros
- acceder al repertorio
- crear/iniciar sesiones de Director
- controlar una sesión activa
- enviar comandos a los miembros

No debería poder eliminar la banda ni administrar funciones críticas del owner.

## Member

Puede:

- ver la banda
- ver miembros
- acceder a las listas compartidas
- participar en sesiones de Director

No puede:

- administrar miembros
- crear sesiones de Director
- modificar configuraciones administrativas

La estructura debe permitir agregar nuevos roles/permisos posteriormente sin tener que rehacer toda la arquitectura.

---

# 5. Invitaciones

El owner/director debería poder invitar usuarios.

Primera implementación recomendada: **invitación mediante email**.

Ejemplo de UI:

```text
Invitar miembro

Email
[________________________]

[Enviar invitación]
```

La invitación debe almacenarse en Firestore.

Conceptualmente:

```text
invitations/{invitationId}

{
  bandId,
  invitedEmail,
  invitedBy,
  status: "pending",
  createdAt,
  expiresAt
}
```

Estados posibles:

```text
pending
accepted
rejected
expired
cancelled
```

No asumir que el usuario invitado ya existe.

Si todavía no tiene cuenta, la invitación debe poder quedar pendiente y asociarse posteriormente cuando se registre con ese email.

---

# 6. Aceptación de invitaciones

Cuando un usuario inicia sesión, la aplicación debe comprobar si existen invitaciones pendientes asociadas a su email.

Mostrar algo similar a:

```text
Tenés una invitación

Juan te invitó a:

"Mi Banda"

[Rechazar] [Aceptar]
```

Al aceptar:

1. validar que la invitación siga vigente;
2. agregar al usuario como miembro de la banda;
3. actualizar la invitación a `accepted`;
4. asociar correctamente el `userId`;
5. evitar duplicar membresías.

La operación debería ser segura y, cuando corresponda, utilizar una transacción/batch de Firestore.

---

# 7. No limitar Director Mode mediante una lista global de emails

No implementar algo como:

```text
directorEmails = [
  "juan@gmail.com",
  "pedro@gmail.com"
]
```

Esto no escala y mezcla autorización con usuarios individuales.

La autorización debe derivarse de:

```text
Usuario
   ↓
Membresía de banda
   ↓
Rol
   ↓
Permisos
```

Esto permitirá que la aplicación sea pública y que cada banda administre sus propios miembros.

---

# 8. Director Mode

Director Mode debe estar asociado a una banda.

Un usuario solamente puede iniciar Director Mode si:

1. está autenticado;
2. pertenece a una banda;
3. tiene rol `owner` o `director`;
4. la banda tiene una sesión válida disponible para iniciar.

Conceptualmente:

```text
¿Está autenticado?
    ↓
¿Pertenece a una banda?
    ↓
¿Tiene permiso de director?
    ↓
Sí → puede iniciar Director Mode
```

Un miembro normal puede participar en una sesión, pero no iniciarla.

---

# 9. Sesión de Director

Cuando el director inicia Director Mode, se crea una sesión asociada a la banda.

Conceptualmente:

```text
directorSessions/{sessionId}

{
  bandId,
  directorId,
  status: "active",
  currentSongId,
  createdAt,
  startedAt,
  endedAt
}
```

No guardar continuamente el `scrollY` como estado principal.

La comunicación debe basarse preferentemente en **eventos/comandos**.

Ejemplos:

```text
SONG_CHANGED
SCROLL_UP
SCROLL_DOWN
NEXT_SONG
PREVIOUS_SONG
```

Esto mantiene el sistema desacoplado y evita depender de sincronizar continuamente la posición exacta del scroll.

---

# 10. Flujo del Director

Ejemplo:

```text
Director
   │
   │ inicia sesión
   ▼
Firestore
   │
   │ sesión activa
   ▼
Miembros de la banda
   │
   ├── Pedro
   ├── Luis
   └── María
```

El director utiliza el pedal ESP32.

```text
ESP32
  ↓
Bluetooth HID
  ↓
App del Director
  ↓
Evento
  ↓
Firestore
  ↓
Apps de los miembros
```

Ejemplo:

```text
ESP32
  ↓
SCROLL_DOWN
  ↓
App Director
  ↓
Firestore
  ↓
Pedro / Luis / María
```

Cada cliente ejecuta localmente el comportamiento correspondiente.

---

# 11. Participación en una sesión

Cuando un miembro abre la sección de Banda y existe una sesión activa:

```text
🎵 Sesión activa

Mi Banda
Director: Juan

[Unirse]
```

Una vez unido:

```text
Modo Director

Sincronizado con:
Mi Banda

Canción:
"Alabanza"

Director:
Juan
```

El miembro no debería tener controles de dirección, salvo los que posteriormente se definan explícitamente.

---

# 12. Seguridad Firestore

Este punto es crítico.

No confiar únicamente en la interfaz.

Ocultar el botón de Director Mode NO es seguridad.

Las **Firestore Security Rules** deben impedir que un usuario no autorizado acceda o modifique datos de una banda o sesión.

Reglas conceptuales:

```text
Usuario autenticado
       ↓
¿Pertenece a bandId?
       ↓
     SÍ
       ↓
Puede leer información permitida
```

Para crear/modificar sesiones:

```text
¿Es owner o director?
       ↓
     SÍ
       ↓
Puede crear/modificar sesión
```

Un `member` no debería poder crear una sesión de Director.

Un usuario que no pertenece a la banda no debería poder leer sus datos privados.

Las reglas deben ser diseñadas junto con el modelo de datos, no como una tarea posterior.

---

# 13. Modelo de datos recomendado

No acoplar innecesariamente toda la información en documentos gigantes.

Preferir una estructura que permita crecer.

Una posible arquitectura:

```text
users/{userId}

bands/{bandId}
  ├── name
  ├── ownerId
  ├── createdAt
  └── updatedAt

bands/{bandId}/members/{userId}
  ├── role
  ├── joinedAt
  └── displayName / información mínima necesaria

bands/{bandId}/lists/{listId}
  ├── name
  ├── createdBy
  ├── createdAt
  └── updatedAt

bands/{bandId}/sessions/{sessionId}
  ├── directorId
  ├── status
  ├── currentSongId
  ├── createdAt
  ├── startedAt
  └── endedAt

bands/{bandId}/sessions/{sessionId}/events/{eventId}
  ├── type
  ├── payload
  ├── senderId
  └── timestamp

invitations/{invitationId}
  ├── bandId
  ├── invitedEmail
  ├── invitedUserId (si ya existe)
  ├── invitedBy
  ├── status
  ├── createdAt
  └── expiresAt
```

Esta estructura es conceptual y debe adaptarse al modelo Firestore que ya existe en la aplicación.

Antes de modificarla, revisar el esquema actual y reutilizar entidades existentes cuando tenga sentido.

---

# 14. No duplicar información innecesariamente

Evitar guardar información que ya puede obtenerse de otra fuente.

Por ejemplo, si `userId` es suficiente para identificar al usuario, no duplicar permanentemente todo su perfil dentro de cada documento.

Sin embargo, pequeños datos desnormalizados como `displayName` pueden ser aceptables si mejoran considerablemente la lectura y se actualizan de forma controlada.

Priorizar consistencia y simplicidad.

---

# 15. Arquitectura de código

La implementación debe mantener una arquitectura limpia y profesional.

**No concentrar toda la lógica en las pantallas.**

Las pantallas deben tener únicamente el código necesario para:

- renderizar;
- manejar interacción de UI;
- consumir hooks;
- mostrar estados de loading/error/empty;
- delegar operaciones a servicios.

La lógica de negocio debe estar desacoplada.

---

# 16. Servicios

Crear servicios específicos cuando corresponda.

Ejemplo:

```text
services/
├── auth/
├── firestore/
├── bands/
│   ├── bandService.ts
│   ├── bandMemberService.ts
│   ├── invitationService.ts
│   └── directorSessionService.ts
└── ...
```

No es obligatorio copiar exactamente esta estructura.

Adaptarla a la arquitectura actual del proyecto.

Los servicios deben encargarse de operaciones como:

```text
createBand()
getUserBands()
getBand()
updateBand()
addMember()
removeMember()
changeMemberRole()

createInvitation()
getPendingInvitations()
acceptInvitation()
rejectInvitation()

createDirectorSession()
endDirectorSession()
sendDirectorEvent()
listenToDirectorSession()
listenToDirectorEvents()
```

Los nombres pueden adaptarse a las convenciones existentes.

---

# 17. Utils

Toda función genérica y reutilizable debe estar fuera de las pantallas.

Por ejemplo:

```text
utils/
├── emailUtils.ts
├── dateUtils.ts
├── permissionUtils.ts
├── bandUtils.ts
└── ...
```

Solo colocar allí funciones realmente reutilizables y sin responsabilidad directa de acceso a Firestore.

No convertir `utils` en un depósito de lógica de negocio.

Si una función interactúa con Firestore, probablemente corresponda a un `service`.

---

# 18. Hooks

Cuando una funcionalidad necesite estado y suscripciones, crear hooks reutilizables.

Ejemplos:

```text
hooks/
├── useBands.ts
├── useBand.ts
├── useBandMembers.ts
├── useBandInvitations.ts
├── useDirectorSession.ts
└── ...
```

Ejemplo conceptual:

```ts
const {
  bands,
  loading,
  error,
} = useBands();
```

La pantalla no debería conocer detalles de consultas Firestore.

---

# 19. Componentes reutilizables

Crear componentes cuando una UI tenga comportamiento reutilizable.

Ejemplos:

```text
components/band/
├── BandCard.tsx
├── BandMemberList.tsx
├── BandMemberRow.tsx
├── BandRoleBadge.tsx
├── InvitationCard.tsx
├── InviteMemberForm.tsx
├── BandEmptyState.tsx
└── DirectorSessionCard.tsx
```

También reutilizar componentes generales ya existentes en el proyecto antes de crear nuevos.

No crear componentes artificialmente solo para dividir código.

El criterio debe ser:

> Si una pieza tiene responsabilidad clara, puede reutilizarse o tiene suficiente complejidad para justificar su aislamiento, convertirla en componente.

---

# 20. Pantallas

La navegación debería quedar conceptualmente así:

```text
Tabs
├── Canciones
├── Listas
├── Banda
└── Configuración
```

El nombre exacto de las tabs debe respetar la navegación actual de la aplicación.

Dentro de Banda:

```text
BandHomeScreen
    │
    ├── lista de bandas
    ├── crear banda
    ├── invitaciones
    └── selección de banda

BandDetailScreen
    │
    ├── información
    ├── miembros
    ├── repertorio
    └── Director Mode
```

Si el sistema de navegación actual utiliza otra estructura, adaptarlo en lugar de introducir una arquitectura paralela.

---

# 21. UX recomendada

La sección Banda debe ser sencilla.

### Sin banda

```text
🎸 Tu banda

Todavía no pertenecés a ninguna banda.

[Crear banda]
[Unirme con invitación]
```

### Con una banda

```text
🎸 Mi Banda

6 miembros

[Ver banda]
```

### Dentro de la banda

```text
Mi Banda

Repertorio
6 miembros

Director Mode

[Iniciar Director Mode]
```

El botón de Director Mode solo debe aparecer habilitado para quienes tengan permiso.

---

# 22. Administración de miembros

Dentro de la banda:

```text
Miembros

Juan
Owner

Pedro
Director

Luis
Miembro

María
Miembro

[+ Invitar miembro]
```

El owner podría abrir un menú:

```text
Pedro
Director

Cambiar rol
Eliminar miembro
```

Los permisos deben ser validados también por Firestore Rules.

---

# 23. Soporte para varias bandas

No asumir que un usuario solo puede pertenecer a una banda.

La arquitectura debe soportar:

```text
Usuario
 ├── Banda A
 ├── Banda B
 └── Banda C
```

Esto evita tener que rediseñar la base de datos posteriormente.

La UI puede permitir seleccionar una banda activa.

Por ejemplo:

```text
Banda activa:

[ Mi Banda ▼ ]
```

La banda activa debería ser estado de aplicación/UI, no necesariamente un dato permanente de seguridad.

La seguridad siempre debe derivarse de Firestore.

---

# 24. Director Mode y la banda activa

Director Mode debe trabajar siempre con un `bandId` explícito.

Evitar depender únicamente de variables globales ambiguas.

Conceptualmente:

```ts
startDirectorSession({
  bandId,
  directorId,
  ...
})
```

Y las consultas/eventos deben estar asociados a esa banda.

Esto evita que un usuario perteneciente a varias bandas mezcle sesiones.

---

# 25. Eventos en tiempo real

El sistema de Director debe ser desacoplado de la UI.

La capa de comunicación debería exponer algo parecido a:

```ts
sendDirectorEvent(...)
subscribeToDirectorEvents(...)
```

La UI decide qué hacer con el evento.

Ejemplo:

```text
Firestore event
      ↓
directorSessionService
      ↓
useDirectorSession
      ↓
SongViewer / UI
```

No hacer que `SongViewer` consulte directamente Firestore.

---

# 26. Compatibilidad con el pedal ESP32

El pedal existente debe seguir funcionando como fuente de comandos.

Arquitectura:

```text
ESP32
 ↓
Bluetooth HID
 ↓
App
 ↓
DirectorSessionService
 ↓
Firestore
 ↓
Listeners de miembros
```

El ESP32 no debería conocer nada acerca de:

- bandas;
- usuarios;
- Firestore;
- autenticación;
- permisos.

Toda esa responsabilidad pertenece a la aplicación.

Esto mantiene el firmware independiente y reutilizable.

---

# 27. Manejo de desconexiones

Director Mode debe contemplar:

- director sin conexión;
- miembro sin conexión;
- pérdida temporal de Internet;
- sesión finalizada;
- usuario que abandona la banda;
- sesión que queda abandonada;
- aplicación cerrada inesperadamente.

No intentar resolver todo en la primera versión, pero diseñar las interfaces para permitirlo.

Por ejemplo:

```text
status:
active
ended
expired
```

---

# 28. Primera versión recomendada

No implementar todo de golpe.

Orden sugerido:

## Fase 1 — Modelo

- revisar modelo Firestore actual;
- definir `bands`;
- definir `members`;
- definir `invitations`;
- definir roles;
- definir reglas de seguridad.

## Fase 2 — UI Banda

- nueva tab Banda;
- crear banda;
- listar bandas;
- entrar a detalle de banda;
- mostrar miembros.

## Fase 3 — Invitaciones

- invitar por email;
- detectar invitaciones pendientes;
- aceptar/rechazar;
- agregar miembro.

## Fase 4 — Roles

- owner;
- director;
- member;
- administración de permisos.

## Fase 5 — Director Session

- iniciar sesión;
- finalizar sesión;
- identificar banda;
- identificar director;
- listeners en tiempo real.

## Fase 6 — Integración con SongViewer

- recibir eventos;
- cambiar canción;
- scroll;
- sincronización.

## Fase 7 — Integración completa con pedal

- ESP32 → App Director → Firestore → miembros.

---

# 29. Consideraciones importantes de seguridad

Nunca confiar en:

```text
if (user.role === "director") {
   mostrarBoton();
}
```

Eso es solamente UX.

La seguridad real debe estar en:

```text
Firestore Security Rules
```

También evitar guardar permisos únicamente en el dispositivo.

El cliente puede mostrar/ocultar funcionalidades, pero Firestore debe decidir si una operación está autorizada.

---

# 30. Reglas de arquitectura

Durante toda la implementación respetar estas reglas:

### 1. Pantallas delgadas

Las pantallas deben tener el código justo y necesario.

Evitar:

```text
Screen
 ├── consultas Firestore
 ├── lógica de permisos
 ├── transformación de datos
 ├── lógica de invitaciones
 ├── listeners
 ├── navegación
 └── UI
```

Preferir:

```text
Screen
   ↓
Hook
   ↓
Service
   ↓
Firestore
```

### 2. Servicios desacoplados

Toda operación de Firestore reutilizable debe vivir en servicios.

### 3. Hooks reutilizables

La lógica de estado/suscripciones debe extraerse cuando pueda reutilizarse.

### 4. Componentes reutilizables

Extraer componentes cuando tengan responsabilidad clara o reutilización potencial real.

### 5. Utils

Funciones puras y genéricas en `utils`.

No colocar acceso a Firestore dentro de utils.

### 6. No duplicar lógica

Si la misma lógica aparece en dos lugares, evaluar extraerla.

### 7. Mantener compatibilidad

No romper funcionalidades existentes de:

- canciones;
- listas;
- autenticación;
- Google Drive;
- SongViewer;
- pedal;
- autoscroll;
- transposición;
- Stage Mode;
- Director Mode existente.

### 8. Migración incremental

No hacer un rewrite completo de la aplicación.

Implementar la nueva arquitectura de forma incremental sobre el código existente.

---

# 31. Criterio para tomar decisiones

Antes de crear una nueva clase, hook, servicio o componente, revisar si ya existe algo equivalente.

Priorizar:

```text
Reutilizar
   ↓
Extender
   ↓
Refactorizar
   ↓
Crear nuevo
```

Evitar duplicar servicios o crear dos mecanismos diferentes para hacer la misma cosa.

---

# 32. Resultado esperado

Al finalizar esta implementación, un usuario nuevo de la Play Store podrá:

1. registrarse/iniciar sesión;
2. utilizar normalmente la aplicación;
3. crear o recibir una invitación a una banda;
4. pertenecer a una o varias bandas;
5. ver el repertorio de su banda;
6. participar en una sesión de Director;
7. recibir comandos en tiempo real.

Y un director podrá:

1. crear una banda;
2. invitar músicos por email;
3. administrar miembros;
4. asignar permisos de director;
5. seleccionar una lista/repertorio;
6. iniciar Director Mode;
7. utilizar el pedal ESP32;
8. controlar remotamente las aplicaciones de los miembros.

Un usuario ajeno a la banda no podrá acceder a sus datos ni utilizar su Director Mode.

---

# 33. Instrucción general para el agente de IA

Antes de modificar código:

1. Analizar la arquitectura actual del proyecto.
2. Identificar cómo está implementado actualmente Firestore.
3. Identificar autenticación y modelo de usuario existente.
4. Identificar cómo está implementado actualmente Director Mode.
5. Identificar cómo está implementado SongViewer y el estado de scroll/canción.
6. Identificar la navegación/tab actual.
7. Proponer cambios mínimos y compatibles con la arquitectura existente.
8. No duplicar funcionalidades ya existentes.
9. Mantener separación entre UI, lógica de negocio, servicios y utilidades.
10. Crear componentes/hook/servicios reutilizables cuando corresponda.
11. Mantener las pantallas lo más simples posible.
12. Implementar Firestore Security Rules junto con el modelo.
13. No asumir que ocultar botones constituye una medida de seguridad.
14. Hacer la implementación incrementalmente.
15. Después de cada etapa, verificar que las funcionalidades existentes continúan funcionando.

La prioridad debe ser:

**arquitectura limpia + seguridad + reutilización + simplicidad + compatibilidad con el código existente.**

No realizar un rewrite innecesario de la aplicación.
