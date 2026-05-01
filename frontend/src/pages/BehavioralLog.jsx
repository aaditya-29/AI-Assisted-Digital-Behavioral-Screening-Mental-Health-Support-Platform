import { useState, useEffect } from 'react'
import { behavioralObservationService } from '../services/clinicalService'
import Navbar from '../components/NavBar'
import { formatDateOnlyIST } from '../utils/formatDate'
import '../index.css'

const FREQ_OPTIONS = ['rarely', 'sometimes', 'often', 'very_often', 'constant']
const INTENSITY_OPTIONS = ['mild', 'moderate', 'severe']
const SETTING_OPTIONS = ['home', 'school', 'clinic', 'community', 'online', 'other']

export default function BehavioralLog() {
  const [categories, setCategories] = useState({})
  const [observations, setObservations] = useState([])
  const [summary, setSummary] = useState(null)
  const [phase, setPhase] = useState('list') // list | form | summary
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category: '', behavior_type: '', setting: '', antecedent: '', behavior_description: '',
    consequence: '', frequency: 'sometimes', duration_minutes: null, intensity: 'moderate', notes: '',
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [catRes, obsRes] = await Promise.all([
        behavioralObservationService.getCategories(),
        behavioralObservationService.getMyObservations(),
      ])
      setCategories(catRes.data)
      setObservations(obsRes.data)
    } catch (e) { console.error(e) }
  }

  const loadSummary = async () => {
    try {
      const res = await behavioralObservationService.getSummary()
      setSummary(res.data)
      setPhase('summary')
    } catch (e) { console.error(e) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await behavioralObservationService.create({
        ...form,
        observation_date: new Date().toISOString().split('T')[0],
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      })
      setForm({ category: '', behavior_type: '', setting: '', antecedent: '', behavior_description: '', consequence: '', frequency: 'sometimes', duration_minutes: null, intensity: 'moderate', notes: '' })
      setPhase('list')
      loadAll()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this observation?')) return
    try { await behavioralObservationService.delete(id); loadAll() } catch (e) { console.error(e) }
  }

  const intensityColors = { mild: '#38a169', moderate: '#d69e2e', severe: '#e53e3e' }
  const categoryData = categories[form.category] || {}
  const categoryBehaviors = Array.isArray(categoryData) ? categoryData : (categoryData.types || [])

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>Behavioral Observation Log</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {phase === 'form' && <button className="btn btn-secondary" onClick={() => setPhase('list')}>← Back</button>}
            {phase === 'list' && (
              <>
                <button className="btn btn-primary" onClick={() => setPhase('form')}>+ Log Behavior</button>
                <button className="btn btn-secondary" onClick={loadSummary}>View Summary</button>
              </>
            )}
            {phase === 'summary' && <button className="btn btn-secondary" onClick={() => setPhase('list')}>← Back</button>}
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Record behavioral observations using the ABC (Antecedent-Behavior-Consequence) framework.
          These feed into your clinical analysis and AI recommendations.
        </p>

        {/* ─── Form ─── */}
        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="card">
            <h2 style={{ marginTop: 0 }}>Log New Observation</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Category *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, behavior_type: '' }))} required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="">Select category</option>
                  {Object.entries(categories).map(([key, val]) => (
                    <option key={key} value={key}>{val.label || key.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Behavior Type *</label>
                <select value={form.behavior_type} onChange={e => setForm(f => ({ ...f, behavior_type: e.target.value }))} required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="">Select type</option>
                  {categoryBehaviors.map(b => <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Setting</label>
                <select value={form.setting} onChange={e => setForm(f => ({ ...f, setting: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="">Select setting</option>
                  {SETTING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Duration (min)</label>
                  <input type="number" min="1" value={form.duration_minutes || ''} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Intensity</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {INTENSITY_OPTIONS.map(i => (
                  <button key={i} type="button" onClick={() => setForm(f => ({ ...f, intensity: i }))}
                    style={{
                      padding: '0.5rem 1.5rem', borderRadius: 8, border: '2px solid',
                      borderColor: form.intensity === i ? intensityColors[i] : '#e2e8f0',
                      background: form.intensity === i ? intensityColors[i] + '18' : 'white',
                      color: form.intensity === i ? intensityColors[i] : '#666',
                      cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize',
                    }}>{i}</button>
                ))}
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: 8, marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>ABC Recording</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#2b6cb0' }}>A</span> – Antecedent (What happened before?)
                  </label>
                  <textarea rows={2} value={form.antecedent} onChange={e => setForm(f => ({ ...f, antecedent: e.target.value }))}
                    placeholder="What was happening right before the behavior?"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#c05621' }}>B</span> – Behavior (What happened?) *
                  </label>
                  <textarea rows={2} value={form.behavior_description} onChange={e => setForm(f => ({ ...f, behavior_description: e.target.value }))}
                    required placeholder="Describe the specific behavior observed"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#38a169' }}>C</span> – Consequence (What happened after?)
                  </label>
                  <textarea rows={2} value={form.consequence} onChange={e => setForm(f => ({ ...f, consequence: e.target.value }))}
                    placeholder="What was the result or response to the behavior?"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Additional Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }} />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
              {loading ? 'Saving...' : 'Save Observation'}
            </button>
          </form>
        )}

        {/* ─── List ─── */}
        {phase === 'list' && (
          <div>
            {observations.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No observations recorded yet.</p>
                <button className="btn btn-primary" onClick={() => setPhase('form')}>Log Your First Observation →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {observations.map(o => (
                  <div key={o.id} className="card" style={{ borderLeft: `4px solid ${intensityColors[o.intensity] || '#888'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{(o.category || '').replace(/_/g, ' ')}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>• {(o.behavior_type || '').replace(/_/g, ' ')}</span>
                        </div>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>{o.behavior_description}</p>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          <span>{(() => { const labels = ['Never','Rarely','Sometimes','Often','Very Often']; return typeof o.frequency === 'number' ? (labels[o.frequency] ?? o.frequency) : (o.frequency != null ? String(o.frequency).replace(/_/g, ' ') : ''); })()}</span>
                          <span style={{ color: intensityColors[o.intensity], fontWeight: 600 }}>{o.intensity}</span>
                          {o.setting && <span>{o.setting}</span>}
                          <span>{formatDateOnlyIST(o.observation_date || o.created_at)}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(o.id)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Summary ─── */}
        {phase === 'summary' && summary && (
          <div>
            <h2>Behavioral Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.total_observations}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Total Observations</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{Object.keys(summary.by_category || {}).length}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Categories</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e53e3e' }}>{summary.severe_count || 0}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Severe Episodes</div>
              </div>
            </div>

            {summary.by_category && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3>By Category</h3>
                {Object.entries(summary.by_category).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <span style={{ textTransform: 'capitalize' }}>{cat.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}

            {summary.top_patterns && summary.top_patterns.length > 0 && (
              <div className="card">
                <h3>Top Behavioral Patterns</h3>
                {summary.top_patterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <span><span style={{ textTransform: 'capitalize' }}>{p.category?.replace(/_/g, ' ')}</span> – {p.behavior?.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 700 }}>{p.count}×</span>
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
