import { useCallback, useEffect, useState } from 'react';
import { BandSetlist } from '../types/band';
import { BandSetlistService } from '../services/BandSetlistService';
export function useBandSetlists(
    bandId: string | null
) {
    const [setlists, setSetlists] = useState<BandSetlist[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!bandId) {
            setSetlists([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribe =
            BandSetlistService.subscribeToBandSetlists(
                bandId,
                updatedSetlists => {
                    setSetlists(updatedSetlists);
                    setLoading(false);
                },
                err => {
                    console.error(
                        '[useBandSetlists]',
                        err
                    );

                    setError(
                        err.message ||
                        'No se pudo cargar el repertorio.'
                    );

                    setLoading(false);
                }
            );

        return () => {
            unsubscribe();
        };
    }, [bandId]);

    const createSetlist = useCallback(
        async (name: string) => {
            if (!bandId) {
                throw new Error(
                    'No hay una banda seleccionada.'
                );
            }

            return BandSetlistService.createBandSetlist(
                bandId,
                name
            );
        },
        [bandId]
    );

    const updateSetlist = useCallback(
        async (setlist: BandSetlist) => {
            await BandSetlistService.updateBandSetlist(
                setlist
            );
        },
        []
    );

    const deleteSetlist = useCallback(
        async (setlistId: string) => {
            if (!bandId) {
                throw new Error(
                    'No hay una banda seleccionada.'
                );
            }

            await BandSetlistService.deleteBandSetlist(
                bandId,
                setlistId
            );
        },
        [bandId]
    );

    return {
        setlists,
        loading,
        error,
        createSetlist,
        updateSetlist,
        deleteSetlist,
    };
}
