import { useCallback, useState } from 'react';
import type {
    Dispatch,
    MutableRefObject,
    SetStateAction,
} from 'react';

interface EditingNote {
    id: string;
    text: string;
}

interface UseSongNotesParams {
    isStageMode: boolean;
    scrollAreaPageY: MutableRefObject<number>;
    scrollPosRef: MutableRefObject<number>;
    musicianNotes: any;
    setMusicianNotes: Dispatch<
        SetStateAction<any>
    >;
}

export const useSongNotes = ({
    isStageMode,
    scrollAreaPageY,
    scrollPosRef,
    musicianNotes,
    setMusicianNotes,
}: UseSongNotesParams) => {
    const [
        editingNote,
        setEditingNote,
    ] = useState<EditingNote | null>(null);

    const addFloatingNoteAtLine =
        useCallback(
            (
                _pageX: number,
                pageY: number
            ) => {
                if (isStageMode) {
                    return;
                }

                const contentY =
                    pageY -
                    scrollAreaPageY.current +
                    scrollPosRef.current;

                const noteId =
                    `note_${Date.now()}`;

                const newY =
                    Math.max(
                        10,
                        Math.round(
                            contentY - 20
                        )
                    );

                setEditingNote({
                    id: noteId,
                    text: '',
                });

                setMusicianNotes(
                    (prev: any) => ({
                        ...prev,
                        [noteId]: {
                            text: '',
                            x: 20,
                            y: newY,
                        },
                    })
                );
            },
            [
                isStageMode,
                scrollAreaPageY,
                scrollPosRef,
                setMusicianNotes,
            ]
        );

    const handleSaveNote =
        useCallback(() => {
            if (!editingNote) {
                return;
            }

            const trimmed =
                editingNote.text.trim();

            if (!trimmed) {
                setMusicianNotes(
                    (prev: any) => {
                        const next = {
                            ...prev,
                        };

                        delete next[
                            editingNote.id
                        ];

                        return next;
                    }
                );
            } else {
                setMusicianNotes(
                    (prev: any) => ({
                        ...prev,
                        [editingNote.id]: {
                            ...(prev[
                                editingNote.id
                            ] || {
                                x: 20,
                                y: 100,
                            }),
                            text: trimmed,
                        },
                    })
                );
            }

            setEditingNote(null);
        }, [
            editingNote,
            setMusicianNotes,
        ]);

    const handleCancelNote =
        useCallback(() => {
            if (!editingNote) {
                return;
            }

            const existing =
                musicianNotes[
                editingNote.id
                ];

            if (
                !existing ||
                !existing.text
            ) {
                setMusicianNotes(
                    (prev: any) => {
                        const next = {
                            ...prev,
                        };

                        delete next[
                            editingNote.id
                        ];

                        return next;
                    }
                );
            }

            setEditingNote(null);
        }, [
            editingNote,
            musicianNotes,
            setMusicianNotes,
        ]);

    const handleDeleteNote =
        useCallback(
            (noteId: string) => {
                setMusicianNotes(
                    (prev: any) => {
                        const next = {
                            ...prev,
                        };

                        delete next[noteId];

                        return next;
                    }
                );
            },
            [setMusicianNotes]
        );

    const handleUpdateNote =
        useCallback(
            (
                noteId: string,
                text: string,
                x: number,
                y: number
            ) => {
                setMusicianNotes(
                    (prev: any) => ({
                        ...prev,
                        [noteId]: {
                            text,
                            x,
                            y,
                        },
                    })
                );
            },
            [setMusicianNotes]
        );

    return {
        editingNote,
        setEditingNote,

        addFloatingNoteAtLine,
        handleSaveNote,
        handleCancelNote,
        handleDeleteNote,
        handleUpdateNote,
    };
};