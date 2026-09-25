import { create } from 'zustand';
import { isWorksheetContent } from '../utils/WorksheetParser';
import { message } from '../components/message';
import { updateStudentAnswers } from '../services/pads';
import { account } from '../libs/appwrite';
import { useNoteStore } from './noteStore';
import { classroomService } from '../services/classroomService';
import { aiUsageEventService } from '../services/aiUsageEventService';

// AI Usage log entry
export interface IAIUsageEntry {
    timestamp: number;
    padId: string;
    question: string;
    responsePreview: string;
}

// Worksheet store - uses server-side storage for cross-browser persistence
interface WorksheetState {
    // Check if content is a worksheet (uses parser)
    isWorksheet: (content: string) => boolean;

    // AI Usage tracking (still localStorage - less critical)
    aiUsageLog: IAIUsageEntry[];
    logAIUsage: (entry: Omit<IAIUsageEntry, 'timestamp'>) => void;
    getAIUsageForPad: (padId: string) => IAIUsageEntry[];

    // Student answers - now synced with server
    // Local cache that gets synced to server
    answers: Record<string, Record<string, string>>;

    // Initialize answers from server data
    initAnswersFromServer: (padId: string, serverAnswers: Record<string, string> | undefined) => void;

    // Save answer - updates local cache and syncs to server
    saveStudentAnswer: (padId: string, elementId: string, answer: string) => void;

    // Get answers for a pad
    getAnswersForPad: (padId: string) => Record<string, string>;

    // Clear worksheet data for a pad
    clearWorksheet: (padId: string) => void;

    // Clear only AI usage log for a pad
    clearAIUsageForPad: (padId: string) => void;

    // Legacy support: get old worksheet sections from localStorage
    getWorksheetSections: (padId: string) => IWorksheetSection[] | null;
    saveWorksheetSections: (padId: string, sections: IWorksheetSection[]) => void;
}

// Legacy interface for backward compatibility
export interface IWorksheetSection {
    id: string;
    type: 'locked' | 'editable';
    content: string;
}

const AI_USAGE_KEY = 'canis_ai_usage';
const WORKSHEETS_KEY = 'canis_worksheets'; // Legacy - for backward compatibility

// Debounce timers for server sync
const syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// Load from localStorage
const loadAIUsage = (): IAIUsageEntry[] => {
    try {
        const data = localStorage.getItem(AI_USAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Legacy loader for old worksheet sections
const loadLegacyWorksheets = (): Record<string, IWorksheetSection[]> => {
    try {
        const data = localStorage.getItem(WORKSHEETS_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

export const useWorksheetStore = create<WorksheetState>((set, get) => ({
    aiUsageLog: loadAIUsage(),
    answers: {},

    isWorksheet: (content: string) => {
        return isWorksheetContent(content);
    },

    initAnswersFromServer: (padId: string, serverAnswers: Record<string, string> | undefined) => {
        if (!serverAnswers) return;

        set(state => ({
            answers: {
                ...state.answers,
                [padId]: serverAnswers
            }
        }));
    },

    logAIUsage: (entry) => {
        const newEntry: IAIUsageEntry = {
            ...entry,
            timestamp: Date.now()
        };

        set(state => {
            const updated = [...state.aiUsageLog, newEntry];
            localStorage.setItem(AI_USAGE_KEY, JSON.stringify(updated));
            return { aiUsageLog: updated };
        });

        void (async () => {
            try {
                const sess = await account.get();
                const uid = sess.$id;
                const note =
                    useNoteStore.getState().currentNote?.id === entry.padId
                        ? useNoteStore.getState().currentNote
                        : useNoteStore.getState().notes.find((n) => n.id === entry.padId);
                const cid = note?.classId;
                if (!cid) return;
                const cls = await classroomService.getClassroom(cid);
                await aiUsageEventService.record({
                    schoolId: cls.schoolId,
                    classroomId: cls.id,
                    noteId: entry.padId,
                    userId: uid,
                    eventKind: 'ai_chat',
                    metadata: {
                        question: entry.question,
                        responsePreview: entry.responsePreview,
                    },
                });
            } catch {
                /* offline or table not deployed */
            }
        })();
    },

    getAIUsageForPad: (padId: string) => {
        return get().aiUsageLog.filter(e => e.padId === padId);
    },

    saveStudentAnswer: (padId: string, elementId: string, answer: string) => {
        set(state => {
            const newAnswers = { ...state.answers };
            if (!newAnswers[padId]) {
                newAnswers[padId] = {};
            }
            newAnswers[padId][elementId] = answer;

            // Debounced sync to server (500ms delay)
            if (syncTimers[padId]) {
                clearTimeout(syncTimers[padId]);
            }
            syncTimers[padId] = setTimeout(() => {
                updateStudentAnswers(padId, newAnswers[padId]).catch((err) => {
                    console.error('Failed to sync answers to server:', err);
                    message.error('Could not save answers. Check your connection and try again.');
                });
            }, 500);

            return { answers: newAnswers };
        });
    },

    getAnswersForPad: (padId: string) => {
        return get().answers[padId] || {};
    },

    clearWorksheet: (padId: string) => {
        set(state => {
            // Clear answers locally
            const newAnswers = { ...state.answers };
            if (newAnswers[padId]) {
                delete newAnswers[padId];
            }

            // Clear on server
            updateStudentAnswers(padId, {}).catch(err => {
                console.error('Failed to clear answers on server:', err);
            });

            // Clear AI usage
            const newUsage = state.aiUsageLog.filter(e => e.padId !== padId);
            localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newUsage));

            return {
                answers: newAnswers,
                aiUsageLog: newUsage
            };
        });
    },

    clearAIUsageForPad: (padId: string) => {
        set(state => {
            const newUsage = state.aiUsageLog.filter(e => e.padId !== padId);
            localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newUsage));
            return { aiUsageLog: newUsage };
        });
    },

    // Legacy methods for backward compatibility
    getWorksheetSections: (padId: string) => {
        const worksheets = loadLegacyWorksheets();
        return worksheets[padId] || null;
    },

    saveWorksheetSections: (padId: string, sections: IWorksheetSection[]) => {
        // Legacy save - still supported for backward compatibility
        const worksheets = loadLegacyWorksheets();
        worksheets[padId] = sections;
        localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(worksheets));
    }
}));

// Re-export the IWorksheetSection for backward compatibility
export type { IWorksheetSection as IWorksheetSectionLegacy };
