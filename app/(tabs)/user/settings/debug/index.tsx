import React from 'react';
import {
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DebugPanel } from '../../../../../src/components/DebugPanel';
import { COLORS } from '../../../../../src/constants/theme';
import { Button } from '../../../../../src/components/common/Button';
import { router } from 'expo-router';

export default function DebugScreen() {


    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right', 'bottom']}
        >
            <DebugPanel />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
});
