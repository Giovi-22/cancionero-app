# Band Mode — Fuente de canciones mediante carpeta de Google Drive

## Contexto

Actualmente Cancionero tiene una biblioteca musical personal por usuario, sincronizada desde Google Drive.

En Band Mode apareció un problema importante:

* El Director/Owner puede tener una canción en su biblioteca personal.
* Un miembro puede tener configurada otra biblioteca personal.
* Cuando el Director inicia un setlist, el miembro puede no tener localmente las mismas canciones.
* El sistema actual puede terminar mostrando `Canción no disponible` porque intenta resolver una canción de la sesión contra la biblioteca local del miembro.

Ejemplo:

```text
Director
  Biblioteca personal → "Iglesia"

Miembro X
  Biblioteca personal → "Folklore"

Banda A
  Setlist → "Iglesia"
```

La biblioteca personal no debería ser la fuente de verdad de una sesión de banda.

---

# Nueva propuesta

## Una banda debe tener una carpeta de Google Drive como fuente de canciones

Cuando un Owner crea una banda, debe seleccionar una carpeta de Google Drive que será la **fuente de canciones de esa banda**.

Conceptualmente:

```text
Banda A
  └── Carpeta Google Drive
        ├── Iglesia.cho
        ├── Santo.cho
        ├── Alabaré.cho
        └── ...
```

Los miembros de la banda sincronizan las canciones desde esa carpeta, independientemente de cuál sea su biblioteca personal.

Esto permite evitar, al menos inicialmente, crear un repositorio de canciones duplicado dentro de Firestore.

---

# Separación conceptual

Deben existir dos fuentes independientes:

```text
Biblioteca personal
  └── Carpetas elegidas por cada usuario

Banda A
  └── Carpeta Drive elegida para la banda

Banda B
  └── Carpeta Drive elegida para la banda
```

Por lo tanto:

```text
Personal Mode
    ↓
Biblioteca personal
    ↓
SQLite local

Band Mode
    ↓
Carpeta Drive de la banda
    ↓
SQLite local
```

Una sesión de Director de una banda **no debe depender de la biblioteca personal del Director ni de la del follower**.

---

# Datos que probablemente deberá tener una banda

En `bands/{bandId}` probablemente habrá que agregar:

```ts
driveFolderId: string;
driveFolderName?: string;
```

Los nombres exactos deben decidirse después de revisar los modelos actuales.

`driveFolderId` es el dato fundamental.

No crear todavía un `BandSong` en Firestore salvo que el análisis técnico demuestre que es necesario.

---

# Flujo de creación de banda

El flujo propuesto:

1. El Owner pulsa "Crear banda".
2. Introduce el nombre de la banda.
3. Selecciona una carpeta de Google Drive.
4. La carpeta queda asociada a la banda.
5. Se crea la banda.
6. Los miembros pueden sincronizar esa carpeta cuando acceden a la banda.

Idealmente, la carpeta debería validarse antes de finalizar la creación.

---

# Permisos de Google Drive

Hay una segunda cuestión importante:

## ¿Los miembros tienen acceso a la carpeta?

Hay dos posibilidades.

### Caso A — La carpeta ya está compartida

El Owner selecciona una carpeta que ya está compartida con los miembros.

La app simplemente sincroniza.

### Caso B — Un miembro no tiene acceso

La app debería detectar que el usuario no puede acceder a la carpeta y mostrar algo como:

> No tienes acceso a la carpeta de canciones de esta banda.

Idealmente, en el futuro podríamos permitir que el Owner comparta la carpeta desde la app.

Pero esto depende de los scopes actuales de Google Drive.

Actualmente la integración utiliza permisos de Drive orientados a lectura, por lo que primero hay que verificar si podemos modificar permisos de carpetas con los scopes actuales o si habría que solicitar permisos adicionales.

**No implementar el sharing automático todavía.**

Primero analizar la viabilidad técnica y el impacto en OAuth.

---

# Reutilización esperada

Antes de implementar, revisar especialmente:

