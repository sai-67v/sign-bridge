/**
 * WorksheetParser - Parses markdown content with worksheet XML tags
 * 
 * Worksheet Format:
 * - Starts with `---worksheet---` marker
 * - Uses XML-style tags for interactive elements:
 *   - <task>...</task> - Read-only question/instruction blocks
 *   - <input /> - Single-line answer field
 *   - <short-input /> - Small inline input
 *   - <long-input /> - Multi-line textarea
 */

export type WorksheetElementType = 'markdown' | 'task' | 'input' | 'short-input' | 'long-input';

export interface WorksheetElement {
    type: WorksheetElementType;
    id: string;
    content: string; // For markdown/task, this is the text content; for inputs, it's empty
}

export interface ParsedWorksheet {
    isWorksheet: boolean;
    title?: string;
    elements: WorksheetElement[];
    rawContent: string;
}

const WORKSHEET_MARKER = '---worksheet---';

export type ParseWorksheetOptions = {
    /** @deprecated Reserved; marker field ids are ordinal-based so the same worksheet shape shares keys across pads (e.g. submissions vs template). */
    noteId?: string;
};

/**
 * Ordinal-based field id for `/short` and `/long` markers — stable for identical worksheet bodies (student answers, dashboards).
 */
export function stableWorksheetFieldOrdinal(ordinal: number): string {
    return `ws-field-${ordinal}`;
}

/**
 * Turns `/short` and `/long` single-line markers into `<short-input />` / `<long-input />` with stable ids.
 * Skips lines inside fenced ``` blocks per worksheet-markers.md.
 */
export function preprocessWorksheetMarkers(body: string): string {
    const lines = body.split(/\r?\n/);
    const out: string[] = [];
    let buffer: string[] = [];
    let inFence = false;
    let fieldOrdinal = 0;

    const flushBuffer = () => {
        if (buffer.length === 0) return;
        const chunk = buffer.join('\n').trimEnd();
        buffer = [];
        if (chunk) out.push(chunk);
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            if (!inFence) {
                flushBuffer();
                inFence = true;
                buffer.push(line);
            } else {
                buffer.push(line);
                flushBuffer();
                inFence = false;
            }
            continue;
        }
        if (inFence) {
            buffer.push(line);
            continue;
        }

        if (trimmed === '/short') {
            flushBuffer();
            const id = stableWorksheetFieldOrdinal(fieldOrdinal++);
            out.push(`<short-input data-ws-id="${id}" />`);
            continue;
        }
        if (trimmed === '/long') {
            flushBuffer();
            const id = stableWorksheetFieldOrdinal(fieldOrdinal++);
            out.push(`<long-input data-ws-id="${id}" />`);
            continue;
        }

        buffer.push(line);
    }
    flushBuffer();
    return out.join('\n\n');
}

function extractDataWsId(fullTag: string): string | undefined {
    const m = fullTag.match(/data-ws-id="([^"]+)"/);
    return m?.[1];
}

/**
 * Strip HTML from a string to get plain text
 */
function htmlToText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div)[^>]*>/gi, '\n')
        .replace(/<\/?(h[1-6])[^>]*>/gi, (match, tag) => {
            // Add markdown heading markers for headings
            if (match.startsWith('</')) return '\n';
            const level = parseInt(tag.charAt(1));
            return '\n' + '#'.repeat(level) + ' ';
        })
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
        .trim();
}

/**
 * Strip HTML tags from content to get plain text, but preserve worksheet structure
 * For HTML content that was corrupted, this extracts and cleans the worksheet elements
 */
function stripHtmlTags(html: string): string {
    let result = html;

    // Extract and clean <task>...</task> blocks
    // The content inside may have HTML that needs to be stripped
    result = result.replace(/<task>([\s\S]*?)<\/task>/gi, (match, innerContent) => {
        // Strip HTML from inside the task, keeping just text
        const cleanedContent = htmlToText(innerContent);
        return `<task>\n${cleanedContent}\n</task>`;
    });

    // Normalize self-closing input tags (they may have extra attributes or spacing)
    result = result.replace(/<long-input[^>]*\/?>/gi, '<long-input />');
    result = result.replace(/<short-input[^>]*\/?>/gi, '<short-input />');
    result = result.replace(/<input[^>]*\/?>/gi, '<input />');

    // Now strip remaining HTML tags (outside of task blocks)
    // First, temporarily protect our cleaned task and input tags
    const protectedTags: { placeholder: string; original: string }[] = [];

    result = result.replace(/<task>[\s\S]*?<\/task>/gi, (match) => {
        const placeholder = `__TASK_${protectedTags.length}__`;
        protectedTags.push({ placeholder, original: match });
        return placeholder;
    });

    result = result.replace(/<(long-input|short-input|input)\s*\/>/gi, (match) => {
        const placeholder = `__INPUT_${protectedTags.length}__`;
        protectedTags.push({ placeholder, original: match });
        return placeholder;
    });

    // Strip remaining HTML
    result = htmlToText(result);

    // Restore protected tags
    for (const { placeholder, original } of protectedTags) {
        result = result.replace(placeholder, '\n' + original + '\n');
    }

    // Clean up whitespace
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    return result;
}

