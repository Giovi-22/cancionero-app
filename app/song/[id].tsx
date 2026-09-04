import React, { useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAppContext } from '../../src/context/AppContext';
import { useDirectorSession } from '../../src/hooks/useDirectorSession';
import { SongViewer } from '../../src/components/SongViewer';
import { COLORS } from '../../src/constants/theme';

export default function SongScreen() {
    const {
        selectedSong,
        songContent,
        songSettings,
        handleSaveSongSettings,
        activeBandId,
        handleFollowSongChange,
        setlistSongs,
        setSelectedSong,
        setSongContent,
        setSetlistSongs,
        globalTheme,
        handleSaveGlobalTheme,
    } = useAppContext();

    const {
        activeSession,
        isDirectorOfSession,
        latestEvent,
        sendEvent,
    } = useDirectorSession(activeBandId);

    const isDirector = isDirectorOfSession;
    const isFollower = !isDirector && !!activeSession;

    if (!selectedSong || !songContent) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    const handleClose = () => {
        router.back();
        setTimeout(() => {
            setSelectedSong(null);
            setSongContent(null);
            if (!isDirector) {
                setSetlistSongs([]);
            }
        }, 350);
    };

    // Callbacks de navegación dentro del setlist (solo para Director)
    const handleDirectorNext = isDirector ? async () => {
        if (!selectedSong || setlistSongs.length === 0) return;
        const idx = setlistSongs.findIndex(s => s.id === selectedSong.id);
        const next = setlistSongs[idx + 1];
        if (next) {
            // Navegar a la canción siguiente
            router.replace(`/song/${next.id}`);
        }
    } : undefined;

    const handleDirectorPrev = isDirector ? async () => {
        if (!selectedSong || setlistSongs.length === 0) return;
        const idx = setlistSongs.findIndex(s => s.id === selectedSong.id);
        const prev = setlistSongs[idx - 1];
        if (prev) {
            router.replace(`/song/${prev.id}`);
        }
    } : undefined;

    return (
        <View style={styles.container}>
            <SongViewer
                title={selectedSong.name}
                songId={selectedSong.id}
                content={songContent}
                onClose={handleClose}
                initialSettings={songSettings}
                onSaveSettings={handleSaveSongSettings}
                globalTheme={globalTheme}
                onSaveGlobalTheme={handleSaveGlobalTheme}
                isDirector={isDirector}
                isFollower={isFollower}
                onSendDirectorEvent={isDirector ? sendEvent : undefined}
                incomingDirectorEvent={!isDirector ? latestEvent : null}
                onFollowSongChange={!isDirector ? handleFollowSongChange : undefined}
                setlistSongs={setlistSongs}
                onDirectorNext={handleDirectorNext}
                onDirectorPrev={handleDirectorPrev}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
