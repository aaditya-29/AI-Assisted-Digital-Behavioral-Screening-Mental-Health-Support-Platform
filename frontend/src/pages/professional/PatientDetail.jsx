import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NavBar from '../../components/NavBar'
import Modal from '../../components/Modal'
import './PatientDetail.css'

const EMPTY_RESOURCE = { title: '', type: 'article', description: '', content_or_url: '' }

export default function PatientDetail() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })
  const { logout } = useAuth()
  const navigate = useNavigate()

  // Resources state
  const [patientResources, setPatientResources] = useState([])
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [resourceForm, setResourceForm] = useState(EMPTY_RESOURCE)
  const [resourceSubmitting, setResourceSubmitting] = useState(false)
  const [resourceError, setResourceError] = useState(null)

  // Global resources browse & recommend
  const [globalResources, setGlobalResources] = useState([])
  const [showGlobalResources, setShowGlobalResources] = useState(false)
  const [globalResourcesLoading, setGlobalResourcesLoading] = useState(false)
  const [recommendingId, setRecommendingId] = useState(null)
  const [recommendedIds, setRecommendedIds] = useState(new Set())
  const [globalFilter, setGlobalFilter] = useState('')

  // Journal state
  const [journals, setJournals] = useState([])
  const [journalsLoading, setJournalsLoading] = useState(false)
  const [showJournals, setShowJournals] = useState(false)
  const [expandedJournals, setExpandedJournals] = useState({})

  // Screening detail modal state
  const [screeningDetail, setScreeningDetail] = useState(null)
  const [screeningDetailLoading, setScreeningDetailLoading] = useState(false)
  const [showScreeningModal, setShowScreeningModal] = useState(false)

  // Task analytics state
  const [taskAnalytics, setTaskAnalytics] = useState(null)
  const [taskAnalyticsLoading, setTaskAnalyticsLoading] = useState(false)

  // AI Recommendations state
  const [patientRecs, setPatientRecs] = useState(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [dismissingRecId, setDismissingRecId] = useState(null)
  const [dismissComment, setDismissComment] = useState('')
  const [showDismissModal, setShowDismissModal] = useState(null) // rec id or null

  useEffect(() => { fetchDetail(); fetchPatientResources(); fetchTaskAnalytics(); fetchPatientRecs() }, [id])

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

  const fetchTaskAnalytics = async () => {
    try {
      setTaskAnalyticsLoading(true)
      const res = await api.get(`/professional/patients/${id}/task-analytics`)
      setTaskAnalytics(res.data)
    } catch (err) {
      console.error('Failed to load task analytics', err)
    } finally {
      setTaskAnalyticsLoading(false)
    }
  }

  const fetchPatientRecs = async () => {
    try {
      setRecsLoading(true)
      const res = await api.get(`/professional/patients/${id}/recommendations`)
      setPatientRecs(res.data)
    } catch (err) {
      console.error('Failed to load patient recommendations', err)
    } finally {
      setRecsLoading(false)
    }
  }

  const handleDismissRec = async (recId) => {
    if (!dismissComment.trim()) return
    setDismissingRecId(recId)
    try {
      await api.patch(`/professional/patients/${id}/recommendations/${recId}/dismiss`, {
        comment: dismissComment.trim()
      })
      setShowDismissModal(null)
      setDismissComment('')
      fetchPatientRecs()
    } catch (err) {
      setModal({ open: true, title: 'Error', message: err?.response?.data?.detail || 'Failed to dismiss recommendation', onClose: () => setModal({ ...modal, open: false }) })
    } finally {
      setDismissingRecId(null)
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
      setModal({ open: true, title: 'Error', message: 'Failed to add note', onClose: () => setModal({ ...modal, open: false }) })
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
    setModal({
      open: true,
      title: 'Confirm Delete',
      message: 'Delete this resource?',
      onClose: () => setModal({ ...modal, open: false }),
      primaryAction: {
        label: 'Delete',
        onClick: async () => {
          setModal({ ...modal, open: false })
          try {
            await api.delete(`/resources/${resourceId}`)
            fetchPatientResources()
          } catch {
            setModal({ open: true, title: 'Error', message: 'Failed to delete resource', onClose: () => setModal({ ...modal, open: false }) })
          }
        }
      },
      secondaryAction: {
        label: 'Cancel',
        onClick: () => setModal({ ...modal, open: false })
      }
    })
  }

  const fetchGlobalResources = async () => {
    if (globalResources.length > 0) return // already loaded
    setGlobalResourcesLoading(true)
    try {
      const res = await api.get('/resources/global')
      setGlobalResources(res.data || [])
    } catch (err) {
      console.error('Failed to load global resources', err)
    } finally {
      setGlobalResourcesLoading(false)
    }
  }

  const handleToggleGlobalResources = () => {
    if (!showGlobalResources) fetchGlobalResources()
    setShowGlobalResources(v => !v)
  }

  const recommendResource = async (resourceId) => {
    setRecommendingId(resourceId)
    try {
      await api.post(`/resources/recommend/${id}/${resourceId}`)
      setRecommendedIds(prev => new Set([...prev, resourceId]))
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to recommend resource'
      if (err?.response?.status === 409) {
        // Already recommended — mark it locally
        setRecommendedIds(prev => new Set([...prev, resourceId]))
      } else {
        setModal({ open: true, title: 'Error', message: detail, onClose: () => setModal({ ...modal, open: false }) })
      }
    } finally {
      setRecommendingId(null)
    }
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
    <>
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

        {/* ── Patient Overview ── */}
        {(() => {
          const latestS = patient.screenings?.[0]
          const totalScreenings = patient.screenings?.length || 0
          const riskColors = { low: '#10b981', moderate: '#f59e0b', high: '#ef4444' }
          const riskBg    = { low: '#dcfce7', moderate: '#fef3c7', high: '#fee2e2' }
          const mlLabels  = { low: 'Low Likelihood', moderate: 'Moderate Likelihood', high: 'High Likelihood', very_high: 'Very High Likelihood' }
          const mlColors  = { low: '#10b981', moderate: '#f59e0b', high: '#f97316', very_high: '#ef4444' }
          return (
            <div className="section-card">
              <h2>Patient Overview</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                {/* Screenings count */}
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Screenings</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{totalScreenings}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>completed</div>
                </div>
                {/* Latest risk */}
                {latestS && (
                  <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Latest Risk</div>
                    <span style={{
                      display: 'inline-block', fontSize: 13, fontWeight: 800, padding: '4px 12px', borderRadius: 20,
                      background: riskBg[latestS.risk_level] || '#f1f5f9',
                      color: riskColors[latestS.risk_level] || '#64748b',
                    }}>
                      {latestS.risk_level ? latestS.risk_level.charAt(0).toUpperCase() + latestS.risk_level.slice(1) : '—'}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Score: {latestS.raw_score ?? '—'}/10</div>
                  </div>
                )}
                {/* ML assessment */}
                {latestS?.ml_probability_label && (
                  <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>AI Assessment</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: mlColors[latestS.ml_probability_label] || '#64748b' }}>
                      {mlLabels[latestS.ml_probability_label] || latestS.ml_probability_label}
                    </div>
                    {latestS.ml_probability != null && (
                      <div style={{ marginTop: 8, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(latestS.ml_probability * 100)}%`, background: mlColors[latestS.ml_probability_label] || '#6366f1', borderRadius: 4 }} />
                      </div>
                    )}
                  </div>
                )}
                {/* Last active */}
                {latestS && (
                  <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Last Screening</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {new Date(latestS.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {latestS.age_group_used ? `Age group: ${latestS.age_group_used}` : 'No age group recorded'}
                    </div>
                  </div>
                )}
                {/* Task sessions */}
                {taskAnalytics && taskAnalytics.total_sessions > 0 && (
                  <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Task Sessions</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{taskAnalytics.total_sessions}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>across {Object.keys(taskAnalytics.pillar_analytics || {}).length} pillars</div>
                  </div>
                )}
                {/* No data state */}
                {totalScreenings === 0 && (
                  <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: 14 }}>No data available yet. The patient hasn't completed any screenings.</div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── AI Recommendations ── */}
        <div className="section-card">
          <h2>AI Recommendations</h2>
          {recsLoading && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          )}
          {!recsLoading && (!patientRecs || patientRecs.recommendations?.length === 0) && (
            <p style={{ color: 'var(--text-muted)' }}>No AI recommendations for this patient yet.</p>
          )}
          {!recsLoading && patientRecs && patientRecs.recommendations?.length > 0 && (
            <>
              {patientRecs.summary && (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>AI Summary</div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, color: 'var(--text-primary)' }}>{patientRecs.summary}</p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {patientRecs.recommendations.map(r => {
                  const catMatch = r.reason.match(/^\[(\w+)\]\s*(.*)/)
                  const category = catMatch?.[1] || null
                  const reason = catMatch?.[2] || r.reason
                  const isResource = category === 'resource'
                  const statusColors = { pending: '#f59e0b', completed: '#10b981', dismissed: '#94a3b8' }
                  const statusBg = { pending: '#fef3c7', completed: '#dcfce7', dismissed: '#f1f5f9' }

                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                      padding: 14, opacity: r.status === 'dismissed' ? 0.6 : 1,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          {category && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: isResource ? '#e0e7ff' : 'rgba(99,102,241,0.1)', color: isResource ? '#4f46e5' : 'var(--primary)',
                              padding: '2px 8px', borderRadius: 20,
                            }}>
                              {isResource ? '📎 Resource' : category.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span style={{
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            background: statusBg[r.status] || '#f1f5f9',
                            color: statusColors[r.status] || '#64748b',
                            padding: '2px 8px', borderRadius: 20,
                          }}>
                            {r.status}
                          </span>
                        </div>
                        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: 'var(--text-primary)' }}>{reason}</p>
                        {r.comment && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                            💬 {r.comment}
                          </p>
                        )}
                      </div>
                      {r.status === 'pending' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ flexShrink: 0, fontSize: 12 }}
                          onClick={() => { setShowDismissModal(r.id); setDismissComment('') }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Task Performance Analytics ── */}
        <div className="section-card">
          <h2>Cognitive Task Performance</h2>
          {taskAnalyticsLoading && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: 10, color: 'var(--text-muted)' }}>Loading task analytics…</p>
            </div>
          )}
          {!taskAnalyticsLoading && (!taskAnalytics || taskAnalytics.total_sessions === 0) && (
            <p style={{ color: 'var(--text-muted)' }}>No completed cognitive tasks yet.</p>
          )}
          {!taskAnalyticsLoading && taskAnalytics && taskAnalytics.total_sessions > 0 && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <strong>{taskAnalytics.total_sessions}</strong> sessions completed across{' '}
                {Object.keys(taskAnalytics.pillar_analytics).length} pillars
              </div>

              {Object.entries(taskAnalytics.pillar_analytics).map(([pk, pv]) => {
                const pillarIcons = { executive_function: '🧠', social_cognition: '🤝', joint_attention: '👁️', sensory_processing: '🎧' }
                const pillarColors = { executive_function: '#6366f1', social_cognition: '#f59e0b', joint_attention: '#10b981', sensory_processing: '#ec4899' }
                const pColor = pillarColors[pk] || '#6366f1'
                return (
                  <div key={pk} style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{pillarIcons[pk] || '📊'}</span> {pv.label}
                      </h3>
                      <span style={{
                        fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                        background: pv.avg_improvement_pct >= 0 ? '#dcfce7' : '#fee2e2',
                        color: pv.avg_improvement_pct >= 0 ? '#15803d' : '#b91c1c',
                      }}>
                        {pv.avg_improvement_pct > 0 ? '+' : ''}{pv.avg_improvement_pct}%
                      </span>
                    </div>

                    {pv.tasks.map(task => {
                      const trendUp = task.trend.includes('improvement')
                      const trendDown = task.trend.includes('decline')
                      // Build SVG chart
                      const chartData = task.weekly_progression || []
                      const hasChart = chartData.length > 0
                      const vals = chartData.map(d => d.avg)
                      const maxV = Math.max(...vals, 1)
                      const minV = Math.min(...vals, 0)
                      const rangeV = maxV - minV || 1
                      const cW = Math.max(chartData.length * 60, 200)
                      const cH = 80
                      const pad = { l: 30, r: 15, t: 14, b: 18 }
                      const ptsArr = chartData.map((d, i) => ({
                        x: pad.l + (chartData.length === 1 ? (cW - pad.l - pad.r) / 2 : (i / (chartData.length - 1)) * (cW - pad.l - pad.r)),
                        y: pad.t + (cH - pad.t - pad.b) - ((d.avg - minV) / rangeV) * (cH - pad.t - pad.b),
                      }))

                      return (
                        <div key={task.category} style={{
                          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                          padding: 16, marginBottom: 10,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <strong style={{ fontSize: 14 }}>{task.task_name}</strong>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                              background: trendUp ? '#dcfce7' : trendDown ? '#fee2e2' : '#f1f5f9',
                              color: trendUp ? '#15803d' : trendDown ? '#b91c1c' : '#64748b',
                            }}>
                              {trendUp ? '↗' : trendDown ? '↘' : '→'} {task.trend.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, fontSize: 12, marginBottom: hasChart ? 10 : 0 }}>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Metric</div>
                              <div style={{ color: pColor, fontWeight: 700, textTransform: 'capitalize' }}>{task.primary_metric.replace(/_/g, ' ')}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>First → Latest</div>
                              <div style={{ fontWeight: 600 }}>{task.first_value} → <strong>{task.latest_value}</strong></div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Change</div>
                              <div style={{ fontWeight: 800, color: task.improvement_pct > 0 ? '#22c55e' : task.improvement_pct < 0 ? '#ef4444' : 'inherit' }}>
                                {task.improvement_pct > 0 ? '+' : ''}{task.improvement_pct}%
                              </div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Sessions</div>
                              <div style={{ fontWeight: 600 }}>{task.total_sessions} (Lv.{task.max_difficulty_reached})</div>
                            </div>
                          </div>

                          {task.rtcv != null && (
                            <div style={{ fontSize: 12, color: task.rtcv > 30 ? '#f59e0b' : 'var(--text-muted)', marginBottom: 8 }}>
                              RTCV: <strong>{task.rtcv}%</strong> {task.rtcv > 30 && '⚠️ High variability — consider shorter sessions'}
                            </div>
                          )}

                          {/* SVG Line Chart */}
                          {hasChart && (
                            <div style={{ overflow: 'auto', background: '#fafbfd', borderRadius: 8, border: '1px solid #f1f5f9', padding: 2 }}>
                              <svg viewBox={`0 0 ${cW} ${cH}`} width="100%" height={cH}>
                                <defs>
                                  <linearGradient id={`pg-${pk}-${task.category}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={pColor} stopOpacity="0.2" />
                                    <stop offset="100%" stopColor={pColor} stopOpacity="0.02" />
                                  </linearGradient>
                                </defs>
                                {/* Grid */}
                                <line x1={pad.l} y1={pad.t} x2={cW - pad.r} y2={pad.t} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3" />
                                <line x1={pad.l} y1={(pad.t + cH - pad.b) / 2} x2={cW - pad.r} y2={(pad.t + cH - pad.b) / 2} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3" />
                                <line x1={pad.l} y1={cH - pad.b} x2={cW - pad.r} y2={cH - pad.b} stroke="#e2e8f0" strokeWidth="1" />
                                {/* Area */}
                                {ptsArr.length > 1 && (
                                  <path
                                    d={`${ptsArr.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')} L${ptsArr[ptsArr.length-1].x},${cH - pad.b} L${ptsArr[0].x},${cH - pad.b} Z`}
                                    fill={`url(#pg-${pk}-${task.category})`}
                                  />
                                )}
                                {/* Line */}
                                {ptsArr.length > 1 && (
                                  <path
                                    d={ptsArr.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                                    fill="none" stroke={pColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                  />
                                )}
                                {/* Points + Labels */}
                                {ptsArr.map((p, i) => (
                                  <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={pColor} strokeWidth="2" />
                                    <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="8" fontWeight="700" fill="#1e293b">{chartData[i].avg}</text>
                                    <text x={p.x} y={cH - 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="#94a3b8">{chartData[i].week}</text>
                                  </g>
                                ))}
                              </svg>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-secondary" onClick={handleToggleGlobalResources}>
                {showGlobalResources ? 'Hide Library' : '📚 Browse Library'}
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => setShowResourceForm(v => !v)}>
                {showResourceForm ? 'Cancel' : '+ Upload Resource'}
              </button>
            </div>
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

          {/* Global Resource Library Panel */}
          {showGlobalResources && (
            <div className="global-resource-panel">
              <div className="global-resource-panel-header">
                <span style={{ fontWeight: 700, fontSize: 14 }}>Global Resource Library</span>
                <input
                  className="global-resource-search"
                  type="text"
                  placeholder="Search resources…"
                  value={globalFilter}
                  onChange={e => setGlobalFilter(e.target.value)}
                />
              </div>
              {globalResourcesLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                </div>
              ) : globalResources.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>No global resources available.</p>
              ) : (
                <ul className="global-resource-list">
                  {globalResources
                    .filter(r =>
                      !globalFilter ||
                      r.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
                      (r.description || '').toLowerCase().includes(globalFilter.toLowerCase()) ||
                      r.type.toLowerCase().includes(globalFilter.toLowerCase())
                    )
                    .map(r => {
                      const isRecommended = recommendedIds.has(r.id)
                      const isLoading = recommendingId === r.id
                      const typeColors = { article: '#6366f1', video: '#f59e0b', exercise: '#10b981', guide: '#3b82f6', tool: '#ec4899' }
                      return (
                        <li key={r.id} className="global-resource-item">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                              <span className="resource-type-badge" style={{ background: typeColors[r.type] || '#6366f1' }}>
                                {r.type}
                              </span>
                              {r.target_risk_level && (
                                <span className="resource-risk-badge">{r.target_risk_level}</span>
                              )}
                            </div>
                            {r.description && (
                              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>{r.description}</p>
                            )}
                            {r.content_or_url && (
                              <a href={r.content_or_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4, display: 'inline-block' }}>
                                View resource ↗
                              </a>
                            )}
                          </div>
                          <button
                            className={`btn btn-sm ${isRecommended ? 'btn-success-outline' : 'btn-primary'}`}
                            style={{ flexShrink: 0 }}
                            onClick={() => !isRecommended && !isLoading && recommendResource(r.id)}
                            disabled={isRecommended || isLoading}
                          >
                            {isLoading ? '…' : isRecommended ? '✓ Sent' : 'Recommend'}
                          </button>
                        </li>
                      )
                    })}
                </ul>
              )}
            </div>
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

      {/* Dismiss Recommendation Modal */}
      {showDismissModal && (
        <div className="modal-overlay" onClick={() => setShowDismissModal(null)}>
          <div className="modal-panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dismiss Recommendation</h3>
              <button className="modal-close-btn" onClick={() => setShowDismissModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Please provide a reason for dismissing this recommendation. This will be visible to the patient.
              </p>
              <textarea
                rows={4}
                value={dismissComment}
                onChange={e => setDismissComment(e.target.value)}
                placeholder="e.g. Patient has already shown improvement in this area…"
                style={{ width: '100%', fontSize: 14, padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowDismissModal(null)}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!dismissComment.trim() || dismissingRecId === showDismissModal}
                  onClick={() => handleDismissRec(showDismissModal)}
                >
                  {dismissingRecId === showDismissModal ? 'Dismissing…' : 'Dismiss with Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    <Modal {...modal} />
    </>
  )
}

