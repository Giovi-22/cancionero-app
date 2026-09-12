import { firestore, auth } from '../lib/firebase';
import { BandSetlist } from '../types/band';

export class BandSetlistService {
    private static COLLECTION = 'bands';

    /**
     * Referencia a la colección de setlists de una banda.
     *
     * Firestore:
     * bands/{bandId}/setlists
     */
    private static getCollection(bandId: string) {
        return firestore()
            .collection(this.COLLECTION)
            .doc(bandId)
            .collection('setlists');
    }

    /**
     * Convierte un documento Firestore en BandSetlist.
     *
     * Mantiene el mapeo Firestore -> modelo de dominio
     * centralizado en un único lugar.
     */
    private static mapSetlist(
        doc: {
            id: string;
            data: () => Record<string, any>;
        },
        bandId: string
    ): BandSetlist {
        const data = doc.data();

        return {
            id: doc.id,
            bandId,

            name:
                typeof data.name === 'string'
                    ? data.name
                    : '',

            date:
                typeof data.date === 'string'
                    ? data.date
                    : undefined,

            songIds:
                Array.isArray(data.songIds)
                    ? data.songIds.filter(
                        (songId: unknown): songId is string =>
                            typeof songId === 'string'
                    )
                    : [],

            notes:
                typeof data.notes === 'string'
                    ? data.notes
                    : undefined,

            songNotes:
                data.songNotes &&
                    typeof data.songNotes === 'object'
                    ? data.songNotes as Record<string, string>
                    : {},

            createdBy:
                typeof data.createdBy === 'string'
                    ? data.createdBy
                    : '',

            createdAt:
                typeof data.createdAt === 'string'
                    ? data.createdAt
                    : new Date().toISOString(),

            updatedAt:
                typeof data.updatedAt === 'string'
                    ? data.updatedAt
                    : new Date().toISOString(),
        };
    }

    /**
     * Obtiene todos los setlists de una banda.
     *
     * El acceso real queda protegido por Firestore Security Rules.
     */
    static async getBandSetlists(
        bandId: string
    ): Promise<BandSetlist[]> {
        if (!bandId) {
            return [];
        }

        try {
            const snapshot = await this
                .getCollection(bandId)
                .orderBy('updatedAt', 'desc')
                .get();

            return snapshot.docs.map(doc =>
                this.mapSetlist(doc, bandId)
            );
        } catch (error: unknown) {
            console.error(
                '[BandSetlistService] Error obteniendo repertorio:',
                error
            );

            throw error;
        }
    }

    /**
     * Suscripción en tiempo real al repertorio de una banda.
     */
    static subscribeToBandSetlists(
        bandId: string,
        onUpdate: (setlists: BandSetlist[]) => void,
        onError?: (error: Error) => void
    ): () => void {
        if (!bandId) {
            onUpdate([]);
            return () => { };
        }

        const query = this
            .getCollection(bandId)
            .orderBy('updatedAt', 'desc');

        const unsubscribe = query.onSnapshot(
            snapshot => {
                try {
                    const setlists: BandSetlist[] =
                        snapshot.docs.map(doc =>
                            this.mapSetlist(doc, bandId)
                        );

                    onUpdate(setlists);
                } catch (error: unknown) {
                    console.error(
                        '[BandSetlistService] Error procesando repertorio:',
                        error
                    );

                    onError?.(
                        error instanceof Error
                            ? error
                            : new Error(
                                'No se pudo procesar el repertorio.'
                            )
                    );
                }
            },
            error => {
                console.error(
                    '[BandSetlistService] Error en suscripción:',
                    error
                );

                onError?.(
                    error instanceof Error
                        ? error
                        : new Error(
                            'No se pudo sincronizar el repertorio.'
                        )
                );
            }
        );

        return unsubscribe;
    }

    /**
     * Crea un nuevo setlist dentro del repertorio de la banda.
     *
     * Cualquier usuario autorizado por las Security Rules
     * podrá crear uno.
     */
    static async createBandSetlist(
        bandId: string,
        name: string,
        date?: Date
    ): Promise<BandSetlist> {
        if (!bandId) {
            throw new Error(
                'No se especificó la banda.'
            );
        }

        const trimmedName = name.trim();

        if (!trimmedName) {
            throw new Error(
                'El nombre del repertorio no puede estar vacío.'
            );
        }

        const user = auth().currentUser;

        if (!user) {
            throw new Error(
                'Debés iniciar sesión para crear un repertorio.'
            );
        }

        const now = new Date().toISOString();

        const formattedDate = date
            ? `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, '0')}-${String(
                date.getDate()
            ).padStart(2, '0')}`
            : undefined;

        const docRef = this
            .getCollection(bandId)
            .doc();

        const newSetlist: BandSetlist = {
            id: docRef.id,
            bandId,
            name: trimmedName,
            date: formattedDate,
            songIds: [],
            notes: undefined,
            songNotes: {},
            createdBy: user.uid,
            createdAt: now,
            updatedAt: now,
        };

        await docRef.set({
            id: newSetlist.id,
            bandId: bandId,
            name: newSetlist.name,
            date: newSetlist.date || null,
            songIds: [],
            notes: null,
            songNotes: {},
            createdBy: user.uid,
            createdAt: now,
            updatedAt: now,
        });

        return newSetlist;
    }

    /**
     * Actualiza un setlist de banda.
     */
    static async updateBandSetlist(
        setlist: BandSetlist
    ): Promise<void> {
        if (!setlist.bandId) {
            throw new Error(
                'El setlist no tiene una banda asociada.'
            );
        }

        if (!setlist.id) {
            throw new Error(
                'El setlist no tiene ID.'
            );
        }

        if (!setlist.name.trim()) {
            throw new Error(
                'El nombre del repertorio no puede estar vacío.'
            );
        }

        const updatedAt = new Date().toISOString();

        await this
            .getCollection(setlist.bandId)
            .doc(setlist.id)
            .update({
                name: setlist.name.trim(),
                date: setlist.date || null,
                songIds: setlist.songIds || [],
                notes: setlist.notes || null,
                songNotes: setlist.songNotes || {},
                updatedAt,
            });
    }

    /**
     * Elimina un setlist del repertorio de la banda.
     */
    static async deleteBandSetlist(
        bandId: string,
        setlistId: string
    ): Promise<void> {
        if (!bandId || !setlistId) {
            throw new Error(
                'Banda o setlist inválido.'
            );
        }

        await this
            .getCollection(bandId)
            .doc(setlistId)
            .delete();
    }
}
