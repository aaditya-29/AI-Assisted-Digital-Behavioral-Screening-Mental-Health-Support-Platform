import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NavBar from '../../components/NavBar'
import Modal from '../../components/Modal'
import './AdminResources.css'

const EMPTY_FORM = { title: '', type: 'article', target_risk_level: '', description: '', content_or_url: '' }

export default function AdminResources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])
  const [appsLoading, setAppsLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [modalState, setModalState] = useState(null)

  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { fetchResources(); fetchApplications() }, [])

  const fetchResources = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/resources')
      setResources(res.data || [])
    } catch (err) {
      console.error('Failed to load resources', err)
      setResources([])
    } finally {
      setLoading(false)
    }
  }

  const fetchApplications = async () => {
    try {
      setAppsLoading(true)
      const res = await api.get('/admin/professional-applications')
      setApplications(res.data || [])
    } catch (err) {
      console.error('Failed to load applications', err)
      setApplications([])
    } finally {
      setAppsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('Title is required'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      await api.post('/admin/resources', form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      fetchResources()
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Failed to create resource')
    } finally {
      setSubmitting(false)
    }
  }

  const closeModal = () => setModalState(null)

  const showMessageModal = ({ title, message }) => {
    setModalState({
      title,
      message,
      primaryAction: { label: 'Close', onClick: closeModal }
    })
  }

  const deleteResource = (id) => {
    setModalState({
      title: 'Delete resource',
      message: 'Delete this resource? This cannot be undone.',
      primaryAction: {
        label: 'Delete',
        onClick: async () => {
          closeModal()
          try {
            await api.delete(`/admin/resources/${id}`)
            fetchResources()
          } catch (err) {
            showMessageModal({ title: 'Delete failed', message: 'Failed to delete resource.' })
          }
        }
      },
      secondaryAction: { label: 'Cancel', onClick: closeModal }
    })
  }

  const verifyApplicant = (userId, firstName, lastName) => {
    setModalState({
      title: 'Verify professional',
      message: `Verify ${firstName} ${lastName} as a professional?`,
      primaryAction: {
        label: 'Verify',
        onClick: async () => {
          closeModal()
          try {
            await api.patch(`/admin/professionals/${userId}/verify`, { is_verified: true })
            fetchApplications()
            showMessageModal({ title: 'Verified', message: `${firstName} ${lastName} is now verified as a professional.` })
          } catch (err) {
            showMessageModal({ title: 'Verification failed', message: 'Failed to verify professional.' })
          }
        }
      },
      secondaryAction: { label: 'Cancel', onClick: closeModal }
    })
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const riskBadgeClass = (level) => level ? `badge badge-${level === 'low' ? 'success' : level === 'high' ? 'error' : 'warning'}` : 'badge badge-info'

  return (
    <div className="resources-page">
      <NavBar />

      <div className="page-content">
        {/* Professional Applications */}
        <section className="section-card" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Professional Applications</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{applications.length} pending</span>
          </div>
          {appsLoading ? (
            <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : applications.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No pending applications.</p>
          ) : (
            <div className="application-list">
              {applications.map(app => (
                <div key={app.id} className="application-item">
                  <div className="application-info">
                    <div className="application-name">{app.first_name} {app.last_name}</div>
                    <div className="application-email">{app.email}</div>
                    {app.license_number && <div className="application-meta">License: {app.license_number}</div>}
                    {app.specialty && <div className="application-meta">Specialty: {app.specialty}</div>}
                    {app.institution && <div className="application-meta">Institution: {app.institution}</div>}
                  </div>
                  <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: 'white', border: 'none', flexShrink: 0 }}
                    onClick={() => verifyApplicant(app.id, app.first_name, app.last_name)}>
                    Verify
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Resources */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Global Resources</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Create and manage resources visible to all users.</p>
          </div>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Resource</button>
          )}
        </div>

        {showForm && (
          <div className="section-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>New Resource</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Title *</label>
                  <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Resource title" />
                </div>
                <div className="form-field">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="exercise">Exercise</option>
                    <option value="guide">Guide</option>
                    <option value="tool">Tool</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Target Risk Level</label>
                  <select value={form.target_risk_level} onChange={e => setForm(p => ({ ...p, target_risk_level: e.target.value }))}>
                    <option value="">All users</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>URL or Content</label>
                  <input type="text" value={form.content_or_url} onChange={e => setForm(p => ({ ...p, content_or_url: e.target.value }))} placeholder="https://… or text content" />
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of this resource…" />
              </div>
              {formError && <div style={{ color: 'var(--error)', fontSize: 14 }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Create Resource'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="section-card">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : resources.length === 0 ? (
            <div className="empty-msg">No resources yet. Add one above.</div>
          ) : (
            <ul className="resource-list">
              {resources.map(r => (
                <li key={r.id} className="resource-item">
                  <div className="resource-item-body">
                    <div className="resource-title">{r.title}</div>
                    {r.description && <div className="resource-desc">{r.description}</div>}
                    <div className="resource-meta-row">
                      <span className="resource-type">{r.type || 'Resource'}</span>
                      {r.target_risk_level && <span className={riskBadgeClass(r.target_risk_level)}>{r.target_risk_level}</span>}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteResource(r.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {modalState && (
        <Modal
          open={!!modalState}
          title={modalState.title}
          message={modalState.message}
          onClose={closeModal}
          primaryAction={modalState.primaryAction}
          secondaryAction={modalState.secondaryAction}
        />
      )}
    </div>
  )
}
