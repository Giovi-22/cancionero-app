import { Tabs } from "expo-router";
import {
    Home,
    Music,
    List,
} from "lucide-react-native";

import { COLORS } from "../../src/constants/theme";

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.surface,
                    borderTopColor: COLORS.border,
                },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.mutedForeground,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Inicio",
                    tabBarIcon: ({ color, size }) => (
                        <Home color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="songs"
                options={{
                    title: "Canciones",
                    tabBarIcon: ({ color, size }) => (
                        <Music color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="setlists"
                options={{
                    title: "Listas",
                    tabBarIcon: ({ color, size }) => (
                        <List color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}