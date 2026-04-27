/**
 * TaskPlayer Page
 * 
 * Routes to medically accurate neuropsychological task components
 * across four clinical intervention pillars:
 *   I.  Executive Function Training & Cognitive Remediation
 *   II. Social Cognition & Affective Computing
 *   III.Joint Attention & Triadic Interaction
 *   IV. Sensory-Perceptual Thresholding & Adaptation
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import taskService from '../services/taskService';
import {
  NBackTask,
  GoNoGoTask,
  DCCSTask,
  TowerTask,
  FERTask,
  FalseBeliefTask,
  SocialStoriesTask,
  ConversationTask,
  JointAttentionRJA,
  JointAttentionIJA,
  VisualTemporalTask,
  AuditoryTask
} from './tasks/index';
import './TaskPlayer.css';

// Map task category (from DB) to React component
const TASK_COMPONENTS = {
  n_back: NBackTask,
  go_nogo: GoNoGoTask,
  dccs: DCCSTask,
  tower_task: TowerTask,
  fer: FERTask,
  false_belief: FalseBeliefTask,
  social_stories: SocialStoriesTask,
  conversation: ConversationTask,
  joint_attention_rja: JointAttentionRJA,
  joint_attention_ija: JointAttentionIJA,
  visual_temporal: VisualTemporalTask,
  auditory_processing: AuditoryTask,
};

const PILLAR_INFO = {
  executive_function: { label: 'Executive Function', color: '#6366f1', icon: '\u{1F9E0}' },
  social_cognition: { label: 'Social Cognition', color: '#f59e0b', icon: '\u{1F465}' },
  joint_attention: { label: 'Joint Attention', color: '#10b981', icon: '\u{1F441}\uFE0F' },
  sensory_perceptual: { label: 'Sensory-Perceptual', color: '#ef4444', icon: '\u{1F3A7}' },
};

const DIFFICULTY_LABELS = {
  1: { label: 'Easy', color: '#10b981', description: 'Introductory level' },
  2: { label: 'Medium', color: '#f59e0b', description: 'Intermediate challenge' },
  3: { label: 'Hard', color: '#ef4444', description: 'Advanced difficulty' },
};

function TaskPlayer() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read ?level= param — when set we skip the difficulty screen entirely
  const urlLevel = (() => {
    const p = new URLSearchParams(location.search);
    const v = parseInt(p.get('level'), 10);
    return isNaN(v) ? null : v;
  })();

  const [phase, setPhase] = useState('loading'); // loading, difficulty, instructions, playing, results, error
  const [taskDetail, setTaskDetail] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(urlLevel || 1);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Load task detail first to show difficulty selection
  useEffect(() => {
    loadTaskDetail();
  }, [taskId]);

  const loadTaskDetail = async () => {
    try {
      setPhase('loading');
      const data = await taskService.getTaskDetail(parseInt(taskId));
      setTaskDetail(data);
      // If a level was specified in the URL (from AI recommendation), skip difficulty selection
      if (urlLevel) {
        await startSession(parseInt(taskId), urlLevel);
        return;
      }
      // If task has multiple difficulty levels, show selector; otherwise go to instructions
      const numLevels = data.difficulty_levels ? Object.keys(data.difficulty_levels).length : 0;
      if (numLevels > 1) {
        setPhase('difficulty');
      } else {
        await startSession(parseInt(taskId), 1);
      }
    } catch (err) {
      console.error('Failed to load task:', err);
      setError(err.response?.data?.detail || 'Failed to load task');
      setPhase('error');
    }
  };

  const startSession = async (id, difficulty) => {
    try {
      setPhase('loading');
      const data = await taskService.startSession(id, difficulty);
      setSessionData(data);
      setPhase('instructions');
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err.response?.data?.detail || 'Failed to start task session');
      setPhase('error');
    }
  };

  const handleDifficultySelect = async () => {
    await startSession(parseInt(taskId), selectedDifficulty);
  };

  const handleStartTask = () => {
    setPhase('playing');
  };

  const handleTaskComplete = async (taskResults) => {
    try {
      setPhase('submitting');
      const response = await taskService.submitSession(sessionData.session_id, taskResults);
      setResults(response);
      setPhase('results');
    } catch (err) {
      console.error('Failed to submit results:', err);
      setError('Failed to save results. Your progress may not have been recorded.');
      setPhase('error');
    }
  };

  const handlePlayAgain = () => {
    setResults(null);
    setSessionData(null);
    if (taskDetail) {
      const numLevels = taskDetail.difficulty_levels ? Object.keys(taskDetail.difficulty_levels).length : 0;
      if (numLevels > 1) {
        setPhase('difficulty');
      } else {
        startSession(parseInt(taskId), 1);
      }
    } else {
      loadTaskDetail();
    }
  };

  const renderTaskComponent = () => {
    if (!sessionData) return null;

    const category = sessionData.category;
    const Component = TASK_COMPONENTS[category];

    if (!Component) {
      return (
        <div className="fallback-task">
          <h3>Task Not Available</h3>
          <p>The task component for <strong>{category}</strong> is not yet implemented.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/tasks')}>
            Back to Tasks
          </button>
        </div>
      );
    }

    return (
      <Component
        config={sessionData.config}
        onComplete={handleTaskComplete}
      />
    );
  };

  const pillar = sessionData?.pillar || taskDetail?.pillar;
  const pillarStyle = pillar ? PILLAR_INFO[pillar] : null;

  // --- LOADING ---
  if (phase === 'loading') {
    return (
      <div className="task-player">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Preparing task...</p>
        </div>
      </div>
    );
  }

  // --- SUBMITTING ---
  if (phase === 'submitting') {
    return (
      <div className="task-player">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Submitting results...</p>
        </div>
      </div>
    );
  }

  // --- ERROR ---
  if (phase === 'error') {
    return (
      <div className="task-player">
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button className="btn btn-primary" onClick={loadTaskDetail}>
              Try Again
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/tasks')}>
              Back to Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- DIFFICULTY SELECTION ---
  if (phase === 'difficulty' && taskDetail) {
    const levels = taskDetail.difficulty_levels || {};
    return (
      <div className="task-player">
        <div className="difficulty-screen">
          {pillarStyle && (
            <div className="pillar-badge" style={{ backgroundColor: pillarStyle.color }}>
              {pillarStyle.icon} {pillarStyle.label}
            </div>
          )}
          <h1>{taskDetail.name}</h1>
          <p className="task-desc">{taskDetail.description}</p>

          <h2>Select Difficulty Level</h2>
          <div className="difficulty-options">
            {Object.entries(levels).map(([lvl, cfg]) => {
              const lvlNum = parseInt(lvl);
              const info = DIFFICULTY_LABELS[lvlNum] || { label: `Level ${lvl}`, color: '#6b7280' };
              return (
                <button
                  key={lvl}
                  className={`difficulty-card ${selectedDifficulty === lvlNum ? 'selected' : ''}`}
                  onClick={() => setSelectedDifficulty(lvlNum)}
                  style={{
                    borderColor: selectedDifficulty === lvlNum ? info.color : '#e5e7eb',
                    boxShadow: selectedDifficulty === lvlNum ? `0 0 0 3px ${info.color}33` : 'none'
                  }}
                >
                  <div className="diff-badge" style={{ backgroundColor: info.color }}>
                    {info.label}
                  </div>
                  <p className="diff-description">{cfg.label || cfg.description || info.description}</p>
                  {cfg.description && cfg.label && (
                    <p className="diff-detail">{cfg.description}</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="difficulty-actions">
            <button className="btn btn-primary btn-large" onClick={handleDifficultySelect}>
              Continue with {DIFFICULTY_LABELS[selectedDifficulty]?.label || `Level ${selectedDifficulty}`}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/tasks')}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- INSTRUCTIONS ---
  if (phase === 'instructions' && sessionData) {
    const diffInfo = DIFFICULTY_LABELS[sessionData.difficulty_level] || {};
    return (
      <div className="task-player">
        <div className="instructions-screen">
          {pillarStyle && (
            <div className="pillar-badge" style={{ backgroundColor: pillarStyle.color }}>
              {pillarStyle.icon} {pillarStyle.label}
            </div>
          )}
          <h1>{sessionData.task_name}</h1>

          <div className="instruction-meta">
            <span className="diff-indicator" style={{ backgroundColor: diffInfo.color || '#6b7280' }}>
              {diffInfo.label || `Level ${sessionData.difficulty_level}`}
            </span>
          </div>

          <div className="instructions-content">
            {sessionData.instructions.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          <div className="instructions-actions">
            <button className="btn btn-primary btn-large" onClick={handleStartTask}>
              Start Task
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/tasks')}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PLAYING ---
  if (phase === 'playing' && sessionData) {
    return (
      <div className="task-player">
        <div className="task-header-bar">
          <div className="task-header-left">
            {pillarStyle && (
              <span className="pillar-tag" style={{ backgroundColor: pillarStyle.color }}>
                {pillarStyle.icon}
              </span>
            )}
            <h2>{sessionData.task_name}</h2>
          </div>
          <div className="task-header-right">
            <span className="diff-tag" style={{
              backgroundColor: (DIFFICULTY_LABELS[sessionData.difficulty_level]?.color || '#6b7280') + '22',
              color: DIFFICULTY_LABELS[sessionData.difficulty_level]?.color || '#6b7280'
            }}>
              {DIFFICULTY_LABELS[sessionData.difficulty_level]?.label || `Level ${sessionData.difficulty_level}`}
            </span>
          </div>
        </div>
        <div className="task-arena-wrapper">
          {renderTaskComponent()}
        </div>
      </div>
    );
  }

  // --- RESULTS ---
  if (phase === 'results' && results) {
    return (
      <div className="task-player">
        <div className="results-screen">
          {pillarStyle && (
            <div className="pillar-badge" style={{ backgroundColor: pillarStyle.color }}>
              {pillarStyle.icon} {pillarStyle.label}
            </div>
          )}
          <h1>Task Complete!</h1>
          <h2>{results.task_name}</h2>

          <div className="results-summary">
            <h3>Your Results</h3>
            <div className="metrics-grid">
              {results.results.map((r, idx) => (
                <div key={idx} className="metric-card">
                  <span className="metric-name">
                    {r.metric_name.replace(/_/g, ' ')}
                  </span>
                  <span className="metric-value">
                    {formatMetricValue(r.metric_name, r.metric_value)}
                  </span>
                </div>
              ))}
            </div>

            {results.performance_summary?.interpretation?.length > 0 && (
              <div className="interpretation">
                <h4>Clinical Interpretation</h4>
                <ul>
                  {results.performance_summary.interpretation.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={handlePlayAgain}>
              Play Again
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/tasks')}>
              Back to Tasks
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/tasks/history')}>
              View History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function formatMetricValue(name, value) {
  const n = name.toLowerCase();
  if (n.includes('accuracy') || n.includes('rate') || n.includes('score') || n.includes('percentage')) {
    return `${Math.round(value)}%`;
  }
  if (n.includes('time') || n.includes('latency') || n.includes('rt') || n.includes('duration')) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return (Math.round(value * 100) / 100).toString();
}

export default TaskPlayer;
