/**
 * Screening History Page
 * 
 * Shows user's past screening results.
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import screeningService from '../services/screeningService'
import NavBar from '../components/NavBar'
import Modal from '../components/Modal'
import './ScreeningHistory.css'

function ScreeningHistory() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const data = await screeningService.getHistory(20)
      setHistory(data.screenings)
    } catch (err) {
      setError('Failed to load screening history')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getRiskBadgeClass = (level) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'badge-green'
      case 'moderate': return 'badge-yellow'
      case 'high': return 'badge-red'
      default: return 'badge-gray'
    }
  }

  const getProbabilityBadgeClass = (label) => {
    switch (label?.toLowerCase()) {
      case 'low': return 'badge-green'
      case 'moderate': return 'badge-yellow'
      case 'high': return 'badge-orange'
      case 'very_high': return 'badge-red'
      default: return 'badge-gray'
    }
  }

  const handleDeleteIncomplete = async (sessionId) => {
    setModal({
      open: true,
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this incomplete screening?',
      onClose: () => setModal({ ...modal, open: false }),
      primaryAction: {
        label: 'Delete',
        onClick: async () => {
          setModal({ ...modal, open: false })
          try {
            await screeningService.deleteIncomplete(sessionId)
            fetchHistory()
          } catch (err) {
            setModal({ open: true, title: 'Error', message: 'Failed to delete screening', onClose: () => setModal({ ...modal, open: false }) })
          }
        }
      },
      secondaryAction: {
        label: 'Cancel',
        onClick: () => setModal({ ...modal, open: false })
      }
    })
  }

  if (loading) {
    return (
      <div className="history-container">
        <div className="history-loading">
          <div className="spinner"></div>
          <p>Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="history-container">
      <NavBar />
      <div className="history-content">
      <div className="history-header">
        <div>
          <h1>Screening History</h1>
          <p>View your past AQ-10 screening results</p>
        </div>
        <Link to="/screening" className="btn btn-primary">
          New Screening
        </Link>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={fetchHistory}>Retry</button>
        </div>
      )}

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>No Screenings Yet</h2>
          <p>Take your first AQ-10 screening to track your results over time.</p>
          <Link to="/screening" className="btn btn-primary">
            Start Screening
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {history.map((screening) => (
            <div 
              key={screening.id} 
              className={`history-card ${!screening.is_complete ? 'incomplete' : ''}`}
            >
              <div className="card-date">
                <span className="date-label">Started</span>
                <span className="date-value">
                  {new Date(screening.started_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {screening.is_complete ? (
                <>
                  <div className="card-score">
                    <span className="score-value">{screening.raw_score}</span>
                    <span className="score-label">/10</span>
                  </div>

                  <div className="card-risk">
                    <span className={`risk-badge ${getRiskBadgeClass(screening.risk_level)}`}>
                      {screening.risk_level}
                    </span>
                  </div>

                  {/* Pre-screening metadata */}
                  <div className="card-meta">
                    {screening.age_group_used && (
                      <span className="meta-chip">👤 {screening.age_group_used}</span>
                    )}
                    {screening.family_asd && (
                      <span className="meta-chip">🧬 Family ASD: {screening.family_asd}</span>
                    )}
                    {screening.jaundice && (
                      <span className="meta-chip">🟡 Jaundice: {screening.jaundice}</span>
                    )}
                    {screening.completed_by && (
                      <span className="meta-chip">📋 By: {screening.completed_by}</span>
                    )}
                  </div>

                  {/* AI probability */}
                  {screening.ml_risk_score != null && (
                    <div className="card-ai">
                      <span className="ai-label">AI Assessment:</span>
                      <span className="ai-prob">{(screening.ml_risk_score * 100).toFixed(1)}%</span>
                      {screening.ml_probability_label && (
                        <span className={`risk-badge ${getProbabilityBadgeClass(screening.ml_probability_label)}`} style={{ fontSize: 11 }}>
                          {screening.ml_probability_label.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="card-actions">
                    <button 
                      onClick={() => navigate(`/screening/results/${screening.id}`)}
                      className="btn btn-outline btn-small"
                    >
                      View Details
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="card-incomplete">
                    <span className="incomplete-badge">Incomplete</span>
                    <p>This screening was not finished</p>
                  </div>

                  <div className="card-actions">
                    <button 
                      onClick={() => navigate('/screening')}
                      className="btn btn-primary btn-small"
                    >
                      Resume
                    </button>
                    <button 
                      onClick={() => handleDeleteIncomplete(screening.id)}
                      className="btn btn-danger btn-small"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="history-footer">
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          Back to Dashboard
        </button>
      </div>
      </div>
      <Modal {...modal} />
    </div>
  )
}

export default ScreeningHistory
