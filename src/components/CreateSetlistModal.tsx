import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';
import { DatePickerField } from './common/DatePickerField';

const CreateSetlistModal = () => {
    const {
        isCreateSetlistOpen,
        setIsCreateSetlistOpen,
        handleCreateSetlist,
        activeLibrary,
    } = useAppContext();

    const [name, setName] = useState('');
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [notes, setNotes] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (isCreateSetlistOpen) {
            setName('');
            setDate(undefined);
            setNotes('');
            setIsCreating(false);
        }
    }, [isCreateSetlistOpen]);

    if (!isCreateSetlistOpen) {
        return null;
    }

    const handleConfirm = async () => {
        if (isCreating || !name.trim() || !activeLibrary) {
            return;
        }

        setIsCreating(true);

        try {
            await handleCreateSetlist(
                name,
                date,
                notes
            );
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        if (isCreating) {
            return;
        }

        setIsCreateSetlistOpen(false);
    };

    return (
        <Modal
            visible={isCreateSetlistOpen}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View
                style={[
                    styles.overlay,
                    {
                        paddingTop: insets.top + 20,
                        paddingBottom: insets.bottom + 20,
                    },
                ]}
            >
                <View style={styles.card}>
                    <View>
                        <Text style={styles.title}>
                            Nueva Lista
                        </Text>
                        {activeLibrary ? (
                            <Text style={styles.librarySubtitle}>
                                Biblioteca: {activeLibrary.name}
                            </Text>
                        ) : (
                            <Text style={[styles.librarySubtitle, { color: COLORS.destructive }]}>
                                No hay biblioteca seleccionada
                            </Text>
                        )}
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Nombre de la lista..."
                        placeholderTextColor={
                            COLORS.mutedForeground
                        }
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        returnKeyType="next"
                        editable={!isCreating && !!activeLibrary}
                    />

                    <TextInput
                        style={[
                            styles.input,
                            styles.notesInput,
                        ]}
                        placeholder="Notas / Observaciones (Opcional)..."
                        placeholderTextColor={
                            COLORS.mutedForeground
                        }
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        editable={!isCreating && !!activeLibrary}
                    />

                    <DatePickerField
                        value={date}
                        onChange={setDate}
                        disabled={isCreating || !activeLibrary}
                    />

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleClose}
                            disabled={isCreating}
                        >
                            <Text style={styles.cancelButtonText}>
                                Cancelar
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                (!name.trim() || isCreating || !activeLibrary) &&
                                styles.confirmButtonDisabled,
                            ]}
                            onPress={handleConfirm}
                            disabled={
                                !name.trim() || isCreating || !activeLibrary
                            }
                        >
                            {isCreating ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                />
                            ) : (
                                <Text style={styles.confirmButtonText}>
                                    Crear
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default CreateSetlistModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 20,
        width: '100%',
        maxWidth: 320,
        gap: 15,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: 'bold',
    },

    librarySubtitle: {
        color: COLORS.accent,
        fontSize: 13,
        marginTop: 2,
    },

    input: {
        backgroundColor: COLORS.card,
        color: COLORS.foreground,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontSize: 15,
    },

    notesInput: {
        height: 70,
        textAlignVertical: 'top',
    },

    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 10,
    },

    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
    },

    cancelButtonText: {
        color: COLORS.mutedForeground,
        fontWeight: 'bold',
    },

    confirmButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },

    confirmButtonDisabled: {
        opacity: 0.5,
    },

    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});