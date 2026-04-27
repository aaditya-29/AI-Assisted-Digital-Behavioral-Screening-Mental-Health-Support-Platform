/**
 * Tasks Page
 * 
 * Displays behavioral tasks organized by clinical intervention pillars.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import taskService from '../services/taskService';
import NavBar from '../components/NavBar';
import './Tasks.css';

const PILLARS = [
  {
    key: 'executive_function',
    label: 'Executive Function',
    icon: '🧠',
    color: '#6366f1',
    description: 'Working memory, inhibitory control, cognitive flexibility, and planning'
  },
  {
    key: 'social_cognition',
    label: 'Social Cognition',
    icon: '👥',
    color: '#f59e0b',
    description: 'Emotion recognition, Theory of Mind, social stories, and conversation skills'
  },
  {
    key: 'joint_attention',
    label: 'Joint Attention',
    icon: '👁️',
    color: '#10b981',
    description: 'Responding to and initiating joint attention through triadic interaction'
  },
  {
    key: 'sensory_perceptual',
    label: 'Sensory-Perceptual',
    icon: '🎧',
    color: '#ef4444',
    description: 'Visual temporal processing and auditory perceptual thresholding'
  }
];

const PARADIGM_ICONS = {
  n_back: '🔢',
  go_nogo: '🛑',
  dccs: '🔄',
  tower_task: '🗼',
  fer: '😊',
  false_belief: '🤔',
  social_stories: '📖',
  conversation: '💬',
  joint_attention_rja: '👆',
  joint_attention_ija: '🔍',
  visual_temporal: '👁️',
  auditory_processing: '🎵',
};

function Tasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPillar, setSelectedPillar] = useState(null);
  const [highlightedCategory, setHighlightedCategory] = useState(null);
  const [recommendedLevel, setRecommendedLevel] = useState(null);

  useEffect(() => {
    loadTasks();
    loadStats();
  }, []);

  // Handle ?category=X&level=Y URL params from recommendation links.
  // Once tasks are loaded, resolve the category to a task ID and navigate
  // directly to the play page, bypassing the Tasks listing entirely.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category');
    const lvl = params.get('level');
    if (cat) {
      setHighlightedCategory(cat);
      setRecommendedLevel(lvl ? parseInt(lvl, 10) : null);
    }
  }, [location.search]);

  // Auto-navigate once tasks are loaded and a category param is present
  useEffect(() => {
    if (!highlightedCategory || loading || tasks.length === 0) return;
    const match = tasks.find(t => t.category === highlightedCategory);
    if (match) {
      const level = recommendedLevel || null;
      const url = level ? `/tasks/${match.id}/play?level=${level}` : `/tasks/${match.id}/play`;
      navigate(url, { replace: true });
    }
    // If no match found, fall through to show the Tasks page normally
  }, [highlightedCategory, loading, tasks]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getAllTasks();
      setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await taskService.getMyStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleStartTask = (taskId) => {
    navigate(`/tasks/${taskId}/play`);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '~3 min';
    return seconds >= 60 ? `~${Math.round(seconds / 60)} min` : `${seconds} sec`;
  };

  const filteredTasks = selectedPillar
    ? tasks.filter(t => t.pillar === selectedPillar)
    : tasks;

  const groupedTasks = PILLARS.reduce((acc, pillar) => {
    acc[pillar.key] = filteredTasks.filter(t => t.pillar === pillar.key);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="tasks-page">
        <NavBar />
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tasks-page">
        <NavBar />
        <div className="error-message">{error}</div>
        <button onClick={loadTasks} className="btn btn-primary">Try Again</button>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <NavBar />
      <div className="tasks-container">
        <div className="tasks-header">
          <h1>Behavioral Assessment Tasks</h1>
          <p>Medically accurate neuropsychological paradigms across four clinical intervention pillars</p>
        </div>

        {stats && (
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-value">{stats.total_tasks_attempted}</span>
              <span className="stat-label">Tasks Attempted</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.total_sessions_completed}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {Math.round((stats.total_time_spent_seconds || 0) / 60)} min
              </span>
              <span className="stat-label">Total Time</span>
            </div>
          </div>
        )}

        <div className="pillar-filters">
          <button
            className={`pillar-filter-btn ${!selectedPillar ? 'active' : ''}`}
            onClick={() => setSelectedPillar(null)}
          >
            All Pillars
          </button>
          {PILLARS.map(pillar => (
            <button
              key={pillar.key}
              className={`pillar-filter-btn ${selectedPillar === pillar.key ? 'active' : ''}`}
              onClick={() => setSelectedPillar(selectedPillar === pillar.key ? null : pillar.key)}
              style={{
                borderColor: pillar.color,
                backgroundColor: selectedPillar === pillar.key ? pillar.color : 'transparent',
                color: selectedPillar === pillar.key ? '#fff' : undefined
              }}
            >
              {pillar.icon} {pillar.label}
            </button>
          ))}
        </div>

        {PILLARS.filter(p => !selectedPillar || p.key === selectedPillar).map(pillar => {
          const pillarTasks = groupedTasks[pillar.key];
          if (!pillarTasks || pillarTasks.length === 0) return null;

          return (
            <div key={pillar.key} className="pillar-section">
              <div className="pillar-header" style={{ borderLeftColor: pillar.color }}>
                <span className="pillar-icon-large">{pillar.icon}</span>
                <div>
                  <h2>Pillar: {pillar.label}</h2>
                  <p>{pillar.description}</p>
                </div>
              </div>

              <div className="tasks-grid">
                {pillarTasks.map(task => {
                  const progress = stats?.task_progress?.find(p => p.task_id === task.id);
                  const paradigmIcon = PARADIGM_ICONS[task.category] || '📋';
                  const diffLevels = task.difficulty_levels || {};
                  const numLevels = Object.keys(diffLevels).length;

                  return (
                    <div
                      key={task.id}
                      className="task-card"
                      style={{ borderTopColor: pillar.color }}
                    >
                      <div className="task-card-header">
                        <div className="task-icon" style={{ backgroundColor: pillar.color }}>
                          {paradigmIcon}
                        </div>
                        <div className="task-title-area">
                          <h3>{task.name}</h3>
                          <span className="task-paradigm">{task.type?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>

                      <p className="task-description">{task.description}</p>

                      <div className="task-meta">
                        <span className="duration">⏱️ {formatDuration(task.estimated_duration)}</span>
                        {numLevels > 0 && (
                          <span className="levels">{numLevels} difficulty levels</span>
                        )}
                      </div>

                      {numLevels > 0 && (
                        <div className="difficulty-preview">
                          {Object.entries(diffLevels).slice(0, 3).map(([lvl, cfg]) => (
                            <span
                              key={lvl}
                              className="diff-dot"
                              title={cfg.label || cfg.description}
                              style={{
                                backgroundColor: lvl === '1' ? '#10b981' : lvl === '2' ? '#f59e0b' : '#ef4444'
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {progress && progress.completed_attempts > 0 && (
                        <div className="task-progress-bar">
                          <div className="progress-info">
                            <span>Completed: {progress.completed_attempts}x</span>
                            {progress.best_score !== null && progress.best_score !== undefined && (
                              <span>Best: {Math.round(progress.best_score)}%</span>
                            )}
                          </div>
                          {progress.improvement_trend && (
                            <span className={`trend ${progress.improvement_trend}`}>
                              {progress.improvement_trend === 'improving' && '📈 Improving'}
                              {progress.improvement_trend === 'stable' && '➡️ Stable'}
                              {progress.improvement_trend === 'declining' && '📉 Needs Practice'}
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        className="btn btn-primary start-btn"
                        onClick={() => handleStartTask(task.id)}
                      >
                        {progress?.completed_attempts > 0 ? 'Play Again' : 'Start Task'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="no-tasks">
            <p>No tasks available{selectedPillar ? ' for this pillar' : ''}</p>
          </div>
        )}

        <div className="tasks-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/tasks/history')}>
            View Task History
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default Tasks;
