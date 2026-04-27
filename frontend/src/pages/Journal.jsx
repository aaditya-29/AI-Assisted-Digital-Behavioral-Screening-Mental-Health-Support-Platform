import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NavBar from '../components/NavBar'
import Modal from '../components/Modal'
import api from '../services/api'
import './Journal.css'

export default function Journal() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formData, setFormData] = useState({ content: '', mood_score: 5, stress_score: 5, is_shared: false })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const formRef = useRef(null)
  const textareaRef = useRef(null)
  const [expandedEntries, setExpandedEntries] = useState({})
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })

  useEffect(() => { fetchEntries() }, [])

  const fetchEntries = async () => {
    try {
      setLoading(true)
      const res = await api.get('/journal/entries')
      setEntries(res.data || [])
    } catch (err) {
      setError('Failed to load journal entries')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.content.trim()) { setFormError('Entry content is required'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      if (editId) {
        await api.patch(`/journal/entries/${editId}`, formData)
      } else {
        await api.post('/journal/entries', formData)
      }
      setShowForm(false)
      setEditId(null)
      setFormData({ content: '', mood_score: 5, stress_score: 5, is_shared: false })
      fetchEntries()
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (entry) => {
    setEditId(entry.id)
    setFormData({ content: entry.content, mood_score: entry.mood_score || 5, stress_score: entry.stress_score || 5, is_shared: entry.is_shared || false })
    setShowForm(true)
    setFormError(null)
  }

  useEffect(() => {
    if (showForm && formRef.current) {
      // allow DOM to update then scroll & focus
      requestAnimationFrame(() => {
        try {
          formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
          if (textareaRef.current) textareaRef.current.focus()
        } catch (e) { /* ignore */ }
      })
    }
  }, [showForm])

  const deleteEntry = async (id) => {
    setModal({
      open: true,
      title: 'Confirm Delete',
      message: 'Delete this journal entry? This cannot be undone.',
      onClose: () => setModal({ ...modal, open: false }),
      primaryAction: {
        label: 'Delete',
        onClick: async () => {
          setModal({ ...modal, open: false })
          try {
            await api.delete(`/journal/entries/${id}`)
            fetchEntries()
          } catch {
            setModal({ open: true, title: 'Error', message: 'Failed to delete entry', onClose: () => setModal({ ...modal, open: false }) })
          }
        }
      },
      secondaryAction: {
        label: 'Cancel',
        onClick: () => setModal({ ...modal, open: false })
      }
    })
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditId(null)
    setFormData({ content: '', mood_score: 5, stress_score: 5, is_shared: false })
    setFormError(null)
  }

  const moodEmoji = (score) => {
    if (score >= 8) return '😄'
    if (score >= 6) return '🙂'
    if (score >= 4) return '😐'
    if (score >= 2) return '😔'
    return '😢'
  }

  const stressColor = (score) => {
    if (score >= 7) return 'var(--error)'
    if (score >= 4) return 'var(--warning)'
    return 'var(--success)'
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="journal-page">
      <NavBar />

      <div className="page-content">
        <div className="journal-header-row">
          <div>
            <h1 className="page-title">My Journal</h1>
            <p className="page-subtitle">Track your daily thoughts, mood, and stress levels</p>
          </div>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null) }}>
              + New Entry
            </button>
          )}
        </div>

        {/* Entry Form */}
        {showForm && (
          <div ref={formRef} className="section-card journal-form-card">
            <h3>{editId ? 'Edit Entry' : 'New Journal Entry'}</h3>
            <form onSubmit={handleSubmit} className="journal-form">
              <div className="form-field">
                <label>What's on your mind?</label>
                <textarea
                  rows={5}
                  ref={textareaRef}
                  value={formData.content}
                  onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                  placeholder="Write your thoughts, feelings, and observations…"
                />
              </div>

              <div className="journal-sliders">
                <div className="slider-group">
                  <label>
                    Mood {moodEmoji(formData.mood_score)}
                    <span className="slider-value">{formData.mood_score}/10</span>
                  </label>
                  <input
                    type="range" min={1} max={10} step={1}
                    value={formData.mood_score}
                    onChange={e => setFormData(p => ({ ...p, mood_score: Number(e.target.value) }))}
                    className="mood-slider"
                  />
                  <div className="slider-labels"><span>Low</span><span>High</span></div>
                </div>

                <div className="slider-group">
                  <label>
                    Stress Level
                    <span className="slider-value" style={{ color: stressColor(formData.stress_score) }}>{formData.stress_score}/10</span>
                  </label>
                  <input
                    type="range" min={1} max={10} step={1}
                    value={formData.stress_score}
                    onChange={e => setFormData(p => ({ ...p, stress_score: Number(e.target.value) }))}
                    className="stress-slider"
                  />
                  <div className="slider-labels"><span>None</span><span>High</span></div>
                </div>
              </div>

              <label className="share-toggle">
                <input
                  type="checkbox"
                  checked={formData.is_shared}
                  onChange={e => setFormData(p => ({ ...p, is_shared: e.target.checked }))}
                />
                <span>Share with my professional</span>
                <span className="share-hint">They will be able to read this entry</span>
              </label>

              {formError && <div className="form-error">{formError}</div>}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : editId ? 'Update Entry' : 'Save Entry'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
        ) : error ? (
          <div className="error-msg">{error}</div>
        ) : entries.length === 0 ? (
          <div className="section-card empty-msg">
            <span className="empty-icon">📔</span>
            <p>No journal entries yet.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Start writing to track your mental wellbeing journey.</p>
          </div>
        ) : (
          <div className="journal-entries">
                {entries.map(entry => (
              <div key={entry.id} className="journal-entry-card section-card">
                <div className="entry-header">
                  <div className="entry-meta">
                    <span className="entry-date">{new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    {entry.is_shared && <span className="shared-badge">Shared</span>}
                  </div>
                  <div className="entry-scores">
                    <span className="score-chip mood-chip" title="Mood">
                      {moodEmoji(entry.mood_score || 5)} {entry.mood_score || '–'}/10
                    </span>
                    <span className="score-chip stress-chip" style={{ color: stressColor(entry.stress_score || 5) }} title="Stress">
                      ⚡ {entry.stress_score || '–'}/10
                    </span>
                  </div>
                </div>
                <p className={`entry-content ${!expandedEntries[entry.id] && entry.content?.length > 200 ? 'clamped' : ''}`}>{entry.content}</p>
                {entry.content?.length > 200 && (
                  <button className="read-more-btn" onClick={() => setExpandedEntries(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}>
                    {expandedEntries[entry.id] ? 'Show Less' : 'Read More'}
                  </button>
                )}
                <div className="entry-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => startEdit(entry)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteEntry(entry.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal {...modal} />
    </div>
  )
}
