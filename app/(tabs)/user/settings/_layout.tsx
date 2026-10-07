import { Stack } from 'expo-router';
import { COLORS } from '../../../../src/constants/theme';

export default function SettingsLayout() {
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
            <Stack.Screen name="index" options={{
                headerShown: true,
                title: "Configuración"
            }} />
            <Stack.Screen name="debug" />
        </Stack>
    );
}