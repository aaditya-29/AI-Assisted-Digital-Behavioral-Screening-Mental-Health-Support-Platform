import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import NavBar from '../components/NavBar'
import './Resources.css'

const TYPE_ICONS = {
  article: '📄',
  video: '🎥',
  exercise: '🏃',
  guide: '📖',
  tool: '🛠️',
}

const RISK_COLORS = {
  low: 'badge-success',
  moderate: 'badge-warning',
  high: 'badge-error',
}

export default function Resources() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [resources, setResources] = useState([])
  const [profRecs, setProfRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [resRes, profRes] = await Promise.all([
        api.get('/resources'),
        api.get('/recommendations/professional').catch(() => ({ data: [] })),
      ])
      setResources(resRes.data || [])
      setProfRecs(profRes.data || [])
    } catch (err) {
      setError('Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  const completeRec = async (id) => {
    try {
      await api.patch(`/recommendations/${id}/complete`)
      setProfRecs(prev => prev.map(r => r.id === id ? { ...r, status: 'completed' } : r))
    } catch { /* ignore */ }
  }

  const dismissRec = async (id) => {
    try {
      await api.patch(`/recommendations/${id}/dismiss`)
      setProfRecs(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r))
    } catch { /* ignore */ }
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const filtered = filter
    ? resources.filter(r => r.type === filter)
    : resources

  const types = [...new Set(resources.map(r => r.type).filter(Boolean))]

  return (
    <div className="resources-user-page">
      <NavBar />

      <div className="page-content">
        <div className="resources-header-row">
          <div>
            <h1 className="page-title">Resources</h1>
            <p className="page-subtitle">Curated guides, articles, and tools to support your journey</p>
          </div>
          {types.length > 0 && (
            <div className="type-filters">
              <button className={`type-filter-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
              {types.map(t => (
                <button key={t} className={`type-filter-btn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
                  {TYPE_ICONS[t] || '📎'} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : error ? (
          <div className="error-msg">{error}</div>
        ) : (
          <>
            {/* ── Professional Recommended Resources ── */}
            {profRecs.length > 0 && (
              <div className="prof-recs-section" style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>👨‍⚕️ Recommended by Your Professional</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Resources your professional has specifically recommended for you.</p>
                <div className="resources-grid">
                  {profRecs.map(rec => {
                    const isPending = rec.status === 'pending'
                    const isCompleted = rec.status === 'completed'
                    const isDismissed = rec.status === 'dismissed'
                    const resource = rec.resource

                    const statusStyles = {
                      pending:   { bg: '#fef3c7', color: '#f59e0b', label: 'Pending' },
                      completed: { bg: '#dcfce7', color: '#10b981', label: 'Completed ✓' },
                      dismissed: { bg: '#f1f5f9', color: '#94a3b8', label: 'Dismissed' },
                    }
                    const sm = statusStyles[rec.status] || statusStyles.pending

                    const handleOpen = (url) => {
                      if (isPending) completeRec(rec.id)
                      if (url?.startsWith('http')) {
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }
                    }

                    // Clean the [resource] prefix from reason
                    const reason = rec.reason?.replace(/^\[resource\]\s*/i, '') || ''

                    return (
                      <div key={rec.id} className="resource-card" style={{ opacity: isDismissed ? 0.6 : 1 }}>
                        <div className="resource-card-header">
                          <span className="resource-type-icon">{resource ? (TYPE_ICONS[resource.type] || '📎') : '👨‍⚕️'}</span>
                          <div className="resource-card-badges">
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: sm.bg, color: sm.color,
                            }}>{sm.label}</span>
                            {resource?.type && <span className="resource-type-badge">{resource.type}</span>}
                          </div>
                        </div>
                        <h3 className="resource-card-title">{resource?.title || 'Professional Recommendation'}</h3>
                        {reason && <p className="resource-card-desc">{reason}</p>}
                        {resource?.description && !reason.includes(resource.description) && (
                          <p className="resource-card-desc" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{resource.description}</p>
                        )}
                        <div className="resource-card-footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {resource?.content_or_url?.startsWith('http') ? (
                            <button onClick={() => handleOpen(resource.content_or_url)} className="btn btn-sm btn-primary">
                              Open Resource →
                            </button>
                          ) : resource?.content_or_url ? (
                            <p className="resource-content-text">{resource.content_or_url}</p>
                          ) : null}
                          {isPending && (
                            <button onClick={() => dismissRec(rec.id)} className="btn btn-sm" style={{ background: '#f1f5f9', color: '#64748b' }}>
                              Dismiss
                            </button>
                          )}
                        </div>
                        {rec.comment && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                            💬 {rec.comment}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── All Resources ── */}
            {filtered.length === 0 && profRecs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">💡</span>
                <p>No resources available yet.</p>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Check back later for guides and materials.</p>
              </div>
            ) : filtered.length > 0 ? (
              <>
                {profRecs.length > 0 && (
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📚 All Resources</h2>
                )}
                <div className="resources-grid">
                  {filtered.map(resource => (
                    <div key={resource.id} className="resource-card">
                      <div className="resource-card-header">
                        <span className="resource-type-icon">{TYPE_ICONS[resource.type] || '📎'}</span>
                        <div className="resource-card-badges">
                          {resource.type && <span className="resource-type-badge">{resource.type}</span>}
                          {resource.target_risk_level && (
                            <span className={`badge ${RISK_COLORS[resource.target_risk_level] || 'badge-info'}`}>
                              {resource.target_risk_level}
                            </span>
                          )}
                          {resource.patient_id && <span className="assigned-badge">Assigned to you</span>}
                        </div>
                      </div>
                      <h3 className="resource-card-title">{resource.title}</h3>
                      {resource.description && (
                        <p className="resource-card-desc">{resource.description}</p>
                      )}
                      {resource.content_or_url && (
                        <div className="resource-card-footer">
                          {resource.content_or_url.startsWith('http') ? (
                            <a href={resource.content_or_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                              Open Resource →
                            </a>
                          ) : (
                            <p className="resource-content-text">{resource.content_or_url}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
