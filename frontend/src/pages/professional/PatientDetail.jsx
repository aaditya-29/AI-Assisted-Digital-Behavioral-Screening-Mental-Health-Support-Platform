import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NavBar from '../../components/NavBar'
import './PatientDetail.css'

const EMPTY_RESOURCE = { title: '', type: 'article', description: '', content_or_url: '' }

export default function PatientDetail() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const { logout } = useAuth()
  const navigate = useNavigate()

  // Resources state
  const [patientResources, setPatientResources] = useState([])
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [resourceForm, setResourceForm] = useState(EMPTY_RESOURCE)
  const [resourceSubmitting, setResourceSubmitting] = useState(false)
  const [resourceError, setResourceError] = useState(null)

  // Journal state
  const [journals, setJournals] = useState([])
  const [journalsLoading, setJournalsLoading] = useState(false)
  const [showJournals, setShowJournals] = useState(false)
  const [expandedJournals, setExpandedJournals] = useState({})

  // Screening detail modal state
  const [screeningDetail, setScreeningDetail] = useState(null)
  const [screeningDetailLoading, setScreeningDetailLoading] = useState(false)
  const [showScreeningModal, setShowScreeningModal] = useState(false)

  useEffect(() => { fetchDetail(); fetchPatientResources() }, [id])

  const fetchDetail = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/professional/patients/${id}`)
      setPatient(res.data)
    } catch (err) {
      console.error(err)
      setError('Failed to load patient')
    } finally {
      setLoading(false)
    }
  }

  const fetchPatientResources = async () => {
    try {
      const res = await api.get(`/resources/patient/${id}`)
      setPatientResources(res.data || [])
    } catch (err) {
      console.error('Failed to load patient resources', err)
    }
  }

  const fetchJournals = async () => {
    try {
      setJournalsLoading(true)
      const res = await api.get(`/journal/patient/${id}/entries`)
      setJournals(res.data || [])
    } catch (err) {
      console.error('Failed to load journals', err)
      setJournals([])
    } finally {
      setJournalsLoading(false)
    }
  }

  const handleToggleJournals = () => {
    if (!showJournals) fetchJournals()
    setShowJournals(v => !v)
  }

  const fetchScreeningDetail = async (sessionId) => {
    setScreeningDetailLoading(true)
    setScreeningDetail(null)
    setShowScreeningModal(true)
    try {
      const res = await api.get(`/professional/patients/${id}/screenings/${sessionId}`)
      setScreeningDetail(res.data)
    } catch (err) {
      console.error('Failed to load screening detail', err)
      setScreeningDetail({ error: 'Failed to load screening details' })
    } finally {
      setScreeningDetailLoading(false)
    }
  }

  const closeScreeningModal = () => {
    setShowScreeningModal(false)
    setScreeningDetail(null)
  }

  const getProbabilityColor = (label) => {
    switch (label?.toLowerCase()) {
      case 'low': return 'green'
      case 'moderate': return 'yellow'
      case 'high': return 'orange'
      case 'very_high': return 'red'
      default: return 'gray'
    }
  }

  const addNote = async () => {
    if (!note.trim()) return
    try {
      await api.post(`/professional/patients/${id}/notes`, { content: note })
      setNote('')
      fetchDetail()
    } catch (err) {
      console.error(err)
      alert('Failed to add note')
    }
  }

  const handleResourceSubmit = async (e) => {
    e.preventDefault()
    if (!resourceForm.title.trim()) { setResourceError('Title is required'); return }
    setResourceSubmitting(true)
    setResourceError(null)
    try {
      await api.post('/resources/patient', { ...resourceForm, patient_id: Number(id) })
      setResourceForm(EMPTY_RESOURCE)
      setShowResourceForm(false)
      fetchPatientResources()
    } catch (err) {
      setResourceError(err?.response?.data?.detail || 'Failed to upload resource')
    } finally {
      setResourceSubmitting(false)
    }
  }

  const deleteResource = async (resourceId) => {
    if (!confirm('Delete this resource?')) return
    try {
      await api.delete(`/resources/${resourceId}`)
      fetchPatientResources()
    } catch { alert('Failed to delete resource') }
  }

  const moodEmoji = (score) => {
    if (!score) return '—'
    if (score >= 8) return '😄'
    if (score >= 6) return '🙂'
    if (score >= 4) return '😐'
    if (score >= 2) return '😔'
    return '😢'
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  if (loading) return (
    <div className="patient-detail-page">
      <div style={{ padding: 80, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
    </div>
  )

  if (error) return (
    <div className="patient-detail-page">
      <div style={{ padding: 80, textAlign: 'center', color: 'var(--error)' }}>{error}</div>
    </div>
  )

  return (
    <div className="patient-detail-page">
      <NavBar />

      <div className="page-content">
        <Link to="/professional/patients" className="back-link">← Back to Patients</Link>

        <div className="patient-header">
          <div className="patient-header-avatar">{(patient.first_name?.[0] || '?').toUpperCase()}</div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>{patient.first_name} {patient.last_name}</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Shared {new Date(patient.consultation_date).toLocaleString()}</p>
          </div>
        </div>

        <div className="section-card">
          <h2>Latest Analysis</h2>
          {patient.latest_analysis ? (
            <div className="analysis-row">
              <div className="analysis-item">
                <span className="analysis-label">Composite Score</span>
                <span className="analysis-value">{patient.latest_analysis.composite_score}</span>
              </div>
              <div className="analysis-item">
                <span className="analysis-label">Trend</span>
                <span className="analysis-value">{patient.latest_analysis.trend_direction}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No analysis available yet.</p>
          )}
        </div>

        <div className="section-card">
          <h2>Recent Screenings</h2>
          {patient.screenings && patient.screenings.length > 0 ? (
            <div className="screening-list">
              {patient.screenings.map(s => (
                <div key={s.id} className="screening-entry">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="screening-date">{new Date(s.completed_at).toLocaleString()}</div>
                    <div className="screening-entry-info">
                      <span>Score: <strong>{s.raw_score}/10</strong></span>
                      {s.family_asd && <span>Family ASD: <strong>{s.family_asd}</strong></span>}
                      {s.jaundice && <span>Jaundice: <strong>{s.jaundice}</strong></span>}
                      {s.completed_by && <span>Completed by: <strong>{s.completed_by}</strong></span>}
                      {s.age_group_used && <span>Age group: <strong>{s.age_group_used}</strong></span>}
                    </div>
                    {s.ml_probability != null && (
                      <div className="ai-prob-row">
                        <div className="ai-prob-bar">
                          <div className={`ai-prob-fill ${s.ml_probability_label || ''}`} style={{ width: `${Math.round((s.ml_probability || 0) * 100)}%` }}></div>
                        </div>
                        <div className="ai-prob-meta">
                          <span className="ai-percent">{(s.ml_probability * 100).toFixed(1)}%</span>
                          <span className="ai-label">{s.ml_probability_label?.replace('_', ' ')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className={`badge badge-${s.risk_level === 'low' ? 'success' : s.risk_level === 'high' ? 'error' : 'warning'}`}>{s.risk_level}</span>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => fetchScreeningDetail(s.id)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No screenings yet.</p>
          )}
        </div>

        <div className="section-card">
          <h2>Notes</h2>
          <div className="note-input-area">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Add a note about this patient…" />
            <div className="note-submit-row">
              <button onClick={addNote} className="btn btn-primary">Add Note</button>
            </div>
          </div>

          {patient.notes && patient.notes.length > 0 ? (
            <div className="notes-list">
              {patient.notes.map(n => (
                <div key={n.id} className="note-entry">
                  <p className="note-content">{n.content}</p>
                  <span className="note-time">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No notes yet.</p>
          )}
        </div>

        {/* Patient Resources */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Patient Resources</h2>
            <button className="btn btn-sm btn-primary" onClick={() => setShowResourceForm(v => !v)}>
              {showResourceForm ? 'Cancel' : '+ Upload Resource'}
            </button>
          </div>

          {showResourceForm && (
            <form onSubmit={handleResourceSubmit} className="patient-resource-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Title *</label>
                  <input type="text" value={resourceForm.title} onChange={e => setResourceForm(p => ({ ...p, title: e.target.value }))} placeholder="Resource title" />
                </div>
                <div className="form-field">
                  <label>Type</label>
                  <select value={resourceForm.type} onChange={e => setResourceForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="exercise">Exercise</option>
                    <option value="guide">Guide</option>
                    <option value="tool">Tool</option>
                  </select>
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>URL or Content</label>
                  <input type="text" value={resourceForm.content_or_url} onChange={e => setResourceForm(p => ({ ...p, content_or_url: e.target.value }))} placeholder="https://… or text content" />
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea rows={2} value={resourceForm.description} onChange={e => setResourceForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description…" />
              </div>
              {resourceError && <div style={{ color: 'var(--error)', fontSize: 14 }}>{resourceError}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={resourceSubmitting}>{resourceSubmitting ? 'Uploading…' : 'Upload'}</button>
              </div>
            </form>
          )}

          {patientResources.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>No resources assigned to this patient yet.</p>
          ) : (
            <ul className="patient-resource-list">
              {patientResources.map(r => (
                <li key={r.id} className="patient-resource-item">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{r.description}</div>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.type}</span>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteResource(r.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Patient Journals */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showJournals ? 16 : 0 }}>
            <h2 style={{ margin: 0 }}>Patient Journals</h2>
            <button className="btn btn-sm btn-secondary" onClick={handleToggleJournals}>
              {showJournals ? 'Hide' : 'View Shared Entries'}
            </button>
          </div>

          {showJournals && (
            journalsLoading ? (
              <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
            ) : journals.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>No shared journal entries from this patient.</p>
            ) : (
              <div className="journal-entries-list">
                {journals.map(j => (
                  <div key={j.id} className="journal-entry-item">
                    <div className="journal-entry-header">
                      <span className="journal-entry-date">{new Date(j.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {j.mood_score && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{moodEmoji(j.mood_score)} Mood: {j.mood_score}/10</span>}
                        {j.stress_score && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>⚡ Stress: {j.stress_score}/10</span>}
                      </div>
                    </div>
                    <p className={`journal-entry-content ${!expandedJournals[j.id] && j.content?.length > 200 ? 'clamped' : ''}`}>{j.content}</p>
                    {j.content?.length > 200 && (
                      <button className="read-more-btn" onClick={() => setExpandedJournals(prev => ({ ...prev, [j.id]: !prev[j.id] }))}>
                        {expandedJournals[j.id] ? 'Show Less' : 'Read More'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Screening Detail Modal */}
      {showScreeningModal && (
        <div className="modal-overlay" onClick={closeScreeningModal}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Screening Details</h3>
              <button className="modal-close-btn" onClick={closeScreeningModal}>✕</button>
            </div>
            <div className="modal-body">
              {screeningDetailLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                  <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading…</p>
                </div>
              )}
              {!screeningDetailLoading && screeningDetail?.error && (
                <div style={{ color: 'var(--error)', textAlign: 'center', padding: 32 }}>{screeningDetail.error}</div>
              )}
              {!screeningDetailLoading && screeningDetail && !screeningDetail.error && (
                <>
                  {/* Pre-screening info */}
                  <div className="modal-section">
                    <h4>Pre-Screening Information</h4>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{new Date(screeningDetail.completed_at).toLocaleString()}</span></div>
                      <div className="detail-item"><span className="detail-label">Score</span><span className="detail-value">{screeningDetail.raw_score}/10</span></div>
                      <div className="detail-item"><span className="detail-label">Risk Level</span><span className={`badge badge-${screeningDetail.risk_level === 'low' ? 'success' : screeningDetail.risk_level === 'high' ? 'error' : 'warning'}`}>{screeningDetail.risk_level}</span></div>
                      <div className="detail-item"><span className="detail-label">Age Group</span><span className="detail-value">{screeningDetail.age_group_used || '—'}</span></div>
                      <div className="detail-item"><span className="detail-label">Family with ASD</span><span className="detail-value">{screeningDetail.family_asd || '—'}</span></div>
                      <div className="detail-item"><span className="detail-label">Born with Jaundice</span><span className="detail-value">{screeningDetail.jaundice || '—'}</span></div>
                      <div className="detail-item"><span className="detail-label">Completed by</span><span className="detail-value">{screeningDetail.completed_by || '—'}</span></div>
                    </div>
                  </div>

                  {/* AI Assessment */}
                  {screeningDetail.ml_probability != null && (
                    <div className="modal-section">
                      <h4>AI Assessment</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Probability</span>
                          <span className="detail-value" style={{ fontWeight: 700, fontSize: 18 }}>
                            {(screeningDetail.ml_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Label</span>
                          <span className={`badge badge-${getProbabilityColor(screeningDetail.ml_probability_label) === 'green' ? 'success' : getProbabilityColor(screeningDetail.ml_probability_label) === 'red' ? 'error' : 'warning'}`}>
                            {screeningDetail.ml_probability_label?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Q&A Responses */}
                  {screeningDetail.responses && screeningDetail.responses.length > 0 && (
                    <div className="modal-section">
                      <h4>Questionnaire Responses</h4>
                      <div className="responses-detail-list">
                        {screeningDetail.responses.map((r, i) => (
                          <div key={i} className="response-detail-item">
                            <div className="response-detail-q">
                              <span className="q-number">Q{i + 1}</span>
                              <span className="q-text">{r.question_text}</span>
                            </div>
                            <div className="response-detail-a">
                              <span className="a-text">{r.selected_option_text}</span>
                              <span className={`a-score ${r.score_value > 0 ? 'scored' : ''}`}>
                                {r.score_value > 0 ? `+${r.score_value}` : '0'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

