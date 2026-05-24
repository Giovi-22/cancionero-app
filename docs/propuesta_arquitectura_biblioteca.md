# Propuesta de Arquitectura: Biblioteca Musical

He analizado a fondo el documento de lineamientos de la "Biblioteca Musical" y tu código actual. La idea de estructurar el cancionero en "Bibliotecas" (Iglesia, Banda, Covers, etc.) en lugar de perfiles de usuario es el enfoque semántico perfecto para un músico.

Para cumplir con la regla de **"no tocar mucho lo que ya tenemos hecho para no romper nada, solo lo necesario"**, propongo una arquitectura incremental y limpia que reutiliza las estructuras existentes con modificaciones mínimas y no destructivas.

---

## 1. Diseño de Base de Datos (SQLite Local)

Para no rehacer las tablas desde cero ni romper el código actual, implementaremos las relaciones de forma sencilla:

### A. Nueva Tabla `libraries`
```sql
CREATE TABLE IF NOT EXISTS libraries (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  driveFolderId TEXT,
  syncEnabled INTEGER DEFAULT 1,
  icon TEXT,
  color TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### B. Relación con `songs` y `setlists`
En lugar de crear tablas intermedias complejas, añadiremos la columna `library_id` directamente a las tablas existentes.
* **Canciones:** 
  ```sql
  ALTER TABLE songs ADD COLUMN library_id TEXT;
  ```
  *(Dado que el `id` de la canción proviene del File ID de Google Drive y este es único por archivo, si una canción está en dos carpetas de Drive distintas, tendrá IDs distintos de todas formas. Por lo tanto, un campo simple `library_id` en `songs` es robusto y simple).*
* **Listas (Setlists):**
  ```sql
  ALTER TABLE setlists ADD COLUMN library_id TEXT;
  ```

### C. Ajustes de Canciones (Tono, Capo, Notas)
Actualmente guardás la configuración de cada canción en la tabla `settings` bajo la clave `song_settings_${songId}`.
Para aislar estos ajustes por biblioteca sin crear nuevas tablas, simplemente cambiaremos el formato de la clave a:
```ts
`song_settings_${libraryId}_${songId}`
```
**Ventaja crucial:** 
* No requiere crear tablas ni triggers nuevos.
* **Compatibilidad hacia atrás:** Si el usuario abre una canción en la biblioteca por defecto (`default`) y no existe `song_settings_default_${songId}`, podemos hacer un fallback automático a la clave anterior `song_settings_${songId}`. **¡Cero pérdida de datos para tus canciones actuales!**

---

## 2. Estrategia de Migración y Retrocompatibilidad

Cuando la app se inicie por primera vez con esta versión:
1. Comprobamos si la tabla `libraries` está vacía.
2. Si está vacía, creamos automáticamente la biblioteca por defecto:
   - `id`: `'default'`
   - `name`: `'Mi Biblioteca'`
   - `driveFolderId`: (leemos el `drive_folder_id` actual de la tabla `settings`).
3. Asignamos todos los setlists existentes a la biblioteca por defecto:
   ```sql
   UPDATE setlists SET library_id = 'default' WHERE library_id IS NULL;
   ```
4. Asignamos todas las canciones existentes a la biblioteca por defecto:
   ```sql
   UPDATE songs SET library_id = 'default' WHERE library_id IS NULL;
   ```

---

## 3. Estado Global y Lógica en la App

Seguiremos usando el flujo de estado de `App.tsx` para mantener la consistencia:
* Añadiremos el estado `activeLibrary` (un objeto `Library`) y `libraries` (el listado).
* Guardaremos el `active_library_id` en la tabla `settings` para recordar la última biblioteca abierta.
* Al cambiar `activeLibrary`:
  1. Cargamos el ID de carpeta de Drive correspondiente.
  2. Actualizamos el estado local de canciones y setlists filtrando por el ID de la biblioteca activa:
     ```sql
     SELECT * FROM songs WHERE library_id = ? ORDER BY name ASC;
     SELECT * FROM setlists WHERE library_id = ? ORDER BY name ASC;
     ```
  3. Ejecutamos el sync automático en background correspondiente a esa biblioteca.

---

## 4. Sincronización con Supabase

Actualmente sincronizás configuraciones y estadísticas con Supabase. ¿Cómo afecta esto a las bibliotecas?
1. **Configuraciones de Usuario (`user_settings`):** Seguirán sincronizándose transparentemente porque la tabla `settings` local guardará las claves estructuradas por biblioteca (`song_settings_${libraryId}_${songId}`). Supabase las recibirá todas juntas en el objeto JSON de settings del usuario.
2. **Setlists (`setlists`):** Añadiremos el campo `library_id` a la tabla `setlists` en Supabase para que al hacer `pull` o `push` se mantenga el aislamiento de listas entre dispositivos.
3. **Estadísticas de Uso (`song_stats`):** Seguirán vinculándose al `song_id`.

---

## 5. Diseño de Interfaz de Usuario (UI/UX Premium)

Para que se sienta como una biblioteca musical premium sin recargar la pantalla:
1. **Selector de Biblioteca en Header:** En la barra superior, al lado del logo, podemos mostrar el nombre de la biblioteca activa con su color e ícono (ej. `🎸 Banda`) en una cápsula estilizada. Al tocarla, se abre un **ActionSheet** o modal inferior elegante para cambiar de biblioteca.
2. **Gestor de Bibliotecas:** Dentro del menú de Configuración (o en el mismo modal inferior del selector), una sección donde el usuario pueda:
   - Crear una nueva biblioteca (seleccionando Nombre, Color, Ícono y Carpeta de Drive).
   - Editar o eliminar bibliotecas existentes (previniendo borrar la biblioteca activa).

---

## 6. Próximos Pasos Propuestos

Si estás de acuerdo con este enfoque, el plan de trabajo estructurado sería:
1. **Paso 1: Actualizar SQLite y migración inicial** en `StorageService.ts`.
2. **Paso 2: Crear el CRUD de Bibliotecas** (métodos en `StorageService` para guardar, listar y borrar bibliotecas).
3. **Paso 3: Modificar las consultas de canciones y setlists** para que filtren por biblioteca activa.
4. **Paso 4: Integrar el selector en la UI** (Header de `App.tsx` y modal de creación/edición de bibliotecas).
5. **Paso 5: Probar y validar** el flujo completo de sincronización independiente y el cambio en caliente.

¿Qué te parece este enfoque? ¿Hacemos algún ajuste antes de que empiece a escribir el código?
