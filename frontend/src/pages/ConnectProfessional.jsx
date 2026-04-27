import { useEffect, useState } from 'react'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import Modal from '../components/Modal'
import './ConnectProfessional.css'

function ConnectProfessional() {
  const [professionals, setProfessionals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })
  const navigate = useNavigate()

  const fetchProfessionals = async (q = '') => {
    setLoading(true)
    try {
      const res = await api.get('/users/professionals', { params: { search: q, verified_only: true } })
      setProfessionals(res.data)
    } catch (err) {
      setError('Failed to load professionals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfessionals() }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    await fetchProfessionals(search)
  }

  const handleRequest = async (prof) => {
    setSelected(prof)
    setMessage('')
  }

  const sendRequest = async () => {
    if (!selected) return
    setSending(true)
    try {
      await api.post('/users/share', { professional_id: selected.user_id, message })
      setModal({
        open: true,
        title: 'Success',
        message: 'Request sent — professional will be notified',
        onClose: () => {
          setModal({ ...modal, open: false })
          setSelected(null)
          fetchProfessionals()
          navigate('/dashboard')
        }
      })
    } catch (err) {
      setModal({
        open: true,
        title: 'Error',
        message: err?.response?.data?.detail || 'Failed to send request',
        onClose: () => setModal({ ...modal, open: false })
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="connect-page">
      <NavBar />
      <div className="connect-container">
        <div className="connect-header">
          <h2>Find a Professional</h2>
          <p>Search verified professionals and request to share your data with them.</p>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input placeholder="Search by name or institution" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>

        {loading && <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>}
        {error && <div className="error-banner">{error}</div>}

        <div className="professional-list">
          {professionals.length === 0 && !loading && <div className="empty-state"><p>No professionals found.</p></div>}
          {professionals.map(p => (
            <div key={p.user_id} className="professional-item">
              <div className="prof-avatar">{(p.first_name?.[0] || '?').toUpperCase()}</div>
              <div className="prof-meta">
                <div className="prof-name">{p.first_name} {p.last_name}</div>
                <div className="prof-specialty">{p.specialty || '—'} • {p.institution || 'Independent'}</div>
              </div>
              <div className="prof-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleRequest(p)}>Request Connect</button>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="request-panel">
            <h3>Requesting: {selected.first_name} {selected.last_name}</h3>
            <textarea placeholder="Optional message to the professional" value={message} onChange={e => setMessage(e.target.value)} />
            <div className="request-actions">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendRequest} disabled={sending}>{sending ? 'Sending…' : 'Send Request'}</button>
            </div>
          </div>
        )}
      </div>
      <Modal {...modal} />
    </div>
  )
}

export default ConnectProfessional
