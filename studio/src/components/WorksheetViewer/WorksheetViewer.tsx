import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MarkdownIt from 'markdown-it';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useAuth } from '../../hooks/useAuth';
import {
  parseWorksheetMarkdown,
  WorksheetElement,
  isWorksheetContent,
  convertLegacySectionsToMarkdown,
  insertTaskBlock,
  appendWorksheetShortMarker,
  appendWorksheetLongMarker,
} from '../../utils/WorksheetParser';
import { IWorksheetSection, updatePad, syncWorksheetStructureFromContent } from '../../services/pads';
import { submissionService } from '../../services/submissionService';
import { encryptText } from '../../services/encryption';
import type { SubmissionStatus } from '../../types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { WorksheetTaskEditor } from './WorksheetTaskEditor';
import './WorksheetViewer.css';

// Markdown renderer
const md = new MarkdownIt({ html: false, breaks: true });

interface WorksheetViewerProps {
    padId: string;
    content: string;
    // Legacy support - if sections are passed, convert them
    legacySections?: IWorksheetSection[];
    // Callback to update content in parent (for teacher editing)
    onContentChange?: (newContent: string) => void;
    // Server-side answers for cross-browser persistence
    serverAnswers?: Record<string, string>;
    // When true, render tasks and inputs read-only (e.g. for viewing a submission)
    readOnly?: boolean;
    /** When set, student answers debounce to this submission (not the pad note). */
    submissionIdForAnswers?: string;
    submissionStatus?: SubmissionStatus;
    onSubmitted?: () => void;
}

/**
 * WorksheetViewer - Renders worksheet markdown with interactive elements
 * 
 * Uses the new unified markdown format with XML-style tags:
 * - <task>...</task> - Read-only for students, editable for teachers
 * - <input /> - Single-line input
 * - <short-input /> - Small inline input  
 * - <long-input /> - Multi-line textarea
 */
