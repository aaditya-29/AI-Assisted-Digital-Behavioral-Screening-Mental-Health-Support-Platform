import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { referralService, reportService } from '../services/clinicalService'
import Navbar from '../components/NavBar'
import { formatDateOnlyIST } from '../utils/formatDate'
import '../index.css'

const URGENCY_COLORS = { routine: '#38a169', soon: '#d69e2e', urgent: '#e53e3e' }
const STATUS_COLORS = { recommended: '#805ad5', acknowledged: '#2b6cb0', scheduled: '#38a169', completed: '#718096', declined: '#a0aec0' }

export default function Referrals() {
  const navigate = useNavigate()
  const [suggestions, setSuggestions] = useState([])
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('suggestions')
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [sugRes, refRes] = await Promise.all([
        referralService.getSuggestions(),
        referralService.getMyReferrals(),
      ])
      setSuggestions(sugRes.data)
      setReferrals(refRes.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const acceptSuggestion = async (s) => {
    try {
      await referralService.acceptSuggestion(s)
      loadAll()
    } catch (e) { console.error(e) }
  }

  const updateStatus = async (id, status) => {
    try {
      await referralService.update(id, { status })
      loadAll()
    } catch (e) { console.error(e) }
  }

  const downloadReport = async () => {
    setPdfLoading(true)
    try {
      const res = await reportService.generateMyReport()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `clinical_report_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) }
    setPdfLoading(false)
  }

  const typeLabels = {
    diagnostic_evaluation: 'Diagnostic Evaluation', speech_therapy: 'Speech Therapy',
    occupational_therapy: 'Occupational Therapy', behavioral_therapy: 'Behavioral Therapy',
    psychology: 'Psychology', psychiatry: 'Psychiatry', developmental_pediatrics: 'Developmental Pediatrics',
    social_skills_group: 'Social Skills Group', educational_support: 'Educational Support',
    psychoeducation: 'Psychoeducation',
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>Referrals & Report</h1>
          <button className="btn btn-primary" onClick={downloadReport} disabled={pdfLoading}>
            {pdfLoading ? 'Generating...' : '📄 Download Clinical Report'}
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          AI-generated referral suggestions based on your complete clinical profile.
          Accept suggestions to track them, or download a comprehensive PDF report.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[
            { key: 'suggestions', label: `Suggestions (${suggestions.length})` },
            { key: 'active', label: `My Referrals (${referrals.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={tab === t.key ? 'btn btn-primary' : 'btn btn-secondary'}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p>Loading...</p>}

        {/* ─── Suggestions ─── */}
        {!loading && tab === 'suggestions' && (
          <div>
            {suggestions.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>No referral suggestions at this time. Complete more assessments to generate recommendations.</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => navigate('/additional-screening')}>ASD Screening</button>
                  <button className="btn btn-secondary" onClick={() => navigate('/comorbidity-screening')}>Comorbidity Screening</button>
                  <button className="btn btn-secondary" onClick={() => navigate('/tasks')}>Cognitive Tasks</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {suggestions.map((s, i) => (
                  <div key={i} className="card" style={{ borderLeft: `4px solid ${URGENCY_COLORS[s.urgency] || '#888'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <h3 style={{ margin: 0 }}>{typeLabels[s.referral_type] || s.referral_type}</h3>
                          <span style={{
                            padding: '0.2rem 0.75rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                            background: (URGENCY_COLORS[s.urgency] || '#888') + '18', color: URGENCY_COLORS[s.urgency] || '#888',
                          }}>
                            {s.urgency}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0', fontSize: '0.9rem' }}>{s.reason}</p>
                      </div>
                      <button className="btn btn-primary" onClick={() => acceptSuggestion(s)} style={{ whiteSpace: 'nowrap' }}>
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── My Referrals ─── */}
        {!loading && tab === 'active' && (
          <div>
            {referrals.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>No active referrals. Accept suggestions from the Suggestions tab.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {referrals.map(r => (
                  <div key={r.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <h3 style={{ margin: 0 }}>{typeLabels[r.referral_type] || r.referral_type}</h3>
                          <span style={{
                            padding: '0.2rem 0.75rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                            background: (STATUS_COLORS[r.status] || '#888') + '18', color: STATUS_COLORS[r.status] || '#888',
                          }}>{r.status}</span>
                          <span style={{
                            padding: '0.2rem 0.75rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                            background: (URGENCY_COLORS[r.urgency] || '#888') + '18', color: URGENCY_COLORS[r.urgency] || '#888',
                          }}>{r.urgency}</span>
                        </div>
                        {r.reason && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0' }}>{r.reason}</p>}
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDateOnlyIST(r.created_at)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        {r.status === 'recommended' && (
                          <button className="btn btn-secondary" onClick={() => updateStatus(r.id, 'acknowledged')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                            Acknowledge
                          </button>
                        )}
                        {r.status === 'acknowledged' && (
                          <button className="btn btn-primary" onClick={() => updateStatus(r.id, 'scheduled')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                            Mark Scheduled
                          </button>
                        )}
                        {r.status === 'scheduled' && (
                          <button className="btn btn-primary" onClick={() => updateStatus(r.id, 'completed')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
