import React, { useCallback } from 'react';
import { isTitleLine } from '../../utils/sectionUtils';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface SongContentProps {
    parsedLines: any[];

    fontSize: number;
    viewMode: string;

    theme: {
        background?: string;
        lyrics?: string;
        chords?: string;
    };

    isStageMode: boolean;
    isDebugMode: boolean;
    isEditToolActive: boolean;

    onLinePress: (
        lineIndex: number,
        pageX: number,
        pageY: number
    ) => void;

    /**
     * Reporta la posición y el alto de cada línea lógica (índice de
     * parsedLines), relativos al contenedor de la canción.
     * Se usa para convertir "línea N" a píxeles en este dispositivo.
     */
    onLineLayout?: (
        lineIndex: number,
        y: number,
        height: number
    ) => void;

    /** Reporta la posición Y del contenedor dentro del ScrollView. */
    onContainerLayout?: (y: number) => void;

    /**
     * Rango de líneas (índices de parsedLines, ambos inclusive) de la sección
     * enfocada por el pedal. Se marca con una barra lateral y un fondo tenue;
     * el resto de la canción se atenúa. null = sin enfoque.
     * No cambia el alto de ninguna línea, así no altera el mapa de líneas.
     */
    activeRange?: { start: number; end: number } | null;
}

const COLORS = {
    foreground: '#ffffff',
    mutedForeground: '#a0a0a0',
    accent: '#3b82f6',
};

const DISPLAY_FOOTER_TEXT =
    'CANCIONERO APP';

export const SongContent: React.FC<
    SongContentProps
