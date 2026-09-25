import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownIt from 'markdown-it';
import { submissionService } from '../../services/submissionService';
import { worksheetService } from '../../services/worksheetService';
import { aiService } from '../../services/ai';
import { message } from '../../components/message';
import { addPad, updatePad, updatePadWorksheetSections, type IWorksheetSection } from '../../services/pads';
import { encryptText } from '../../services/encryption';
import { usePadStore } from '../../store';
import { isWorksheetContent, parseWorksheetMarkdown } from '../../utils/WorksheetParser';
import type { IWorksheetSubmission, IWorksheetDistribution, IWorksheet } from '../../types';

const md = new MarkdownIt({ html: true, breaks: true });

function parseWorksheetSections(content: string): IWorksheetSection[] {
  const sections: IWorksheetSection[] = [];
  let sectionIndex = 0;
  const lines = content.split('\n');
  let currentLockedContent = '';

  for (const line of lines) {
    const isHeading = line.startsWith('## ') || line.startsWith('### ') || line.startsWith('# ');

    if (isHeading) {
      if (currentLockedContent.trim()) {
        sections.push({ id: `section-${sectionIndex++}`, type: 'locked', content: currentLockedContent.trim() });
        sections.push({ id: `section-${sectionIndex++}`, type: 'editable', content: '' });
      }
      currentLockedContent = line.replace(/^#+\s*/, '') + '\n';
    } else if (line.trim()) {
      currentLockedContent += line + '\n';
    }
  }

  if (currentLockedContent.trim()) {
    sections.push({ id: `section-${sectionIndex++}`, type: 'locked', content: currentLockedContent.trim() });
    sections.push({ id: `section-${sectionIndex++}`, type: 'editable', content: '' });
  }

  if (sections.length === 0) {
    sections.push(
      { id: 'section-0', type: 'locked', content: '📝 Complete the worksheet below:' },
      { id: 'section-1', type: 'editable', content: '' }
    );
  }

  return sections;
}

interface WeaknessEntry {
  studentId: string;
  weaknesses: string[];
  suggestions: string[];
  rawAnalysis: string;
}

/**
 * Build Catcher pipeline context: worksheet tasks + student answers in order.
 * Matches the structure AISidebar uses so extract_tasks gets real student work.
 */
function buildContextFromWorksheet(
  worksheetContent: string,
  answers: Record<string, string>
): string {
  if (!worksheetContent?.trim()) {
    return Object.entries(answers)
      .map(([q, a]) => `**Task:** (Question ${q})\n\n**Student Answer:** ${a || '(no answer provided)'}`)
      .join('\n\n');
  }
  if (!isWorksheetContent(worksheetContent)) {
    return Object.entries(answers)
      .map(([q, a]) => `**Task:** (Question ${q})\n\n**Student Answer:** ${a || '(no answer provided)'}`)
      .join('\n\n');
  }
  const parsed = parseWorksheetMarkdown(worksheetContent);
  const contextParts: string[] = [];
  for (const element of parsed.elements) {
    if (element.type === 'task') {
      contextParts.push(`**Task:** ${element.content}`);
    } else if (element.type === 'long-input' || element.type === 'short-input' || element.type === 'input') {
      const studentAnswer = answers[element.id] ?? '(no answer provided)';
      contextParts.push(`**Student Answer:** ${studentAnswer}`);
    } else if (element.type === 'markdown' && element.content.trim()) {
      contextParts.push(element.content);
    }
  }
  return contextParts.length ? contextParts.join('\n\n') : Object.entries(answers)
    .map(([q, a]) => `**Task:** (Question ${q})\n\n**Student Answer:** ${a || '(no answer provided)'}`)
    .join('\n\n');
}

async function analyzeSubmission(
  submission: IWorksheetSubmission,
  worksheet: IWorksheet | null
): Promise<WeaknessEntry> {
  const answers: Record<string, string> = submission.studentAnswers
    ? JSON.parse(submission.studentAnswers)
    : {};
  const worksheetContent = worksheet?.content ?? '';
  const context = buildContextFromWorksheet(worksheetContent, answers);

  try {
    const result = await aiService.runPipeline('Catcher', {
      input: 'Analyze this submission.',
      stream: false,
      variables: {
        student_name: submission.studentId,
        context,
      },
    });
    const raw: string = result.output || '';
    const weaknesses = raw
      .split('\n')
      .filter((l: string) => l.startsWith('-') || l.startsWith('•'))
      .map((l: string) => l.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);

    return {
      studentId: submission.studentId,
      weaknesses: weaknesses.length ? weaknesses : [raw],
      suggestions: [],
      rawAnalysis: raw,
    };
  } catch {
    return {
      studentId: submission.studentId,
      weaknesses: ['Could not connect to AI service'],
      suggestions: [],
      rawAnalysis: '',
    };
  }
}

export default function ClassroomWeaknessReport({
  distribution,
  submissions,
  onSubmissionsUpdate,
  teacherId,
  teacherName,
}: {
  distribution: IWorksheetDistribution;
  submissions: IWorksheetSubmission[];
  onSubmissionsUpdate: (subs: IWorksheetSubmission[]) => void;
  teacherId: string;
  teacherName: string;
}) {
  const navigate = useNavigate();
  const setNeedToUpdate = usePadStore(s => s.setNeedToUpdate);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<WeaknessEntry[]>([]);
  const [generatingWS, setGeneratingWS] = useState<string | null>(null);

  const submittedSubs = submissions.filter(s => s.status === 'submitted' || s.status === 'reviewed');

  const runAnalysis = async () => {
    if (!submittedSubs.length) return;
    setAnalyzing(true);
    setProgress(0);
    const results: WeaknessEntry[] = [];

    let worksheet: IWorksheet | null = null;
    try {
      worksheet = await worksheetService.getWorksheet(distribution.worksheetId);
    } catch {
      // continue with null; buildContextFromWorksheet will use fallback format
    }

    for (let i = 0; i < submittedSubs.length; i++) {
      const sub = submittedSubs[i];
      const entry = await analyzeSubmission(sub, worksheet);
      results.push(entry);

      await submissionService.saveAiAnalysis(sub.id, {
        weaknesses: entry.weaknesses,
        rawAnalysis: entry.rawAnalysis,
      });

      setProgress(Math.round(((i + 1) / submittedSubs.length) * 100));
    }

    setReport(results);
    setAnalyzing(false);

    const updated = await Promise.all(
      submissions.map(s => submissionService.getSubmission(s.id).catch(() => s))
    );
    onSubmissionsUpdate(updated);
  };

  const generatePersonalizedWorksheet = async (entry: WeaknessEntry) => {
    setGeneratingWS(entry.studentId);
    const weaknessContext = entry.weaknesses.map(w => `- ${w}`).join('\n');
    const title = `Personalized Worksheet — ${entry.studentId.slice(-6)}`;
    try {
      const result = await aiService.runPipeline('Catcher', {
        input: 'yes',
        stream: false,
        variables: {
          analysis_report: weaknessContext,
        },
      });
      let content = (result.output || '').trim();
      const worksheetMarker = '---worksheet---';
      const idx = content.indexOf(worksheetMarker);
      if (idx !== -1) {
        content = content.slice(idx + worksheetMarker.length).trim();
      }
      if (!content) {
        content = `# ${title}\n\nBased on analysis, this student struggles with:\n${weaknessContext}\n\n---\n\n*Complete the exercises below to improve these areas.*\n\n`;
      }
      // Save to Appwrite (for distribution workflow) — non-blocking
      worksheetService.createWorksheet(teacherId, {
        title,
        content,
        worksheetSections: JSON.stringify([]),
        classroomId: distribution.classroomId,
      }).catch(() => {/* best-effort */});

      // Create a local pad and navigate to it so the teacher can see it
      const padId = await addPad({
        uid: 'local-user-123',
        title,
        shortDesc: 'Personalized worksheet from Catcher analysis',
      });
      if (padId) {
        const markedContent = content.startsWith('---worksheet---')
          ? content
          : `---worksheet---\n\n${content}`;
        await updatePad({ id: padId, content: markedContent, cipherContent: encryptText(markedContent) });
        const sections = parseWorksheetSections(content);
        await updatePadWorksheetSections(padId, sections);
        setNeedToUpdate();
        navigate(`/app/pad/${padId}`);
      }

      message.success('Personalized worksheet created.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate worksheet.';
      message.error(msg);
    } finally {
      setGeneratingWS(null);
    }
  };

  const existingReports = submissions.filter(s => s.aiAnalysis);

  return (
    <div className="weakness-report">
      <div className="wr-header">
        <p className="wr-subtitle">
          {submittedSubs.length} submission{submittedSubs.length !== 1 ? 's' : ''} ready for analysis
        </p>
        {submittedSubs.length > 0 && (
          <button
            className="btn-primary"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            {analyzing ? `Analyzing… (${progress}%)` : '🤖 Run AI Analysis'}
          </button>
        )}
      </div>

      {analyzing && (
        <div className="wr-progress">
          <div className="wr-progress-bar">
            <div className="wr-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="wr-progress-label">{progress}%</span>
        </div>
      )}

      {report.length > 0 && (
        <div className="wr-results">
          <h3>Classroom Weakness Report</h3>
          {report.map(entry => (
            <div key={entry.studentId} className="wr-student">
              <div className="wr-student-header">
                <span className="wr-student-id">Student …{entry.studentId.slice(-6)}</span>
                <button
                  className="btn-secondary wr-gen-btn"
                  onClick={() => generatePersonalizedWorksheet(entry)}
                  disabled={generatingWS === entry.studentId}
                >
                  {generatingWS === entry.studentId ? 'Creating…' : '📝 Generate Personalized Worksheet'}
                </button>
              </div>
              <ul className="wr-weaknesses">
                {entry.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {report.length === 0 && existingReports.length > 0 && (
        <div className="wr-existing">
          <h3>Previous Analysis Results</h3>
          {existingReports.map(s => {
            const analysis = s.aiAnalysis ? JSON.parse(s.aiAnalysis) : null;
            if (!analysis) return null;
            return (
              <div key={s.id} className="wr-student">
                <div className="wr-student-id">Student …{s.studentId.slice(-6)}</div>
                <ul className="wr-weaknesses">
                  {(analysis.weaknesses || []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!analyzing && report.length === 0 && existingReports.length === 0 && submittedSubs.length === 0 && (
        <div className="wr-empty">
          <span>🤖</span>
          <p>No submissions to analyze yet. Students need to submit their worksheets first.</p>
        </div>
      )}
    </div>
  );
}
