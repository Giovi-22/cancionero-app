import { COLORS } from "@/src/constants/theme";
import { StyleSheet, View, Text, ViewStyle } from "react-native";

interface CardContainerProps {
    title?: string;
    cardStyle?: ViewStyle;
    children: React.ReactNode;
}

export default function CardContainer({ title, children, cardStyle }: CardContainerProps) {
    return (
        <View style={styles.container}>
            {
                title && (
                    <Text style={styles.sectionTitle}>
                        {title}
                    </Text>
                )}
            <View style={[styles.card, cardStyle]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        marginBottom: 24,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    sectionTitle: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});