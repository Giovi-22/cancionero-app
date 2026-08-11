import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../src/lib/supabase';

/**
 * Pantalla de callback OAuth.
 *
 * Supabase redirige a cancionero-app://callback#access_token=...&refresh_token=...
 * después de que el usuario autoriza con Google.
 *
 * Expo Router monta esta pantalla, extraemos los tokens del fragmento de URL
 * y establecemos la sesión de Supabase antes de navegar al home.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Obtener la URL completa que abrió la app (incluyendo el fragmento #)
        const initialUrl = await Linking.getInitialURL();
        if (!initialUrl) {
          router.replace('/(tabs)');
          return;
        }

        // Los tokens vienen en el fragmento (#) de la URL, no como query params (?)
        // Ejemplo: cancionero-app://callback#access_token=xxx&refresh_token=yyy&...
        const fragment = initialUrl.split('#')[1] ?? '';
        const params: Record<string, string> = {};
        fragment.split('&').forEach((pair) => {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[key] = decodeURIComponent(value);
          }
        });

        const accessToken = params['access_token'];
        const refreshToken = params['refresh_token'];

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[Callback] Error al establecer sesión:', error.message);
          } else {
            console.log('[Callback] Sesión establecida correctamente.');
          }
        } else {
          console.warn('[Callback] No se encontraron tokens en la URL:', initialUrl);
        }
      } catch (e) {
        console.error('[Callback] Excepción inesperada:', e);
      } finally {
        // Siempre redirigir al home, haya o no tokens
        router.replace('/(tabs)');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.text}>Iniciando sesión...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    color: '#a0a0a0',
    fontSize: 14,
  },
});