/**
 * Extract worksheet content starting from the marker
 * Returns the content from ---worksheet--- onwards, or null if not found
 * 
 * Handles multiple scenarios:
 * - Raw markdown with marker
 * - HTML-wrapped content where marker is inside <p> tags
 * - Malformed markers with whitespace/newlines
 * - Case variations
 * 
 * IMPORTANT: For HTML content, always returns the CLEANED/STRIPPED version
 * so that tag regex patterns can match correctly.
 */
function extractWorksheetContent(content: string): string | null {
    if (!content || typeof content !== 'string') return null;

    // Check if content looks like HTML
    const isHtml = /<[^>]+>/i.test(content);

    // For HTML content, we MUST work with the stripped version
    // because the raw HTML has malformed tag structure that breaks our regex
    let workContent = isHtml ? stripHtmlTags(content) : content;

    // Handle case where "---" becomes <hr> and "worksheet---" is separate
    // Replace <hr> tags with "---" to reconstruct the marker
    workContent = workContent.replace(/<hr\s*\/?>/gi, '---');

    // Also handle the text form where they got split by newlines
    // "---\nworksheet---" or "---\n\nworksheet---" should become "---worksheet---"
    workContent = workContent.replace(/---\s*\n\s*worksheet---/gi, WORKSHEET_MARKER);

    // Try exact match
    let markerIndex = workContent.indexOf(WORKSHEET_MARKER);
    if (markerIndex !== -1) {
        return workContent.substring(markerIndex);
    }

    // Try case-insensitive exact match
    const lowerContent = workContent.toLowerCase();
    markerIndex = lowerContent.indexOf(WORKSHEET_MARKER.toLowerCase());
    if (markerIndex !== -1) {
        // Normalize the marker
        return WORKSHEET_MARKER + workContent.substring(markerIndex + WORKSHEET_MARKER.length);
    }

    // Try regex for malformed markers (handles whitespace/newlines in the marker)
    const malformedRegex = /---\s*worksheet\s*---/i;
    const match = workContent.match(malformedRegex);
    if (match && match.index !== undefined) {
        return WORKSHEET_MARKER + workContent.substring(match.index + match[0].length);
    }

    // Also try just "worksheet---" at the start (when --- was already rendered as hr and removed)
    const partialMatch = workContent.match(/worksheet\s*---/i);
    if (partialMatch && partialMatch.index !== undefined && partialMatch.index < 50) {
        // If worksheet--- appears near the beginning, treat it as the marker
        return WORKSHEET_MARKER + workContent.substring(partialMatch.index + partialMatch[0].length);
    }

    return null;
}

/**
 * Check if content contains a worksheet marker (anywhere in the text)
 */
export function isWorksheetContent(content: string): boolean {
    return extractWorksheetContent(content) !== null;
}

/**
 * Generate a unique ID for worksheet elements
 */
function generateElementId(type: string, index: number): string {
    return `ws-${type}-${index}`;
}

/**
 * Serialize interactive worksheet structure for `notes.worksheetSections` (order + ids for dashboards).
 */
export function worksheetElementsToSections(
    elements: WorksheetElement[]
): Array<{ id: string; type: 'locked' | 'editable'; content: string }> {
    const out: Array<{ id: string; type: 'locked' | 'editable'; content: string }> = [];
    for (const el of elements) {
        if (el.type === 'task') {
            out.push({ id: el.id, type: 'locked', content: el.content });
        } else if (el.type === 'input' || el.type === 'short-input' || el.type === 'long-input') {
            out.push({ id: el.id, type: 'editable', content: el.type });
        }
    }
    return out;
}

/**
 * Parse worksheet markdown content into structured elements
 */
export function parseWorksheetMarkdown(content: string, _opts?: ParseWorksheetOptions): ParsedWorksheet {
    try {
        return parseWorksheetMarkdownInner(content);
    } catch (e) {
        console.warn("parseWorksheetMarkdown failed", e);
        return {
            isWorksheet: true,
            title: undefined,
            elements: [
                {
                    type: "markdown",
                    id: "ws-parse-error",
                    content:
                        "**This worksheet could not be read.**\n\nTry refreshing the page. If it keeps happening, ask your teacher to open and re-save the worksheet.",
                },
            ],
            rawContent: content,
        };
    }
}

