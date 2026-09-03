import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
} from 'react-native';
import { CreateBandSetlistModal } from '../../../../src/components/band/CreateBandSetlistModal';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBands } from '../../../../src/hooks/useBands';
import { BandSetlistList } from '../../../../src/components/band/BandSetlistList';
import { BandSetlist } from '../../../../src/types/band';
import { COLORS } from '../../../../src/constants/theme';
import { useBandSetlists } from '../../../../src/hooks/useBandSetlists';
import { useAppContext } from '../../../../src/context/AppContext';
import { useDirectorSession } from '../../../../src/hooks/useDirectorSession';

export default function BandSetlistsScreen() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const insets = useSafeAreaInsets();

    const { activeBandId } = useAppContext();

    const { activeSession } = useDirectorSession(activeBandId);

    const {
        userBandsInfo,
    } = useBands();

    // La banda del repertorio se determina por activeBandId,
    // que es el ID establecido desde BandScreen antes de navegar.
    const activeBand = userBandsInfo.find(
        info => info.band.id === activeBandId
    )?.band || null;

    const {
        setlists,
        loading,
        error,
        createSetlist,
    } = useBandSetlists(activeBandId);

    const handleSelectSetlist = (setlist: BandSetlist) => {
        router.push({
            pathname: '/(tabs)/band/setlists/[id]',
            params: {
                id: setlist.id,
            },
        });
    };

    const handleCreateSetlist = () => {
        setIsCreateModalOpen(true);
    };

    const handleCreate = async (name: string) => {
        await createSetlist(name);
        setIsCreateModalOpen(false);
    };

    const handleGoBack = () => {
        router.back();
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    activeOpacity={0.7}
                    onPress={handleGoBack}
                >
                    <ChevronLeft
                        size={24}
                        color={COLORS.foreground}
                    />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>
                        Repertorio de la banda
                    </Text>

                    {activeBand && (
                        <Text
                            style={styles.headerSubtitle}
                            numberOfLines={1}
                        >
                            {activeBand.name}
                        </Text>
                    )}
                </View>

                <View style={styles.headerSpacer} />
            </View>

            {/* Lista de repertorios */}
            <BandSetlistList
                bandId={activeBandId}
                setlists={setlists}
                loading={loading}
                error={error}
                activeSession={activeSession}
                onSelectSetlist={handleSelectSetlist}
                onCreateSetlist={handleCreateSetlist}
            />

            {/* Crear repertorio */}
            <CreateBandSetlistModal
                visible={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleCreate}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },

    headerTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },

    headerTitle: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '700',
    },

    headerSubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 2,
    },

    headerSpacer: {
        width: 40,
        marginLeft: 12,
    },
});
