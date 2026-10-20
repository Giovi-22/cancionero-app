import { planLibrarySync } from './librarySyncPlan';
import type { LocalLibraryInfo, RemoteLibraryDoc } from './librarySyncPlan';

declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

const base = { syncEnabled: true, icon: 'book-open', color: '#3b82f6' };
const L = (id: string, o: Partial<LocalLibraryInfo> = {}): LocalLibraryInfo =>
  ({ id, name: id, driveFolderId: '', createdAt: 1, updatedAt: 1, isPristinePlaceholder: false, ...base, ...o });
const R = (id: string, o: Partial<RemoteLibraryDoc> = {}): RemoteLibraryDoc =>
  ({ id, name: id, driveFolderId: '', createdAt: 1, updatedAt: 1, ...base, ...o });

describe('planLibrarySync', () => {
  // 1) Dispositivo nuevo: solo placeholder; la nube tiene 'default' (con carpeta) y lib_2
  test('1. dispositivo nuevo: baja default y lib_2 (aunque el placeholder sea "más nuevo")', () => {
    const p = planLibrarySync(
      [L('default', { name: 'Mi Biblioteca', updatedAt: 999, isPristinePlaceholder: true })],
      [R('default', { name: 'Iglesia', driveFolderId: 'F1', updatedAt: 10 }), R('lib_2', { driveFolderId: 'F2', updatedAt: 20 })]
    );
    expect(p.saveLocal.map(x => x.id).sort().join() === 'default,lib_2' && p.pushRemote.length === 0 && p.deleteLocalIds.length === 0).toBe(true);
    expect(p.saveLocal.find(x => x.id === 'default')?.driveFolderId === 'F1').toBe(true);
  });

  // 2) Primera vez con la función: dispositivo con bibliotecas, nube vacía -> sube todo menos placeholder
  test('2. migración inicial: sube las reales, no el placeholder', () => {
    const p = planLibrarySync(
      [L('default', { driveFolderId: 'F1' }), L('lib_9', { driveFolderId: 'F9' }), L('x', { isPristinePlaceholder: true })],
      []
    );
    expect(p.pushRemote.map(x => x.id).sort().join() === 'default,lib_9').toBe(true);
  });

  // 3) El caso real del usuario: en el dispositivo B recreó la biblioteca a mano (otro id, misma carpeta)
  test('3a. placeholder + biblioteca recreada con la misma carpeta => se reasigna a "default" de la nube, sin duplicar', () => {
    const p = planLibrarySync(
      [L('default', { isPristinePlaceholder: true }), L('lib_B', { name: 'Iglesia', driveFolderId: 'F1', updatedAt: 50 })],
      [R('default', { driveFolderId: 'F1', updatedAt: 10 })]
    );
    expect(
      p.reassign.length === 1 && p.reassign[0].fromId === 'lib_B' && p.reassign[0].toId === 'default' &&
      p.saveLocal.some(x => x.id === 'default') && !p.pushRemote.some(x => x.id === 'lib_B')
    ).toBe(true);
  });

  test('3b. biblioteca recreada a mano => reasigna al id de la nube, sin duplicar', () => {
    const p = planLibrarySync(
      [L('lib_B', { name: 'Iglesia', driveFolderId: 'F1', updatedAt: 50 })],
      [R('lib_A', { name: 'Iglesia', driveFolderId: 'F1', updatedAt: 10 })]
    );
    expect(
      p.reassign.length === 1 && p.reassign[0].fromId === 'lib_B' && p.reassign[0].toId === 'lib_A' && p.pushRemote.length === 0
    ).toBe(true);
  });

  // 4) Última modificación gana
  test('4. gana la más reciente en ambos sentidos', () => {
    const p = planLibrarySync([L('a', { name: 'viejo', updatedAt: 5 }), L('b', { name: 'nuevo', updatedAt: 50 })],
                              [R('a', { name: 'nuevo', updatedAt: 9 }), R('b', { name: 'viejo', updatedAt: 7 })]);
    expect(p.saveLocal.map(x => x.id).join() === 'a' && p.pushRemote.map(x => x.id).join() === 'b').toBe(true);
  });

  // 5) Borrado remoto se replica; 'default' nunca se borra
  test('5. tombstone borra localmente, pero nunca "default"', () => {
    const p = planLibrarySync([L('lib_1'), L('default', { driveFolderId: 'F' })],
                              [R('lib_1', { deletedAt: 100, updatedAt: 100 }), R('default', { deletedAt: 100, updatedAt: 100 })]);
    expect(p.deleteLocalIds.join() === 'lib_1' && p.pushRemote.length === 0).toBe(true);
  });

  // 6) Tombstone de algo que este dispositivo ya no tiene: no hace nada
  test('6. tombstone sin copia local => no-op', () => {
    const p = planLibrarySync([], [R('lib_z', { deletedAt: 5 })]);
    expect(!p.saveLocal.length && !p.deleteLocalIds.length && !p.pushRemote.length).toBe(true);
  });

  // 7) Idempotencia: estados iguales => sin acciones
  test('7. estados iguales => plan vacío', () => {
    const p = planLibrarySync([L('a', { driveFolderId: 'F', updatedAt: 3 })], [R('a', { driveFolderId: 'F', updatedAt: 3 })]);
    expect(!p.saveLocal.length && !p.pushRemote.length && !p.reassign.length && !p.deleteLocalIds.length).toBe(true);
  });

  // 8) Un gemelo remoto se reasigna una sola vez
  test('8. un gemelo remoto se reasigna una sola vez', () => {
    const p = planLibrarySync(
      [L('l1', { driveFolderId: 'F' }), L('l2', { driveFolderId: 'F' })],
      [R('r1', { driveFolderId: 'F' })]
    );
    expect(p.reassign.length === 1).toBe(true);
  });
});
