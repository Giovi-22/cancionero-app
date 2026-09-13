import React from 'react';
import {
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DebugPanel } from '../../../../src/components/DebugPanel';
import { COLORS } from '../../../../src/constants/theme';

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
