import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';
import { StorageService } from './StorageService';

const GOOGLE_TOKEN_KEY      = 'google_access_token';
const GOOGLE_REFRESH_KEY    = 'google_refresh_token';
const GOOGLE_TOKEN_EXPIRY   = 'google_token_expiry'; // timestamp en ms

WebBrowser.maybeCompleteAuthSession();

export class AuthService {
  private static instance: AuthService;
  private session: any = null;
  private googleAccessToken: string | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Inicia sesión con Google usando Supabase
   */
  public async signInWithGoogle() {
    const redirectUrl = AuthSession.makeRedirectUri({
      path: 'callback',
    });
    
    console.log('--- REDIRECT URL:', redirectUrl, '---');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        scopes: 'https://www.googleapis.com/auth/drive.readonly',
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });

    if (error) throw error;

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (res.type === 'success') {
      const { url } = res;
      const params = this.parseQueryParams(url);
      
      console.log('--- URL PARAMS KEYS:', Object.keys(params));

      // Persistir el Google Access Token
      if (params.provider_token) {
        this.googleAccessToken = params.provider_token;
        await StorageService.saveSetting(GOOGLE_TOKEN_KEY, params.provider_token);
        // Guardar tiempo de expiración (Google tokens duran 1 hora = 3600 segundos)
        const expiresAt = Date.now() + 3600 * 1000;
        await StorageService.saveSetting(GOOGLE_TOKEN_EXPIRY, expiresAt);
        console.log('--- Google Access Token capturado y guardado. Expira:', new Date(expiresAt).toISOString(), '---');
      }

      // Persistir el Google Refresh Token (de larga duración, no expira)
      if (params.provider_refresh_token) {
        await StorageService.saveSetting(GOOGLE_REFRESH_KEY, params.provider_refresh_token);
        console.log('--- Google Refresh Token capturado y guardado. ---');
      }
      
      if (params.refresh_token || params.access_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token || params.code,
          refresh_token: params.refresh_token || '',
        });
        
        if (sessionError) throw sessionError;
        this.session = sessionData.session;
        
        // A veces el token viene dentro de la sesión recién creada
        if ((this.session as any).provider_token && !params.provider_token) {
          this.googleAccessToken = (this.session as any).provider_token;
          await StorageService.saveSetting(GOOGLE_TOKEN_KEY, this.googleAccessToken!);
          await StorageService.saveSetting(GOOGLE_TOKEN_EXPIRY, Date.now() + 3600 * 1000);
        }

        return this.session;
      }
    }
    
    return null;
  }

  /**
   * Obtiene el Access Token de Google para la sesión actual.
   * Refresca automáticamente si el token expiró, usando el Refresh Token guardado
   * y la Edge Function de Supabase que tiene las credenciales seguras.
   */
  public async getGoogleAccessToken(): Promise<string | null> {
    // 1. Verificar si el token en memoria está vigente
    const expiresAt = await StorageService.getSetting<number>(GOOGLE_TOKEN_EXPIRY);
    const isExpired = !expiresAt || Date.now() >= expiresAt - 5 * 60 * 1000; // 5 min de margen

    if (this.googleAccessToken && !isExpired) {
      return this.googleAccessToken;
    }

    // 2. Token expirado o ausente: intentar refrescar con Refresh Token
    const refreshToken = await StorageService.getSetting<string>(GOOGLE_REFRESH_KEY);
    if (refreshToken) {
      console.log('[AuthService] Token expirado. Refrescando via Edge Function...');
      const newToken = await this.refreshGoogleToken(refreshToken);
      if (newToken) return newToken;
    }

    // 3. Restaurar desde SQLite como fallback (puede estar expirado si no hubo internet)
    const savedToken = await StorageService.getSetting<string>(GOOGLE_TOKEN_KEY);
    if (savedToken) {
      this.googleAccessToken = savedToken;
      return savedToken;
    }

    // 4. Último fallback: desde la sesión activa de Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    
    const providerToken = (session as any).provider_token || null;
    if (providerToken) {
      this.googleAccessToken = providerToken;
    }
    return providerToken;
  }

  /**
   * Llama a la Edge Function de Supabase para obtener un nuevo Google Access Token.
   * La Edge Function tiene el client_secret almacenado de forma segura en los secrets de Supabase.
   */
  private async refreshGoogleToken(refreshToken: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('refresh-google-token', {
        body: { refresh_token: refreshToken },
      });

      if (error || !data?.access_token) {
        console.error('[AuthService] Error al refrescar el token de Google:', error || 'No access_token en respuesta');
        return null;
      }

      const newToken: string = data.access_token;
      const expiresIn: number = data.expires_in || 3600;
      const newExpiry = Date.now() + expiresIn * 1000;

      // Actualizar memoria y SQLite
      this.googleAccessToken = newToken;
      await StorageService.saveSetting(GOOGLE_TOKEN_KEY, newToken);
      await StorageService.saveSetting(GOOGLE_TOKEN_EXPIRY, newExpiry);

      console.log(`[AuthService] Token de Google refrescado exitosamente. Expira: ${new Date(newExpiry).toISOString()}`);
      return newToken;
    } catch (e) {
      console.error('[AuthService] Excepción al refrescar el token de Google:', e);
      return null;
    }
  }

  public async signOut() {
    await supabase.auth.signOut();
    this.session = null;
    this.googleAccessToken = null;
    // Eliminar todos los tokens de Google de SQLite
    try {
      const db = await StorageService.getDb();
      await db.runAsync(
        'DELETE FROM settings WHERE key IN (?, ?, ?)',
        [GOOGLE_TOKEN_KEY, GOOGLE_REFRESH_KEY, GOOGLE_TOKEN_EXPIRY]
      );
      console.log('[AuthService] Sesión cerrada y tokens eliminados.');
    } catch (e) {
      console.error('Error al eliminar tokens en sign out:', e);
    }
  }

  public async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  private parseQueryParams(url: string) {
    const params: Record<string, string> = {};
    const regex = /[#?&]([^=#]+)=([^&#]*)/g;
    let match;
    while ((match = regex.exec(url)) !== null) {
      params[match[1]] = decodeURIComponent(match[2]);
    }
    return params;
  }
}

export const authService = AuthService.getInstance();

