import {
    useCallback,
    useEffect,
    useState,
} from 'react';

import { useBandContext } from '../context/BandContext';
import { DriveService } from '../services/DriveService';
import { BandSong } from '../types/band';

interface UseBandSongsResult {
    songs: BandSong[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useBandSongs = (): UseBandSongsResult => {
    const { selectedBand } = useBandContext();

    const [songs, setSongs] = useState<BandSong[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadSongs = useCallback(async () => {
        const folderId = selectedBand?.driveFolderId;

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
    }, [selectedBand?.driveFolderId]);

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