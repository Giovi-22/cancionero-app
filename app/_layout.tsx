import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { useOtaUpdate } from "../src/hooks/useOtaUpdate";
import { Platform, View, StyleSheet, Animated } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { AppContextProvider } from "../src/context/AppContext";
import { COLORS } from "../src/constants/theme";

import { FolderPickerModal } from "../src/components/FolderPickerModal";
import { LibrarySelectorModal } from "../src/components/LibrarySelectorModal";

// App Contexts
import { useAppContext } from "../src/context/AppContext";
import { UserContextProvider, useUserContext } from "../src/context/UserContext";
import { DebugContextProvider } from "../src/context/DebugContext";
import { BandContextProvider } from "../src/context/BandContext";
import CreateSetlistModal from "../src/components/CreateSetlistModal";
import EditSetlistModal from "../src/components/EditSetlistModal";
import AppWithSplash from "@/src/screens/SplashScreen";

// Mantener la splash nativa visible hasta que nuestra app esté lista
SplashScreen.preventAutoHideAsync();

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
    useOtaUpdate();

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
                    backgroundColor: COLORS.background, // Asegúrate de que apunte a '#121316'
                }}
            >
                <UserContextProvider>
                    <StatusBar style="light" backgroundColor="#0a0a0a" translucent />
                    <BandContextProvider>
                        <DebugContextProvider>
                            <AppContextProvider>
                                <AppWithSplash>
                                    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
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
                                </AppWithSplash>
                                <GlobalModals />
                            </AppContextProvider>
                        </DebugContextProvider>
                    </BandContextProvider>
                </UserContextProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