export default function WorksheetViewer({
    padId,
    content,
    legacySections,
    onContentChange,
    serverAnswers,
    readOnly = false,
    submissionIdForAnswers,
    submissionStatus,
    onSubmitted,
}: WorksheetViewerProps) {
    const { user } = useAuth();
    const role = readOnly ? 'student' : (user?.role || 'student');
    const canAuthorWorksheet = !readOnly && (role === 'teacher' || role === 'admin');
    const { answers, saveStudentAnswer, getAIUsageForPad, initAnswersFromServer, clearAIUsageForPad } = useWorksheetStore();
    const aiUsage = getAIUsageForPad(padId);

    // Initialize answers from server on mount (pad note path only — submission flow uses local draft)
    useEffect(() => {
        if (submissionIdForAnswers) return;
        if (serverAnswers) {
            initAnswersFromServer(padId, serverAnswers);
        }
    }, [padId, serverAnswers, initAnswersFromServer, submissionIdForAnswers]);

    const [submissionDraft, setSubmissionDraft] = useState<Record<string, string>>({});
    useEffect(() => {
        if (!submissionIdForAnswers) return;
        setSubmissionDraft(serverAnswers ? { ...serverAnswers } : {});
    }, [submissionIdForAnswers, serverAnswers]);

    const submissionSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (submissionSyncTimerRef.current) {
                clearTimeout(submissionSyncTimerRef.current);
                submissionSyncTimerRef.current = null;
            }
        };
    }, []);

    // Get answers for this pad from global store, or submission draft when completing a class worksheet
    const padAnswers = submissionIdForAnswers
        ? submissionDraft
        : (answers[padId] || serverAnswers || {});

    // If legacy sections are provided and content isn't in new format, convert
    const effectiveContent = useMemo(() => {
        if (legacySections && legacySections.length > 0 && !isWorksheetContent(content)) {
            return convertLegacySectionsToMarkdown(legacySections);
        }
        return content;
    }, [content, legacySections]);

    // Parse the worksheet content — pass padId so `/short` and `/long` get stable answer keys
    const parsed = useMemo(() => parseWorksheetMarkdown(effectiveContent), [effectiveContent]);

    const structureSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!parsed.isWorksheet || readOnly || submissionIdForAnswers) return;
        if (structureSyncTimerRef.current) clearTimeout(structureSyncTimerRef.current);
        structureSyncTimerRef.current = setTimeout(() => {
            void syncWorksheetStructureFromContent(padId, effectiveContent).catch((e) =>
                console.warn('worksheet structure sync', e)
            );
        }, 600);
        return () => {
            if (structureSyncTimerRef.current) clearTimeout(structureSyncTimerRef.current);
        };
    }, [parsed.isWorksheet, effectiveContent, padId, readOnly, submissionIdForAnswers]);

    // Local state for task edits (teacher only)
    const [taskEdits, setTaskEdits] = useState<Record<string, string>>({});
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

    // Initialize task edits from parsed content only when the content prop changes from the parent
    useEffect(() => {
        const initialEdits: Record<string, string> = {};
        parsed.elements.forEach(el => {
            if (el.type === 'task') {
                initialEdits[el.id] = el.content;
            }
        });
        setTaskEdits(initialEdits);
    }, [effectiveContent]); // Reset when body or legacy conversion changes

    const handleInputChange = (elementId: string, value: string) => {
        if (submissionIdForAnswers) {
            setSubmissionDraft((prev) => {
                const next = { ...prev, [elementId]: value };
                if (submissionSyncTimerRef.current) clearTimeout(submissionSyncTimerRef.current);
                submissionSyncTimerRef.current = setTimeout(() => {
                    void submissionService.updateAnswers(submissionIdForAnswers, next).catch((err) =>
                        console.error('Failed to save answers to submission', err)
                    );
                }, 500);
                return next;
            });
            return;
        }
        saveStudentAnswer(padId, elementId, value);
    };

    const handleTurnIn = useCallback(async () => {
        if (!submissionIdForAnswers) return;
        try {
            await submissionService.submit(submissionIdForAnswers, submissionDraft);
            onSubmitted?.();
        } catch (e) {
            console.error(e);
        }
    }, [submissionIdForAnswers, submissionDraft, onSubmitted]);

    /** Persist task body from `taskEdits` or from the task TipTap surface (`overrideMarkdown`). */
    const saveTaskEdit = useCallback((elementId: string, overrideMarkdown?: string) => {
        const draft = (overrideMarkdown ?? taskEdits[elementId])?.trim();
        if (draft == null || draft === '') return;

        // Find the original element
        const element = parsed.elements.find(el => el.id === elementId);
        if (!element || element.type !== 'task') return;

        // Replace in the original content
        const newTagContent = `<task>\n${draft}\n</task>`;

        // Simple string replacement (works for unique content)
        let newContent = effectiveContent;

        // Try to find and replace the task content
        // We need to find the exact <task>...</task> block
        const taskRegex = /<task>([\s\S]*?)<\/task>/g;
        let match;
        let found = false;

        while ((match = taskRegex.exec(effectiveContent)) !== null) {
            // Check if this is the task we're editing by comparing content
            if (match[1].trim() === element.content.trim()) {
                // Replace this specific occurrence
                newContent = effectiveContent.slice(0, match.index) +
                    newTagContent +
                    effectiveContent.slice(match.index + match[0].length);
                found = true;
                break;
            }
        }

        if (found) {
            // Trigger content update
            if (onContentChange) {
                onContentChange(newContent);
            }

            void updatePad({
                id: padId,
                content: newContent,
                cipherContent: encryptText(newContent)
            });
        }

        setEditingTaskId(null);
    }, [taskEdits, parsed.elements, effectiveContent, padId, onContentChange]);

    const taskBodyHtml = useCallback((body: string) => {
        const t = (body ?? '').trim();
        if (t.startsWith('<')) return t;
        return md.render(body);
    }, []);

    // Add a new question block at the end of the worksheet (teacher only)
    const handleAddQuestion = useCallback(() => {
        const questionNumber = parsed.elements.filter(el => el.type === 'task').length + 1;
        const newContent = insertTaskBlock(effectiveContent, `## Question ${questionNumber}\n\nEnter your question or instructions here...`);

        if (onContentChange) {
            onContentChange(newContent);
        }

        void updatePad({
            id: padId,
            content: newContent,
            cipherContent: encryptText(newContent)
        });
    }, [effectiveContent, parsed.elements, padId, onContentChange]);

    const persistWorksheetBody = useCallback(
        (newContent: string) => {
            if (onContentChange) onContentChange(newContent);
            void updatePad({
                id: padId,
                content: newContent,
                cipherContent: encryptText(newContent),
            });
        },
        [onContentChange, padId]
    );

    const handleInsertShortMarker = useCallback(() => {
        persistWorksheetBody(appendWorksheetShortMarker(effectiveContent));
    }, [effectiveContent, persistWorksheetBody]);

    const handleInsertLongMarker = useCallback(() => {
        persistWorksheetBody(appendWorksheetLongMarker(effectiveContent));
    }, [effectiveContent, persistWorksheetBody]);

    // Render a single worksheet element
    const renderElement = (element: WorksheetElement) => {
        switch (element.type) {
            case 'markdown':
                return (
                    <div
                        key={element.id}
                        className="worksheet-markdown rendered-markdown"
                        dangerouslySetInnerHTML={{ __html: md.render(element.content) }}
                    />
                );

            case 'task':
                const isEditing = editingTaskId === element.id;
                const taskContent = taskEdits[element.id] ?? element.content;

                return (
                    <div key={element.id} className={`worksheet-task ${canAuthorWorksheet ? 'teacher-editable' : ''}`}>
                        <div className="task-marker" aria-hidden="true" />
                        {canAuthorWorksheet ? (
                            // Teacher can edit tasks
                            <div className="task-edit-container">
                                {isEditing ? (
                                    <WorksheetTaskEditor
                                        key={element.id}
                                        padId={padId}
                                        elementId={element.id}
                                        markdown={taskContent}
                                        onSave={(md) => saveTaskEdit(element.id, md)}
                                        onCancel={() => {
                                            setTaskEdits(prev => ({ ...prev, [element.id]: element.content }));
                                            setEditingTaskId(null);
                                        }}
                                    />
                                ) : (
                                    <div
                                        className="task-content rendered-markdown clickable"
                                        onClick={() => setEditingTaskId(element.id)}
                                        title="Click to edit"
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: taskBodyHtml(taskContent) }} />
                                        <span className="edit-hint">Click to edit</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Student sees read-only rendered markdown
                            <div
                                className="task-content rendered-markdown"
                                dangerouslySetInnerHTML={{ __html: taskBodyHtml(element.content) }}
                            />
                        )}
                    </div>
                );

            case 'input':
                return (
                    <div key={element.id} className="worksheet-answer-field">
                        <Label className="worksheet-answer-field__label text-muted-foreground text-xs font-medium">
                            {readOnly ? 'Answer' : canAuthorWorksheet ? 'Answer field' : 'Your answer'}
                        </Label>
                        <Input
                            type="text"
                            placeholder="Your answer..."
                            value={padAnswers[element.id] || ''}
                            onChange={(e) => !readOnly && handleInputChange(element.id, e.target.value)}
                            disabled={readOnly || canAuthorWorksheet}
                            className="worksheet-answer-field__control max-w-xl"
                        />
                    </div>
                );

            case 'short-input':
                return (
                    <div key={element.id} className="worksheet-answer-field">
                        <Label className="worksheet-answer-field__label text-muted-foreground text-xs font-normal sr-only">
                            Short answer
                        </Label>
                        <Input
                            type="text"
                            placeholder="Short answer"
                            value={padAnswers[element.id] || ''}
                            onChange={(e) => !readOnly && handleInputChange(element.id, e.target.value)}
                            disabled={readOnly || canAuthorWorksheet}
                            className="worksheet-answer-field__control max-w-xl"
                        />
                    </div>
                );

            case 'long-input':
                return (
                    <div key={element.id} className="worksheet-answer-field worksheet-answer-field--long">
                        <Label className="worksheet-answer-field__label text-muted-foreground text-xs font-medium">
                            {readOnly ? 'Student answer' : canAuthorWorksheet ? 'Answer field (students edit)' : 'Your answer'}
                        </Label>
                        <Textarea
                            placeholder="Type your answer here..."
                            value={padAnswers[element.id] || ''}
                            onChange={(e) => !readOnly && handleInputChange(element.id, e.target.value)}
                            disabled={readOnly || canAuthorWorksheet}
                            rows={4}
                            className="worksheet-answer-field__control max-w-2xl min-h-[120px]"
                        />
                        {(readOnly || canAuthorWorksheet) && padAnswers[element.id] ? (
                            <p className="worksheet-answer-field__answer-foot text-xs">
                                <span className="font-medium">{readOnly ? 'Answer: ' : 'Student wrote: '}</span>
                                {padAnswers[element.id]}
                            </p>
                        ) : null}
                    </div>
                );

            default:
                return null;
        }
    };

    if (!parsed.isWorksheet) {
        return (
            <div className="worksheet-error" role="alert">
                <p><strong>Worksheet format issue</strong></p>
                <p>
                    This page is opened as a worksheet, but the body does not contain a valid{' '}
                    <code>---worksheet---</code> block. Ask your teacher to re-save the worksheet, or open it as a
                    regular note if that was a mistake.
                </p>
            </div>
        );
    }

    return (
        <div className="worksheet-viewer">
            {aiUsage.length > 0 ? (
                <div className="worksheet-header worksheet-header--minimal">
                    <span className="ai-usage-badge" title={`${aiUsage.length} AI interaction(s)`}>
                        AI · {aiUsage.length}
                    </span>
                </div>
            ) : null}

            {!readOnly && role === 'student' && (
                <div className="ai-disabled-banner">
                    <span>AI assistance is disabled for this test.</span>
                </div>
            )}

            <div className="worksheet-content">
                {parsed.elements.map(renderElement)}
            </div>

            {submissionIdForAnswers && !readOnly && (submissionStatus ?? "pending") === "pending" ? (
                <div className="worksheet-submit-bar">
                    <Button type="button" variant="default" className="text-sm" onClick={() => void handleTurnIn()}>
                        Turn in worksheet
                    </Button>
                    <p className="text-muted-foreground text-xs mt-2 max-w-prose">
                        You can keep editing until you turn in. After that, this copy is read only.
                    </p>
                </div>
            ) : null}

            {canAuthorWorksheet && (
                <div className="worksheet-add-question flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleAddQuestion}>
                            Add question block
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleInsertShortMarker}>
                            Insert /short
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleInsertLongMarker}>
                            Insert /long
                        </Button>
                    </div>
                    <p className="text-muted-foreground text-xs max-w-prose">
                        Put prompt text above the marker. <code className="rounded bg-muted px-1">/short</code> is one line;{' '}
                        <code className="rounded bg-muted px-1">/long</code> is multi-line.
                    </p>
                </div>
            )}


            {canAuthorWorksheet && aiUsage.length > 0 && (
                <div className="ai-usage-log">
                    <div className="ai-usage-header">
                        <h4>AI usage log</h4>
                        <button
                            className="ai-usage-reset-btn"
                            onClick={() => {
                                if (window.confirm('Are you sure you want to reset the AI usage log for this worksheet?')) {
                                    clearAIUsageForPad(padId);
                                }
                            }}
                            title="Reset AI usage log"
                        >
                            Reset
                        </button>
                    </div>
                    {aiUsage.map((entry, idx) => (
                        <div key={idx} className="ai-log-entry">
                            <span className="log-time">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="log-question">{entry.question}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
