/**
 * Shared NavBar component with notification bell.
 * Used across all pages for consistent navigation.
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import './NavBar.css'

export default function NavBar() {
  const { user, logout, isAdmin, isProfessional } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [counts, setCounts] = useState({ total_unread: 0, consultation_requests: 0, notes: 0, journals: 0, resources: 0, other: 0 })
  const [notifications, setNotifications] = useState([])
  const [showPanel, setShowPanel] = useState(false)
  const [badgeCleared, setBadgeCleared] = useState(false) // Facebook-style: visually clear on open
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const panelRef = useRef(null)
  const hamburgerRef = useRef(null)
  const mobileRef = useRef(null)

  useEffect(() => { fetchCounts() }, [location.pathname])
  useEffect(() => {
    const interval = setInterval(fetchCounts, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false)
      // Close mobile menu only when clicking outside both the menu and the hamburger button
      if (mobileRef.current && !mobileRef.current.contains(e.target) && !(hamburgerRef.current && hamburgerRef.current.contains(e.target))) setShowMobileMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchCounts = async () => {
    try {
      const res = await api.get('/notifications/counts')
      setCounts(res.data)
      // Only re-show the badge if there are new unread since we last cleared
      setBadgeCleared(false)
    } catch { /* silent */ }
  }

  const togglePanel = async () => {
    if (!showPanel) {
      // Facebook-style: visually clear the count the moment panel opens
      setBadgeCleared(true)
      try {
        const res = await api.get('/notifications/?limit=20')
        setNotifications(res.data || [])
      } catch { /* silent */ }
    }
    setShowPanel(v => !v)
  }

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setCounts(prev => ({ ...prev, total_unread: Math.max(0, prev.total_unread - 1) }))
    } catch { /* silent */ }
  }

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setCounts(prev => ({ ...prev, total_unread: 0, consultation_requests: 0, notes: 0, journals: 0, resources: 0, other: 0 }))
    } catch { /* silent */ }
  }

  const handleNotifClick = (n) => {
    if (!n.is_read) markRead(n.id)
    if (n.link) navigate(n.link)
    setShowPanel(false)
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  // Build nav links based on role
  const userLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/screening', label: 'Screening' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/journal', label: 'Journal' },
    { to: '/analysis', label: 'Analysis' },
    { to: '/resources', label: 'Resources' },
  ]

  const professionalLinks = [
    { to: '/professional', label: 'Dashboard' },
    { to: '/professional/patients', label: 'Patients' },
    { to: '/professional/consultations', label: 'Consultations', badge: counts.consultation_requests || 0 },
    { to: '/dashboard', label: '← User View' },
  ]

  const adminLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/resources', label: 'Resources' },
    { to: '/dashboard', label: '← User View' },
  ]

  // Determine which link set to show
  const path = location.pathname
  let links = userLinks
  let logoSuffix = ''
  if (path.startsWith('/admin')) {
    links = adminLinks
    logoSuffix = ' Admin'
  } else if (path.startsWith('/professional')) {
    links = professionalLinks
    logoSuffix = ''
  }

  return (
    <nav className="main-nav">
      <div className="main-nav-inner">
        {/* Mobile hamburger — placed first in DOM so it renders left on mobile */}
        <button ref={hamburgerRef} className="nav-hamburger" aria-label="Menu" onClick={() => setShowMobileMenu(v => !v)}>
          <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}></span>
        </button>

        <Link to="/dashboard" className="main-nav-logo">
          <span className="main-nav-logo-icon">🧠</span>
          <span className="main-nav-logo-text">MindBridge{logoSuffix}</span>
        </Link>

        <div className="main-nav-links">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`main-nav-link ${isActive(link.to) ? 'active' : ''}`}
            >
              {link.label}
              {link.badge > 0 && <span className="nav-badge">{link.badge}</span>}
            </Link>
          ))}
        </div>

        <div className="main-nav-right">
          {/* Role quick-switch buttons */}
          {isAdmin && !path.startsWith('/admin') && (
            <Link to="/admin" className="nav-role-btn">⚙ Admin</Link>
          )}
          {isProfessional && !isAdmin && !path.startsWith('/professional') && (
            <Link to="/professional" className="nav-role-btn">👨‍⚕️ Portal</Link>
          )}

          {/* Notification bell */}
          <div className="notif-wrapper" ref={panelRef}>
            <button className="notif-bell" onClick={togglePanel} title="Notifications">
              🔔
              {counts.total_unread > 0 && !badgeCleared && (
                <span className="notif-count pulse">{counts.total_unread}</span>
              )}
            </button>

            {showPanel && (
              <div className="notif-panel">
                <div className="notif-panel-header">
                  <span className="notif-panel-title">Notifications</span>
                  {counts.total_unread > 0 && (
                    <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                <div className="notif-panel-body">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.is_read ? '' : 'unread'}`}
                        onClick={() => handleNotifClick(n)}
                      >
                        <div className="notif-item-title">{n.title}</div>
                        {n.message && <div className="notif-item-msg">{n.message}</div>}
                        <div className="notif-item-time">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile link */}
          <Link to="/profile" className="nav-avatar-link" title="Profile">
            <div className="nav-avatar">{user?.first_name?.[0]?.toUpperCase()}</div>
          </Link>

          <button onClick={handleLogout} className="btn btn-secondary btn-sm">Sign Out</button>
        </div>

        {/* Mobile Menu Panel */}
        {showMobileMenu && (
          <div className="mobile-menu" ref={mobileRef}>
            <div className="mobile-menu-links">
              {links.map(link => (
                <Link key={link.to} to={link.to} className={`mobile-link ${isActive(link.to) ? 'active' : ''}`} onClick={() => setShowMobileMenu(false)}>
                  {link.label}
                  {link.badge > 0 && <span className="nav-badge">{link.badge}</span>}
                </Link>
              ))}
            </div>
            <div className="mobile-menu-actions">
              {isAdmin && !location.pathname.startsWith('/admin') && (
                <Link to="/admin" className="nav-role-btn mobile" onClick={() => setShowMobileMenu(false)}>⚙ Admin</Link>
              )}
              {isProfessional && !isAdmin && !location.pathname.startsWith('/professional') && (
                <Link to="/professional" className="nav-role-btn mobile" onClick={() => setShowMobileMenu(false)}>👨‍⚕️ Portal</Link>
              )}
              <button className="mobile-signout-btn" onClick={() => { setShowMobileMenu(false); handleLogout(); }}>Sign Out</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
