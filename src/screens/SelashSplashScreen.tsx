import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SPLASH = require('../../assets/splash_screen.png');
const { width: IMG_W, height: IMG_H } = Image.resolveAssetSource(SPLASH);

// Mismo color que el fondo del PNG (#171b1e) y que app.config.js
const BG = '#171B1E';

const BAR_W = 120;
const BAR_H = 3;
// Posición vertical de la barra dentro de la imagen (0 = arriba, 1 = abajo).
// El texto SELAH termina cerca de 0.58, así que 0.64 la deja justo debajo.
const BAR_TOP_RATIO = 0.64;

type Props = {
    /** Cuando pasa a true, la barra se completa al 100%. */
    done?: boolean;
};

export default function SelahSplashScreen({ done = false }: Props): React.JSX.Element {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const progress = useRef(new Animated.Value(0)).current;
    const [barTop, setBarTop] = useState<number | null>(null);

    // Fade in de imagen + barra, y avance suave hasta ~85%
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();

        Animated.timing(progress, {
            toValue: 0.70,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [fadeAnim, progress]);

    // Cuando la app está lista, completa la barra
    useEffect(() => {
        if (!done) return;
        Animated.timing(progress, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [done, progress]);

    // Calcula dónde quedó realmente la imagen (resizeMode contain)
    // para que la barra siempre quede debajo de "SELAH" en cualquier pantalla.
    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        const scale = Math.min(width / IMG_W, height / IMG_H);
        const renderedH = IMG_H * scale;
        const offsetY = (height - renderedH) / 2;
        setBarTop(offsetY + renderedH * BAR_TOP_RATIO);
    };

    const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-BAR_W, 0],
    });

    const counterTranslateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [BAR_W, 0],
    });

    return (
        <View style={styles.container} onLayout={onLayout}>
            <Animated.Image
                source={SPLASH}
                style={[styles.splashImage, { opacity: fadeAnim }]}
                resizeMode="contain"
            />

            {barTop !== null && (
                <Animated.View
                    style={[styles.track, { top: barTop - 20, opacity: fadeAnim }]}
                    accessibilityRole="progressbar"
                >
                    <Animated.View style={[styles.fill, { transform: [{ translateX }] }]}>
                        <Animated.View
                            style={[
                                styles.gradientContainer,
                                { transform: [{ translateX: counterTranslateX }] },
                            ]}
                        >
                            <LinearGradient
                                colors={['#DFCEA3', '#C5B083', '#B29B70']}
                                locations={[0, 0.55, 1]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.gradient}
                            />
                        </Animated.View>
                    </Animated.View>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    splashImage: {
        width: '100%',
        height: '100%',
    },
    track: {
        position: 'absolute',
        alignSelf: 'center',
        width: BAR_W,
        height: BAR_H,
        borderRadius: BAR_H / 2,
        backgroundColor: '#2A2A30',
        overflow: 'hidden',
    },
    fill: {
        width: BAR_W,
        height: BAR_H,
        borderRadius: BAR_H / 2,
        overflow: 'hidden',
    },
    gradientContainer: {
        width: BAR_W,
        height: BAR_H,
    },
    gradient: {
        width: '100%',
        height: '100%',
    },
});

