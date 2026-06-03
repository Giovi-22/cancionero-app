import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft, Bluetooth, Footprints, ChevronDown, ChevronUp } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PedalConfigScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.foreground} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pedal Bluetooth</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.glassCard}>
                    <View style={styles.statusRow}>
                        <Bluetooth size={24} color={COLORS.mutedForeground} />
                        <Text style={styles.statusText}>Buscando pedales cercanos...</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Mapeo de Botones (Próximamente)</Text>
                
                <View style={styles.mappingCard}>
                    <View style={styles.mappingRow}>
                        <View style={styles.pedalIcon}>
                            <Footprints size={20} color={COLORS.accent} />
                            <Text style={styles.pedalLabel}>Pedal Izquierdo</Text>
                        </View>
                        <View style={styles.actionSelector}>
                            <ChevronUp size={16} color={COLORS.foreground} />
                            <Text style={styles.actionText}>Scroll Arriba</Text>
                        </View>
                    </View>
                    
                    <View style={styles.divider} />

                    <View style={styles.mappingRow}>
                        <View style={styles.pedalIcon}>
                            <Footprints size={20} color={COLORS.accent} />
                            <Text style={styles.pedalLabel}>Pedal Derecho</Text>
                        </View>
                        <View style={styles.actionSelector}>
                            <ChevronDown size={16} color={COLORS.foreground} />
                            <Text style={styles.actionText}>Scroll Abajo</Text>
                        </View>
                    </View>
                </View>
                
                <Text style={styles.helpText}>
                    En futuras actualizaciones podrás conectar un pedal bluetooth como si fuera un teclado y mapear sus botones para bajar y subir las canciones, o cambiar a la siguiente canción de la lista sin tocar la pantalla.
                </Text>
            </ScrollView>
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
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        padding: 5,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    content: {
        padding: 20,
    },
    glassCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
        alignItems: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusText: {
        color: COLORS.mutedForeground,
        fontSize: 15,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.mutedForeground,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 5,
    },
    mappingCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
    },
    mappingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    pedalIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    pedalLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.foreground,
    },
    actionSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 5,
    },
    actionText: {
        color: COLORS.foreground,
        fontSize: 13,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: 15,
    },
    helpText: {
        fontSize: 13,
        color: COLORS.mutedForeground,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 10,
    }
});
