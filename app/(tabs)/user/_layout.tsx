import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/theme';

export default function UserLayout() {
    return (
        <Stack
            screenOptions={{
                animation: 'slide_from_right',
                headerStyle: {
                    backgroundColor: COLORS.background,
                },
                headerTintColor: COLORS.foreground,
                headerTitleStyle: {
                    color: COLORS.foreground,
                    fontWeight: '600',
                },
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name="settings"
                options={{
                    headerShown: true,
                    title: 'Configuración',
                }}
            />
        </Stack>
    );
}
