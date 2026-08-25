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

Un usuario podrá pertenecer a varias bandas.

---

# 2. Nueva sección / tab "Banda"

Agregar una nueva sección principal de navegación llamada:

Banda

Esta sección debe centralizar todo lo relacionado con las bandas del usuario.

La pantalla no debería contener toda la lógica de negocio. Debe ser una pantalla liviana que consuma hooks, servicios y componentes reutilizables.

## Posible estructura

Banda
│
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

Si el usuario no pertenece a ninguna banda:

Banda

Todavía no pertenecés a ninguna banda.

[Crear banda]
[Unirse a una banda]

---

# 3. Creación de una banda

Un usuario puede crear una banda.

Formulario mínimo:

Nombre de la banda
[________________]

[Crear banda]

El creador pasa automáticamente a ser:

role: owner

Ejemplo:

Mi Banda

Juan      OWNER
Pedro     MEMBER
Luis      MEMBER
María     MEMBER

La creación inicial debe ser atómica y crear simultáneamente:

bands/{bandId}

y

bands/{bandId}/members/{ownerId}

El usuario creador será el único OWNER inicial.

No se debe permitir la creación de un segundo OWNER mediante operaciones del cliente.

---

# 4. Roles y permisos

Definir roles de manera clara.

Roles iniciales:

owner
director
member

Los permisos no deben depender de comprobaciones dispersas del tipo:

if (role === 'owner')

Debe existir una capa de abstracción:

ROLE
  ↓
PERMISSIONS
  ↓
FEATURES

La implementación actual utiliza:

getBandPermissions(role)

para transformar el rol del usuario en permisos granulares.

## Owner

Puede:

- editar información de la banda
- administrar miembros
- invitar miembros
- invitar usuarios como member o director
- eliminar miembros
- asignar el rol director
- quitar el rol director
- crear/iniciar sesiones de Director
- controlar sesiones de Director
- administrar listas de la banda
- eliminar la banda

El Owner es el único rol que puede administrar roles.

## Director

Puede:

- ver la banda
- ver sus miembros
- acceder al repertorio
- crear/iniciar sesiones de Director
- controlar una sesión activa
- enviar comandos a los miembros
- invitar nuevos usuarios como member

El Director NO puede:

- eliminar la banda
- editar configuraciones administrativas críticas
- cambiar roles de miembros
- asignar el rol director
- quitar el rol director
- invitar usuarios como director
- invitar usuarios como owner
- administrar funciones exclusivas del Owner

## Member

Puede:

- ver la banda
- ver miembros
- acceder a las listas compartidas
- participar en sesiones de Director

No puede:

- administrar miembros
- enviar invitaciones
- crear sesiones de Director
- controlar sesiones
- modificar configuraciones administrativas
- cambiar roles

---

## Cambios de rol

El rol de un miembro es independiente de la forma en que ingresó a la banda.

Por ejemplo:

Member
  ↓
Owner lo promueve
  ↓
Director

Al pasar a Director, el usuario obtiene automáticamente los permisos correspondientes al rol director.

No se debe almacenar un campo adicional como:

isDirector
canInvite
canControlSession

El rol es la fuente de verdad.

La capa de permisos debe derivarse siempre del rol actual.

Ejemplo:

role: "director"

↓

getBandPermissions("director")

↓

permisos de Director

El Owner también puede quitar el rol de Director:

Director
  ↓
Owner modifica el rol
  ↓
Member

Al volver a member, el usuario pierde automáticamente los permisos de Director.

## Reglas de asignación de roles

Únicamente el Owner puede modificar el rol de otro miembro.

Un Owner puede asignar:

member
director

Un Owner nunca puede crear otro owner desde el cliente.

Un Director nunca puede promover a otro usuario a Director.

Un Director tampoco puede modificar su propio rol para obtener privilegios adicionales.

---

# 5. Invitaciones

El Owner y el Director pueden invitar usuarios a la banda.

Las invitaciones se realizan inicialmente mediante email.

## Permisos para invitar

Owner:

- puede invitar usuarios como member
- puede invitar usuarios como director

Director:

- puede invitar usuarios únicamente como member

Member:

- no puede enviar invitaciones

El Director no puede utilizar una invitación para otorgar el rol director.

La asignación del rol director permanece exclusivamente bajo control del Owner.

Nunca se puede invitar ni incorporar un usuario con role: owner.

