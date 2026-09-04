# Plan de refactorización arquitectónica — App Cancionero Mobile

## Objetivo
Eliminar fuentes de verdad duplicadas y separar responsabilidades entre autenticación, estado global de la app y estado transversal de Band.

## Arquitectura objetivo
- **UserContext:** identidad, autenticación, `user`, `userId`, perfil y estado de sesión.
- **AppContext:** canciones locales, canción actual, preferencias y estado global propio de la aplicación.
- **BandContext:** bandas, `activeBand`, `activeBandId`, `userRole`, `permissions`, `members`, selección y sincronización de banda.
- **Services:** acceso a Firestore y persistencia.
- **Hooks:** lógica reutilizable de funcionalidades.
- **Screens/components:** presentación y coordinación.

## Fuente única de verdad
- Quién soy: `useUser()`.
- Banda activa: `useBand().activeBand` / `activeBandId`.
- Rol en la banda: `useBand().userRole`.
- Permisos: `useBand().permissions`.
- Miembros: `useBand().members`.
- Repertorios: `useBandSetlists(activeBandId)`.
- Director Mode: `useDirectorSession(activeBandId)`.

No debe existir una combinación de `activeBandId` desde un contexto y `selectedBand`, `userRole` o `permissions` desde una instancia independiente de `useBands()`.

## Problema actual
`useBands()` mantiene estado local. Cada pantalla que lo ejecuta crea una instancia diferente. Además, `AppContext` mantiene `activeBandId`, generando dos fuentes de verdad.

## Plan de migración
1. Diagnóstico completo sin modificar archivos.
2. Crear y centralizar `UserContext`.
3. Crear `BandContext` y centralizar todo el estado de Band.
4. Limpiar `AppContext`.
5. Adaptar/reutilizar `useBands`, `useBandSetlists` y `useDirectorSession`.
6. Migrar pantallas y componentes.
7. Buscar y eliminar referencias duplicadas.
8. Validar múltiples bandas, roles, repertorios, notas, Director Mode, navegación y reglas Firestore.

## Reglas
- No resolver inconsistencias con parches por pantalla.
- No duplicar `activeBandId`.
- `userRole` depende de la banda activa, no del usuario global.
- Los permisos de UI no reemplazan la seguridad de Firestore.
- No crear Contexts innecesarios para estado local o de una sola funcionalidad.

## Criterios de terminado
- Una única fuente de verdad para la banda activa.
- Todas las pantallas consumen `BandContext`.
- `UserContext` es la fuente de verdad de identidad.
- `AppContext` no duplica usuario ni estado de Band.
- No hay múltiples instancias independientes del estado transversal de Band.
- Director Mode y navegación funcionan correctamente al cambiar de banda.
- Tests y reglas Firestore siguen funcionando.
