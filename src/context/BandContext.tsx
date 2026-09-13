import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    Band,
    BandMember,
    BandRole,
    UserProfile,
} from '../types/band';

import {
    BandService,
    UserBandInfo,
} from '../services/BandService';

import { UserService } from '../services/UserService';

import {
    getBandPermissions,
    BandPermissions,
} from '../utils/permissions';

import { useUserContext } from './UserContext';

interface BandContextType {
    bands: Band[];
    userBandsInfo: UserBandInfo[];
    selectedBand: Band | null;
    userRole: BandRole | null;
    permissions: BandPermissions;
    members: BandMember[];
    loading: boolean;
    error: string | null;

    selectBand: (band: Band) => void;

    createBand: (
        name: string,
        description?: string
    ) => Promise<Band>;

    refreshBands: () => Promise<void>;

    deleteBand: (bandId: string) => Promise<void>;
}

const BandContext = createContext<BandContextType | undefined>(
    undefined
);

export const BandContextProvider = ({
    children,
}: {
    children: ReactNode;
}) => {
    const { user } = useUserContext();

    // ============================================================
    // Estado global de banda
    // ============================================================

    const [userBandsInfo, setUserBandsInfo] = useState<
        UserBandInfo[]
    >([]);

    const [selectedBand, setSelectedBand] =
        useState<Band | null>(null);

    const [userRole, setUserRole] =
        useState<BandRole | null>(null);

    const [members, setMembers] =
        useState<BandMember[]>([]);

    const [loading, setLoading] =
        useState<boolean>(true);

    const [error, setError] =
        useState<string | null>(null);

    // ============================================================
    // Control de suscripción global de bandas
    // ============================================================

    const userBandsUnsubscribeRef =
        useRef<(() => void) | null>(null);

    /**
     * Identifica la generación actual de la suscripción.
     *
     * Si un callback de Firestore llega tarde después de haber
     * cancelado una suscripción, podemos ignorarlo.
     */
    const userBandsSubscriptionIdRef =
        useRef(0);

    /**
     * Permite forzar una nueva suscripción sin duplicar la lógica
     * dentro de deleteBand.
     */
    const [bandsSubscriptionKey, setBandsSubscriptionKey] =
        useState(0);

    // ============================================================
    // Permisos derivados de la banda/rol actual
    // ============================================================

    const permissions: BandPermissions = useMemo(() => {
        return getBandPermissions(userRole);
    }, [userRole]);

    // ============================================================
    // Cargar bandas
    // ============================================================

    const loadBands = useCallback(async () => {
        if (!user) {
            setUserBandsInfo([]);
            setSelectedBand(null);
            setUserRole(null);
            setMembers([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const userId = user.uid || user.id;

            const bandsInfo =
                await BandService.getUserBands(userId);

            setUserBandsInfo(bandsInfo);

            if (bandsInfo.length > 0) {
                // Mantener la banda seleccionada si todavía existe.
                const currentId = selectedBand?.id;

                const matched = currentId
                    ? bandsInfo.find(
                        bandInfo =>
                            bandInfo.band.id === currentId
                    )
                    : null;

                if (matched) {
                    setSelectedBand(matched.band);
                    setUserRole(matched.role);
                } else {
                    setSelectedBand(bandsInfo[0].band);
                    setUserRole(bandsInfo[0].role);
                }
            } else {
                setSelectedBand(null);
                setUserRole(null);
                setMembers([]);
            }
        } catch (e: any) {
            console.error(
                '[BandContext] Error al cargar bandas:',
                e
            );

            setError(
                'No se pudieron cargar las bandas.'
            );
        } finally {
            setLoading(false);
        }
    }, [user, selectedBand?.id]);

    // ============================================================
    // Carga inicial
    // ============================================================

    useEffect(() => {
        loadBands();
    }, [user]);

    // ============================================================
    // Suscripción reactiva a las bandas del usuario
    // ============================================================

    useEffect(() => {
        if (!user) {
            return;
        }

        const userId = user.uid || user.id;

        if (!userId) {
            return;
        }

        const subscriptionId =
            ++userBandsSubscriptionIdRef.current;

        const unsubscribe =
            BandService.subscribeToUserBands(
                userId,
                updatedBands => {
                    // Ignorar callbacks de una suscripción vieja.
                    if (
                        subscriptionId !==
                        userBandsSubscriptionIdRef.current
                    ) {
                        return;
                    }

                    setUserBandsInfo(updatedBands);

                    // Mantener la banda actualmente seleccionada
                    // si todavía existe.
                    setSelectedBand(
                        currentSelectedBand => {
                            if (!updatedBands.length) {
                                setUserRole(null);
                                setMembers([]);

                                return null;
                            }

                            if (currentSelectedBand) {
                                const stillExists =
                                    updatedBands.find(
                                        info =>
                                            info.band.id ===
                                            currentSelectedBand.id
                                    );

                                if (stillExists) {
                                    setUserRole(
                                        stillExists.role
                                    );

                                    return stillExists.band;
                                }
                            }

                            // No había banda seleccionada
                            // o la anterior ya no existe.
                            setUserRole(
                                updatedBands[0].role
                            );

                            return updatedBands[0].band;
                        }
                    );

                    setLoading(false);
                    setError(null);
                },
                subscriptionError => {
                    // Ignorar errores provenientes de una
                    // suscripción que ya no es la activa.
                    if (
                        subscriptionId !==
                        userBandsSubscriptionIdRef.current
                    ) {
                        return;
                    }

                    console.error(
                        '[BandContext] Error en suscripción de bandas:',
                        subscriptionError
                    );

                    setError(
                        'No se pudieron sincronizar las bandas.'
                    );

                    setLoading(false);
                }
            );

        userBandsUnsubscribeRef.current = unsubscribe;

        return () => {
            unsubscribe();

            if (
                userBandsUnsubscribeRef.current ===
                unsubscribe
            ) {
                userBandsUnsubscribeRef.current = null;
            }
        };
    }, [user, bandsSubscriptionKey]);

    // ============================================================
    // Suscripción a miembros de la banda seleccionada
    // ============================================================

    useEffect(() => {
        if (!selectedBand) {
            setMembers([]);
            return;
        }

        const unsubscribe =
            BandService.subscribeToBandMembers(
                selectedBand.id,
                updatedMembers => {
                    setMembers(updatedMembers);

                    // Actualizar el rol del usuario en tiempo real
                    // si cambió dentro de la banda.
                    const userId =
                        user?.uid || user?.id;

                    if (userId) {
                        const myMemberDoc =
                            updatedMembers.find(
                                member =>
                                    member.userId === userId
                            );

                        if (myMemberDoc) {
                            setUserRole(
                                myMemberDoc.role
                            );
                        }
                    }
                }
            );

        return () => unsubscribe();
    }, [selectedBand?.id, user]);

    // ============================================================
    // Seleccionar banda manualmente
    // ============================================================

    const selectBand = useCallback(
        (band: Band) => {
            const info = userBandsInfo.find(
                bandInfo =>
                    bandInfo.band.id === band.id
            );

            setSelectedBand(band);
            setUserRole(info?.role || null);
        },
        [userBandsInfo]
    );

    // ============================================================
    // Crear banda
    // ============================================================

    const createBand = useCallback(
        async (
            name: string,
            description: string = ''
        ) => {
            if (!user) {
                throw new Error(
                    'Usuario no autenticado'
                );
            }

            setLoading(true);

            try {
                const userProfile: UserProfile = {
                    uid: user.uid || user.id,
                    email: user.email || '',
                    displayName:
                        user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        user.email ||
                        'Usuario',
                    photoURL:
                        user.user_metadata?.avatar_url ||
                        null,
                };

                // Garantizar que el usuario exista
                // en Firestore.
                await UserService.syncUserProfile(
                    userProfile
                );

                const newBand =
                    await BandService.createBand(
                        name,
                        description,
                        userProfile
                    );

                // La suscripción reactiva detectará
                // automáticamente la nueva membresía.
                setSelectedBand(newBand);
                setUserRole('owner');

                return newBand;
            } catch (e: any) {
                console.error(
                    '[BandContext] Error al crear banda:',
                    e
                );

                throw e;
            } finally {
                setLoading(false);
            }
        },
        [user]
    );

    // ============================================================
    // Eliminar banda
    // ============================================================

    const deleteBand = useCallback(
        async (bandId: string) => {
            if (!user) {
                throw new Error(
                    'Usuario no autenticado'
                );
            }

            const bandInfo = userBandsInfo.find(
                info => info.band.id === bandId
            );

            if (!bandInfo) {
                throw new Error(
                    'La banda no pertenece al usuario actual.'
                );
            }

            if (bandInfo.role !== 'owner') {
                throw new Error(
                    'Solo el propietario puede eliminar la banda.'
                );
            }

            // Guardamos el estado actual antes de eliminar.
            const wasSelected =
                selectedBand?.id === bandId;

            const remainingBands =
                userBandsInfo.filter(
                    info => info.band.id !== bandId
                );

            setLoading(true);
            setError(null);

            // ========================================================
            // Suspender temporalmente la suscripción global.
            //
            // La banda y sus members van a desaparecer durante la
            // eliminación. No queremos que el listener intente
            // reaccionar a ese proceso.
            // ========================================================

            userBandsSubscriptionIdRef.current += 1;

            userBandsUnsubscribeRef.current?.();
            userBandsUnsubscribeRef.current = null;

            // Si la banda eliminada era la seleccionada,
            // dejamos de escuchar sus miembros.
            if (wasSelected) {
                setSelectedBand(null);
                setUserRole(null);
                setMembers([]);
            }

            try {
                await BandService.deleteBand(bandId);

                // Actualizar inmediatamente el estado local.
                setUserBandsInfo(remainingBands);

                // Si había otras bandas, seleccionar
                // automáticamente la primera.
                if (
                    wasSelected &&
                    remainingBands.length > 0
                ) {
                    setSelectedBand(
                        remainingBands[0].band
                    );

                    setUserRole(
                        remainingBands[0].role
                    );
                }

                // Si no quedan bandas, dejamos todo vacío.
                if (remainingBands.length === 0) {
                    setSelectedBand(null);
                    setUserRole(null);
                    setMembers([]);
                }
            } catch (e: any) {
                console.error(
                    '[BandContext] Error al eliminar banda:',
                    e
                );

                const message =
                    e instanceof Error
                        ? e.message
                        : 'No se pudo eliminar la banda.';

                setError(message);

                // Si la eliminación falló y habíamos limpiado
                // la banda seleccionada, restauramos el estado.
                if (wasSelected) {
                    setSelectedBand(bandInfo.band);
                    setUserRole(bandInfo.role);
                }

                throw e;
            } finally {
                setLoading(false);

                // ====================================================
                // Pedimos al useEffect que cree una nueva suscripción.
                //
                // Importante:
                // NO recreamos acá manualmente el listener.
                // El useEffect es el único responsable de eso.
                // ====================================================

                setBandsSubscriptionKey(
                    currentKey => currentKey + 1
                );
            }
        },
        [
            user,
            userBandsInfo,
            selectedBand?.id,
        ]
    );

    // ============================================================
    // Estado expuesto por el contexto
    // ============================================================

    const value = useMemo<BandContextType>(
        () => ({
            bands: userBandsInfo.map(
                bandInfo => bandInfo.band
            ),
            userBandsInfo,
            selectedBand,
            userRole,
            permissions,
            members,
            loading,
            error,
            selectBand,
            createBand,
            deleteBand,
            refreshBands: loadBands,
        }),
        [
            userBandsInfo,
            selectedBand,
            userRole,
            permissions,
            members,
            loading,
            error,
            selectBand,
            createBand,
            deleteBand,
            loadBands,
        ]
    );

    return (
        <BandContext.Provider value={value}>
            {children}
        </BandContext.Provider>
    );
};

export const useBandContext = (): BandContextType => {
    const context = useContext(BandContext);

    if (!context) {
        throw new Error(
            'useBandContext must be used within a BandContextProvider'
        );
    }

    return context;
};