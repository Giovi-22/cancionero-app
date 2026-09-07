import React, {
    createContext,
    ReactNode,
    useContext,
} from 'react';

import { useBands } from '../hooks/useBands';

type BandContextType = ReturnType<typeof useBands>;

const BandContext = createContext<BandContextType | undefined>(
    undefined
);

export const BandContextProvider = ({
    children,
}: {
    children: ReactNode;
}) => {
    const bandState = useBands();

    return (
        <BandContext.Provider value={bandState}>
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