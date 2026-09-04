# Implementación de Bandas y Director Mode — App Cancionero

## Objetivo

Rediseñar el sistema de Director Mode para que la aplicación pueda publicarse en Google Play Store y ser utilizada por cualquier usuario, pero permitiendo que las funciones de dirección y sincronización en tiempo real estén restringidas a los miembros autorizados de una banda.

La implementación debe aprovechar la migración actual de Supabase a Firebase/Firestore.

La idea central es dejar de pensar Director Mode como una simple función habilitada para determinados emails y pasar a un modelo de Bandas, donde los usuarios pertenecen a uno o más grupos musicales y tienen distintos roles y permisos.

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

La pantalla no debería contener toda la lógica de negocio. Debe ser una pantalla liviana que consuma hooks, servicios y componentes reutilizables.

## Posible estructura

```text
Banda

├── Mis bandas
├── Crear banda
├── Invitaciones
├── Unirse a una banda
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

La creación inicial debe ser atómica y crear simultáneamente:

```text
bands/{bandId}
```

y

```text
bands/{bandId}/members/{ownerId}
```

El usuario creador será el único OWNER inicial.

No se debe permitir la creación de un segundo OWNER mediante operaciones del cliente.

---

# 4. Roles y permisos

Definir roles de manera clara.

Roles iniciales:

```text
owner
director
member
```

Los permisos no deben depender de comprobaciones dispersas del tipo:

```ts
if (role === 'owner')
```

Debe existir una capa de abstracción:

```text
ROLE
  ↓
PERMISSIONS
  ↓
FEATURES
```

La implementación actual utiliza:

```text
getBandPermissions(role)
```

para transformar el rol del usuario en permisos granulares.

## Owner

Puede:

* editar información de la banda;
* administrar miembros;
* invitar miembros;
* invitar usuarios como member o director;
* eliminar miembros;
* asignar el rol director;
* quitar el rol director;
* crear/iniciar sesiones de Director;
* controlar sesiones de Director;
* administrar listas de la banda;
* eliminar la banda.

El Owner es el único rol que puede administrar roles.

## Director

Puede:

* ver la banda;
* ver sus miembros;
* acceder al repertorio;
* crear/iniciar sesiones de Director;
* controlar una sesión activa;
* enviar comandos a los miembros;
* invitar nuevos usuarios como member.

El Director NO puede:

* eliminar la banda;
* editar configuraciones administrativas críticas;
* cambiar roles de miembros;
* asignar el rol director;
* quitar el rol director;
* invitar usuarios como director;
* invitar usuarios como owner;
* administrar funciones exclusivas del Owner.

## Member

Puede:

* ver la banda;
* ver miembros;
* acceder a las listas compartidas;
* participar en sesiones de Director.

No puede:

* administrar miembros;
* enviar invitaciones;
* crear sesiones de Director;
* controlar sesiones;
* modificar configuraciones administrativas;
* cambiar roles.

---

# 5. Cambios de rol

El rol de un miembro es independiente de la forma en que ingresó a la banda.

Por ejemplo:

```text
Member
  ↓
Owner lo promueve
  ↓
Director
```

Al pasar a Director, el usuario obtiene automáticamente los permisos correspondientes al rol director.

No se debe almacenar un campo adicional como:

```text
isDirector
canInvite
canControlSession
```

El rol es la fuente de verdad.

Ejemplo:

```text
role: "director"

↓

getBandPermissions("director")

↓

permisos de Director
```

El Owner también puede quitar el rol de Director:

```text
Director
  ↓
Owner modifica el rol
  ↓
