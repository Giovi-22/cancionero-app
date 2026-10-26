import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { useBandContext } from '../context/BandContext';
import { DriveService } from '../services/DriveService';
import { BandSong } from '../types/band';
import { firestore } from '../lib/firebase';

interface UseBandSongsResult {
    songs: BandSong[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useBandSongs = (bandId?: string | null): UseBandSongsResult => {
    const { selectedBand, bands } = useBandContext();

    const targetBand = useMemo(() => {
        if (!bandId) return selectedBand;
        return bands.find(b => b.id === bandId) || selectedBand;
    }, [bandId, bands, selectedBand]);

    const [songs, setSongs] = useState<BandSong[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadSongs = useCallback(async () => {
        let folderId = targetBand?.driveFolderId;

        if (!folderId && bandId) {
            try {
                const doc = await firestore().collection('bands').doc(bandId).get();
                if (doc.exists) {
                    folderId = doc.data()?.driveFolderId;
                }
            } catch (err) {
                console.warn('[useBandSongs] No se pudo obtener la banda de Firestore:', err);
            }
        }

        if (!folderId) {
            setSongs([]);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const remoteSongs =
                await DriveService.getSongsFromFolderRecursive(
                    folderId
                );

            const bandSongs: BandSong[] = remoteSongs.map(song => ({
                id: song.id,
                name: song.name.replace(
                    /\.(chordpro|pro|cho|chopro|crd|txt)$/i,
                    ''
                ),
                mimeType: song.mimeType,
                modifiedTime: song.modifiedTime,
                folderName: song.folderName,
            }));

            setSongs(bandSongs);
        } catch (e: any) {
            console.error(
                '[useBandSongs] Error al cargar canciones de la banda:',
                e
            );

            setSongs([]);

            setError(
                e instanceof Error
                    ? e.message
                    : 'No se pudieron cargar las canciones de la banda.'
            );
        } finally {
            setLoading(false);
        }
    }, [targetBand?.driveFolderId, bandId]);

    useEffect(() => {
        loadSongs();
    }, [loadSongs]);

    return {
        songs,
        loading,
        error,
        refresh: loadSongs,
    };
};