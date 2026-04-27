/**
 * User Management Page
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NavBar from '../../components/NavBar'
import Modal from '../../components/Modal'
import './UserManagement.css'

function UserManagement() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ role: '', is_active: '', search: '' })
  const [assign, setAssign] = useState({ patient_id: '', professional_id: '' })
  const [professionalsList, setProfessionalsList] = useState([])
  const [patientsList, setPatientsList] = useState([])
  const [assignError, setAssignError] = useState(null)
  const [pagination, setPagination] = useState({ skip: 0, limit: 20 })
  const [modal, setModal] = useState({ open: false, title: '', message: '', onClose: () => setModal({ ...modal, open: false }) })
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
    fetchAssignLists()
  }, [filters, pagination])

  const fetchAssignLists = async () => {
    try {
      setAssignError(null)
      const profs = await api.get('/admin/users?role=professional&limit=100')
      const pats = await api.get('/admin/users?role=user&limit=100')
      setProfessionalsList(profs.data.users || [])
      setPatientsList(pats.data.users || [])
    } catch (err) {
      const resp = err?.response?.data
      let message = err.message || 'Failed to load assign lists'
      if (resp) {
        if (Array.isArray(resp.detail)) {
          message = resp.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
        } else if (typeof resp.detail === 'string') {
          message = resp.detail
        }
      }
      setAssignError(message)
      setProfessionalsList([])
      setPatientsList([])
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('skip', pagination.skip)
      params.append('limit', pagination.limit)
      if (filters.role) params.append('role', filters.role)
      if (filters.is_active !== '') params.append('is_active', filters.is_active)
      if (filters.search) params.append('search', filters.search)
      const response = await api.get(`/admin/users?${params.toString()}`)
      setUsers(response.data.users)
      setTotal(response.data.total)
    } catch (err) {
      setError('Failed to load users')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole })
      fetchUsers()
    } catch (err) { setModal({ open: true, title: 'Error', message: 'Failed to update role', onClose: () => setModal({ ...modal, open: false }) }) }
  }

  const updateUserStatus = async (userId, isActive) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { is_active: isActive })
      fetchUsers()
    } catch (err) { setModal({ open: true, title: 'Error', message: 'Failed to update status', onClose: () => setModal({ ...modal, open: false }) }) }
  }

  const deleteUser = async (userId, userName) => {
    setModal({
      open: true,
      title: 'Confirm Delete',
      message: `Delete ${userName}? This cannot be undone.`,
      onClose: () => setModal({ ...modal, open: false }),
      primaryAction: {
        label: 'Delete',
        onClick: async () => {
          setModal({ ...modal, open: false })
          try {
            await api.delete(`/admin/users/${userId}`)
            fetchUsers()
          } catch (err) {
            setModal({ open: true, title: 'Error', message: 'Failed to delete user', onClose: () => setModal({ ...modal, open: false }) })
          }
        }
      },
      secondaryAction: {
        label: 'Cancel',
        onClick: () => setModal({ ...modal, open: false })
      }
    })
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, skip: 0 }))
  }

  const totalPages = Math.ceil(total / pagination.limit)
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1
  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="user-mgmt-page">
      <NavBar />

      <div className="page-content">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Manage user accounts, roles, and permissions</p>

        {/* Assign Patient to Professional */}
        <div className="section-card">
          <h3>Assign Patient to Professional</h3>
          <div className="assign-grid">
            <div className="form-field">
              <label>Patient</label>
              <select value={assign.patient_id} onChange={e => setAssign(p => ({ ...p, patient_id: e.target.value }))}>
                <option value="">Select patient</option>
                {patientsList.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.email}</option>)}
              </select>
              {assignError && <span className="error-note">{assignError}</span>}
              {!assignError && patientsList.length === 0 && <span className="warn-note">No patients found</span>}
            </div>
            <div className="form-field">
              <label>Professional</label>
              <select value={assign.professional_id} onChange={e => setAssign(p => ({ ...p, professional_id: e.target.value }))}>
                <option value="">Select professional</option>
                {professionalsList.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.email}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end', height: 44 }} onClick={async () => {
              if (!assign.patient_id || !assign.professional_id) {
                setModal({ open: true, title: 'Error', message: 'Choose both patient and professional', onClose: () => setModal({ ...modal, open: false }) })
                return
              }
              try {
                await api.post('/admin/assign-patient', { patient_id: Number(assign.patient_id), professional_id: Number(assign.professional_id) })
                setModal({ open: true, title: 'Success', message: 'Patient assigned to professional', onClose: () => setModal({ ...modal, open: false }) })
                fetchUsers()
              } catch (err) { setModal({ open: true, title: 'Error', message: 'Failed to assign patient', onClose: () => setModal({ ...modal, open: false }) }) }
            }}>Assign</button>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-row">
          <div className="filters-grid">
            <div className="form-field">
              <label>Search</label>
              <input type="text" value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} placeholder="Name or email…" />
            </div>
            <div className="form-field">
              <label>Role</label>
              <select value={filters.role} onChange={e => handleFilterChange('role', e.target.value)}>
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-field">
              <label>Status</label>
              <select value={filters.is_active} onChange={e => handleFilterChange('is_active', e.target.value)}>
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-end', height: 44 }} onClick={() => setFilters({ role: '', is_active: '', search: '' })}>Clear</button>
          </div>
        </div>

        {/* Users Table */}
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--error)' }}>{error}</div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="td-name">{user.first_name} {user.last_name}</div>
                        <div className="td-email">{user.email}</div>
                        {user.professional_profile && (
                          <div className="td-professional-meta">
                            <div className="meta-row"><strong>License:</strong> {user.professional_profile.license_number}</div>
                            {user.professional_profile.specialty && <div className="meta-row"><strong>Specialty:</strong> {user.professional_profile.specialty}</div>}
                            {user.professional_profile.institution && <div className="meta-row"><strong>Institution:</strong> {user.professional_profile.institution}</div>}
                          </div>
                        )}
                      </td>
                      <td>
                        <select className="role-select" value={user.role} onChange={e => updateUserRole(user.id, e.target.value)}>
                          <option value="user">User</option>
                          <option value="professional">Professional</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <button className={`status-toggle ${user.is_active ? 'status-active' : 'status-inactive'}`} onClick={() => updateUserStatus(user.id, !user.is_active)}>
                          {user.is_active ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
                          {user.role === 'professional' && !user.is_verified && (
                            <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: 'white', border: 'none' }} onClick={() => {
                              setModal({
                                open: true,
                                title: 'Confirm Verification',
                                message: `Verify ${user.first_name} ${user.last_name}?`,
                                onClose: () => setModal({ ...modal, open: false }),
                                primaryAction: {
                                  label: 'Verify',
                                  onClick: async () => {
                                    setModal({ ...modal, open: false })
                                    try {
                                      await api.patch(`/admin/professionals/${user.id}/verify`, { is_verified: true })
                                      fetchUsers()
                                      setModal({ open: true, title: 'Success', message: 'Verified', onClose: () => setModal({ ...modal, open: false }) })
                                    } catch {
                                      setModal({ open: true, title: 'Error', message: 'Failed to verify', onClose: () => setModal({ ...modal, open: false }) })
                                    }
                                  }
                                },
                                secondaryAction: {
                                  label: 'Cancel',
                                  onClick: () => setModal({ ...modal, open: false })
                                }
                              })
                            }}>Verify</button>
                          )}
                          {user.role === 'professional' && user.is_verified && (
                            <span className="badge badge-success" style={{ fontSize: 12 }}>✓ Verified</span>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => deleteUser(user.id, `${user.first_name} ${user.last_name}`)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pagination">
                <span className="pagination-info">Showing {pagination.skip + 1}–{Math.min(pagination.skip + pagination.limit, total)} of {total}</span>
                <div className="pagination-btns">
                  <button className="btn btn-secondary btn-sm" disabled={pagination.skip === 0} onClick={() => setPagination(p => ({ ...p, skip: Math.max(0, p.skip - p.limit) }))}>← Prev</button>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {currentPage} / {totalPages}</span>
                  <button className="btn btn-secondary btn-sm" disabled={pagination.skip + pagination.limit >= total} onClick={() => setPagination(p => ({ ...p, skip: p.skip + p.limit }))}>Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Modal {...modal} />
    </div>
  )
}

export default UserManagement
