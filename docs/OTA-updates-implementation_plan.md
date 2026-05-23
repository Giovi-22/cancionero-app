# Expo Updates OTA — Plan de implementación

## Objetivo

Instalar y configurar **expo-updates** para poder enviar actualizaciones *Over The Air* (OTA) a la app sin necesidad de generar un nuevo APK. Los usuarios recibirán los cambios automáticamente al abrir la app.

## Contexto del proyecto

| Item | Valor |
|---|---|
| Proyecto | `App-cancionero-mobile` |
| Owner EAS | `giovi22` |
| Project ID | `cc81069d-e4ad-4149-bd64-4f95d94b9516` |
| EAS CLI | `18.12.3` (disponible actualización a `19.0.0`) |
| expo-updates | ❌ No instalado |

## ¿Cómo funciona?

1. Instalás `expo-updates` en el proyecto.
2. Configurás en `app.json` la URL de updates y el canal (channel).
3. Configurás en `eas.json` a qué canal apunta cada build.
4. Compilás el APK **una vez** con EAS Build (ya lo tenés hecho).
5. Para cada cambio futuro, corrés `eas update --channel preview` — tarda unos segundos y los usuarios lo reciben al abrir la app.

## Cambios propuestos

---

### [MODIFY] [app.json](file:///e:/GIOVI/PROGRAMACIÓN/MUSICA/App-cancionero-mobile/app.json)

Agregar la sección `updates` con:
- `url` apuntando al servidor EAS Updates
- `enabled: true`
- `fallbackToCacheTimeout: 0` (muestra la versión en caché mientras descarga en segundo plano)
- `checkAutomatically: "ON_LOAD"` (chequea al abrir la app)

Agregar `expo-updates` a los plugins.

---

### [MODIFY] [eas.json](file:///e:/GIOVI/PROGRAMACIÓN/MUSICA/App-cancionero-mobile/eas.json)

Agregar sección `channel` a cada perfil de build:
- `preview` → canal `"preview"`
- `production` → canal `"production"`

Esto vincula cada APK a su canal de updates.

---

### [INSTALL] expo-updates

```
npx expo install expo-updates
```

---

## Flujo de trabajo después de la configuración

```
# Enviar actualización OTA al canal preview:
eas update --channel preview --message "Descripción del cambio"

# Los usuarios que tengan el APK de preview recibirán
# la actualización automáticamente al abrir la app.
```

## Open Questions

> [!IMPORTANT]
> **¿Querés manejar las actualizaciones en segundo plano (silencioso) o mostrar un diálogo al usuario?**
> - **Silencioso** *(recomendado)*: La app descarga la actualización en background y la aplica al próximo reinicio.
> - **Con aviso**: Se muestra un banner/diálogo diciendo "Hay una actualización disponible, reiniciá la app".

> [!NOTE]
> Necesitarás regenerar el APK **una sola vez** después de esta configuración para que quede linkeado al servidor de EAS Updates. De ahí en adelante, usás solo `eas update`.

## Verification Plan

- Correr `npx expo install expo-updates` y verificar que no hay errores.
- Editar `app.json` y `eas.json`.
- Compilar nuevo APK con `eas build --profile preview --platform android`.
- Instalar APK en el dispositivo.
- Hacer un cambio pequeño y correr `eas update --channel preview`.
- Verificar que la app recibe el cambio al abrirla.
