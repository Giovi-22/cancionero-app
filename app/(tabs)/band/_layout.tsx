import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/theme';

export default function BandLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {
                    backgroundColor: COLORS.background,
                },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="setlists/index" />
            <Stack.Screen name="setlists/[id]" />
        </Stack>
    );
}