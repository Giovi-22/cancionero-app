import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import {
    Home,
    Music,
    List,
    User,
} from "lucide-react-native";

import { COLORS } from "../../src/constants/theme";

function AnimatedTabButton({ children, onPress, accessibilityState }: any) {
    const selected = accessibilityState?.selected;
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.7);

    useEffect(() => {
        scale.value = withSpring(selected ? 1.1 : 1, { damping: 12, stiffness: 120 });
        opacity.value = withSpring(selected ? 1 : 0.6, { damping: 12 });
    }, [selected]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });

    return (
        <Pressable
            onPress={onPress}
            style={styles.tabButton}
        >
            <Animated.View style={[styles.innerButton, animatedStyle]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.surface,
                    borderTopColor: COLORS.border,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
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
                    tabBarButton: (props) => <AnimatedTabButton {...props} />
                }}
            />

            <Tabs.Screen
                name="songs"
                options={{
                    title: "Canciones",
                    tabBarIcon: ({ color, size }) => (
                        <Music color={color} size={size} />
                    ),
                    tabBarButton: (props) => <AnimatedTabButton {...props} />
                }}
            />

            <Tabs.Screen
                name="setlists"
                options={{
                    title: "Listas",
                    tabBarIcon: ({ color, size }) => (
                        <List color={color} size={size} />
                    ),
                    tabBarButton: (props) => <AnimatedTabButton {...props} />
                }}
            />

            <Tabs.Screen
                name="user"
                options={{
                    title: "Perfil",
                    tabBarIcon: ({ color, size }) => (
                        <User color={color} size={size} />
                    ),
                    tabBarButton: (props) => <AnimatedTabButton {...props} />
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});