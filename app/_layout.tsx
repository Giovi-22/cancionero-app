import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppContextProvider } from "../src/context/AppContext";
import { COLORS } from "../src/constants/theme";

import { useState } from "react";
import { FolderPickerModal } from "../src/components/FolderPickerModal";
import { LibrarySelectorModal } from "../src/components/LibrarySelectorModal";
import { CreateSetlistModal, EditSetlistModal } from "../src/components/SetlistModals";
import { useAppContext } from "../src/context/AppContext";

function GlobalModals() {
    const { isLibrariesOpen, setIsLibrariesOpen } = useAppContext();
    return (
        <>
            <FolderPickerModal />
            <CreateSetlistModal />
            <EditSetlistModal />
            <LibrarySelectorModal isOpen={isLibrariesOpen} onClose={() => setIsLibrariesOpen(false)} />
        </>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider
                style={{
                    flex: 1,
                    backgroundColor: COLORS.background,
                }}
            >
                <AppContextProvider>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                        }}
                    />
                    <GlobalModals />
                </AppContextProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}