import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";

import { AppContextProvider } from "../src/context/AppContext";
import { COLORS } from "../src/constants/theme";

import { FolderPickerModal } from "../src/components/FolderPickerModal";
import { LibrarySelectorModal } from "../src/components/LibrarySelectorModal";
import { CreateSetlistModal, EditSetlistModal } from "../src/components/SetlistModals";
import { useAppContext } from "../src/context/AppContext";

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

export default function RootLayout() {
    useEffect(() => {
        if (Platform.OS === 'android') {
            // Ocultar barra de navegación del sistema y hacerla inmersiva y oscura
            NavigationBar.setPositionAsync('absolute').catch(() => {});
            NavigationBar.setBackgroundColorAsync('#0a0a0a').catch(() => {});
            NavigationBar.setButtonStyleAsync('light').catch(() => {});
            NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
            NavigationBar.setVisibilityAsync('hidden').catch(() => {});
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
                <StatusBar style="light" backgroundColor="#0a0a0a" translucent />
                <AppContextProvider>
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
                    <GlobalModals />
                </AppContextProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}