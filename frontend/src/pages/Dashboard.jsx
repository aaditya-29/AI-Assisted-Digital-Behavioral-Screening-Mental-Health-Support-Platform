import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import api from '../services/api'
import './Dashboard.css'

// ── helpers ──────────────────────────────────────────────────────────────────
const ACTION_RE = /recommend|suggest|follow up|follow-up|urgent|please|refer|action/i
const CATEGORY_LABELS = {
  nback: 'Working Memory',
  go_nogo: 'Inhibitory Control',
  dccs: 'Card Sort',
  tower: 'Planning',
  fer: 'Emotion Recognition',
  false_belief: 'Theory of Mind',
  social_stories: 'Social Stories',
  conversation: 'Conversation Cues',
  rja: 'Joint Attention (R)',
  ija: 'Joint Attention (I)',
  visual_temporal: 'Visual Processing',
  auditory_processing: 'Auditory Processing',
}

function parseCategoryFromReason(reason) {
  if (!reason) return null
  const m = reason.match(/^\[([^\]]+)\]/)
  return m ? m[1] : null
}

function cleanReason(reason) {
  if (!reason) return ''
  return reason.replace(/^\[[^\]]+\]\s*/, '')
}

function priorityColor(p) {
  if (p <= 1) return 'rec-priority-1'
  if (p <= 2) return 'rec-priority-2'
  if (p <= 3) return 'rec-priority-3'
  return 'rec-priority-low'
}

