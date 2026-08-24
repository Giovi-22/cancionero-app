import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Home,
    Music,
    List,
    User,
} from "lucide-react-native";

import { COLORS } from "../../src/constants/theme";

function AnimatedTabButton({ children, onPress, onPressIn, onPressOut, accessibilityState }: any) {
    const selected = accessibilityState?.selected;
    const scale = useSharedValue(selected ? 1.1 : 1);
    const opacity = useSharedValue(selected ? 1 : 0.6);

    useEffect(() => {
        scale.value = withSpring(selected ? 1.1 : 1, { damping: 12, stiffness: 150 });
        opacity.value = withSpring(selected ? 1 : 0.6, { damping: 12 });
    }, [selected]);

    const handlePressIn = (e: any) => {
        scale.value = withSpring(0.85, { damping: 15, stiffness: 300 });
        opacity.value = withSpring(0.9, { damping: 15 });
        onPressIn?.(e);
    };

    const handlePressOut = (e: any) => {
        scale.value = withSpring(selected ? 1.1 : 1, { damping: 12, stiffness: 150 });
        opacity.value = withSpring(selected ? 1 : 0.6, { damping: 12 });
        onPressOut?.(e);
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{ color: 'rgba(59, 130, 246, 0.25)', borderless: true, radius: 28 }}
            style={({ pressed }) => [
                styles.tabButton,
                pressed && styles.tabButtonPressed
            ]}
        >
            <Animated.View style={[styles.innerButton, animatedStyle]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.surface,
                    borderTopColor: COLORS.border,
                    height: 60 + insets.bottom,
                    paddingBottom: 8 + insets.bottom,
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
        borderRadius: 16,
    },
    tabButtonPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    innerButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});