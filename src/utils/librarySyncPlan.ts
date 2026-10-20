/**
 * Planificador PURO de sincronización de bibliotecas (local SQLite <-> Firestore).
 *
 * No depende de Firebase, SQLite ni React: recibe el estado local y el remoto y
 * devuelve QUÉ hay que hacer. Quien lo llama (LibraryService) ejecuta el plan.
 * Así la lógica de fusión se puede probar sin red y sin dispositivo.
 *
 * Reglas:
 *  1. Última modificación gana (updatedAt) por cada biblioteca.
 *  2. Un borrado remoto (tombstone: deletedAt) gana y se replica en el dispositivo.
 *  3. La biblioteca "placeholder" que la app crea sola en una instalación nueva
 *     (id 'default', sin carpeta, sin canciones ni listas) NUNCA se sube y siempre
 *     pierde contra la versión de la nube.
 *  4. Si el usuario recreó a mano en este dispositivo una biblioteca que ya existía
 *     en la nube (misma carpeta de Drive, distinto id), no se duplica: se
 *     reasignan sus canciones/listas al id de la nube.
 */

export interface PlanLibrary {
  id: string;
  name: string;
  driveFolderId?: string;
  syncEnabled: boolean;
  icon?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocalLibraryInfo extends PlanLibrary {
  /** Lo calcula quien llama: id 'default', sin carpeta, sin canciones y sin listas. */
  isPristinePlaceholder: boolean;
}

export interface RemoteLibraryDoc extends PlanLibrary {
  /** Marca de borrado (tombstone). */
  deletedAt?: number | null;
}

export interface LibrarySyncPlan {
  /** Guardar (upsert) en SQLite. */
  saveLocal: PlanLibrary[];
  /** Borrar del dispositivo (fueron borradas desde otro dispositivo). */
  deleteLocalIds: string[];
  /** Subir (upsert) a Firestore. */
  pushRemote: PlanLibrary[];
  /** Mover canciones y listas de fromId a toId y luego quitar la fila fromId (sin borrar archivos). */
  reassign: { fromId: string; toId: string }[];
}

const PROTECTED_ID = 'default';

function folderKey(lib: PlanLibrary): string {
  return (lib.driveFolderId || '').trim();
}

function toPlain(lib: RemoteLibraryDoc | LocalLibraryInfo): PlanLibrary {
  return {
    id: lib.id,
    name: lib.name,
    driveFolderId: lib.driveFolderId || '',
    syncEnabled: lib.syncEnabled,
    icon: lib.icon,
    color: lib.color,
    createdAt: lib.createdAt,
    updatedAt: lib.updatedAt,
  };
}

export function planLibrarySync(
  local: LocalLibraryInfo[],
  remote: RemoteLibraryDoc[]
): LibrarySyncPlan {
  const plan: LibrarySyncPlan = {
    saveLocal: [],
    deleteLocalIds: [],
    pushRemote: [],
    reassign: [],
  };

  const localById = new Map(local.map(l => [l.id, l]));
  const remoteById = new Map(remote.map(r => [r.id, r]));
  const handledLocal = new Set<string>();
  const handledRemote = new Set<string>();

  // --- Regla 4: duplicados por carpeta de Drive ---------------------------------
  for (const l of local) {
    if (remoteById.has(l.id)) continue;
    if (l.isPristinePlaceholder) continue;

    const folder = folderKey(l);
    if (!folder) continue;

    const twin = remote.find(
      r =>
        !r.deletedAt &&
        r.id !== l.id &&
        // el id remoto no existe acá, o existe solo como placeholder (que va a ser reemplazado)
        (!localById.has(r.id) || localById.get(r.id)!.isPristinePlaceholder) &&
        !handledRemote.has(r.id) &&
        folderKey(r) === folder
    );

    if (twin) {
      plan.reassign.push({ fromId: l.id, toId: twin.id });
      plan.saveLocal.push(toPlain(twin));
      handledLocal.add(l.id);
      handledRemote.add(twin.id);
    }
  }

  // --- Recorrer lo que hay en la nube -------------------------------------------
  for (const r of remote) {
    if (handledRemote.has(r.id)) continue;

    const l = localById.get(r.id);

    // Regla 2: borrado remoto
    if (r.deletedAt) {
      if (l && r.id !== PROTECTED_ID) plan.deleteLocalIds.push(r.id);
      continue;
    }

    if (!l) {
      plan.saveLocal.push(toPlain(r));
      continue;
    }

    // Regla 3: el placeholder siempre pierde
    if (l.isPristinePlaceholder) {
      plan.saveLocal.push(toPlain(r));
      continue;
    }

    // Regla 1: última modificación gana
    if (r.updatedAt > l.updatedAt) plan.saveLocal.push(toPlain(r));
    else if (r.updatedAt < l.updatedAt) plan.pushRemote.push(toPlain(l));
  }

  // --- Lo que solo existe en el dispositivo -------------------------------------
  for (const l of local) {
    if (remoteById.has(l.id) || handledLocal.has(l.id)) continue;
    if (l.isPristinePlaceholder) continue; // Regla 3: nunca se sube
    plan.pushRemote.push(toPlain(l));
  }

  return plan;
}
