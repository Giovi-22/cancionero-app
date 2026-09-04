import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

import { authService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { UserProfile } from '../types/band';

export interface AuthenticatedUser {
    id: string;
    uid: string;
    email: string | null;
    user_metadata: {
        full_name: string | null;
        name: string | null;
        avatar_url: string | null;
    };
}

export interface UserContextType {
    /**
     * Usuario autenticado en Firebase, normalizado para compatibilidad
     * con la API que utilizaba anteriormente AppContext.
     */
    user: AuthenticatedUser | null;

    /**
     * Perfil persistido en Firestore: users/{uid}
     */
    userProfile: UserProfile | null;

    /**
     * Indica si todavía estamos resolviendo el estado inicial
     * de autenticación.
     */
    isLoading: boolean;

    /**
     * Atajo para saber si existe una sesión autenticada.
     */
    isAuthenticated: boolean;

    /**
     * Cierra la sesión de Firebase + Google.
     */
    signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserContextProvider = ({
    children,
}: {
    children: ReactNode;
}) => {
    const [user, setUser] = useState<AuthenticatedUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Convierte el usuario normalizado de AuthService en el perfil
     * persistido de Firestore.
     */
    const syncProfile = useCallback(async (authUser: AuthenticatedUser) => {
        try {
            const profile = await UserService.syncUserProfile(authUser);

            if (profile) {
                setUserProfile(profile);
            }
        } catch (error) {
            console.warn(
                '[UserContext] Error al sincronizar perfil:',
                error
            );
        }
    }, []);

    useEffect(() => {
        /**
         * AuthService ya se encarga internamente de:
         * - escuchar Firebase Auth
         * - normalizar el usuario
         * - sincronizar el perfil
         *
         * UserContext agrega encima el estado React y conserva también
         * el UserProfile disponible para el resto de la aplicación.
         */
        const unsubscribe = authService.onAuthStateChanged(
            (authUser: AuthenticatedUser | null) => {
                setUser(authUser);

                if (!authUser) {
                    setUserProfile(null);
                    setIsLoading(false);
                    return;
                }

                setIsLoading(false);

                // La sincronización no debe bloquear la disponibilidad
                // de la sesión para la UI.
                syncProfile(authUser);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [syncProfile]);

    const signOut = useCallback(async () => {
        try {
            await authService.signOut();
        } finally {
            // onAuthStateChanged también hará esto, pero limpiar
            // inmediatamente evita mantener estado viejo durante el cierre.
            setUser(null);
            setUserProfile(null);
        }
    }, []);

    const value: UserContextType = {
        user,
        userProfile,
        isLoading,
        isAuthenticated: !!user,
        signOut,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

export const useUserContext = (): UserContextType => {
    const context = useContext(UserContext);

    if (!context) {
        throw new Error(
            'useUserContext must be used within a UserContextProvider'
        );
    }

    return context;
};
