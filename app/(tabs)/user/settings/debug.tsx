import React from 'react';
import {
    SafeAreaView,
    StyleSheet,
} from 'react-native';

import { DebugPanel } from '../../../../src/components/DebugPanel';
import { COLORS } from '../../../../src/constants/theme';

export default function DebugScreen() {
    return (
        <SafeAreaView style={styles.container}>
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