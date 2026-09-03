import { useCallback, useState } from 'react';

import {
    parseChordPro,
    rebuildChordProFromParsedLines,
} from '../utils/chordpro';

import { FileSystemService } from '../services/FileSystemService';

interface UseSongEditorParams {
    parsedLines: any[];
    songId: string;
    currentContent: string;
    setCurrentContent: (
        content: string
    ) => void;
    onContentUpdated?: (
        newContent: string
    ) => void;
}

export const useSongEditor = ({
    parsedLines,
    songId,
    setCurrentContent,
    onContentUpdated,
}: UseSongEditorParams) => {
    const [
        editingLineIndex,
        setEditingLineIndex,
    ] = useState<number | null>(null);

    const [
        editingLineText,
        setEditingLineText,
    ] = useState('');

    const [
        inputSelection,
        setInputSelection,
    ] = useState({
        start: 0,
        end: 0,
    });

    const insertAtCursor =
        useCallback(
            (textToInsert: string) => {
                const start =
                    inputSelection.start;

                const end =
                    inputSelection.end;

                const newText =
                    editingLineText.slice(
                        0,
                        start
                    ) +
                    textToInsert +
                    editingLineText.slice(end);

                setEditingLineText(
                    newText
                );

                const newPos =
                    start +
                    textToInsert.length;

                setInputSelection({
                    start: newPos,
                    end: newPos,
                });
            },
            [
                inputSelection,
                editingLineText,
            ]
        );

    const openLineEditModal =
        useCallback(
            (lineIndex: number) => {
                const line =
                    parsedLines[lineIndex];

                if (!line) {
                    return;
                }

                let lineText = '';

                if (
                    line.type === 'section'
                ) {
                    lineText =
                        line.blocks
                            .map(
                                (b: any) => b.text
                            )
                            .join('');
                } else {
                    lineText =
                        line.blocks
                            .map(
                                (b: any) =>
                                    (b.chord
                                        ? `[${b.chord}]`
                                        : '') +
                                    (b.text || '')
                            )
                            .join('');
                }

                setEditingLineText(
                    lineText
                );

                setInputSelection({
                    start: lineText.length,
                    end: lineText.length,
                });

                setEditingLineIndex(
                    lineIndex
                );
            },
            [parsedLines]
        );

    const handleSaveEditedLine =
        useCallback(
            async () => {
                if (
                    editingLineIndex === null
                ) {
                    return;
                }

                const newParsedLines =
                    [...parsedLines];

                const rawLine =
                    editingLineText.trim();

                if (
                    rawLine.startsWith('[') &&
                    rawLine.endsWith(']') &&
                    !rawLine
                        .slice(1, -1)
                        .includes(']')
                ) {
                    newParsedLines[
                        editingLineIndex
                    ] = {
                        type: 'section',
                        blocks: [
                            {
                                text: rawLine,
                            },
                        ],
                    };
                } else {
                    const parsedSingleLine =
                        parseChordPro(
                            editingLineText
                        );

                    const firstLine =
                        Array.isArray(
                            parsedSingleLine
                        ) &&
                            parsedSingleLine.length > 0
                            ? parsedSingleLine[0]
                            : null;

                    if (firstLine) {
                        newParsedLines[
                            editingLineIndex
                        ] = firstLine;
                    } else {
                        newParsedLines[
                            editingLineIndex
                        ] = {
                            type: 'chords-lyrics',
                            isMetadata: false,
                            blocks: [
                                {
                                    text: editingLineText,
                                },
                            ],
                        };
                    }
                }

                const updatedChordPro =
                    rebuildChordProFromParsedLines(
                        newParsedLines
                    );

                setCurrentContent(
                    updatedChordPro
                );

                try {
                    await FileSystemService.saveSongContent(
                        songId,
                        updatedChordPro
                    );

                    onContentUpdated?.(
                        updatedChordPro
                    );
                } catch (error) {
                    console.error(
                        'Error guardando línea editada:',
                        error
                    );
                }

                setEditingLineIndex(null);
            },
            [
                editingLineIndex,
                editingLineText,
                parsedLines,
                songId,
                setCurrentContent,
                onContentUpdated,
            ]
        );

    const closeEditor =
        useCallback(() => {
            setEditingLineIndex(null);
        }, []);

    return {
        editingLineIndex,
        setEditingLineIndex,

        editingLineText,
        setEditingLineText,

        inputSelection,
        setInputSelection,

        insertAtCursor,
        openLineEditModal,
        handleSaveEditedLine,
        closeEditor,
    };
};