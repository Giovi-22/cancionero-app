import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

interface UseSongMetronomeParams {
    bpm: number;
}

export const useSongMetronome = ({
    bpm,
}: UseSongMetronomeParams) => {
    const [isMetronomeActive, setIsMetronomeActive] =
        useState(false);

    const [beat, setBeat] = useState(0);

    const [beatCount, setBeatCount] = useState(0);

    const [metronomeMuted, setMetronomeMuted] =
        useState(false);

    const [timeSignature, setTimeSignature] = useState(4);

    const beatCountRef = useRef(0);

    const soundAccentRef = useRef<Audio.Sound | null>(null);
    const soundNormalRef = useRef<Audio.Sound | null>(null);

    /**
     * Carga los sonidos del metrónomo.
     */
    useEffect(() => {
        let mounted = true;

        const loadSounds = async () => {
            try {
                const { sound: accentSound } =
                    await Audio.Sound.createAsync(
                        require('../../assets/click_accent.wav')
                    );

                const { sound: normalSound } =
                    await Audio.Sound.createAsync(
                        require('../../assets/click_normal.wav')
                    );

                if (!mounted) {
                    await accentSound.unloadAsync();
                    await normalSound.unloadAsync();
                    return;
                }

                soundAccentRef.current = accentSound;
                soundNormalRef.current = normalSound;
            } catch (error) {
                console.error(
                    'Error cargando sonidos del metrónomo:',
                    error
                );
            }
        };

        loadSounds();

        return () => {
            mounted = false;

            if (soundAccentRef.current) {
                soundAccentRef.current.unloadAsync();
                soundAccentRef.current = null;
            }

            if (soundNormalRef.current) {
                soundNormalRef.current.unloadAsync();
                soundNormalRef.current = null;
            }
        };
    }, []);

    /**
     * Reproduce el click correspondiente al beat.
     */
    const playMetronomeClick = useCallback(
        async (currentBeat: number) => {
            if (metronomeMuted) {
                return;
            }

            try {
                const sound =
                    currentBeat === 0
                        ? soundAccentRef.current
                        : soundNormalRef.current;

                if (!sound) {
                    return;
                }

                await sound.setPositionAsync(0);
                await sound.playAsync();
            } catch (error) {
                console.error(
                    'Error reproduciendo click del metrónomo:',
                    error
                );
            }
        },
        [metronomeMuted]
    );

    /**
     * Ejecuta el metrónomo.
     */
    useEffect(() => {
        if (!isMetronomeActive) {
            return;
        }

        const intervalMs = 60000 / bpm;

        beatCountRef.current = 0;
        setBeat(0);
        setBeatCount(0);

        playMetronomeClick(0);

        const interval = setInterval(() => {
            beatCountRef.current =
                (beatCountRef.current + 1) %
                timeSignature;

            const currentBeat =
                beatCountRef.current;

            setBeat(currentBeat);
            setBeatCount(currentBeat + 1);

            playMetronomeClick(currentBeat);
        }, intervalMs);

        return () => {
            clearInterval(interval);
        };
    }, [
        isMetronomeActive,
        bpm,
        timeSignature,
        playMetronomeClick,
    ]);

    /**
     * Al cambiar la canción o configuración,
     * el contador vuelve a cero cuando el metrónomo
     * se encuentra detenido.
     */
    useEffect(() => {
        if (!isMetronomeActive) {
            beatCountRef.current = 0;
            setBeat(0);
            setBeatCount(0);
        }
    }, [isMetronomeActive]);

    return {
        isMetronomeActive,
        setIsMetronomeActive,

        beat,
        beatCount,

        metronomeMuted,
        setMetronomeMuted,

        timeSignature,
        setTimeSignature,

        playMetronomeClick,
    };
};