## Ejemplo de UI

Invitar miembro

Email
[________________________]

[Enviar invitación]

La invitación debe almacenarse en Firestore.

Conceptualmente:

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

Estados posibles:

pending
accepted
rejected
expired
cancelled

No asumir que el usuario invitado ya existe.

Si todavía no tiene cuenta, la invitación debe quedar pendiente y poder asociarse posteriormente cuando se registre con ese email.

Las Security Rules deben impedir:

- invitaciones creadas por miembros;
- invitaciones creadas por usuarios ajenos a la banda;
- invitaciones de Director que asignen role: director;
- cualquier invitación con role: owner;
- modificación arbitraria de bandId, invitedEmail, invitedByUserId o role.

---

# 6. Aceptación de invitaciones

Cuando un usuario inicia sesión, la aplicación debe comprobar si existen invitaciones pendientes asociadas a su email.

Mostrar algo similar:

Tenés una invitación

Juan te invitó a:

"Mi Banda"

[Rechazar] [Aceptar]

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

# 7. No limitar Director Mode mediante una lista global de emails

No implementar algo como:

directorEmails = [
  "juan@gmail.com",
  "pedro@gmail.com"
]

Esto no escala y mezcla autorización con usuarios individuales.

La autorización debe derivarse de:

Usuario
   ↓
Membresía de banda
   ↓
Rol
   ↓
Permisos

Esto permitirá que la aplicación sea pública y que cada banda administre sus propios miembros.

---

# 8. Director Mode

Director Mode debe estar asociado a una banda.

Un usuario solamente puede iniciar Director Mode si:

1. está autenticado;
2. pertenece a la banda;
3. tiene rol owner o director;
4. la banda tiene una sesión válida disponible para iniciar.

Conceptualmente:

¿Está autenticado?
    ↓
¿Pertenece a una banda?
    ↓
¿Tiene permiso de director?
    ↓
Sí → puede iniciar Director Mode

Un miembro normal puede participar en una sesión, pero no iniciarla.

---

# 9. Sesión de Director

Cuando el director inicia Director Mode, se crea una sesión asociada a la banda.

Conceptualmente:

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

No guardar continuamente el scrollY como estado principal.

La comunicación debe basarse preferentemente en eventos/comandos.

Ejemplos:

SONG_CHANGED
SCROLL_UP
SCROLL_DOWN
NEXT_SONG
PREVIOUS_SONG

Esto mantiene el sistema desacoplado y evita depender de sincronizar continuamente la posición exacta del scroll.

---

# 10. Flujo del Director

Ejemplo:

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

El director utiliza el pedal ESP32.

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

Ejemplo:

ESP32
  ↓
SCROLL_DOWN
  ↓
App Director
  ↓
Firestore
  ↓
Pedro / Luis / María

Cada cliente ejecuta localmente el comportamiento correspondiente.

---

# 11. Participación en una sesión

Cuando un miembro abre la sección de Banda y existe una sesión activa:

Sesión activa

Mi Banda
Director: Juan

[Unirse]

Una vez unido:

Modo Director

Sincronizado con:
Mi Banda

Canción:
"Alabanza"

Director:
Juan

El miembro no debería tener controles de dirección, salvo los que posteriormente se definan explícitamente.

---

# 12. Seguridad Firestore

Este punto es crítico.

No confiar únicamente en la interfaz.

Ocultar el botón de Director Mode NO es seguridad.

Las Firestore Security Rules deben impedir que un usuario no autorizado acceda o modifique datos de una banda o sesión.

La seguridad real debe derivarse de:

Usuario autenticado
       ↓
Membresía
       ↓
Rol
       ↓
Permiso
       ↓
Operación autorizada

Un member no puede crear sesiones.

Un usuario externo no puede leer información privada de una banda.

Un Director no puede modificar roles.

Un Director puede crear sesiones y controlar las sesiones que tenga autorizadas.

Un Owner conserva todos los privilegios administrativos.

---

# 13. Modelo de datos recomendado

No acoplar innecesariamente toda la información en documentos gigantes.

Preferir una estructura que permita crecer.

Una posible arquitectura:

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

Esta estructura es conceptual y debe adaptarse al modelo Firestore que ya existe en la aplicación.

Antes de modificarla, revisar el esquema actual y reutilizar entidades existentes cuando tenga sentido.

---

# 14. No duplicar información innecesariamente

