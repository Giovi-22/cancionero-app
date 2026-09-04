El orden que te propongo es:

1-Limpiar LiveSession legacy y todas sus referencias.
2-Revisar/corregir DirectorSessionService y useDirectorSession.
3-Revisar AppContext para sacar cualquier dependencia del sistema viejo.
4-Terminar el flujo Banda → repertorio → iniciar DirectorSession.
5-Integrar SetlistPlayer con la sesión nueva.
6-Terminar SONG_CHANGED.
7-Terminar SCROLL_UP / SCROLL_DOWN.
8-Revisar el mecanismo anti-loop entre Director y followers.
9-Revisar DirectorSessionBanner.
10-Revisar las Security Rules y los tests de Firestore.
11-Hacer una búsqueda final de todo LiveSession/legacy.
12-Recién ahí considerar Fase 7 terminada.

No voy a tocar todavía el firmware del pedal ni hacer la integración específica de Fase 8.