function parseWorksheetMarkdownInner(content: string): ParsedWorksheet {
    // Extract content starting from the worksheet marker
    const worksheetContent = extractWorksheetContent(content);

    if (!worksheetContent) {
        return {
            isWorksheet: false,
            elements: [],
            rawContent: content
        };
    }

    const elements: WorksheetElement[] = [];
    let elementIndex = 0;

    // Remove the worksheet marker from the extracted content
    let workContent = worksheetContent.substring(WORKSHEET_MARKER.length).trim();
    workContent = preprocessWorksheetMarkers(workContent);

    // Extract title if present (first # heading)
    let title: string | undefined;
    const titleMatch = workContent.match(/^#\s+(.+?)(?:\n|$)/);
    if (titleMatch) {
        title = titleMatch[1].trim();
    }

    // Regex patterns for our tags (allow attributes e.g. data-ws-id from marker preprocessor)
    const tagPatterns: Array<{
        regex: RegExp;
        type: WorksheetElementType;
        captureContent: boolean;
    }> = [
        { regex: /<task>([\s\S]*?)<\/task>/g, type: 'task', captureContent: true },
        { regex: /<long-input\s*([^>]*?)\s*\/>/g, type: 'long-input', captureContent: false },
        { regex: /<short-input\s*([^>]*?)\s*\/>/g, type: 'short-input', captureContent: false },
        { regex: /<input\s*([^>]*?)\s*\/>/g, type: 'input', captureContent: false },
    ];

    // Find all tag positions
    interface TagMatch {
        type: WorksheetElementType;
        start: number;
        end: number;
        content: string;
        fullTag: string;
    }

    const allMatches: TagMatch[] = [];

    for (const pattern of tagPatterns) {
        let match;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        while ((match = regex.exec(workContent)) !== null) {
            const fullTag = match[0];
            allMatches.push({
                type: pattern.type,
                start: match.index,
                end: match.index + fullTag.length,
                content: pattern.captureContent ? match[1] || '' : '',
                fullTag,
            });
        }
    }

    // Sort by position and drop overlapping tag matches (invalid markup / duplicate regex hits)
    allMatches.sort((a, b) => a.start - b.start);
    const nonOverlapping: TagMatch[] = [];
    let coverUntil = -1;
    for (const m of allMatches) {
        if (m.start < coverUntil) continue;
        nonOverlapping.push(m);
        coverUntil = m.end;
    }

    // Build elements array, including markdown sections between tags
    let currentPos = 0;

    for (const match of nonOverlapping) {
        // Add any markdown content before this tag
        if (match.start > currentPos) {
            const mdContent = workContent.substring(currentPos, match.start).trim();
            if (mdContent) {
                elements.push({
                    type: 'markdown',
                    id: generateElementId('md', elementIndex++),
                    content: mdContent
                });
            }
        }

        // Add the tag element
        const stable = match.type === 'task' ? undefined : extractDataWsId(match.fullTag);
        elements.push({
            type: match.type,
            id: stable || generateElementId(match.type, elementIndex++),
            content: match.content.trim()
        });

        currentPos = match.end;
    }

    // Add any remaining markdown content
    if (currentPos < workContent.length) {
        const mdContent = workContent.substring(currentPos).trim();
        if (mdContent) {
            elements.push({
                type: 'markdown',
                id: generateElementId('md', elementIndex++),
                content: mdContent
            });
        }
    }

    if (elements.length === 0) {
        elements.push({
            type: 'markdown',
            id: generateElementId('md', elementIndex++),
            content:
                '_No questions yet._ Add **task** blocks and `/short` or `/long` answer lines, or ask your teacher to add content.',
        });
    }

    return {
        isWorksheet: true,
        title,
        elements,
        rawContent: content
    };
}

/**
 * Convert old worksheetSections format to new markdown format
 * For backward compatibility during migration
 */
export function convertLegacySectionsToMarkdown(
    sections: Array<{ id: string; type: 'locked' | 'editable'; content: string }>
): string {
    let markdown = WORKSHEET_MARKER + '\n\n';

    for (const section of sections) {
        if (section.type === 'locked') {
            // Locked sections become <task> blocks
            markdown += `<task>\n${section.content}\n</task>\n\n`;
        } else {
            // Editable sections — marker form gets stable ids when parsed with noteId
            markdown += '/long\n\n';
        }
    }

    return markdown.trim();
}

/**
 * Create a new empty worksheet template.
 * No title is embedded in the body; the pad title is the only editable title.
 */
export function createEmptyWorksheet(_title?: string): string {
    return `${WORKSHEET_MARKER}

<task>
## Question 1

Enter your question or instructions here...
</task>

/long

<task>
## Question 2

Enter another question...
</task>

/long
`;
}

/**
 * Insert a new task block into worksheet content
 */
export function insertTaskBlock(content: string, taskContent: string): string {
    return content + `\n\n<task>\n${taskContent}\n</task>\n\n/long\n`;
}

/** Append a `/short` marker line (teacher authoring — see worksheet-markers.md). */
export function appendWorksheetShortMarker(content: string): string {
    return `${content.replace(/\s+$/, '')}\n\n/short\n`;
}

/** Append a `/long` marker line. */
export function appendWorksheetLongMarker(content: string): string {
    return `${content.replace(/\s+$/, '')}\n\n/long\n`;
}

/**
 * Get the worksheet marker constant
 */
export function getWorksheetMarker(): string {
    return WORKSHEET_MARKER;
}
