import { COLORS } from "@/src/constants/theme";
import { StyleSheet, View, Text } from "react-native";

interface CardContainerProps {
    title: string;
    children: React.ReactNode;
}

export default function CardContainer({ title, children }: CardContainerProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>
                {title}
            </Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        marginBottom: 24,
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