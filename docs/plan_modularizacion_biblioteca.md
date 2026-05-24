# Plan de Trabajo: Modularización por Capas y Biblioteca Musical

Este plan detalla el proceso para estructurar la aplicación en módulos limpios y legibles, extrayendo el contenido de `App.tsx` (que tiene casi 1900 líneas) en pantallas (`screens`), componentes (`components`) y un gestor de estado global (`context`), mientras integramos de forma nativa la funcionalidad de **Biblioteca Musical**.

---

## 1. Nueva Estructura del Proyecto (`src/`)

Estructuraremos el código en las siguientes carpetas bajo `src/`:

```
src/
├── components/                 # Componentes visuales y modales reutilizables
│   ├── SongList.tsx            # (Existente) Listado interactivo y reordenable
│   ├── SongViewer.tsx          # (Existente) Visor de canciones y reproductor
│   ├── SetlistList.tsx         # (Existente) Listado de setlists
│   ├── SettingsModal.tsx       # (Extraído) Panel de configuración de usuario/cuenta
│   ├── FolderPickerModal.tsx   # (Extraído) Explorador de carpetas de Drive
│   ├── LibrarySelectorModal.tsx# (Nuevo) Gestor y selector de bibliotecas
│   └── LiveSessionBanners.tsx  # (Extraído) Banners de director y seguidor en vivo
├── context/
│   └── AppContext.tsx          # (Nuevo) Estado global y lógica de negocio (Zustand-like React Context)
├── screens/                    # Pantallas principales de la aplicación
│   ├── HomeScreen.tsx          # (Nuevo) Pantalla de inicio (resumen, estadísticas, shows)
│   ├── SongsScreen.tsx         # (Nuevo) Listado de canciones y buscador
│   └── SetlistsScreen.tsx      # (Nuevo) Gestión de repertorios y listas
├── services/                   # Lógica de servicios (Sin cambios en su responsabilidad)
│   ├── AuthService.ts
│   ├── StorageService.ts
│   ├── SyncService.ts
│   ├── DriveService.ts
│   ├── FileSystemService.ts
│   └── LiveSessionService.ts
├── types/
│   └── index.ts                # Interfaces y tipos TypeScript
└── utils/
    └── chordUtils.ts
```

---

## 2. Definición del Estado Global (`AppContext.tsx`)

Para evitar pasar docenas de props entre pantallas y modales, crearemos un `AppContext` que encapsule:
- **Autenticación:** Usuario activo.
- **Biblioteca Activa:** Biblioteca seleccionada, lista de bibliotecas disponibles.
- **Datos Musicales:** Canciones y listas correspondientes a la biblioteca activa.
- **Estado de Pantalla:** Pestaña activa, canción seleccionada para ver, setlist activa.
- **Live Session:** Estado del Director Mode y follower (shows en vivo).
- **Acciones Globales:** `changeLibrary()`, `syncLibrary()`, `startShow()`, `loadInitialData()`.

Esto permitirá que cualquier pantalla obtenga sus datos de forma súper sencilla:
```ts
const { songs, activeLibrary, changeLibrary } = useAppContext();
```

---

## 3. Plan de Implementación Paso a Paso

Proponemos realizar la modularización de forma incremental para asegurar que la app compile en cada paso y no romper nada:

### Fase 1: Base de Datos y Tipos (Soporte de Biblioteca)
1. **Actualizar `StorageService.ts`**:
   - Crear tabla `libraries`.
   - Modificar tablas `songs` y `setlists` agregando `library_id` (vía `ALTER TABLE`).
   - Crear migración automática al iniciar: si no hay bibliotecas, crear la de por defecto (`Mi Biblioteca`) e indexar todos los datos locales existentes.
2. **Definir Tipos en `src/types/index.ts`**:
   - Agregar el tipo `Library`.

### Fase 2: Crear el Estado Global (`AppContext.tsx`)
1. Crear `src/context/AppContext.tsx`.
2. Mover toda la lógica de inicialización, carga de datos, sincronización y manejo de sesiones en vivo desde `App.tsx` al proveedor de contexto.
3. Exponer los estados y funciones a toda la app.

### Fase 3: Extraer Componentes Auxiliares
1. Crear `src/components/FolderPickerModal.tsx`.
2. Crear `src/components/SettingsModal.tsx`.
3. Crear `src/components/LibrarySelectorModal.tsx` (que además de cambiar, permitirá crear/editar/eliminar bibliotecas con sus colores e íconos).
4. Crear `src/components/LiveSessionBanners.tsx`.

### Fase 4: Crear Pantallas Independientes
1. Crear `src/screens/HomeScreen.tsx` (moviendo la UI del Home).
2. Crear `src/screens/SongsScreen.tsx` (moviendo el listado general y cabecera de setlists).
3. Crear `src/screens/SetlistsScreen.tsx` (moviendo la lista de setlists y creación).

### Fase 5: Simplificar `App.tsx`
1. Reemplazar todo el contenido de `App.tsx` por un cascarón limpio:
   - Envolver en `AppContextProvider`.
   - Renderizar el header, la pantalla activa correspondiente al tab actual, y el tab bar inferior.
   - Todo con un código que no superará las 150 líneas.

---

## 4. Beneficios de este Enfoque

- **Legibilidad:** En lugar de buscar en 1900 líneas, cada archivo tendrá entre 100 y 300 líneas enfocadas en una sola tarea.
- **Robustez:** La lógica de negocio (sync, DB, auth) queda totalmente aislada de la renderización UI.
- **Preparación para Navegación Avanzada:** Si a futuro queremos meter Expo Router o React Navigation (Stacks, Drawers, etc.), el cambio será trivial porque las pantallas ya son módulos independientes y el estado está centralizado.
- **Mantenibilidad:** El código existente (como `SongViewer.tsx` o `SongList.tsx`) no cambia en absoluto, solo cambia de dónde obtienen los datos.

¿Te parece bien arrancar con la **Fase 1** (Base de Datos, Tipos y preparación)?
