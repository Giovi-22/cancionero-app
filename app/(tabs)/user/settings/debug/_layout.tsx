import { Stack } from 'expo-router';

export default function DebugLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="udp-test" />
        </Stack>
    );
}