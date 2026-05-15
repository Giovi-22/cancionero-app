import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';
import { StorageService } from './StorageService';

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
      scheme: 'cancionero-app',
      path: 'auth/callback',
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

      // Atrapamos el token de Google si viene en la URL
      if (params.provider_token) {
        this.googleAccessToken = params.provider_token;
        console.log('--- Google Token Captured! ---');
      }
      
      if (params.refresh_token || params.access_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token || params.code,
          refresh_token: params.refresh_token || '',
        });
        
        if (sessionError) throw sessionError;
        this.session = sessionData.session;
        
        // A veces el token viene dentro de la sesión recién creada
        if ((this.session as any).provider_token) {
          this.googleAccessToken = (this.session as any).provider_token;
        }

        return this.session;
      }
    }
    
    return null;
  }

  /**
   * Obtiene el Access Token de Google para la sesión actual
   */
  public async getGoogleAccessToken(): Promise<string | null> {
    if (this.googleAccessToken) return this.googleAccessToken;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    
    return (session as any).provider_token || null;
  }

  public async signOut() {
    await supabase.auth.signOut();
    this.session = null;
    this.googleAccessToken = null;
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
