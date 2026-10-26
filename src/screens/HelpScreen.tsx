import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Download, ExternalLink, FileText, Share2 } from 'lucide-react-native';

import { COLORS } from '../constants/theme';
import { HELP_SECTIONS } from '../constants/helpContent';
import {
  HELP_WEB_URL,
  TEMPLATE_GOOGLE_DOC_COPY_URL,
} from '../constants/songTemplate';
import { TemplateService } from '../services/TemplateService';
import { Button } from '../components/common/Button';
import AppModal from '../components/common/AppModal';
import { HelpSection } from '../components/help/HelpSection';
import { HelpBlockRenderer } from '../components/help/HelpBlockRenderer';

export function HelpScreen() {
  const [loadingKind, setLoadingKind] = useState<'template' | 'example' | null>(
    null
  );

  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: '',
  });

  const handleShareFile = async (kind: 'template' | 'example') => {
    if (loadingKind) return;
    setLoadingKind(kind);

    try {
      await TemplateService.shareSongFile(kind);
    } catch (err: any) {
      setErrorModal({
        visible: true,
        message:
          err?.message ||
          'No se pudo preparar el archivo. Intentá nuevamente.',
      });
    } finally {
      setLoadingKind(null);
    }
  };

  const handleOpenGoogleDoc = () => {
    if (TEMPLATE_GOOGLE_DOC_COPY_URL) {
      Linking.openURL(TEMPLATE_GOOGLE_DOC_COPY_URL).catch(() => {
        setErrorModal({
          visible: true,
          message: 'No se pudo abrir el enlace de Google Docs.',
        });
      });
    }
  };

  const handleOpenWebManual = () => {
    if (HELP_WEB_URL) {
      Linking.openURL(HELP_WEB_URL).catch(() => {
        setErrorModal({
          visible: true,
          message: 'No se pudo abrir el manual web.',
        });
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>Guía de uso</Text>
          <Text style={styles.headerSubtitle}>
            Aprendé a sincronizar tus canciones, escribir en el formato correcto y
            coordinar tus ensayos en vivo con tu banda.
          </Text>
        </View>

        {HELP_SECTIONS.map((section, index) => (
          <HelpSection
            key={section.id}
            id={section.id}
            title={section.title}
            iconName={section.iconName}
            defaultExpanded={index === 0} // Primera sección abierta por defecto
          >
            {section.blocks.map((block, bIdx) => (
              <HelpBlockRenderer key={bIdx} block={block} />
            ))}

            {/* Acciones de descarga / plantillas en la sección de creación */}
            {section.hasTemplateActions && (
              <View style={styles.templateActionsBox}>
                <Text style={styles.templateActionsTitle}>
                  Plantillas para descargar
                </Text>

                <Button
                  title="Guardar plantilla en mi Drive"
                  variant="primary"
                  icon={<Share2 size={18} />}
                  onPress={() => handleShareFile('template')}
                  loading={loadingKind === 'template'}
                  disabled={loadingKind !== null}
                  style={styles.actionBtn}
                />

                <Button
                  title="Guardar canción de ejemplo"
                  variant="secondary"
                  icon={<Download size={18} />}
                  onPress={() => handleShareFile('example')}
                  loading={loadingKind === 'example'}
                  disabled={loadingKind !== null}
                  style={styles.actionBtn}
                />

                {!!TEMPLATE_GOOGLE_DOC_COPY_URL && (
                  <Button
                    title="Abrir plantilla en Google Docs"
                    variant="secondary"
                    icon={<FileText size={18} />}
                    onPress={handleOpenGoogleDoc}
                    style={styles.actionBtn}
                  />
                )}

                <Text style={styles.actionExplanation}>
                  Se abrirá el menú de compartir de tu celular: elegí Drive,
                  seleccioná la carpeta donde guardás tus canciones y tocá
                  Guardar. Después volvé a la app y sincronizá.
                </Text>

                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    La plantilla aparecerá como una canción más después de
                    sincronizar. Editala en Drive o reemplazala por tu primera
                    canción.
                  </Text>
                </View>

                {!!HELP_WEB_URL && (
                  <TouchableOpacity
                    style={styles.webManualLink}
                    onPress={handleOpenWebManual}
                    activeOpacity={0.7}
                  >
                    <ExternalLink size={15} color={COLORS.accent} />
                    <Text style={styles.webManualText}>
                      Ver manual completo en la web
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </HelpSection>
        ))}
      </ScrollView>

      {/* Modal de error */}
      <AppModal
        visible={errorModal.visible}
        type="warning"
        title="Atención"
        message={errorModal.message}
        confirmText="Entendido"
        onConfirm={() => setErrorModal({ visible: false, message: '' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 20,
  },
  headerTitle: {
    color: COLORS.foreground,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  headerSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
  },

  templateActionsBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: 10,
  },
  templateActionsTitle: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionBtn: {
    width: '100%',
  },
  actionExplanation: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: '#18181b',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    marginTop: 4,
  },
  warningText: {
    color: '#a1a1aa',
    fontSize: 12,
    lineHeight: 17,
  },
  webManualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'center',
    padding: 6,
  },
  webManualText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
