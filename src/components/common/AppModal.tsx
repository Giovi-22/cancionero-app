import React from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AlertTriangle,
    CheckCircle2,
    Info,
    XCircle,
} from 'lucide-react-native';

import { COLORS } from '../../constants/theme';

type AppModalType = 'danger' | 'warning' | 'success' | 'info';

interface AppModalProps {
    visible: boolean;
    type?: AppModalType;

    title: string;
    message?: string;

    confirmText?: string;
    cancelText?: string;

    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;

    loading?: boolean;

    /**
     * Si es false, tocar fuera del modal no lo cierra.
     * Para acciones importantes/destructivas conviene dejarlo en false.
     */
    dismissOnBackdrop?: boolean;
}

const TYPE_CONFIG = {
    danger: {
        icon: XCircle,
        iconColor: '#ef4444',
        iconBackground: 'rgba(239, 68, 68, 0.12)',
        confirmBackground: '#ef4444',
        confirmText: '#fff',
    },
    warning: {
        icon: AlertTriangle,
        iconColor: '#f59e0b',
        iconBackground: 'rgba(245, 158, 11, 0.12)',
        confirmBackground: '#f59e0b',
        confirmText: '#000',
    },
    success: {
        icon: CheckCircle2,
        iconColor: '#22c55e',
        iconBackground: 'rgba(34, 197, 94, 0.12)',
        confirmBackground: '#22c55e',
        confirmText: '#000',
    },
    info: {
        icon: Info,
        iconColor: COLORS.accent,
        iconBackground: 'rgba(234, 179, 8, 0.12)',
        confirmBackground: COLORS.accent,
        confirmText: '#000',
    },
};

export default function AppModal({
    visible,
    type = 'info',
    title,
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel,
    loading = false,
    dismissOnBackdrop = false,
}: AppModalProps) {
    const config = TYPE_CONFIG[type];
    const Icon = config.icon;

    const handleConfirm = async () => {
        if (!onConfirm || loading) {
            return;
        }

        await onConfirm();
    };

    const handleCancel = () => {
        if (loading) {
            return;
        }

        onCancel?.();
    };

    const handleBackdropPress = () => {
        if (dismissOnBackdrop && !loading) {
            onCancel?.();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleCancel}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    activeOpacity={1}
                    style={StyleSheet.absoluteFill}
                    onPress={handleBackdropPress}
                />

                <View style={styles.modal}>
                    <View
                        style={[
                            styles.iconContainer,
                            {
                                backgroundColor: config.iconBackground,
                            },
                        ]}
                    >
                        <Icon
                            size={28}
                            color={config.iconColor}
                            strokeWidth={2.2}
                        />
                    </View>

                    <Text style={styles.title}>{title}</Text>

                    {message ? (
                        <Text style={styles.message}>{message}</Text>
                    ) : null}

                    <View style={styles.buttons}>
                        {onCancel ? (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancel}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.cancelButtonText,
                                        loading && styles.disabledText,
                                    ]}
                                >
                                    {cancelText}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        {onConfirm ? (
                            <TouchableOpacity
                                style={[
                                    styles.confirmButton,
                                    {
                                        backgroundColor:
                                            config.confirmBackground,
                                    },
                                    loading && styles.disabledButton,
                                ]}
                                onPress={handleConfirm}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={config.confirmText}
                                    />
                                ) : (
                                    <Text
                                        style={[
                                            styles.confirmButtonText,
                                            {
                                                color: config.confirmText,
                                            },
                                        ]}
                                    >
                                        {confirmText}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },

    modal: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: COLORS.card,
        borderRadius: 22,
        padding: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },

    message: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 22,
    },

    buttons: {
        flexDirection: 'row',
        gap: 10,
    },

    cancelButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
    },

    cancelButtonText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '700',
    },

    confirmButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
    },

    confirmButtonText: {
        fontSize: 14,
        fontWeight: '800',
    },

    disabledButton: {
        opacity: 0.7,
    },

    disabledText: {
        opacity: 0.5,
    },
});