* `DriveService`
* `SyncService`
* `StorageService`
* selector actual de carpetas de Drive
* `FolderPickerModal`
* `LibrarySelectorModal`
* `SongMetadata`
* SQLite/local storage
* sincronización actual Google Drive → SQLite
* flujo de autorización/scopes de Google Drive
* `BandService`
* `BandContext`
* `BandSetlistService`
* `BandSongSelector`
* `SetlistPlayer`
* `useDirectorSession`

La prioridad es **reutilizar la infraestructura existente**.

No duplicar el sistema de sincronización de canciones si puede extenderse el actual.

---

# Qué debería cambiar conceptualmente

Actualmente:

```text
Band Setlist
    ↓
ID de canción
    ↓
Biblioteca/local del usuario
```

Propuesta:

```text
Band
    ↓
driveFolderId
    ↓
Google Drive
    ↓
sincronización
    ↓
SQLite local
    ↓
Band Setlist / Director Session
```

El `SongMetadata` local puede seguir siendo utilizado.

La diferencia principal es **de dónde se sincroniza/resuelve la canción en Band Mode**.

---

# Sincronización

No es necesario descargar todo el repertorio de la banda inmediatamente.

Una estrategia posible:

### Al entrar en una banda

Sincronizar metadata de la carpeta y detectar canciones faltantes.

### Al abrir un setlist

Verificar que las canciones del setlist estén disponibles localmente.

### Antes/durante una sesión

Si faltan canciones, descargarlas desde la carpeta de Drive de la banda.

Esto puede permitir mostrar:

```text
✓ Iglesia
✓ Santo
↓ Alabaré — descargando...
```

No implementar esta estrategia hasta revisar la arquitectura actual de sincronización.

---

# Regla fundamental

> **Band Mode nunca debe asumir que la biblioteca personal del usuario contiene las canciones de la banda.**

La carpeta de Drive asociada a la banda es la fuente de verdad de sus canciones.

La biblioteca personal sigue existiendo y funcionando exactamente como antes para Personal Mode.

---

# No hacer todavía

No implementar todavía:

* `BandSong` en Firestore.
* Copias de canciones dentro de Firestore.
* Un repositorio de canciones nuevo.
* Sistema de versionado propio.
* Sharing automático de Google Drive.
* Cambios grandes en Director/Session.
* Cambios en Firestore Rules sin necesidad.

Primero analizar qué infraestructura existente puede reutilizarse.

---

# Próximo paso

Hacer un análisis técnico del código existente para responder:

1. ¿Cómo se selecciona actualmente una carpeta de Google Drive?
2. ¿Cómo se guarda actualmente el `folderId` de una biblioteca?
3. ¿Cómo `DriveService` sincroniza una carpeta?
4. ¿Cómo `SyncService` y `StorageService` relacionan canciones con una biblioteca?
5. ¿Podemos reutilizar ese mecanismo para una banda?
6. ¿Dónde debería almacenarse `driveFolderId` dentro de `Band`?
7. ¿Cómo debería sincronizarse una carpeta de banda sin romper Personal Mode?
8. ¿Cómo debería resolver `BandSongSelector` las canciones?
9. ¿Qué cambios necesita `SetlistPlayer`?
10. ¿Qué scopes de Google Drive tenemos actualmente?
11. ¿Podemos detectar desde la app si un miembro no tiene acceso a la carpeta?
12. ¿Podemos compartir la carpeta desde la app con los permisos OAuth actuales?

El objetivo del análisis es producir un plan de implementación **pequeño, reutilizando al máximo la arquitectura existente**.

---

# Objetivo final

El usuario quiere que Band Mode funcione así:

```text
OWNER
  │
  ├── crea banda
  │
  └── selecciona carpeta Drive
             │
             ▼
       CARPETA DE BANDA
             │
       ┌─────┼─────┐
       ▼     ▼     ▼
    Member Member Member
       │     │     │
       └─────┼─────┘
             ▼
       SQLite local
             │
             ▼
       Band Setlist
             │
             ▼
       Director Session
```

Cada usuario puede conservar su propia biblioteca personal.

La banda tiene una fuente común de canciones.

Esto elimina la dependencia accidental entre Director Mode y las bibliotecas personales de los usuarios.
