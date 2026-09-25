import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submissionService } from '../../services/submissionService';
import { worksheetService } from '../../services/worksheetService';
import WorksheetViewer from '../../components/WorksheetViewer';
import type { IWorksheetSubmission, IWorksheetDistribution, IWorksheet } from '../../types';
import ClassroomWeaknessReport from './ClassroomWeaknessReport';
import './SubmissionsDashboard.css';

type Tab = 'overview' | 'analysis';

export type SubmissionsDashboardProps = {
  /** When set, only distributions for this classroom are shown. */
  classroomIdFilter?: string;
  /** Rendered inside classroom hub — tighter chrome. */
  embedded?: boolean;
  /** Open this distribution after the list loads (e.g. deep link). */
  initialDistributionId?: string | null;
};

function SubmissionRow({
  submission,
  onClick,
}: {
  submission: IWorksheetSubmission;
  onClick: () => void;
}) {
  const shortId = submission.studentId.slice(-6);
  return (
    <div
      className={`sub-row status-${submission.status}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <div className="sub-student">Student …{shortId}</div>
      <span className={`sub-badge status-${submission.status}`}>{submission.status}</span>
      {submission.submittedAt && (
        <div className="sub-date">{new Date(submission.submittedAt).toLocaleDateString()}</div>
      )}
      {submission.status === 'submitted' && !submission.aiAnalysis && (
        <div className="sub-pending-analysis">awaiting AI analysis</div>
      )}
      {submission.aiAnalysis && (
        <div className="sub-has-analysis">✓ analysis ready</div>
      )}
      <button
        type="button"
        className="sub-view-btn"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        View
      </button>
    </div>
  );
}

function SubmissionDetailPanel({
  submission,
  worksheet,
  onBack,
}: {
  submission: IWorksheetSubmission;
  worksheet: IWorksheet | null;
  onBack: () => void;
}) {
  let answers: Record<string, string> = {};
  try {
    if (submission.studentAnswers) answers = JSON.parse(submission.studentAnswers);
  } catch {
    // ignore invalid JSON
  }
  let analysis: { weaknesses?: string[]; rawAnalysis?: string } | null = null;
  try {
    if (submission.aiAnalysis) analysis = JSON.parse(submission.aiAnalysis);
  } catch {
    // ignore invalid JSON
  }

  return (
    <div className="sd-submission-detail">
      <div className="sd-detail-header">
        <button type="button" className="sd-detail-back" onClick={onBack}>
          ← Back to list
        </button>
        <h3 className="sd-detail-title">{worksheet?.title ?? 'Worksheet'}</h3>
        <p className="sd-detail-meta">
          Student …{submission.studentId.slice(-6)}
          {submission.submittedAt && (
            <> · Submitted {new Date(submission.submittedAt).toLocaleDateString()}</>
          )}
        </p>
      </div>
      <div className="sd-detail-worksheet">
        {worksheet ? (
          <WorksheetViewer
            padId={worksheet.id}
            content={worksheet.content}
            serverAnswers={answers}
            readOnly
          />
        ) : (
          <p className="sd-detail-loading">Loading worksheet…</p>
        )}
      </div>
      {analysis && (
        <div className="sd-detail-analysis">
          <h4>AI Analysis</h4>
          {(analysis.weaknesses ?? []).length > 0 && (
            <ul className="sd-analysis-weaknesses">
              {(analysis.weaknesses as string[]).map((w: string, i: number) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubmissionsDashboard({
  classroomIdFilter,
  embedded,
  initialDistributionId,
}: SubmissionsDashboardProps = {}) {
  const { user } = useAuth();
  const isEmbedded = !!embedded;

  const [distributions, setDistributions] = useState<IWorksheetDistribution[]>([]);
  const [submissions, setSubmissions] = useState<IWorksheetSubmission[]>([]);
  const [selectedDist, setSelectedDist] = useState<IWorksheetDistribution | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<IWorksheetSubmission | null>(null);
  const [worksheetCache, setWorksheetCache] = useState<Record<string, IWorksheet>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    setLoading(true);
    setSelectedDist(null);
    setSelectedSubmission(null);
    setSubmissions([]);

    void worksheetService.listDistributions(user.uid).then(async (allDists) => {
      if (cancelled) return;
      const dists = classroomIdFilter
        ? allDists.filter((d) => d.classroomId === classroomIdFilter)
        : allDists;
      setDistributions(dists);
      setLoading(false);

      const pickId = initialDistributionId?.trim() || null;
      const toOpen = pickId ? dists.find((d) => d.id === pickId) : null;
      if (toOpen) {
        setSelectedDist(toOpen);
        const subs = await submissionService.getSubmissionsForDistribution(toOpen.id);
        if (cancelled) return;
        setSubmissions(subs);
        setDistributions((prev) =>
          prev.map((d) => (d.id === toOpen.id ? { ...d, submissionCount: subs.length } : d))
        );
      }

      const counts = await Promise.all(
        dists.map((d) =>
          submissionService.getSubmissionsForDistribution(d.id).then((subs) => ({ id: d.id, count: subs.length }))
        )
      );
      if (cancelled) return;
      setDistributions((prev) =>
        prev.map((d) => {
          const c = counts.find((x) => x.id === d.id);
          return c ? { ...d, submissionCount: c.count } : d;
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, classroomIdFilter, initialDistributionId]);

  const handleSelectDist = async (dist: IWorksheetDistribution) => {
    setSelectedDist(dist);
    setSelectedSubmission(null);
    const subs = await submissionService.getSubmissionsForDistribution(dist.id);
    setSubmissions(subs);
    setDistributions((prev) => prev.map((d) => (d.id === dist.id ? { ...d, submissionCount: subs.length } : d)));
  };

  const handleSelectSubmission = async (submission: IWorksheetSubmission) => {
    setSelectedSubmission(submission);
    if (!worksheetCache[submission.worksheetId]) {
      try {
        const ws = await worksheetService.getWorksheet(submission.worksheetId);
        setWorksheetCache((prev) => ({ ...prev, [submission.worksheetId]: ws }));
      } catch {
        // leave cache empty; detail panel will show "Loading worksheet…"
      }
    }
  };

  if (!user) return null;

  const pending = submissions.filter((s) => s.status === 'pending').length;
  const submitted = submissions.filter((s) => s.status === 'submitted').length;
  const reviewed = submissions.filter((s) => s.status === 'reviewed').length;

  return (
    <div className={`submissions-dashboard${isEmbedded ? ' submissions-dashboard--embedded' : ''}`}>
      <div className="sd-header">
        {isEmbedded ? <h2 className="sd-title sd-title--embedded">Submissions</h2> : <h1 className="sd-title">📊 Submissions Dashboard</h1>}
      </div>

      <div className="sd-layout">
        <div className="sd-dist-list">
          <h3>{classroomIdFilter ? 'Distributions (this class)' : 'Distributions'}</h3>
          {loading && <div className="sd-loading">Loading…</div>}
          {distributions.map((d) => (
            <div
              key={d.id}
              className={`dist-item ${selectedDist?.id === d.id ? 'active' : ''}`}
              onClick={() => void handleSelectDist(d)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && void handleSelectDist(d)}
              role="button"
              tabIndex={0}
            >
              <div className="dist-id">Worksheet #{d.worksheetId.slice(-6)}</div>
              <div className="dist-date">
                {d.distributedAt ? new Date(d.distributedAt).toLocaleDateString() : ''}
              </div>
              <div className="dist-count">{d.submissionCount} students</div>
            </div>
          ))}
          {!loading && distributions.length === 0 && (
            <div className="sd-empty">No distributions yet</div>
          )}
        </div>

        {selectedDist && (
          <div className="sd-detail">
            <div className="sd-tabs">
              <button className={`sd-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                Overview
              </button>
              <button className={`sd-tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
                AI Analysis
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="sd-overview">
                {selectedSubmission ? (
                  <SubmissionDetailPanel
                    submission={selectedSubmission}
                    worksheet={worksheetCache[selectedSubmission.worksheetId] ?? null}
                    onBack={() => setSelectedSubmission(null)}
                  />
                ) : (
                  <>
                    <div className="sd-stats">
                      <div className="sd-stat"><span className="sd-stat-val">{pending}</span><span className="sd-stat-label">Pending</span></div>
                      <div className="sd-stat"><span className="sd-stat-val">{submitted}</span><span className="sd-stat-label">Submitted</span></div>
                      <div className="sd-stat"><span className="sd-stat-val">{reviewed}</span><span className="sd-stat-label">Reviewed</span></div>
                    </div>
                    <div className="sd-sub-list">
                      {submissions.map((s) => (
                        <SubmissionRow
                          key={s.id}
                          submission={s}
                          onClick={() => void handleSelectSubmission(s)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <ClassroomWeaknessReport
                distribution={selectedDist}
                submissions={submissions}
                onSubmissionsUpdate={setSubmissions}
                teacherId={user.uid}
                teacherName={user.displayName || 'Teacher'}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