Evitar guardar información que ya puede obtenerse de otra fuente.

Por ejemplo, si userId es suficiente para identificar al usuario, no duplicar permanentemente todo su perfil dentro de cada documento.

Sin embargo, pequeños datos desnormalizados como displayName pueden ser aceptables si mejoran considerablemente la lectura y se actualizan de forma controlada.

Priorizar consistencia y simplicidad.

---

# 15. Arquitectura de código

La implementación debe mantener una arquitectura limpia y profesional.

No concentrar toda la lógica en las pantallas.

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

services/
├── auth/
├── firestore/
├── bands/
│   ├── bandService.ts
│   ├── bandMemberService.ts
│   ├── invitationService.ts
│   └── directorSessionService.ts
└── ...

No es obligatorio copiar exactamente esta estructura.

Adaptarla a la arquitectura actual del proyecto.

Los servicios deben encargarse de operaciones como:

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

Los nombres pueden adaptarse a las convenciones existentes.

---

# 17. Utils

Toda función genérica y reutilizable debe estar fuera de las pantallas.

Por ejemplo:

utils/
├── emailUtils.ts
├── dateUtils.ts
├── permissionUtils.ts
├── bandUtils.ts
└── ...

Solo colocar allí funciones realmente reutilizables y sin responsabilidad directa de acceso a Firestore.

No convertir utils en un depósito de lógica de negocio.

Si una función interactúa con Firestore, probablemente corresponda a un service.

---

# 18. Hooks

Cuando una funcionalidad necesite estado y suscripciones, crear hooks reutilizables.

Ejemplos:

hooks/
├── useBands.ts
├── useBand.ts
├── useBandMembers.ts
├── useBandInvitations.ts
├── useDirectorSession.ts
└── ...

La pantalla no debería conocer detalles de consultas Firestore.

---

# 19. Componentes reutilizables

Crear componentes cuando una UI tenga comportamiento reutilizable.

Ejemplos:

components/band/
├── BandCard.tsx
├── BandMemberList.tsx
├── BandMemberRow.tsx
├── BandRoleBadge.tsx
├── InvitationCard.tsx
├── InviteMemberForm.tsx
├── BandEmptyState.tsx
└── DirectorSessionCard.tsx

También reutilizar componentes generales ya existentes en el proyecto antes de crear nuevos.

No crear componentes artificialmente solo para dividir código.

---

# 20. Pantallas

La navegación debería quedar conceptualmente así:

Tabs
├── Canciones
├── Listas
├── Banda
└── Configuración

El nombre exacto de las tabs debe respetar la navegación actual de la aplicación.

Dentro de Banda:

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

Si el sistema de navegación actual utiliza otra estructura, adaptarlo en lugar de introducir una arquitectura paralela.

---

# 21. UX recomendada

La sección Banda debe ser sencilla.

### Sin banda

🎸 Tu banda

Todavía no pertenecés a ninguna banda.

[Crear banda]
[Unirme con invitación]

### Con una banda

🎸 Mi Banda

6 miembros

[Ver banda]

### Dentro de la banda

Mi Banda

Repertorio
6 miembros

Director Mode

[Iniciar Director Mode]

El botón de Director Mode solo debe aparecer habilitado para quienes tengan permiso.

---

# 22. Administración de miembros

Dentro de la banda:

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

El Owner puede administrar los roles.

Ejemplo:

Pedro
Director

Cambiar rol
Eliminar miembro

El cambio de rol debe estar limitado al Owner.

Un Director no puede administrar roles aunque tenga permiso para invitar miembros.

---

# 23. Soporte para varias bandas

No asumir que un usuario solo puede pertenecer a una banda.

La arquitectura debe soportar:

Usuario
 ├── Banda A
 ├── Banda B
 └── Banda C

Esto evita tener que rediseñar la base de datos posteriormente.

La UI puede permitir seleccionar una banda activa.

La banda activa debería ser estado de aplicación/UI, no necesariamente un dato permanente de seguridad.

La seguridad siempre debe derivarse de Firestore.

---

# 24. Director Mode y la banda activa

Director Mode debe trabajar siempre con un bandId explícito.

Evitar depender únicamente de variables globales ambiguas.

Conceptualmente:

startDirectorSession({
  bandId,
  directorId,
  ...
})

Las consultas y eventos deben estar asociados a esa banda.

