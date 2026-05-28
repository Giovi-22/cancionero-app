import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppContextProvider } from "../src/context/AppContext";
import { COLORS } from "../src/constants/theme";

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
                </AppContextProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}