// ── component ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const { user, logout, isAdmin, isProfessional } = useAuth()
  const navigate = useNavigate()

  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [showNotesModal, setShowNotesModal] = useState(false)

  const [recs, setRecs] = useState(null)   // { summary, recommendations, has_recommendations }
  const [recsLoading, setRecsLoading] = useState(true)
  const [profRecsCount, setProfRecsCount] = useState(0)

  useEffect(() => {
    api.get('/users/my-notes')
      .then(res => setNotes(res.data || []))
      .catch(() => {})
      .finally(() => setNotesLoading(false))

    api.get('/recommendations')
      .then(res => setRecs(res.data))
      .catch(() => setRecs(null))
      .finally(() => setRecsLoading(false))

    api.get('/recommendations/professional')
      .then(res => {
        const pending = (res.data || []).filter(r => r.status === 'pending')
        setProfRecsCount(pending.length)
      })
      .catch(() => {})
  }, [])

  // Count only pending recs for the dashboard card
  const visibleRecs = recs?.recommendations?.filter(r => r.status === 'pending') ?? []

  const latestNote = notes[0] ?? null
  const excerpt = latestNote
    ? latestNote.content.length > 130
      ? latestNote.content.slice(0, 130).trim() + '…'
      : latestNote.content
    : null

  return (
    <div className="dashboard">
      <NavBar />

      <main className="dashboard-main">
        <div className="container">

          {/* ── Welcome ── */}
          <section className="welcome-section">
            <h2>Good day, {user?.first_name} 👋</h2>
            <p>Here's your behavioral health dashboard</p>
          </section>

          {/* ── Role banners ── */}
          {isAdmin && (
            <section className="admin-section">
              <div className="admin-banner">
                <span className="admin-badge">Admin</span>
                <p>You have full administrative access to the platform.</p>
                <Link to="/admin" className="btn btn-sm">Go to Admin Dashboard</Link>
              </div>
            </section>
          )}

          {isProfessional && !isAdmin && (
            <section className="professional-section">
              <div className="professional-banner">
                <span className="professional-badge">Professional</span>
                <p>Access your shared patients, notes, and consultation requests.</p>
                <Link to="/professional/patients" className="btn btn-sm">View Patients</Link>
              </div>
            </section>
          )}

          {/* ── Feature grid ── */}
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-icon-wrapper"><span className="card-icon">📋</span></div>
              <h3>ASD Screening</h3>
              <p>Take the AQ-10 screening questionnaire to assess behavioral patterns and track results over time.</p>
              <Link to="/screening" className="btn btn-primary">Start Screening</Link>
            </div>
            <div className="dashboard-card">
              <div className="card-icon-wrapper"><span className="card-icon">✅</span></div>
              <h3>Task Tracking</h3>
              <p>Complete interactive cognitive and behavioral tasks to assess your abilities.</p>
              <Link to="/tasks" className="btn btn-primary">Go to Tasks</Link>
            </div>
            <div className="dashboard-card">
              <div className="card-icon-wrapper"><span className="card-icon">📔</span></div>
              <h3>Journal</h3>
              <p>Record your daily thoughts, mood, and stress levels for longitudinal insights.</p>
              <Link to="/journal" className="btn btn-primary">Open Journal</Link>
            </div>
            <div className="dashboard-card">
              <div className="card-icon-wrapper"><span className="card-icon">📊</span></div>
              <h3>Analysis</h3>
              <p>View your behavioral analysis, mood & stress trends, and AI-powered screening insights.</p>
              <Link to="/analysis" className="btn btn-primary">View Analysis</Link>
            </div>
            <div className="dashboard-card">
              <div className="card-icon-wrapper"><span className="card-icon">💡</span></div>
              <h3>Resources</h3>
              {profRecsCount > 0 ? (
                <p><strong className="recs-count-badge">{profRecsCount}</strong> resource{profRecsCount !== 1 ? 's' : ''} recommended by your professional. Browse all curated guides and materials.</p>
              ) : (
                <p>Access curated resources, guides, and support materials tailored to your needs.</p>
              )}
              <Link to="/resources" className="btn btn-primary">View Resources</Link>
            </div>
            <div className="dashboard-card">
              <div className="card-icon-wrapper"><span className="card-icon">👨‍⚕️</span></div>
              <h3>Professional Support</h3>
              <p>Connect with verified mental health professionals and share your screening data.</p>
              <Link to="/connect-professional" className="btn btn-primary">Find a Professional</Link>
            </div>

            {/* ── AI Recommendations card ── */}
            <div className="dashboard-card dashboard-card-recs">
              <div className="card-icon-wrapper recs-icon-wrapper"><span className="card-icon">🤖</span></div>
              <h3>AI Recommendations</h3>
              {recsLoading ? (
                <p>Loading…</p>
              ) : visibleRecs.length > 0 ? (
                <p>
                  <strong className="recs-count-badge">{visibleRecs.length}</strong> personalised suggestion{visibleRecs.length !== 1 ? 's' : ''} based on your latest screening, journal, and task data.
                </p>
              ) : (
                <p>Complete a screening or journal entry and our AI will generate personalised task suggestions for you.</p>
              )}
              <Link to="/analysis?tab=recommendations" className="btn btn-primary">View Recommendations</Link>
            </div>

            {/* ── Professional Notes card ── */}
            <div className="dashboard-card dashboard-card-notes" onClick={notes.length > 0 ? () => setShowNotesModal(true) : undefined} style={{ cursor: notes.length > 0 ? 'pointer' : 'default' }}>
              <div className="card-icon-wrapper notes-icon-wrapper"><span className="card-icon">📝</span></div>
              <h3>Notes from Professional</h3>
              {notesLoading ? (
                <p>Loading…</p>
              ) : notes.length > 0 ? (
                <p>
                  <strong className="recs-count-badge">{notes.length}</strong> note{notes.length !== 1 ? 's' : ''} from your connected professional.
                  {latestNote && (
                    <span className="notes-latest-excerpt"> Latest: {excerpt}</span>
                  )}
                </p>
              ) : (
                <p>No notes yet. When a professional adds notes to your profile, they'll appear here.</p>
              )}
              {notes.length > 0 ? (
                <button className="btn btn-primary" onClick={e => { e.stopPropagation(); setShowNotesModal(true) }}>View Notes</button>
              ) : (
                <button className="btn btn-primary" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>No Notes Yet</button>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Notes modal ── */}
      {showNotesModal && (
        <div className="notes-modal-overlay" onClick={() => setShowNotesModal(false)}>
          <div className="notes-modal" onClick={e => e.stopPropagation()}>
            <div className="notes-modal-header">
              <div>
                <h3>Professional Notes</h3>
                <p>{notes.length} note{notes.length !== 1 ? 's' : ''} from your professional</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowNotesModal(false)}>✕</button>
            </div>
            <div className="notes-modal-body">
              {notes.map(n => {
                const isAction = ACTION_RE.test(n.content)
                return (
                  <div key={n.id} className={`note-modal-card${isAction ? ' note-modal-action' : ''}`}>
                    <div className="note-modal-card-header">
                      <div className="note-modal-author-row">
                        <span className="note-avatar">{n.professional_name?.[0] ?? 'P'}</span>
                        <div>
                          <div className="note-modal-author">{n.professional_name ?? 'Professional'}</div>
                          <div className="note-modal-date">
                            {new Date(n.created_at).toLocaleString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      {isAction && <span className="note-action-pill">⚡ Action</span>}
                    </div>
                    <p className="note-modal-content">{n.content}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

