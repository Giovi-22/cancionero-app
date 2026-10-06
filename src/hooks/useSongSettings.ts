import { useEffect, useRef, useState } from 'react';

interface UseSongSettingsParams {
    songId: string;
    initialSettings?: any;
    onSaveSettings?: (settings: any) => void;
}

export const useSongSettings = ({
    songId,
    initialSettings,
    onSaveSettings,
}: UseSongSettingsParams) => {
    const [transpose, setTranspose] = useState<number>(
        initialSettings?.transpose || 0
    );

    const [capo, setCapo] = useState(
        initialSettings?.capo || 0
    );

    const [fontSize, setFontSize] = useState(
        initialSettings?.fontSize || 16
    );

    const [viewMode, setViewMode] = useState<'all' | 'lyrics'>(
        initialSettings?.viewMode || 'all'
    );

    const [isScrolling, setIsScrolling] = useState(false);

    const [scrollSpeed, setScrollSpeed] = useState<number>(
        initialSettings?.scrollSpeed || 0.6
    );

    const [pedalSpeed, setPedalSpeed] = useState<number>(
        initialSettings?.pedalSpeed || 0.4
    );

    const [isStageMode, setIsStageMode] = useState(true);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [musicianNotes, setMusicianNotes] = useState<any>(
        initialSettings?.musicianNotes || {}
    );

    const [bpm, setBpm] = useState(
        initialSettings?.bpm || 120
    );

    /**
     * Cuando cambia la canción, cargamos nuevamente
     * sus configuraciones iniciales.
     *
     * Se conserva el comportamiento anterior de SongViewer:
     * los valores se resetean solamente cuando cambia songId.
     */
    const prevSongId = useRef(songId);

    useEffect(() => {
        if (prevSongId.current !== songId) {
            setTranspose(initialSettings?.transpose || 0);
            setCapo(initialSettings?.capo || 0);
            setFontSize(initialSettings?.fontSize || 16);
            setViewMode(initialSettings?.viewMode || 'all');
            setMusicianNotes(initialSettings?.musicianNotes || {});
            setBpm(initialSettings?.bpm || 120);

            prevSongId.current = songId;
        }
    }, [songId, initialSettings]);

    /**
     * Guarda las configuraciones cuando cambian.
     *
     * Se mantiene deliberadamente la misma lista de dependencias
     * que tenía SongViewer antes de extraer este hook.
     */
    useEffect(() => {
        onSaveSettings?.({
            songId,
            settings: {
                transpose,
                capo,
                fontSize,
                viewMode,
                scrollSpeed,
                pedalSpeed,
                musicianNotes,
                bpm,
            },
        });
    }, [
        transpose,
        capo,
        fontSize,
        viewMode,
        scrollSpeed,
        pedalSpeed,
        musicianNotes,
        bpm,
    ]);

    return {
        transpose,
        setTranspose,

        capo,
        setCapo,

        fontSize,
        setFontSize,

        viewMode,
        setViewMode,

        isScrolling,
        setIsScrolling,

        scrollSpeed,
        setScrollSpeed,

        pedalSpeed,
        setPedalSpeed,

        isStageMode,
        setIsStageMode,

        isSettingsOpen,
        setIsSettingsOpen,

        musicianNotes,
        setMusicianNotes,

        bpm,
        setBpm,
    };
};