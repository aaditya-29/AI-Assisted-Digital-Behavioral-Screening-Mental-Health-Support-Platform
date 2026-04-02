import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import api from '../services/api'
import './Auth.css'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (newPassword.length < 8) {
      setMsg({ type: 'error', text: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    setIsLoading(true)
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      })
      setMsg({ type: 'success', text: 'Password changed successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to change password.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="change-password-page">
      <NavBar />
      <div className="change-password-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-header-icon">🔑</div>
            <h1>Change Password</h1>
            <p>Set a new password for your account</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {msg && <div className={`server-error`} style={{ background: msg.type === 'success' ? 'var(--success-bg)' : undefined, borderColor: msg.type === 'success' ? 'var(--success-border)' : undefined, color: msg.type === 'success' ? '#065f46' : undefined }}>{msg.text}</div>}

            <div className="form-group">
              <label>Current Password</label>
              <div className="password-field">
                <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                <button type="button" className="password-toggle-btn" onClick={() => setShowCurrent(s => !s)}>{showCurrent ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <div className="form-group">
              <label>New Password</label>
              <div className="password-field">
                <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
                <button type="button" className="password-toggle-btn" onClick={() => setShowNew(s => !s)}>{showNew ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="password-field">
                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
                <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(s => !s)}>{showConfirm ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <button type="submit" className="btn-auth" disabled={isLoading}>{isLoading ? 'Updating…' : 'Change Password'}</button>

            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate('/profile')}>Back to Profile</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
