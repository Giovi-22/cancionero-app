import React from 'react';
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

import { COLORS } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
    title: string;
    onPress: () => void;
    icon?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    variant?: ButtonVariant;
    activeOpacity?: number;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
}

export function Button({
    title,
    onPress,
    icon,
    loading = false,
    disabled = false,
    variant = 'primary',
    activeOpacity = 0.8,
    style,
    textStyle,
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const isVisuallyDisabled = disabled && !loading;

    const contentColor = getContentColor(
        variant,
        isVisuallyDisabled
    );

    return (
        <TouchableOpacity
            style={[
                styles.button,
                styles[`${variant}Button`],
                isVisuallyDisabled && styles.disabledButton,
                style,
            ]}
            activeOpacity={activeOpacity}
            onPress={onPress}
            disabled={isDisabled}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={contentColor}
                />
            ) : (
                icon && (
                    <View style={styles.iconContainer}>
                        {React.isValidElement(icon)
                            ? React.cloneElement(
                                icon as React.ReactElement<any>,
                                { color: contentColor }
                            )
                            : icon}
                    </View>
                )
            )}

            <Text
                style={[
                    styles.text,
                    { color: contentColor },
                    textStyle,
                ]}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}

function getContentColor(
    variant: ButtonVariant,
    disabled: boolean
) {
    if (disabled) {
        return COLORS.mutedForeground;
    }

    switch (variant) {
        case 'secondary':
            return COLORS.foreground;

        case 'danger':
            return COLORS.foreground;

        case 'primary':
        default:
            return COLORS.background;
    }
}

const styles = StyleSheet.create({
    button: {
        minHeight: 44,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },

    primaryButton: {
        backgroundColor: COLORS.primary,
    },

    secondaryButton: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    dangerButton: {
        backgroundColor: COLORS.destructive,
    },

    disabledButton: {
        backgroundColor: COLORS.border,
        opacity: 0.7,
    },

    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    text: {
        fontSize: 14,
        fontWeight: '700',
    },
});