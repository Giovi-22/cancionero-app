import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Text } from 'react-native';
import SelahIcon from '../components/common/SelashIcon';

export default function SelahSplashScreen(): React.JSX.Element {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, [opacity]);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.content, { opacity }]}>
                {/* Icono Vectorial Escalar */}
                <SelahIcon size={160} />

                {/* Texto Tipográfico de la Marca */}
                <Text style={styles.title}>SELAH</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
    },
    title: {
        marginTop: 28,
        fontSize: 30,
        fontWeight: '300',
        color: '#a855f7',
        letterSpacing: 10,
        textAlign: 'center',
    },
});