Member
```

Al volver a member, el usuario pierde automáticamente los permisos de Director.

## Reglas de asignación de roles

Únicamente el Owner puede modificar el rol de otro miembro.

Un Owner puede asignar:

```text
member
director
```

Un Owner nunca puede crear otro owner desde el cliente.

Un Director nunca puede promover a otro usuario a Director.

Un Director tampoco puede modificar su propio rol para obtener privilegios adicionales.

---

# 6. Invitaciones

El Owner y el Director pueden invitar usuarios a la banda.

Las invitaciones se realizan inicialmente mediante email.

## Permisos para invitar

Owner:

* puede invitar usuarios como member;
* puede invitar usuarios como director.

Director:

* puede invitar usuarios únicamente como member.

Member:

* no puede enviar invitaciones.

El Director no puede utilizar una invitación para otorgar el rol director.

La asignación del rol director permanece exclusivamente bajo control del Owner.

Nunca se puede invitar ni incorporar un usuario con:

```text
role: owner
```

## Ejemplo de UI

```text
Invitar miembro

Email

[____________________________]

[Enviar invitación]
```

La invitación debe almacenarse en Firestore.

Conceptualmente:

```text
invitations/{invitationId}

{
  bandId,
  invitedEmail,
  invitedUserId,
  invitedByUserId,
  role: "member",
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

Si todavía no tiene cuenta, la invitación debe quedar pendiente y poder asociarse posteriormente cuando se registre con ese email.

Las Security Rules deben impedir:

* invitaciones creadas por miembros;
* invitaciones creadas por usuarios ajenos a la banda;
* invitaciones de Director que asignen `role: director`;
* cualquier invitación con `role: owner`;
* modificación arbitraria de `bandId`, `invitedEmail`, `invitedUserId`, `invitedByUserId` o `role`.

---

# 7. Aceptación de invitaciones

Cuando un usuario inicia sesión, la aplicación debe comprobar si existen invitaciones pendientes asociadas a su email.

Mostrar algo similar:

```text
Tenés una invitación

Juan te invitó a:

"Mi Banda"

[Rechazar] [Aceptar]
```

Al aceptar:

1. validar que la invitación siga vigente;
2. verificar que el usuario autenticado sea realmente el destinatario;
3. verificar que la invitación esté en estado pending;
4. verificar que no esté vencida;
5. agregar al usuario como miembro de la banda;
6. utilizar el rol autorizado por la invitación;
7. actualizar la invitación a accepted;
8. asociar correctamente el userId;
9. evitar duplicar membresías.

La operación debe estar protegida por Firestore Security Rules y, cuando corresponda, utilizar una transacción o mecanismo atómico.

El usuario nunca puede modificar por sí mismo el rol de la invitación para obtener privilegios adicionales.

---

# 8. No limitar Director Mode mediante una lista global de emails

No implementar algo como:

```ts
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

# 9. Repertorio de Banda

Cada banda puede tener listas/repertorios compartidos.

El repertorio de banda debe estar asociado explícitamente a un `bandId`.

Conceptualmente:

```text
bands/{bandId}/setlists/{setlistId}
```

o la estructura equivalente utilizada por la implementación actual.

El repertorio permite:

* crear listas;
* visualizar listas;
* agregar canciones;
* quitar canciones;
* seleccionar/deseleccionar canciones existentes;
* mantener el orden de las canciones;
* visualizar la cantidad de canciones;
* editar notas generales del repertorio;
* agregar notas individuales a canciones;
* editar notas individuales;
* eliminar notas individuales.

## Notas del repertorio

Una lista puede tener una nota general:

```text
Notas de la Lista
```

Esta nota puede contener información general del ensayo, presentación o repertorio.

El modelo `BandSetlist` contempla:

```ts
notes?: string;
```

## Notas por canción

Cada canción del repertorio puede tener una nota independiente.

El modelo `BandSetlist` contempla:

```ts
songNotes?: Record<string, string>;
```

Las claves corresponden al `songId`.

Ejemplo:

```ts
songNotes: {
  "song-123": "Entrar después de la intro",
  "song-456": "Bajar volumen en el puente"
}
```

Estas notas son independientes de la nota general del repertorio.

### Estado actual

**Implementado.**

El repertorio de banda actualmente soporta:

* selección y deselección de canciones existentes;
* preservación del orden;
* notas generales;
* notas individuales por canción;
* edición y eliminación de notas individuales;
* visualización de las notas desde la pantalla de detalle.

Estas funcionalidades forman parte del modelo actual de `BandSetlist` y no deben recrearse durante las fases posteriores de Director Mode.

---

# 10. Director Mode

Director Mode debe estar asociado a una banda.

Un usuario solamente puede iniciar Director Mode si:

1. está autenticado;
2. pertenece a la banda;
3. tiene rol owner o director;
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

Director Mode debe trabajar siempre con un `bandId` explícito.

---

# 11. Sesión de Director

Cuando el director inicia Director Mode, se crea una sesión asociada a la banda.

Conceptualmente:

```text
bands/{bandId}/sessions/{sessionId}

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

La comunicación debe basarse preferentemente en eventos/comandos.

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

# 12. Flujo del Director

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

# 13. Participación en una sesión

Cuando un miembro abre la sección de Banda y existe una sesión activa:

```text
Sesión activa

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

# 14. Seguridad Firestore

Este punto es crítico.

No confiar únicamente en la interfaz.

Ocultar el botón de Director Mode NO es seguridad.

Las Firestore Security Rules deben impedir que un usuario no autorizado acceda o modifique datos de una banda o sesión.

La seguridad real debe derivarse de:

```text
Usuario autenticado
       ↓
Membresía
       ↓
Rol
       ↓
Permiso
       ↓
Operación autorizada
```

Un member no puede crear sesiones.

Un usuario externo no puede leer información privada de una banda.

Un Director no puede modificar roles.

Un Director puede crear sesiones y controlar las sesiones que tenga autorizadas.

Un Owner conserva todos los privilegios administrativos.

---

# 15. Modelo de datos recomendado

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
  ├── userId
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
  ├── invitedUserId
  ├── invitedByUserId
  ├── role
  ├── status
  ├── createdAt
  └── expiresAt
```

Esta estructura es conceptual y debe adaptarse al modelo Firestore que ya existe en la aplicación.

Antes de modificarla, revisar el esquema actual y reutilizar entidades existentes cuando tenga sentido.

---

# 16. No duplicar información innecesariamente

Evitar guardar información que ya puede obtenerse de otra fuente.

Por ejemplo, si `userId` es suficiente para identificar al usuario, no duplicar permanentemente todo su perfil dentro de cada documento.

Sin embargo, pequeños datos desnormalizados como `displayName` pueden ser aceptables si mejoran considerablemente la lectura y se actualizan de forma controlada.

Priorizar consistencia y simplicidad.

---

# 17. Arquitectura de código

La implementación debe mantener una arquitectura limpia y profesional.

No concentrar toda la lógica en las pantallas.

Las pantallas deben tener únicamente el código necesario para:

* renderizar;
* manejar interacción de UI;
* consumir hooks;
* mostrar estados de loading/error/empty;
* delegar operaciones a servicios.

La lógica de negocio debe estar desacoplada.

---

# 18. Servicios

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
cancelInvitation()

createDirectorSession()
endDirectorSession()
sendDirectorEvent()
listenToDirectorSession()
listenToDirectorEvents()
```

Los nombres pueden adaptarse a las convenciones existentes.

---

# 19. Utils

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

Si una función interactúa con Firestore, probablemente corresponda a un service.

---

# 20. Hooks

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

La pantalla no debería conocer detalles de consultas Firestore.

---

# 21. Componentes reutilizables

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

---

# 22. Pantallas

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

# 23. UX recomendada

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

# 24. Administración de miembros

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

El Owner puede administrar los roles.

Ejemplo:

```text
Pedro

Director

Cambiar rol
Eliminar miembro
```

El cambio de rol debe estar limitado al Owner.

Un Director no puede administrar roles aunque tenga permiso para invitar miembros.

---

# 25. Soporte para varias bandas

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

La banda activa debería ser estado de aplicación/UI, no necesariamente un dato permanente de seguridad.

La seguridad siempre debe derivarse de Firestore.

---

# 26. Director Mode y la banda activa

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

Las consultas y eventos deben estar asociados a esa banda.

Esto evita que un usuario perteneciente a varias bandas mezcle sesiones.

---

# 27. Eventos en tiempo real

El sistema de Director debe ser desacoplado de la UI.

La capa de comunicación debería exponer algo parecido a:

```text
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

# 28. Compatibilidad con el pedal ESP32

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
listeners de miembros
```

El ESP32 no debería conocer nada acerca de:

* bandas;
* usuarios;
* Firestore;
* autenticación;
* permisos.

Toda esa responsabilidad pertenece a la aplicación.

---

# 29. Manejo de desconexiones

Director Mode debe contemplar:

* director sin conexión;
* miembro sin conexión;
* pérdida temporal de Internet;
* sesión finalizada;
* usuario que abandona la banda;
* sesión que queda abandonada;
* aplicación cerrada inesperadamente.

No intentar resolver todo en la primera versión, pero diseñar las interfaces para permitirlo.

Por ejemplo:

```text
status:

active
ended
expired
```

---

# 30. Estado actual de implementación y fases

La implementación se realiza de manera incremental.

## Fase 1 — Modelo y arquitectura inicial

* revisar modelo Firestore actual;
* definir bandas;
* definir miembros;
* definir roles;
* preparar reglas de seguridad;
* preparar arquitectura base.

**Estado: ✅ Implementada**

---

## Fase 2 — UI y estructura de Banda

* nueva tab Banda;
* crear banda;
* listar bandas;
* seleccionar banda;
* mostrar miembros;
* estructura inicial de Band UI.

**Estado: ✅ Implementada**

---

## Fase 3 — Creación de bandas

* validación del formulario;
* creación atómica de banda + owner;
* auto-selección de la banda creada;
* actualización inmediata de UI;
* protección mediante Firestore Security Rules.

**Estado: ✅ Implementada**

---

## Fase 4 — Roles y permisos

* owner;
* director;
* member;
* abstracción ROLE → PERMISSIONS → FEATURES;
* protección backend mediante Firestore Security Rules;
* promoción y degradación de miembros entre member/director exclusivamente por Owner;
* protección contra creación de segundos owners.

**Estado: ✅ Implementada**

---

## Fase 5 — Invitaciones

* invitación mediante email;
* Owner puede invitar member/director;
* Director puede invitar únicamente member;
* detección de invitaciones pendientes;
* aceptación/rechazo;
* asociación con usuario existente o futuro registro;
* prevención de duplicados;
* expiración/cancelación;
* seguridad de las operaciones mediante Firestore Rules.

### Implementación adicional

Para mejorar la experiencia al ingresar un email en la invitación, se utiliza Google Drive como fuente de sugerencias de usuarios/emails existentes.

Esto es únicamente una ayuda visual para seleccionar posibles destinatarios.

No constituye el mecanismo de autorización ni reemplaza las invitaciones de Firestore.

**Estado: ✅ Implementada**

---

## Fase 6 — Director Session

Objetivos:

* iniciar sesión;
* finalizar sesión;
* identificar banda;
* identificar director;
* listeners en tiempo real;
* emisión de eventos.

### Estado actual

**Estado: 🟡 Infraestructura implementada, integración pendiente**

Actualmente ya existen:

* `DirectorSessionService`;
* modelo de sesiones;
* creación y finalización de sesiones;
* emisión de eventos;
* listeners de sesión;
* listeners de eventos;
* `useDirectorSession`;
* Firestore Security Rules correspondientes.

La infraestructura del servicio fue implementada y validada mediante pruebas.

Sin embargo, el nuevo sistema todavía debe conectarse completamente al flujo real de reproducción de la aplicación.

Particularmente falta:

* conectar `useDirectorSession` con las pantallas reales;
* utilizar correctamente el `bandId`;
* reemplazar el inicio de sesión legacy;
* conectar los eventos con `SongViewer`;
* conectar el follower con la sesión nueva;
* validar el flujo completo Director → Firestore → Followers.

El sistema legacy `LiveSessionService` todavía puede existir en partes de la aplicación y debe migrarse progresivamente sin realizar un rewrite innecesario.

---

## Fase 7 — Integración con SongViewer

Objetivos:

* recibir eventos;
* cambiar canción;
* scroll;
* sincronización.

### Estado actual

**Estado: 🟡 Preparada parcialmente, integración pendiente**

`SongViewer` ya dispone de soporte para:

* `onSendDirectorEvent`;
* `incomingDirectorEvent`;
* `SONG_CHANGED`;
* `SCROLL_UP`;
* `SCROLL_DOWN`;
* prevención de re-emisión de cambios;
* integración con los controles del Director;
* integración con eventos provenientes del Director.

La integración pendiente está principalmente en:

* `app/setlist-player/[setlistId].tsx`;
* `app/song/[id].tsx`;
* `AppContext.tsx`.

El objetivo es conectar:

```text
useDirectorSession(bandId)
        ↓
sendEvent
        ↓
SongViewer.onSendDirectorEvent
```

y:

```text
useDirectorSession(bandId)
        ↓
latestEvent
        ↓
SongViewer.incomingDirectorEvent
```

No modificar `SongViewer` si no existe una necesidad concreta detectada durante la integración.

---

## Fase 8 — Integración completa con pedal

Objetivo:

```text
ESP32
  ↓
Bluetooth HID
  ↓
App Director
  ↓
DirectorSession
  ↓
Firestore
  ↓
Followers
```

Debe validarse:

* cambio de canción;
* scroll arriba;
* scroll abajo;
* navegación anterior/siguiente;
* funcionamiento con el pedal físico;
* comportamiento cuando hay varios miembros conectados.

**Estado: ❌ Pendiente**

---

# 31. Integración progresiva del sistema Legacy

La aplicación posee o poseía un sistema anterior de sesiones basado en `LiveSessionService`.

Ese sistema no debe mezclarse indefinidamente con `DirectorSessionService`.

La arquitectura objetivo es:

```text
DirectorSessionService
        ↓
DirectorSession
        ↓
Firestore
```

y no:

```text
DirectorSessionService
        +
LiveSessionService
        ↓
dos mecanismos de sincronización
```

Antes de eliminar cualquier parte del sistema legacy se debe:

1. identificar todos sus consumidores;
2. conectar el nuevo DirectorSession;
3. verificar que el flujo nuevo funciona;
4. eliminar progresivamente las dependencias legacy;
5. ejecutar las pruebas correspondientes;
6. verificar que las listas personales continúan funcionando.

No realizar una eliminación masiva del sistema legacy hasta que exista equivalencia funcional comprobada.

---

# 32. Punto de integración de Director Mode

El flujo objetivo para un repertorio de banda es:

```text
Band Setlist
      ↓
Iniciar Director Mode
      ↓
bandId
      ↓
DirectorSession
      ↓
SetlistPlayer
      ↓
SongViewer
```

Para los eventos:

```text
Director
      ↓
SongViewer
      ↓
useDirectorSession
      ↓
DirectorSessionService
      ↓
Firestore
      ↓
useDirectorSession de followers
      ↓
SongViewer
```

El `bandId` debe acompañar explícitamente al flujo de Director Mode.

Las listas personales deben continuar funcionando sin necesidad de un `bandId`.

---

# 33. Consideraciones importantes de seguridad

Nunca confiar en:

```ts
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

La matriz de seguridad debe mantenerse alineada:

### OWNER

* administración total de banda;
* administración de roles;
* invitaciones member/director;
* Director Mode.

### DIRECTOR

* Director Mode;
* invitaciones member;
* sin administración de roles.

### MEMBER

* participación;
* sin administración;
* sin invitaciones;
* sin Director Mode.

---

# 34. Reglas de arquitectura

Durante toda la implementación respetar estas reglas:

### 1. Pantallas delgadas

Las pantallas deben tener el código justo y necesario.

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

Funciones puras y genéricas en utils.

No colocar acceso a Firestore dentro de utils.

### 6. No duplicar lógica

Si la misma lógica aparece en dos lugares, evaluar extraerla.

### 7. Mantener compatibilidad

No romper funcionalidades existentes de:

* canciones;
* listas personales;
* repertorios de banda;
* autenticación;
* Google Drive;
* SongViewer;
* pedal;
* autoscroll;
* transposición;
* Stage Mode;
* Director Mode.

### 8. Migración incremental

No hacer un rewrite completo de la aplicación.

Implementar la nueva arquitectura de forma incremental sobre el código existente.

### 9. Repertorio de banda

Las funcionalidades ya implementadas de repertorio, incluyendo notas generales y notas por canción, deben mantenerse y reutilizarse.

No duplicar su lógica para Director Mode.

---

# 35. Criterio para tomar decisiones

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

# 36. Resultado esperado

Al finalizar esta implementación, un usuario nuevo de la Play Store podrá:

1. registrarse/iniciar sesión;
2. utilizar normalmente la aplicación;
3. crear o recibir una invitación a una banda;
4. pertenecer a una o varias bandas;
5. ver el repertorio de su banda;
6. participar en una sesión de Director;
7. recibir comandos en tiempo real.

Y un Owner podrá:

1. crear una banda;
2. invitar músicos por email;
3. administrar miembros;
4. asignar o quitar el rol de Director;
5. seleccionar una lista/repertorio;
6. iniciar Director Mode;
7. utilizar el pedal ESP32;
8. controlar remotamente las aplicaciones de los miembros.

Y un Director podrá:

1. participar como miembro autorizado;
2. iniciar y controlar Director Mode;
3. invitar nuevos usuarios como miembros;
4. utilizar el pedal ESP32 como fuente de comandos;
5. controlar remotamente las aplicaciones de los miembros durante una sesión.

Un usuario ajeno a la banda no podrá acceder a sus datos ni utilizar su Director Mode.

---

# 37. Instrucción general para el agente de IA

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
16. Antes de implementar cada fase, realizar un análisis previo de los archivos existentes.
17. No modificar una parte de la arquitectura si ya existe una implementación equivalente sin justificarlo.
18. Mantener ROLE → PERMISSIONS → FEATURES como mecanismo central de autorización en el frontend.
19. Mantener Firestore Security Rules como autoridad final de seguridad en el backend.
20. Nunca permitir que una operación del cliente cree o asigne el rol owner.
21. Mantener las funcionalidades existentes del repertorio de banda, incluyendo notas generales y notas por canción.
22. No mezclar el nuevo `DirectorSession` con el sistema legacy más allá de lo estrictamente necesario durante la migración.
23. Antes de modificar o eliminar `LiveSessionService`, identificar todos sus consumidores y verificar la equivalencia funcional con `DirectorSessionService`.

La prioridad debe ser:

```text
arquitectura limpia
        +
seguridad
        +
reutilización
        +
simplicidad
        +
compatibilidad con el código existente
```

No realizar un rewrite innecesario de la aplicación.

---

# 38. Próximo paso recomendado

Antes de modificar código para continuar con Director Mode, realizar una auditoría técnica del estado real del proyecto.

La auditoría debe determinar:

* qué partes de Director Mode ya están implementadas;
* qué partes están preparadas pero desconectadas;
* qué partes continúan utilizando el sistema legacy;
* cómo se obtiene actualmente el `bandId`;
* cómo se inicia actualmente un repertorio de banda;
* cómo se conecta `SetlistPlayer` con `SongViewer`;
* cómo se conecta `SongScreen` con `SongViewer`;
* qué debe migrarse de `LiveSessionService`;
* qué archivos concretos deben modificarse;
* qué cambios pueden realizarse sin afectar las listas personales;
* qué pruebas deben ejecutarse antes y después de la integración.

**No modificar código durante esta auditoría.**

El código real del proyecto debe considerarse la fuente de verdad por encima de cualquier descripción previa del documento.

El siguiente paso de implementación debe ser el cambio mínimo necesario para conectar la infraestructura existente de `DirectorSession` con el flujo real de reproducción.
