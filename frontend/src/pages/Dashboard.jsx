import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import api from '../services/api'
import './Dashboard.css'

function Dashboard() {
  const { user, logout, isAdmin, isProfessional, ROLES } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [showNotesModal, setShowNotesModal] = useState(false)

  const latestNote = notes && notes.length > 0 ? notes[0] : null
  const latestIsAction = latestNote && /recommend|suggest|follow up|follow-up|urgent|please|refer|action/i.test(latestNote.content)
  const latestExcerpt = latestNote ? (latestNote.content.length > 120 ? latestNote.content.slice(0,120).trim() + '…' : latestNote.content) : null

  useEffect(() => {
    api.get('/users/my-notes')
      .then(res => setNotes(res.data || []))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <NavBar />

      <main className="dashboard-main">
        <div className="container">
          <section className="welcome-section">
            <h2>Good day, {user?.first_name} 👋</h2>
            <p>Here's your behavioral health dashboard</p>
          </section>

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

          {/* Professional Notes: single dashboard card */}

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">📋</span>
              </div>
              <h3>ASD Screening</h3>
              <p>Take the AQ-10 screening questionnaire to assess behavioral patterns and track results over time.</p>
              <Link to="/screening" className="btn btn-primary">Start Screening</Link>
            </div>

            <div className="dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">✅</span>
              </div>
              <h3>Task Tracking</h3>
              <p>Complete interactive cognitive and behavioral tasks to assess your abilities.</p>
              <Link to="/tasks" className="btn btn-primary">Go to Tasks</Link>
            </div>

            <div className="dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">📔</span>
              </div>
              <h3>Journal</h3>
              <p>Record your daily thoughts, mood, and stress levels for longitudinal insights.</p>
              <Link to="/journal" className="btn btn-primary">Open Journal</Link>
            </div>

            <div className="dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">📊</span>
              </div>
              <h3>Analysis</h3>
              <p>View your behavioral analysis, mood & stress trends, and AI-powered screening insights.</p>
              <Link to="/analysis" className="btn btn-primary">View Analysis</Link>
            </div>

            <div className="dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">💡</span>
              </div>
              <h3>Resources</h3>
              <p>Access curated resources, guides, and support materials tailored to your needs.</p>
              <Link to="/resources" className="btn btn-primary">View Resources</Link>
            </div>

            <div className="dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">👨‍⚕️</span>
              </div>
              <h3>Professional Support</h3>
              <p>Connect with verified mental health professionals and share your screening data.</p>
              <Link to="/connect-professional" className="btn btn-primary">Find a Professional</Link>
            </div>
            {/* Notes card placed last among the main cards */}
            <div className="dashboard-card notes-dashboard-card">
              <div className="card-icon-wrapper">
                <span className="card-icon">📝</span>
              </div>
              <h3>Notes from Professional</h3>
              <p style={{ minHeight: 48, marginBottom: 12, color: 'var(--text-secondary)' }}>
                {latestNote ? latestExcerpt : 'No notes shared by your professional yet.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {latestIsAction ? <span className="note-badge small">Action</span> : <span />}
                <div>
                  <button className="btn btn-primary" onClick={() => setShowNotesModal(true)}>View Notes</button>
                </div>
              </div>
            </div>
          </div>

          
        </div>
      </main>

      {showNotesModal && (
        <div className="notes-modal-overlay" onClick={() => setShowNotesModal(false)}>
          <div className="notes-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>All Notes</h3>
              <div>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowNotesModal(false)}>Close</button>
              </div>
            </div>
            <div className="modal-body">
              {notes.map(n => {
                const isAction = /recommend|suggest|follow up|follow-up|urgent|please|refer|action/i.test(n.content)
                return (
                  <div key={n.id} className="note-modal-card">
                    <div className="card-header">
                      <div>
                        <div className="note-professional">{n.professional_name}</div>
                        <div className="note-date">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        {isAction && <span className="note-badge small">Action</span>}
                      </div>
                    </div>
                    <div className="card-body">
                      <p className="note-content" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                    </div>
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
