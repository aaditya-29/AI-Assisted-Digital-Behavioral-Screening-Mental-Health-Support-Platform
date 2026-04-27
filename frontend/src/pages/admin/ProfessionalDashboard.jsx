import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from "../../services/api"
import NavBar from "../../components/NavBar"
import Modal from '../../components/Modal'
import "./ProfessionalDashboard.css"

function ProfessionalDashboard() {
  const [stats, setStats] = useState(null)
  const [patients, setPatients] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchProfessionalData()
  }, [])

  const fetchProfessionalData = async () => {
    try {
      setLoading(true)
      const [statsRes, patientsRes, requestsRes] = await Promise.all([
        api.get('/professional/stats'),
        api.get('/professional/patients'),
        api.get('/professional/consultations', { params: { status_filter: 'pending' } })
      ])
      setStats(statsRes.data)
      // normalize patient objects: backend returns user_id, admin UI expects id
      const rawPatients = patientsRes.data || []
      const normalized = rawPatients.map(p => ({ ...p, id: p.id || p.user_id }))
      setPatients(normalized)
      setRequests(requestsRes.data || [])
    } catch (err) {
      setError('Failed to load professional data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner"></div>
        <p>Loading dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-loader">
        <p style={{ color: 'var(--error)' }}>{error}</p>
        <button onClick={fetchProfessionalData} className="btn btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="professional-page">
      <NavBar />

      <div className="page-content">
        <h1 className="page-title">Professional Dashboard</h1>
        <p className="page-subtitle">Patient data and professional actions</p>

        <div className="stats-grid">
          <StatCard title="Total Patients" value={stats?.total_patients || 0} sub={stats?.active_patients ? `${stats.active_patients} active` : null} color="green" />
          <StatCard title="Screenings" value={stats?.total_screenings || 0} sub={stats?.completed_screenings ? `${stats.completed_screenings} completed` : null} color="blue" />
          <StatCard title="Journal Entries" value={stats?.total_journal_entries || 0} color="purple" />
          <StatCard title="Task Sessions" value={stats?.total_task_sessions || 0} sub={stats?.completed_task_sessions ? `${stats.completed_task_sessions} completed` : null} color="orange" />
        </div>

        {/* Shared Patients */}
        <div className="section-card">
          <h2>Shared Patients</h2>
          <div className="patient-list-table">
            {patients.length > 0 ? patients.map(patient => (
              <div key={patient.id} className="patient-row">
                <div>
                  <div className="patient-name">{patient.first_name} {patient.last_name}</div>
                </div>
                <Link to={`/professional/patients/${patient.id}`} className="btn btn-outline btn-sm">View Details</Link>
              </div>
            )) : (
              <p className="empty-msg">No shared patients yet.</p>
            )}
          </div>
        </div>

        {/* Pending Requests */}
        <div className="section-card">
          <h2>Pending Consultation Requests</h2>
          {requests.length > 0 ? requests.map(req => (
            <div key={req.id} className="request-card">
              <div className="request-header">
                <span className="request-user">User #{req.user_id}</span>
              </div>
              <p className="request-msg">{req.message || 'No message provided'}</p>
              <p className="request-date">Requested: {new Date(req.created_at).toLocaleString()}</p>
              <div className="request-btn-group">
                <button className="btn-accept" onClick={async () => {
                  try { await api.patch(`/professional/consultations/${req.id}`, { status: 'accepted' }); fetchProfessionalData() }
                  catch (err) { setModal({ open: true, title: 'Error', message: 'Failed to accept', onClose: () => setModal({ ...modal, open: false }) }) }
                }}>Accept</button>
                <button className="btn-reject" onClick={async () => {
                  try { await api.patch(`/professional/consultations/${req.id}`, { status: 'declined' }); fetchProfessionalData() }
                  catch (err) { setModal({ open: true, title: 'Error', message: 'Failed to decline', onClose: () => setModal({ ...modal, open: false }) }) }
                }}>Decline</button>
              </div>
            </div>
          )) : (
            <p className="empty-msg">No pending requests.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="section-card">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <Link to="/professional/consultations" className="btn btn-primary">Manage Consultations</Link>
            <Link to="/professional/patients" className="btn btn-secondary">View All Patients</Link>
          </div>
        </div>
      </div>
      <Modal {...modal} />
    </div>
  )
}

function StatCard({ title, value, sub, color }) {
  return (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-card-title">{title}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}

export default ProfessionalDashboard

