import { Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";

import { AppContextProvider } from "../src/context/AppContext";
import { COLORS } from "../src/constants/theme";

import { FolderPickerModal } from "../src/components/FolderPickerModal";
import { LibrarySelectorModal } from "../src/components/LibrarySelectorModal";
//import { DirectorSessionBanner } from "../src/components/DirectorSessionBanner";

//App Contexts
import { useAppContext } from "../src/context/AppContext";
import { UserContextProvider } from "../src/context/UserContext";
import { DebugContextProvider } from "../src/context/DebugContext";
import { BandContextProvider } from "../src/context/BandContext";
import CreateSetlistModal from "../src/components/CreateSetlistModal";
import EditSetlistModal from "../src/components/EditSetlistModal";

function GlobalModals() {
    const { isLibrariesOpen, setIsLibrariesOpen } = useAppContext();
    return (
        <>
            <CreateSetlistModal />
            <EditSetlistModal />
            <LibrarySelectorModal isOpen={isLibrariesOpen} onClose={() => setIsLibrariesOpen(false)} />
            <FolderPickerModal />
        </>
    );
}

/**
 * Banner global de Director Mode.
 *
 * Se renderiza como un elemento real en el flujo de flex layout arriba del Stack,
 * ocupando su propio espacio vertical (NO usa position absolute ni tapa la UI).
 *
 * Aplica insets.top para situarse debajo de la barra de estado del sistema.
 * Si el usuario se encuentra dentro de /setlist-player o /song/[id], no se renderiza
 * para evitar duplicar controles ya presentes en el SongViewer.
 */
/*
function GlobalDirectorBanner() {
    const pathname = usePathname();

    // No mostrar el banner si ya estamos en el reproductor de setlists o en el visor de canción
    if (pathname?.includes('/setlist-player') || pathname?.includes('/song/')) {
        return null;
    }

    return (
        <DirectorSessionBanner />
    );
}
*/
export default function RootLayout() {
    useEffect(() => {
        if (Platform.OS === 'android') {
            // Ocultar barra de navegación del sistema y hacerla inmersiva y oscura
            NavigationBar.setPositionAsync('absolute').catch(() => { });
            NavigationBar.setBackgroundColorAsync('#0a0a0a').catch(() => { });
            NavigationBar.setButtonStyleAsync('light').catch(() => { });
            NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => { });
            NavigationBar.setVisibilityAsync('hidden').catch(() => { });
        }
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider
                style={{
                    flex: 1,
                    backgroundColor: COLORS.background,
                }}
            >
                <UserContextProvider>
                    <StatusBar style="light" backgroundColor="#0a0a0a" translucent />
                    <BandContextProvider>
                        <DebugContextProvider>
                            <AppContextProvider>
                                <View style={{ flex: 1, backgroundColor: COLORS.background }}>
                                    {/*<GlobalDirectorBanner />*/}
                                    <View style={{ flex: 1 }}>
                                        <Stack
                                            screenOptions={{
                                                headerShown: false,
                                            }}
                                        >
                                            <Stack.Screen name="(tabs)" />
                                            <Stack.Screen name="song/[id]" />
                                            <Stack.Screen name="pedal-config" />
                                            <Stack.Screen
                                                name="setlist-player/[setlistId]"
                                                options={{ animation: 'slide_from_bottom' }}
                                            />
                                        </Stack>
                                    </View>
                                </View>
                                <GlobalModals />
                            </AppContextProvider>
                        </DebugContextProvider>
                    </BandContextProvider>
                </UserContextProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}