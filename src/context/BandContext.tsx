import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
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

        const unsubscribe =
            BandService.subscribeToUserBands(
                userId,
                updatedBands => {
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

        return () => {
            unsubscribe();
        };
    }, [user]);

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