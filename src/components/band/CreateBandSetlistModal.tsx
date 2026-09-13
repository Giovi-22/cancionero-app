import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { X, ListMusic } from 'lucide-react-native';

import { COLORS } from '../../constants/theme';
import { DatePickerField } from '../common/DatePickerField';

interface CreateBandSetlistModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate: (
        name: string,
        date?: Date
    ) => Promise<void>;
}

export function CreateBandSetlistModal({
    visible,
    onClose,
    onCreate,
}: CreateBandSetlistModalProps) {
    const [name, setName] = useState('');
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setName('');
            setDate(undefined);
            setError(null);
            setCreating(false);
        }
    }, [visible]);

    const handleCreate = async () => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            setError(
                'Ingresá un nombre para el repertorio.'
            );
            return;
        }

        try {
            setCreating(true);
            setError(null);

            await onCreate(
                trimmedName,
                date
            );

            setName('');
            setDate(undefined);
            onClose();
        } catch (err: any) {
            console.error(
                '[CreateBandSetlistModal] Error creando repertorio:',
                err
            );

            setError(
                err?.message ||
                'No se pudo crear el repertorio.'
            );
        } finally {
            setCreating(false);
        }
    };

    const handleClose = () => {
        if (creating) {
            return;
        }

        Keyboard.dismiss();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback
                onPress={Keyboard.dismiss}
            >
                <View style={styles.overlay}>
                    <KeyboardAvoidingView
                        behavior={
                            Platform.OS === 'ios'
                                ? 'padding'
                                : undefined
                        }
                        style={styles.keyboardContainer}
                    >
                        <TouchableWithoutFeedback>
                            <View style={styles.modal}>
                                {/* Header */}
                                <View style={styles.header}>
                                    <View style={styles.titleContainer}>
                                        <View style={styles.iconContainer}>
                                            <ListMusic
                                                size={20}
                                                color={COLORS.accent}
                                            />
                                        </View>

                                        <View>
                                            <Text style={styles.title}>
                                                Nuevo repertorio
                                            </Text>

                                            <Text style={styles.subtitle}>
                                                Repertorio de la banda
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.closeButton}
                                        activeOpacity={0.7}
                                        onPress={handleClose}
                                        disabled={creating}
                                    >
                                        <X
                                            size={22}
                                            color={
                                                COLORS.mutedForeground
                                            }
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Nombre */}
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>
                                        Nombre
                                    </Text>

                                    <TextInput
                                        value={name}
                                        onChangeText={value => {
                                            setName(value);

                                            if (error) {
                                                setError(null);
                                            }
                                        }}
                                        placeholder="Ej. Domingo 7 de septiembre"
                                        placeholderTextColor={
                                            COLORS.mutedForeground
                                        }
                                        style={styles.input}
                                        autoFocus
                                        editable={!creating}
                                        returnKeyType="done"
                                        onSubmitEditing={handleCreate}
                                        maxLength={100}
                                    />
                                </View>

                                {/* Fecha */}
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>
                                        Fecha
                                    </Text>

                                    <DatePickerField
                                        value={date}
                                        onChange={setDate}
                                        disabled={creating}
                                    />
                                </View>

                                {/* Error */}
                                {error && (
                                    <Text style={styles.errorText}>
                                        {error}
                                    </Text>
                                )}

                                {/* Acciones */}
                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        activeOpacity={0.8}
                                        onPress={handleClose}
                                        disabled={creating}
                                    >
                                        <Text
                                            style={
                                                styles.cancelButtonText
                                            }
                                        >
                                            Cancelar
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.createButton,
                                            creating &&
                                            styles.createButtonDisabled,
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={handleCreate}
                                        disabled={creating}
                                    >
                                        {creating ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={
                                                    COLORS.background
                                                }
                                            />
                                        ) : (
                                            <Text
                                                style={
                                                    styles.createButtonText
                                                }
                                            >
                                                Crear repertorio
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },

    keyboardContainer: {
        width: '100%',
    },

    modal: {
        width: '100%',
        backgroundColor: COLORS.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 20,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },

    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },

    iconContainer: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        marginRight: 12,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '700',
    },

    subtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 2,
    },

    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },

    fieldContainer: {
        marginBottom: 18,
    },

    label: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },

    input: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 14,
        color: COLORS.foreground,
        fontSize: 15,
    },

    errorText: {
        color: '#ef4444',
        fontSize: 13,
        marginBottom: 18,
    },

    actions: {
        flexDirection: 'row',
        gap: 10,
    },

    cancelButton: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },

    cancelButtonText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '600',
    },

    createButton: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accent,
    },

    createButtonDisabled: {
        opacity: 0.7,
    },

    createButtonText: {
        color: COLORS.background,
        fontSize: 14,
        fontWeight: '700',
    },
});