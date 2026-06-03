import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppContext } from '../../src/context/AppContext';
import { SongViewer } from '../../src/components/SongViewer';
import { COLORS } from '../../src/constants/theme';

export default function SongScreen() {
    const { id } = useLocalSearchParams();
    const { 
        selectedSong, 
        songContent, 
        songSettings,
        handleSaveSongSettings,
        myDirectorSession,
        followingSession,
        handleFollowSongChange,
        setlistSongs,
        handleDirectorNext,
        handleDirectorPrev,
        setSelectedSong,
        setSongContent,
        setSetlistSongs
    } = useAppContext();

    if (!selectedSong || !songContent) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    const handleClose = () => {
        setSelectedSong(null);
        setSongContent(null);
        if (!myDirectorSession) {
            setSetlistSongs([]);
        }
        router.back();
    };

    return (
        <View style={styles.container}>
            <SongViewer
                title={selectedSong.name}
                songId={selectedSong.id}
                content={songContent}
                onClose={handleClose}
                initialSettings={songSettings}
                onSaveSettings={handleSaveSongSettings}
                isDirector={!!myDirectorSession}
                directorSessionId={myDirectorSession?.id}
                followSessionId={followingSession?.id}
                onFollowSongChange={handleFollowSongChange}
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
