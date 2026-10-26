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
import { useResponsive } from '../../hooks/useResponsive';

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
    const { isTablet } = useResponsive();

    const iconSize = isTablet ? 28 : 24;

    return (
        <View style={[styles.header, isTablet && styles.headerTablet, { paddingTop: insets.top + (isTablet ? 18 : 15) }]}>
            <Text style={[styles.logo, isTablet && styles.logoTablet]}>{title}</Text>

            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={[styles.iconButton, isTablet && styles.iconButtonTablet]}
                    onPress={onSync}
                    disabled={isSyncing}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {isSyncing ? (
                        <ActivityIndicator size={isTablet ? "small" : "small"} color={COLORS.accent} />
                    ) : (
                        <RefreshCcw size={iconSize} color={COLORS.foreground} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.iconButton, isTablet && styles.iconButtonTablet]}
                    onPress={() => {
                        Keyboard.dismiss();
                        onSettings && onSettings();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {hasUser ? (
                        <User size={iconSize} color={COLORS.accent} />
                    ) : (
                        <View>
                            <User size={iconSize} color={COLORS.mutedForeground} />
                            <View style={[styles.alertDot, isTablet && styles.alertDotTablet]} />
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
    headerTablet: {
        paddingHorizontal: 28,
        paddingVertical: 18,
    },
    logo: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    logoTablet: {
        fontSize: 26,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        marginLeft: 15,
        padding: 5,
        position: 'relative',
    },
    iconButtonTablet: {
        marginLeft: 20,
        padding: 8,
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
    alertDotTablet: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});
