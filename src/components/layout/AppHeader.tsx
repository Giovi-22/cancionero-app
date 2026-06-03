import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    RefreshCcw,
    User,
} from "lucide-react-native";

import { COLORS } from '../../constants/theme';

type Props = {
    title: string;
    isSyncing?: boolean;
    onSync?: () => void;
    onSettings?: () => void;
    hasUser?: boolean;
};

export function AppHeader({
    title,
    isSyncing,
    onSync,
    onSettings,
    hasUser,
}: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
            <Text style={styles.logo}>{title}</Text>

            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onSync}
                    disabled={isSyncing}
                >
                    {isSyncing ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : (
                        <RefreshCcw size={24} color={COLORS.foreground} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => {
                        Keyboard.dismiss();
                        onSettings && onSettings();
                    }}
                >
                    {hasUser ? (
                        <User size={24} color={COLORS.accent} />
                    ) : (
                        <View>
                            <User size={24} color={COLORS.mutedForeground} />
                            <View style={styles.alertDot} />
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: COLORS.background,
    },
    logo: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    headerActions: {
        flexDirection: 'row',
    },
    iconButton: {
        marginLeft: 15,
        padding: 5,
        position: 'relative',
    },
    alertDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        borderWidth: 1,
        borderColor: COLORS.background,
    },
});
