Mi propuesta de trabajo

Yo lo haría en estas fases:

Fase 0 — Diagnóstico

No modificamos código.

Mapeamos:

Providers
Contexts
Hooks
Services
Screens
Estado global
Estado local
Duplicaciones
Dependencias
Fase 1 — UserContext

Extraemos del AppContext todo lo que realmente corresponde al usuario.

Primero sin romper funcionalidades.

Fase 2 — BandContext

Movemos:

bands
activeBand
activeBandId
userRole
permissions
members
selectBand
refreshBands

a un único lugar.

Fase 3 — AppContext

Limpiamos AppContext y dejamos solamente aquello que realmente pertenece al estado global de la aplicación.

Fase 4 — Adaptamos hooks

Por ejemplo:

useBands
      ↓
useBand

sin perder la lógica existente de BandService.

Y revisamos:

useBandSetlists
useDirectorSession

para que consuman el nuevo modelo en lugar de crear fuentes alternativas.

Fase 5 — Migración de pantallas

Vamos pantalla por pantalla:

BandScreen
BandSetlistsScreen
BandSetlistDetailScreen
BandSongSelector
SetlistPlayer
DirectorSessionBanner
HomeScreen
...

y eliminamos los parches.

Fase 6 — Limpieza

Buscamos globalmente:

activeBandId
selectedBand
useBands(
userRole
permissions
auth.currentUser

y verificamos que no haya quedado ningún acceso incorrecto.

Fase 7 — Tests

Y recién ahí volvemos a probar:

múltiples bandas
owner/director/member
cambio de banda
repertorios
notas
Director Mode
sesión activa
banner
navegación
permisos
Firestore rules