> = ({
    parsedLines,
    fontSize,
    viewMode,
    theme,
    isStageMode,
    isDebugMode,
    isEditToolActive,
    onLinePress,
    onLineLayout,
    onContainerLayout,
    activeRange,
}) => {
        const getRenderItems =
            useCallback(
                (
                    blocks: any[],
                    isTitle: boolean
                ) => {
                    if (isTitle) {
                        return blocks.map(
                            b => ({
                                chord:
                                    undefined as
                                    | string
                                    | undefined,
                                text: b.text
                                    .replace(
                                        /\[TITULO\]/i,
                                        ''
                                    )
                                    .trim(),
                            })
                        );
                    }

                    const items: {
                        chord?: string;
                        text: string;
                    }[] = [];

                    for (
                        let i = 0;
                        i < blocks.length;
                        i++
                    ) {
                        const block =
                            blocks[i];

                        const rawText =
                            block.text || '';

                        const words =
                            rawText.match(
                                /^\s+|\S+\s*/g
                            ) || [];

                        if (
                            words.length === 0
                        ) {
                            if (block.chord) {
                                items.push({
                                    chord:
                                        block.chord,
                                    text: '',
                                });
                            }

                            continue;
                        }

                        if (block.chord) {
                            items.push({
                                chord:
                                    block.chord,
                                text: words[0],
                            });

                            for (
                                let w = 1;
                                w < words.length;
                                w++
                            ) {
                                items.push({
                                    text: words[w],
                                });
                            }
                        } else {
                            for (
                                let w = 0;
                                w < words.length;
                                w++
                            ) {
                                items.push({
                                    text: words[w],
                                });
                            }
                        }
                    }

                    return items;
                },
                []
            );

        const renderChordOnlyLine =
            useCallback(
                (blocks: any[]) => {
                    return (
                        <Text
                            style={[
                                styles.lyricText,
                                {
                                    fontSize,
                                    color:
                                        theme.lyrics,
                                    lineHeight:
                                        fontSize * 1.4,
                                },
                            ]}
                        >
                            {blocks.map(
                                (
                                    block,
                                    index
                                ) => (
                                    <React.Fragment
                                        key={`chord-only-${index}`}
                                    >
                                        {block.chord && (
                                            <Text
                                                style={[
                                                    styles.chordText,
                                                    {
                                                        fontSize,
                                                        color:
                                                            theme.chords,
                                                    },
                                                ]}
                                            >
                                                {block.chord}
                                            </Text>
                                        )}

                                        {block.text && (
                                            <Text
                                                style={[
                                                    styles.lyricText,
                                                    {
                                                        fontSize,
                                                        color:
                                                            theme.lyrics,
                                                    },
                                                ]}
                                            >
                                                {block.text.replace(
                                                    / /g,
                                                    '\u00A0'
                                                )}
                                            </Text>
                                        )}
                                    </React.Fragment>
                                )
                            )}
                        </Text>
                    );
                },
                [
                    fontSize,
                    theme.chords,
                    theme.lyrics,
                ]
            );

        return (
            <View
                style={styles.songContainer}
                onLayout={e => {
                    onContainerLayout?.(
                        e.nativeEvent.layout.y
                    );
                }}
            >
                {parsedLines.map(
                    (
                        line,
                        lIndex
                    ) => {
                        const isTitle =
                            isTitleLine(line);

                        const sectionColor =
                            isStageMode
                                ? '#fbbf24'
                                : theme.chords;

                        const fullLineText =
                            line.blocks
                                .map(
                                    b => b.text
                                )
                                .join('');

                        // Ocultar líneas de metadata cuyo valor esté vacío o sea solo "-".
                        // Intro y Tono siempre se muestran aunque estén vacíos.
                        if (line.isMetadata) {
                            const colonIdx = fullLineText.indexOf(':');
                            if (colonIdx !== -1) {
                                const label = fullLineText.slice(0, colonIdx).trim();
                                const alwaysShow = /^(intro|tono)$/i.test(label);

                                if (!alwaysShow) {
                                    // Construir el contenido completo incluyendo acordes de todos los bloques
                                    const fullContentWithChords = line.blocks
                                        .map(b => `${b.chord ?? ''} ${b.text ?? ''}`)
                                        .join('');
                                    const fullColonIdx = fullContentWithChords.indexOf(':');
                                    const valueContent = fullColonIdx !== -1
                                        ? fullContentWithChords.slice(fullColonIdx + 1).trim()
                                        : fullContentWithChords.trim();

                                    if (!valueContent || valueContent === '-') {
                                        return null;
                                    }
                                }
                            }
                        }

                        const isNonPlayableMetadata =
                            line.isMetadata &&
                            /^(NOTA|TONO|KEY|BPM|TEMPO|CAPO|COMP[ÁA]S):/i.test(
                                fullLineText
                            );

                        const isChordOnlyLine =
                            line.type !==
                            'section' &&
                            !line.isMetadata &&
                            line.blocks.some(
                                b => !!b.chord
                            ) &&
                            !/\p{L}{2,}/u.test(
                                fullLineText
                            );

                        // Enfoque de sección (pedal): solo cambia colores y
                        // opacidad, nunca el alto, para no mover el mapa de líneas.
                        const inActiveSection =
                            !!activeRange &&
                            lIndex >= activeRange.start &&
                            lIndex <= activeRange.end;

                        const dimmed =
                            !!activeRange &&
                            !inActiveSection;

                        return (
                            <View
                                key={lIndex}
                                style={[
                                    inActiveSection &&
                                    styles.activeSectionLine,
                                    dimmed &&
                                    styles.dimmedLine,
                                ]}
                                onLayout={e => {
                                    onLineLayout?.(
                                        lIndex,
                                        e.nativeEvent.layout.y,
                                        e.nativeEvent.layout.height
                                    );
                                }}
                            >
                                {inActiveSection && (
                                    <View
                                        pointerEvents="none"
                                        style={styles.activeSectionBar}
                                    />
                                )}

                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={e => {
                                        onLinePress(
                                            lIndex,
                                            e.nativeEvent
                                                .pageX,
                                            e.nativeEvent
                                                .pageY
                                        );
                                    }}
                                    style={[
                                        styles.lineWrapper,
                                        line.type ===
                                        'section' &&
                                        (isTitle
                                            ? styles.titleLine
                                            : styles.sectionLine),
                                        isEditToolActive && {
                                            borderWidth: 1,
                                            borderColor:
                                                'rgba(59, 130, 246, 0.5)',
                                            borderRadius: 4,
                                            marginVertical: 2,
                                            padding: 3,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.blocksContainer,
                                            isTitle && {
                                                justifyContent:
                                                    'center',
                                                width: '100%',
                                            },
                                            isDebugMode && {
                                                borderWidth: 1,
                                                borderColor:
                                                    '#3b82f6',
                                                borderStyle:
                                                    'dashed',
                                            },
                                        ]}
                                    >
                                        {isChordOnlyLine
                                            ? renderChordOnlyLine(
                                                line.blocks
                                            )
                                            : getRenderItems(
                                                line.blocks,
                                                isTitle
                                            ).map(
                                                (
                                                    item,
                                                    bIndex
                                                ) => {
                                                    if (
                                                        isTitle
                                                    ) {
                                                        return (
                                                            <View
                                                                key={
                                                                    bIndex
                                                                }
                                                                style={[
                                                                    styles.block,
                                                                    {
                                                                        width:
                                                                            '100%',
                                                                        alignItems:
                                                                            'center',
                                                                    },
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.lyricText,
                                                                        {
                                                                            fontSize:
                                                                                fontSize *
                                                                                1.5,
                                                                            textAlign:
                                                                                'center',
                                                                            fontWeight:
                                                                                'bold',
                                                                            lineHeight:
                                                                                fontSize *
                                                                                1.5 *
                                                                                1.25,
                                                                            color:
                                                                                theme.lyrics,
                                                                        },
                                                                        isDebugMode && {
                                                                            backgroundColor:
                                                                                'rgba(59, 130, 246, 0.15)',
                                                                        },
                                                                    ]}
                                                                >
                                                                    {
                                                                        item.text
                                                                    }
                                                                </Text>
                                                            </View>
                                                        );
                                                    }

                                                    const hasChord =
                                                        !!item.chord;

                                                    if (
                                                        !hasChord &&
                                                        (!item.text ||
                                                            /^\s+$/.test(
                                                                item.text
                                                            ))
                                                    ) {
                                                        return (
                                                            <Text
                                                                key={`item-${bIndex}`}
                                                                style={[
                                                                    styles.lyricText,
                                                                    {
                                                                        fontSize,
                                                                        color:
                                                                            theme.lyrics,
                                                                    },
                                                                    line.type ===
                                                                    'section' && {
                                                                        color:
                                                                            sectionColor,
                                                                        fontWeight:
                                                                            'bold',
                                                                    },
                                                                ]}
                                                            >
                                                                {(
                                                                    item.text ||
                                                                    ' '
                                                                ).replace(
                                                                    / /g,
                                                                    '\u00A0'
                                                                )}
                                                            </Text>
                                                        );
                                                    }

                                                    const displayText =
                                                        (
                                                            item.text ||
                                                            ''
                                                        ).replace(
                                                            / /g,
                                                            '\u00A0'
                                                        );

                                                    const isSpaceOnly =
                                                        /^\s+$/.test(
                                                            item.text ||
                                                            ''
                                                        );

                                                    return (
                                                        <View
                                                            key={`item-${bIndex}`}
                                                            style={[
                                                                styles.block,
                                                                line.isMetadata && {
                                                                    flexDirection:
                                                                        'row',
                                                                    alignItems:
                                                                        'baseline',
                                                                },
                                                                isSpaceOnly &&
                                                                item.text
                                                                    .length >
                                                                1 && {
                                                                    minWidth:
                                                                        Math.max(
                                                                            fontSize,
                                                                            item
                                                                                .text
                                                                                .length *
                                                                            (fontSize *
                                                                                0.45)
                                                                        ),
                                                                },
                                                                isChordOnlyLine &&
                                                                hasChord && {
                                                                    marginRight:
                                                                        Math.max(
                                                                            6,
                                                                            fontSize *
                                                                            0.4
                                                                        ),
                                                                },
                                                                isDebugMode && {
                                                                    borderWidth: 1,
                                                                    borderColor:
                                                                        hasChord
                                                                            ? '#ef4444'
                                                                            : '#3b82f6',
                                                                    borderStyle:
                                                                        hasChord
                                                                            ? 'solid'
                                                                            : 'dotted',
                                                                    padding: 1,
                                                                },
                                                            ]}
                                                        >
                                                            {viewMode !==
                                                                'lyrics' &&
                                                                (hasChord ? (
                                                                    <Text
                                                                        style={[
                                                                            styles.chordText,
                                                                            {
                                                                                fontSize,
                                                                                color:
                                                                                    theme.chords,
                                                                            },
                                                                            line.isMetadata && {
                                                                                marginRight:
                                                                                    4,
                                                                            },
                                                                            isNonPlayableMetadata && {
                                                                                color:
                                                                                    theme.lyrics,
                                                                                fontWeight:
                                                                                    'normal',
                                                                            },
                                                                            isDebugMode && {
                                                                                backgroundColor:
                                                                                    'rgba(239, 68, 68, 0.15)',
                                                                            },
                                                                        ]}
                                                                    >
                                                                        {
                                                                            item.chord
                                                                        }
                                                                    </Text>
                                                                ) : (
                                                                    <Text
                                                                        style={[
                                                                            styles.chordText,
                                                                            {
                                                                                fontSize,
                                                                                opacity: 0,
                                                                            },
                                                                        ]}
                                                                        numberOfLines={
                                                                            1
                                                                        }
                                                                    >
                                                                        X
                                                                    </Text>
                                                                ))}

                                                            <Text
                                                                style={[
                                                                    styles.lyricText,
                                                                    {
                                                                        fontSize,
                                                                        color:
                                                                            theme.lyrics,
                                                                    },
                                                                    line.type ===
                                                                    'section' && {
                                                                        color:
                                                                            sectionColor,
                                                                        fontWeight:
                                                                            'bold',
                                                                    },
                                                                    isDebugMode && {
                                                                        backgroundColor:
                                                                            hasChord
                                                                                ? 'rgba(239, 68, 68, 0.05)'
                                                                                : 'rgba(59, 130, 246, 0.15)',
                                                                    },
                                                                ]}
                                                            >
                                                                {displayText ||
                                                                    '\u00A0'}
                                                            </Text>
                                                        </View>
                                                    );
                                                }
                                            )}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    }
                )}

                <View
                    style={
                        styles.footerContainer
                    }
                >
                    <View
                        style={
                            styles.footerLine
                        }
                    />

                    <Text
                        style={
                            styles.footerText
                        }
                    >
                        {DISPLAY_FOOTER_TEXT}
                    </Text>
                </View>
            </View>
        );
    };

const styles = StyleSheet.create({
    songContainer: {
        padding: 20,
    },

    lineWrapper: {
        marginBottom: 5,
        paddingHorizontal: 5,
        borderRadius: 5,
    },

    // ── Enfoque de la sección activa (pedal) ──

    activeSectionLine: {
        backgroundColor: 'rgba(251, 191, 36, 0.10)',
    },

    activeSectionBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: '#fbbf24',
    },

    dimmedLine: {
        opacity: 0.5,
    },

    titleLine: {
        marginTop: 20,
        marginBottom: 20,
    },

    sectionLine: {
        marginTop: 15,
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor:
            'rgba(255,255,255,0.1)',
        paddingBottom: 5,
    },

    blocksContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
    },

    block: {
        minWidth: 10,
    },

    chordText: {
        color: COLORS.accent,
        fontWeight: 'bold',
        fontFamily:
            Platform.OS === 'ios'
                ? 'Courier'
                : 'monospace',
    },

    lyricText: {
        color: COLORS.foreground,
        fontFamily:
            Platform.OS === 'ios'
                ? 'Courier'
                : 'monospace',
        lineHeight: 22,
    },

    footerContainer: {
        paddingBottom: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
        width: '100%',
    },

    footerLine: {
        width: '100%',
        height: 1,
        backgroundColor:
            'rgba(255,255,255,0.1)',
        marginBottom: 15,
    },

    footerText: {
        color:
            COLORS.mutedForeground,
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 1,
        textTransform:
            'uppercase',
        opacity: 0.6,
    },
});
