/**
 * Analysis Page
 *
 * Shows aggregated behavioral insights: journal mood/stress trends
 * and ASD screening history summary.
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import api from '../services/api'
import './Analysis.css'

export default function Analysis() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/analysis/summary')
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load analysis data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="analysis-container">
        <NavBar />
        <div className="analysis-loading">
          <div className="spinner"></div>
          <p>Loading your analysis…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="analysis-container">
        <NavBar />
        <div className="analysis-empty">
          <span className="analysis-empty-icon">📊</span>
          <h2>Analysis Unavailable</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">Back to Dashboard</button>
        </div>
      </div>
    )
  }

  const { journal, screening, insight } = data

  const moodColor = (label) => {
    switch (label) {
      case 'Excellent': return 'green'
      case 'Good': return 'teal'
      case 'Neutral': return 'gray'
      case 'Low': case 'Very Low': return 'red'
      default: return 'gray'
    }
  }

  const stressColor = (label) => {
    switch (label) {
      case 'Low': return 'green'
      case 'Moderate': return 'yellow'
      case 'High': return 'red'
      default: return 'gray'
    }
  }

  const riskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'green'
      case 'moderate': return 'yellow'
      case 'high': return 'red'
      default: return 'gray'
    }
  }

  const mlLabelText = (label) => {
    switch (label?.toLowerCase()) {
      case 'low': return 'Low Likelihood'
      case 'moderate': return 'Moderate Likelihood'
      case 'high': return 'High Likelihood'
      case 'very_high': return 'Very High Likelihood'
      default: return 'N/A'
    }
  }

  const mlLabelColor = (label) => {
    switch (label?.toLowerCase()) {
      case 'low': return 'green'
      case 'moderate': return 'yellow'
      case 'high': return 'orange'
      case 'very_high': return 'red'
      default: return 'gray'
    }
  }

  // Simple bar chart — normalised 0–10
  const MiniBar = ({ value, max = 10, color }) => (
    <div className="mini-bar-track">
      <div
        className={`mini-bar-fill mini-bar-${color}`}
        style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
      />
    </div>
  )

  const hasMoodTrend = journal.mood_trend?.length > 1
  const hasStressTrend = journal.stress_trend?.length > 1

  return (
    <div className="analysis-container">
      <NavBar />

      <div className="analysis-inner">
        <div className="analysis-header">
          <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
          <h1>Behavioral Analysis</h1>
          <p className="analysis-subtitle">AI-powered insights based on your journal entries and ASD screening results.</p>
        </div>

        {/* Insight Banner */}
        <div className="insight-banner">
          <span className="insight-icon">🧠</span>
          <p>{insight}</p>
        </div>

        <div className="analysis-grid">

          {/* === Journal Card === */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <span className="card-icon-sm">📔</span>
              <h2>Journal Insights</h2>
              <span className="card-period">Last 30 days</span>
            </div>

            {journal.entry_count_30d === 0 ? (
              <div className="analysis-empty-state">
                <p>No journal entries in the last 30 days.</p>
                <Link to="/journal" className="btn btn-sm btn-primary">Write First Entry</Link>
              </div>
            ) : (
              <>
                <div className="stat-row">
                  <span className="stat-label">Total Entries</span>
                  <span className="stat-value">{journal.entry_count_30d}</span>
                </div>

                {journal.avg_mood != null && (
                  <div className="stat-block">
                    <div className="stat-row">
                      <span className="stat-label">Avg Mood</span>
                      <span className={`stat-badge badge-${moodColor(journal.mood_label)}`}>
                        {journal.mood_label} ({journal.avg_mood}/10)
                      </span>
                    </div>
                    <MiniBar value={journal.avg_mood} color={moodColor(journal.mood_label)} />
                  </div>
                )}

                {journal.avg_stress != null && (
                  <div className="stat-block">
                    <div className="stat-row">
                      <span className="stat-label">Avg Stress</span>
                      <span className={`stat-badge badge-${stressColor(journal.stress_label)}`}>
                        {journal.stress_label} ({journal.avg_stress}/10)
                      </span>
                    </div>
                    <MiniBar value={journal.avg_stress} color={stressColor(journal.stress_label)} />
                  </div>
                )}

                {hasMoodTrend && (
                  <div className="trend-section">
                    <h4>Weekly Mood Trend</h4>
                    <div className="trend-bars">
                      {journal.mood_trend.map((pt, i) => (
                        <div key={i} className="trend-bar-col">
                          <div className="trend-bar-track">
                            <div
                              className="trend-bar-fill trend-bar-blue"
                              style={{ height: `${(pt.avg / 10) * 100}%` }}
                            />
                          </div>
                          <span className="trend-bar-label">{pt.week}</span>
                          <span className="trend-bar-val">{pt.avg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasStressTrend && (
                  <div className="trend-section">
                    <h4>Weekly Stress Trend</h4>
                    <div className="trend-bars">
                      {journal.stress_trend.map((pt, i) => (
                        <div key={i} className="trend-bar-col">
                          <div className="trend-bar-track">
                            <div
                              className="trend-bar-fill trend-bar-orange"
                              style={{ height: `${(pt.avg / 10) * 100}%` }}
                            />
                          </div>
                          <span className="trend-bar-label">{pt.week}</span>
                          <span className="trend-bar-val">{pt.avg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link to="/journal" className="btn btn-sm btn-secondary analysis-card-link">
                  View Journal →
                </Link>
              </>
            )}
          </div>

          {/* === Screening Card === */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <span className="card-icon-sm">📋</span>
              <h2>ASD Screening</h2>
              <span className="card-period">Last 5 sessions</span>
            </div>

            {screening.total_completed === 0 ? (
              <div className="analysis-empty-state">
                <p>No completed screenings yet.</p>
                <Link to="/screening" className="btn btn-sm btn-primary">Take Screening</Link>
              </div>
            ) : (
              <>
                <div className="stat-row">
                  <span className="stat-label">Sessions Completed</span>
                  <span className="stat-value">{screening.total_completed}</span>
                </div>

                {screening.latest_ml_label && (
                  <div className="stat-block">
                    <div className="stat-row">
                      <span className="stat-label">AI Assessment</span>
                      <span className={`stat-badge badge-${mlLabelColor(screening.latest_ml_label)}`}>
                        {mlLabelText(screening.latest_ml_label)}
                      </span>
                    </div>
                  </div>
                )}

                {screening.latest_risk_level && (
                  <div className="stat-block">
                    <div className="stat-row">
                      <span className="stat-label">AQ Score Risk</span>
                      <span className={`stat-badge badge-${riskColor(screening.latest_risk_level)}`}>
                        {screening.latest_risk_level?.charAt(0).toUpperCase() + screening.latest_risk_level?.slice(1)} Risk
                        {screening.latest_raw_score != null && ` (${screening.latest_raw_score}/10)`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Screening history timeline */}
                {screening.history.length > 1 && (
                  <div className="trend-section">
                    <h4>Score History</h4>
                    <div className="trend-bars">
                      {[...screening.history].reverse().map((s, i) => (
                        <div key={s.id} className="trend-bar-col">
                          <div className="trend-bar-track">
                            <div
                              className={`trend-bar-fill trend-bar-${riskColor(s.risk_level)}-bar`}
                              style={{ height: `${((s.raw_score || 0) / 10) * 100}%` }}
                            />
                          </div>
                          <span className="trend-bar-label">#{i + 1}</span>
                          <span className="trend-bar-val">{s.raw_score ?? '–'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="analysis-card-actions">
                  <Link to="/screening" className="btn btn-sm btn-primary">New Screening</Link>
                  <Link to="/screening/history" className="btn btn-sm btn-secondary">View History →</Link>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Disclaimer */}
        <div className="analysis-disclaimer">
          <strong>Note:</strong> These insights are derived from your self-reported journal entries and AQ-10 screening responses.
          They are not a clinical diagnosis. If you have concerns, please consult a qualified healthcare professional.
        </div>
      </div>
    </div>
  )
}
