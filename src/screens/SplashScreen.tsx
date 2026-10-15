import { useEffect } from "react";
import { useUserContext } from "../context/UserContext";
import SelahSplashScreen from "./SelashSplashScreen";
import * as SplashScreen from "expo-splash-screen";
import { useState } from "react";

/**
 * Pantalla de transición React: se muestra mientras Firebase resuelve
 * el estado inicial de autenticación. Cuando termina, oculta la splash
 * nativa y cede el paso a la navegación normal.
 */

export default function AppWithSplash({ children }: { children: React.ReactNode }) {
    const { isLoading } = useUserContext();
    const [delayApp, setDelayApp] = useState(true);

    useEffect(() => {
        // Se oculta la splash nativa del sistema operativo justo cuando el estado deja de cargar
        SplashScreen.hideAsync().catch(() => { });
        // Simular 2 segundos para que te dé tiempo a verla y probarla
        const timer = setTimeout(() => setDelayApp(false), 2000);
        return () => clearTimeout(timer);

    }, []);

    if (isLoading || delayApp) {
        return <SelahSplashScreen done={!isLoading} />;
    }

    return <>{children}</>;
}
