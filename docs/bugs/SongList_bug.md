
# Problema pendiente: SongList y repertorios de banda

## Contexto

`SongList` ahora es reutilizable y recibe las canciones mediante props. Sin embargo, en `BandSetlistDetailScreen` se le pasan las canciones del repertorio de banda, mientras que `onSongPress` todavía proviene de `AppContext`.

## Problema

Al abrir una canción directamente desde un repertorio de banda, `SongViewer` puede utilizar el `setlistSongs` de `AppContext`, que corresponde al flujo personal y no necesariamente al repertorio de banda actual.

Esto puede provocar que:

- Los botones de siguiente/anterior no respeten el orden del repertorio de banda.
- La navegación utilice canciones de otro contexto.
- Se mezclen los estados de repertorios personales y de banda.

## Decisión pendiente

No resolverlo agregando las canciones de banda a `AppContext`, porque eso mezclaría responsabilidades.

Después de terminar la migración de `useBands` hacia `BandContext`, revisar el flujo:

```text
BandSetlistDetailScreen
        ↓
SongList
        ↓
SongViewer
        ↓
Navegación siguiente/anterior
```

La solución debe permitir que `SongViewer` reciba explícitamente el contexto de navegación y las canciones del repertorio que está reproduciendo.

## Regla importante

`AppContext` no debe convertirse en la fuente global de canciones de banda. Las canciones y el orden del repertorio deben permanecer asociados al flujo de banda que los utiliza.