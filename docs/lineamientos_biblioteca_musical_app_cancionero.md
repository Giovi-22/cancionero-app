# Implementación de “Biblioteca Musical”

## Objetivo

Agregar el concepto de “Biblioteca Musical” a la app para permitir múltiples contextos musicales independientes dentro de una misma cuenta de usuario.

Cada biblioteca representa una colección aislada de:
- canciones
- listas
- configuraciones
- sincronización
- preferencias
- contexto de uso

Ejemplos:
- Iglesia
- Banda
- Folclore
- Covers
- Acústico

La idea NO es crear perfiles de usuario.
El concepto correcto es una “biblioteca musical”.

---

# Concepto General

Actualmente la app trabaja con:
- autenticación Google Drive
- selección de carpeta Drive (folderId)
- sincronización de canciones
- almacenamiento local SQLite
- almacenamiento remoto Supabase
- modo offline
- playlists
- configuraciones por canción
- director mode
- stage mode
- pedal support

La nueva arquitectura debe encapsular todo esto dentro de una entidad llamada:

```ts
Library
```

Cada biblioteca debe funcionar como un ecosistema musical independiente.

---

# Requerimiento Principal

El usuario debe poder:

- crear múltiples bibliotecas
- seleccionar una biblioteca activa
- asociar una carpeta distinta de Google Drive a cada biblioteca
- cambiar entre bibliotecas
- mantener canciones y configuraciones separadas entre bibliotecas

Cuando cambia la biblioteca activa:
- cambia el catálogo de canciones
- cambian playlists
- cambia configuración
- cambia sincronización
- cambia contexto completo de la app

---

# Arquitectura Recomendada

## Nueva Entidad

```ts
type Library = {
  id: string

  userId: string

  name: string

  driveFolderId?: string

  syncEnabled: boolean

  icon?: string
  color?: string

  createdAt: number
  updatedAt: number
}
```

---

# Relaciones

## Songs

Las canciones deben pertenecer a una biblioteca.

```ts
Song.libraryId
```

## Playlists

Las playlists deben pertenecer a una biblioteca.

```ts
Playlist.libraryId
```

## Settings

Las configuraciones deben poder depender de una biblioteca.

---

# Importante: Configuración por Biblioteca

La misma canción puede tener configuraciones distintas según la biblioteca.

Ejemplo:

Biblioteca Iglesia:
- tono G
- capo 2
- scroll lento

Biblioteca Banda:
- tono A
- bpm distinto
- scroll rápido

Por eso NO conviene almacenar configuraciones globales solamente.

---

# Recomendación de Modelo

## Opción recomendada

Separar:

```ts
Song
LibrarySong
```

Donde:

```ts
LibrarySong
```

contiene:
- configuraciones específicas
- overrides
- metadata contextual

Ejemplo:

```ts
type LibrarySong = {
  id: string

  libraryId: string
  songId: string

  customTone?: string
  capo?: number
  bpm?: number
  autoscrollSpeed?: number

  notes?: string

  updatedAt: number
}
```

Esto evita duplicar canciones completas.

---

# Sincronización

Cada biblioteca debe tener su propia sincronización.

La sincronización depende de:

```ts
Library.driveFolderId
```

NO usar rutas.
Usar siempre folderId de Google Drive.

Correcto:

```ts
1AbCdEfGhIjKlMn
```

Incorrecto:

```txt
Mi unidad/Canciones Iglesia
```

Porque las rutas pueden cambiar y los IDs no.

---

# Flujo de Sincronización

```txt
Biblioteca activa
      ↓
Obtiene driveFolderId
      ↓
Lee archivos de Google Drive
      ↓
Descarga canciones
      ↓
Actualiza SQLite local
      ↓
Actualiza Supabase
      ↓
Actualiza índices y caché
```

---

# Modo Offline

Cada biblioteca debe seguir funcionando offline.

Las canciones deben continuar disponibles desde SQLite local aunque no exista conexión.

---

# Estado Global

Debe existir una biblioteca activa global.

Ejemplo:

```ts
currentLibrary
```

Toda la app debe depender de:

```ts
currentLibraryId
```

---

# Recomendación Técnica

## Zustand o Context

Mantener:

```ts
currentLibrary
setCurrentLibrary
```

Cuando cambia:
- invalidar queries
- recargar canciones
- recargar playlists
- recargar configuración
- reinicializar sync context

---

# Base de Datos

Agregar tabla:

```sql
libraries
```

Y luego:

```sql
songs.library_id
playlists.library_id
```

O implementar:

```sql
library_songs
```

según el enfoque elegido.

---

# UX/UI

## Pantalla Inicial

La app puede:
- recordar última biblioteca
- o mostrar selector de biblioteca

Ejemplo:

```txt
🎵 Iglesia
🎸 Banda
🪗 Folclore
🎤 Covers
```

---

# Biblioteca Activa

Mostrar siempre contexto activo.

Ejemplo:

```txt
Biblioteca actual:
🎸 Banda
```

---

# Configuración de Biblioteca

Cada biblioteca puede tener:
- color
- icono
- carpeta Drive
- configuración default
- preferencias de scroll
- preferencias de pedal
- preferencias de visualización

---

# Director Mode

Las sesiones de Director Mode deben pertenecer a una biblioteca.

Ejemplo:

```txt
Sesión Ensayo Banda
```

Todos los usuarios conectados usan:
- misma biblioteca
- mismas playlists
- mismo contexto

---

# Escalabilidad Futura

La arquitectura debe dejar preparada la posibilidad de:

- compartir bibliotecas
- bibliotecas colaborativas
- importar/exportar bibliotecas
- sincronización automática
- presets de pedal por biblioteca
- configuraciones de escenario por biblioteca
- roles dentro de una biblioteca
- bibliotecas locales sin Drive
- multiusuario

---

# Objetivo UX Final

La sensación para el usuario debe ser:

"Cambiar de biblioteca cambia completamente el contexto musical de la app."

No debe sentirse como cambiar de usuario.
Debe sentirse como cambiar de repertorio o entorno musical.

---

# Importante

La implementación debe intentar:

- minimizar migraciones destructivas
- mantener compatibilidad con usuarios actuales
- migrar automáticamente la configuración actual a una biblioteca default inicial

Ejemplo:

```txt
Biblioteca inicial:
“Mi Biblioteca”
```

conteniendo:
- folderId actual
- canciones actuales
- playlists actuales
- configuraciones actuales

---

# Resultado Esperado

Después de implementar esto, el usuario podrá:

- tener múltiples repertorios independientes
- cambiar rápidamente entre contextos musicales
- mantener configuraciones distintas por repertorio
- sincronizar carpetas Drive distintas
- usar la app como sistema profesional de performance musical en vivo

