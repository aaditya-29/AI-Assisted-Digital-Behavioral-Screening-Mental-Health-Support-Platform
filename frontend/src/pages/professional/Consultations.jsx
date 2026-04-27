import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NavBar from '../../components/NavBar'
import Modal from '../../components/Modal'
import './Consultations.css'
import { formatDateTimeIST } from '../../utils/formatDate'

function Consultations() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })
  const { logout } = useAuth()
  const navigate = useNavigate()

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const res = await api.get('/professional/consultations')
      setRequests(res.data || [])
    } catch (err) {
      console.error(err)
      setError('Failed to load consultation requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/professional/consultations/${id}`, { status })
      fetchRequests()
    } catch (err) {
      console.error(err)
      setModal({ open: true, title: 'Error', message: 'Failed to update request', onClose: () => setModal({ ...modal, open: false }) })
    }
  }

  const toggleDetails = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="consultations-page">
      <NavBar />

      <div className="page-content">
        <h1 className="page-title">Consultation Requests</h1>
        <p className="page-subtitle">Manage data-sharing requests sent to you by users.</p>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--error)' }}>{error}</div>
        ) : (
          <div className="section-card">
            {requests.length === 0 ? (
              <div className="empty-msg">No consultation requests yet.</div>
            ) : (
              <div className="request-list">
                {requests.map(r => (
                  <div key={r.id} className="request-card">
                    <div className="request-header">
                      <div className="request-user">{r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : `User #${r.user_id}`}</div>
                      <span className={`request-status status-${r.status}`}>{r.status}</span>
                    </div>
                    {r.message && <div className="request-msg">"{r.message}"</div>}
                    <div className="request-date">Requested: {formatDateTimeIST(r.created_at)}</div>

                    {/* View Details toggle */}
                    <button className="btn-view-details" onClick={() => toggleDetails(r.id)}>
                      {expandedIds.has(r.id) ? '▾ Hide Details' : '▸ View Details'}
                    </button>

                    {/* Patient screening summary (shown on expand) */}
                    {expandedIds.has(r.id) && (
                      <div className="patient-screening-summary">
                        {r.screening_count > 0 ? (
                          <>
                            <div className="screening-summary-row">
                              <span className="screening-summary-label">Screenings completed:</span>
                              <span className="screening-summary-value">{r.screening_count}</span>
                            </div>
                            {r.last_risk_level && (
                              <div className="screening-summary-row">
                                <span className="screening-summary-label">Latest risk level:</span>
                                <span className={`screening-risk-badge risk-${r.last_risk_level}`}>{r.last_risk_level}</span>
                              </div>
                            )}
                            {r.last_ml_probability_label && (
                              <div className="screening-summary-row">
                                <span className="screening-summary-label">ML probability:</span>
                                <span className={`screening-risk-badge risk-${r.last_ml_probability_label.replace('_', '-')}`}>{r.last_ml_probability_label.replace('_', ' ')}</span>
                              </div>
                            )}
                            {r.last_raw_score !== null && r.last_raw_score !== undefined && (
                              <div className="screening-summary-row">
                                <span className="screening-summary-label">AQ-10 score:</span>
                                <span className="screening-summary-value">{r.last_raw_score} / 10</span>
                              </div>
                            )}
                            {r.last_screening_date && (
                              <div className="screening-summary-row">
                                <span className="screening-summary-label">Last screened:</span>
                                <span className="screening-summary-value">{formatDateTimeIST(r.last_screening_date)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="screening-none-msg">No screenings completed yet</div>
                        )}
                      </div>
                    )}

                    <div className="request-actions">
                      {r.status === 'pending' && (
                        <>
                          <button className="btn-accept" onClick={() => updateStatus(r.id, 'accepted')}>✓ Accept</button>
                          <button className="btn-reject" onClick={() => updateStatus(r.id, 'declined')}>✕ Decline</button>
                        </>
                      )}
                      <Link to={`/professional/patients/${r.user_id}`} className="btn btn-outline btn-sm">View Patient</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Modal {...modal} />
    </div>
  )
}

export default Consultations
