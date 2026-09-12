import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    Keyboard,
} from 'react-native';

import { X, ListMusic } from 'lucide-react-native';

import { COLORS } from '../../constants/theme';
import { BandSetlist } from '../../types/band';
import { DatePickerField } from '../common/DatePickerField';

interface EditBandSetlistModalProps {
    visible: boolean;
    setlist: BandSetlist | null;
    onClose: () => void;
    onSave: (setlist: BandSetlist) => Promise<void>;
}

export default function EditBandSetlistModal({
    visible,
    setlist,
    onClose,
    onSave,
}: EditBandSetlistModalProps) {
    const [name, setName] = useState('');
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || !setlist) {
            return;
        }

        setName(setlist.name);

        setDate(
            setlist.date
                ? new Date(`${setlist.date}T00:00:00`)
                : undefined
        );

        setError(null);
        setSaving(false);
    }, [visible, setlist]);

    const handleSave = async () => {
        if (!setlist) {
            return;
        }

        const trimmedName = name.trim();

        if (!trimmedName) {
            setError(
                'Ingresá un nombre para el repertorio.'
            );
            return;
        }

        try {
            setSaving(true);
            setError(null);

            await onSave({
                ...setlist,
                name: trimmedName,
                date: date
                    ? `${date.getFullYear()}-${String(
                        date.getMonth() + 1
                    ).padStart(2, '0')}-${String(
                        date.getDate()
                    ).padStart(2, '0')}`
                    : undefined,
            });

            onClose();
        } catch (err: any) {
            console.error(
                '[EditBandSetlistModal] Error editando repertorio:',
                err
            );

            setError(
                err?.message ||
                'No se pudo guardar el repertorio.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
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
                        <View style={styles.modal}>
                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.titleContainer}>
                                    <View style={styles.iconContainer}>
                                        <ListMusic
                                            size={22}
                                            color={COLORS.primary}
                                        />
                                    </View>

                                    <View>
                                        <Text style={styles.title}>
                                            Editar repertorio
                                        </Text>

                                        <Text style={styles.subtitle}>
                                            Modificá los datos del repertorio
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={onClose}
                                    disabled={saving}
                                    style={styles.closeButton}
                                >
                                    <X
                                        size={22}
                                        color={COLORS.foreground}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Content */}
                            <View style={styles.content}>
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>
                                        Nombre
                                    </Text>

                                    <TextInput
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="Nombre del repertorio"
                                        placeholderTextColor={
                                            COLORS.mutedForeground
                                        }
                                        style={styles.input}
                                        editable={!saving}
                                        autoFocus
                                        maxLength={100}
                                    />
                                </View>

                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>
                                        Fecha
                                    </Text>

                                    <DatePickerField
                                        value={date}
                                        onChange={setDate}
                                        disabled={saving}
                                    />
                                </View>

                                {error && (
                                    <Text style={styles.error}>
                                        {error}
                                    </Text>
                                )}
                            </View>

                            {/* Actions */}
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[
                                        styles.cancelButton,
                                        saving &&
                                        styles.disabled,
                                    ]}
                                    onPress={onClose}
                                    disabled={saving}
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
                                        styles.saveButton,
                                        saving &&
                                        styles.disabled,
                                    ]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#fff"
                                        />
                                    ) : (
                                        <Text
                                            style={
                                                styles.saveButtonText
                                            }
                                        >
                                            Guardar cambios
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        padding: 20,
    },

    keyboardContainer: {
        width: '100%',
        alignItems: 'center',
    },

    modal: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: COLORS.background,
        borderRadius: 16,
        overflow: 'hidden',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },

    iconContainer: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '700',
    },

    subtitle: {
        color: COLORS.mutedForeground,
        fontSize: 13,
        marginTop: 2,
    },

    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    content: {
        padding: 20,
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
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        color: COLORS.foreground,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
    },

    error: {
        color: COLORS.destructive,
        fontSize: 13,
        marginTop: 2,
    },

    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },

    cancelButton: {
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    cancelButtonText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '600',
    },

    saveButton: {
        minWidth: 130,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    disabled: {
        opacity: 0.5,
    },
});