import React from 'react';
import { PipelineTrace } from '../../services/ai';
import './TraceViewer.css';

interface TraceViewerProps {
    trace: PipelineTrace[];
}

export const TraceViewer: React.FC<TraceViewerProps> = ({ trace }) => {
    if (!trace || trace.length === 0) return null;

    return (
        <div className="trace-viewer">
            <div className="trace-header">Pipeline Execution Trace</div>
            <div className="trace-timeline">
                {trace.map((step, index) => (
                    <div key={index} className="trace-item">
                        <div className="trace-icon">
                            {step.type === 'classifier' ? '🔍' :
                                step.type === 'generate' ? '⚡' :
                                    step.type === 'terminal' ? '🏁' : '•'}
                        </div>
                        <div className="trace-content">
                            <div className="trace-node-name">{step.node}</div>
                            <div className="trace-details">
                                <span className="trace-type">{step.type}</span>
                                {step.classification && (
                                    <div className="trace-classification">
                                        Classified as: <strong>{step.classification}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
