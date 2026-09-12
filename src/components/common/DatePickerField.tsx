import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COLORS } from '../../constants/theme';

interface DatePickerFieldProps {
    value?: Date;
    onChange: (date?: Date) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function DatePickerField({
    value,
    onChange,
    disabled = false,
    placeholder = 'Añadir Fecha (Opcional)',
}: DatePickerFieldProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);

    const formatDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1)
            .toString()
            .padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);

        return `${day}/${month}/${year}`;
    };

    const handleChange = (
        _event: unknown,
        selectedDate?: Date
    ) => {
        setShowDatePicker(false);

        if (selectedDate) {
            onChange(selectedDate);
        }
    };

    return (
        <View>
            <TouchableOpacity
                style={[
                    styles.datePickerButton,
                    disabled && styles.disabled,
                ]}
                onPress={() => setShowDatePicker(true)}
                disabled={disabled}
                activeOpacity={0.8}
            >
                <Text style={styles.datePickerText}>
                    {value
                        ? `Fecha: ${formatDate(value)}`
                        : placeholder}
                </Text>
            </TouchableOpacity>

            {showDatePicker && (
                <DateTimePicker
                    value={value || new Date()}
                    mode="date"
                    display="default"
                    onChange={handleChange}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    datePickerButton: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },

    datePickerText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: '500',
    },

    disabled: {
        opacity: 0.5,
    },
});