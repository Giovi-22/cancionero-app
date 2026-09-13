import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

import {
    AuthenticatedUser,
    authService,
} from '../services/AuthService';
import { UserService } from '../services/UserService';
import { UserProfile } from '../types/band';

export interface UserContextType {
    /**
     * Usuario autenticado en Firebase, normalizado para la aplicación.
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
     * Sincroniza el usuario autenticado con su perfil persistido
     * en Firestore.
     *
     * La responsabilidad del perfil pertenece a UserContext/UserService.
     */
    const syncProfile = useCallback(
        async (authUser: AuthenticatedUser) => {
            try {
                const profile =
                    await UserService.syncUserProfile(authUser);

                if (profile) {
                    setUserProfile(profile);
                }
            } catch (error) {
                console.warn(
                    '[UserContext] Error al sincronizar perfil:',
                    error
                );
            }
        },
        []
    );

    useEffect(() => {
        /**
         * AuthService solamente informa cambios en Firebase Auth.
         *
         * UserContext se encarga de:
         * - mantener el usuario en React
         * - sincronizar su perfil
         * - exponer el estado de autenticación al resto de la app
         */
        const unsubscribe = authService.onAuthStateChanged(
            (authUser: AuthenticatedUser | null) => {
                setUser(authUser);

                if (!authUser) {
                    setUserProfile(null);
                    setIsLoading(false);
                    return;
                }

                // La sesión queda disponible inmediatamente.
                // El perfil se sincroniza en segundo plano.
                setIsLoading(false);
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
            /**
             * onAuthStateChanged también actualizará este estado,
             * pero lo limpiamos inmediatamente para evitar mostrar
             * información del usuario durante el cierre de sesión.
             */
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