Esto evita que un usuario perteneciente a varias bandas mezcle sesiones.

---

# 25. Eventos en tiempo real

El sistema de Director debe ser desacoplado de la UI.

La capa de comunicación debería exponer algo parecido a:

sendDirectorEvent(...)
subscribeToDirectorEvents(...)

La UI decide qué hacer con el evento.

Ejemplo:

Firestore event
      ↓
directorSessionService
      ↓
useDirectorSession
      ↓
SongViewer / UI

No hacer que SongViewer consulte directamente Firestore.

---

# 26. Compatibilidad con el pedal ESP32

El pedal existente debe seguir funcionando como fuente de comandos.

Arquitectura:

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

El ESP32 no debería conocer nada acerca de:

- bandas;
- usuarios;
- Firestore;
- autenticación;
- permisos.

Toda esa responsabilidad pertenece a la aplicación.

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

status:
active
ended
expired

---

# 28. Estado actual de implementación y fases

La implementación se realiza de manera incremental.

## Fase 1 — Modelo y arquitectura inicial

- revisar modelo Firestore actual;
- definir bandas;
- definir miembros;
- definir roles;
- preparar reglas de seguridad;
- preparar arquitectura base.

## Fase 2 — UI y estructura de Banda

- nueva tab Banda;
- crear banda;
- listar bandas;
- seleccionar banda;
- mostrar miembros;
- estructura inicial de Band UI.

## Fase 3 — Creación de bandas

- validación del formulario;
- creación atómica de banda + owner;
- auto-selección de la banda creada;
- actualización inmediata de UI;
- protección mediante Firestore Security Rules.

## Fase 4 — Roles y permisos

- owner;
- director;
- member;
- abstracción ROLE → PERMISSIONS → FEATURES;
- protección backend mediante Firestore Security Rules;
- promoción y degradación de miembros entre member/director exclusivamente por Owner;
- protección contra creación de segundos owners.

## Fase 5 — Invitaciones

- invitación mediante email;
- Owner puede invitar member/director;
- Director puede invitar únicamente member;
- detección de invitaciones pendientes;
- aceptación/rechazo;
- asociación con usuario existente o futuro registro;
- prevención de duplicados;
- expiración/cancelación;
- seguridad de las operaciones mediante Firestore Rules.

## Fase 6 — Director Session

- iniciar sesión;
- finalizar sesión;
- identificar banda;
- identificar director;
- listeners en tiempo real.

## Fase 7 — Integración con SongViewer

- recibir eventos;
- cambiar canción;
- scroll;
- sincronización.

## Fase 8 — Integración completa con pedal

- ESP32 → App Director → Firestore → miembros.

---

# 29. Consideraciones importantes de seguridad

Nunca confiar en:

if (user.role === "director") {
   mostrarBoton();
}

Eso es solamente UX.

La seguridad real debe estar en:

Firestore Security Rules

También evitar guardar permisos únicamente en el dispositivo.

El cliente puede mostrar/ocultar funcionalidades, pero Firestore debe decidir si una operación está autorizada.

La matriz de seguridad debe mantenerse alineada:

OWNER
- administración total de banda
- administración de roles
- invitaciones member/director
- Director Mode

DIRECTOR
- Director Mode
- invitaciones member
- sin administración de roles

MEMBER
- participación
- sin administración
- sin invitaciones
- sin Director Mode

---

# 30. Reglas de arquitectura

Durante toda la implementación respetar estas reglas:

### 1. Pantallas delgadas

Las pantallas deben tener el código justo y necesario.

Preferir:

Screen
   ↓
Hook
   ↓
Service
   ↓
Firestore

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

Reutilizar
   ↓
Extender
   ↓
Refactorizar
   ↓
Crear nuevo

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
16. Antes de implementar cada fase, realizar un análisis previo de los archivos existentes.
17. No modificar una parte de la arquitectura si ya existe una implementación equivalente sin justificarlo.
18. Mantener ROLE → PERMISSIONS → FEATURES como mecanismo central de autorización en el frontend.
19. Mantener Firestore Security Rules como autoridad final de seguridad en el backend.
20. Nunca permitir que una operación del cliente cree o asigne el rol owner.

La prioridad debe ser:

arquitectura limpia
+
seguridad
+
reutilización
+
simplicidad
+
compatibilidad con el código existente

No realizar un rewrite innecesario de la aplicación.