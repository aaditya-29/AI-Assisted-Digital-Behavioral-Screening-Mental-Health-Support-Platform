import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { comorbidityService } from '../services/clinicalService'
import Navbar from '../components/NavBar'
import { formatDateOnlyIST } from '../utils/formatDate'
import '../index.css'

export default function ComorbidityScreening() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('instrument')

  const [instruments, setInstruments] = useState([])
  const [questionnaire, setQuestionnaire] = useState(null)
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [phase, setPhase] = useState('select')

  useEffect(() => { loadInstruments(); loadHistory() }, [])
  useEffect(() => {
    if (preselected && instruments.length > 0) startInstrument(preselected)
  }, [preselected, instruments])

  const loadInstruments = async () => {
    try { const res = await comorbidityService.getInstruments(); setInstruments(res.data) } catch (e) { console.error(e) }
  }
  const loadHistory = async () => {
    try { const res = await comorbidityService.getHistory(); setHistory(res.data) } catch (e) { console.error(e) }
  }

  const startInstrument = async (key) => {
    setLoading(true)
    try {
      const res = await comorbidityService.getQuestions(key)
      setQuestionnaire(res.data)
      setSelectedInstrument(key)
      setAnswers({})
      setPhase('questions')
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleAnswer = (qId, value) => setAnswers(prev => ({ ...prev, [qId]: value }))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const responses = Object.entries(answers).map(([qId, answer]) => ({ question_id: parseInt(qId), answer }))
      const res = await comorbidityService.submit({ instrument: selectedInstrument, responses })
      setResult(res.data)
      setPhase('result')
      loadHistory()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const questions = questionnaire?.questions || []
  const totalQ = questions.length
  const answeredCount = Object.keys(answers).length

  const severityColors = {
    minimal: '#38a169', unlikely: '#38a169', mild: '#d69e2e', possible: '#d69e2e',
    moderate: '#dd6b20', moderately_severe: '#e53e3e', severe: '#c53030', likely: '#c53030',
  }
  const conditionIcons = { phq9: '😔', gad7: '😰', asrs: '🧠' }
  const conditionColors = { phq9: '#6b46c1', gad7: '#2b6cb0', asrs: '#c05621' }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>Comorbidity Screening</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {phase !== 'select' && <button className="btn btn-secondary" onClick={() => { setPhase('select'); setResult(null) }}>← Back</button>}
            <button className="btn btn-secondary" onClick={() => setPhase(phase === 'history' ? 'select' : 'history')}>
              {phase === 'history' ? 'Back' : 'History'}
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Screen for commonly co-occurring conditions with ASD: depression, anxiety, and ADHD. 
          Results feed into your overall analysis and AI recommendations.
        </p>

        {/* ─── Select ─── */}
        {phase === 'select' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {instruments.map(inst => (
              <div key={inst.key} className="card" style={{ cursor: 'pointer', borderLeft: `4px solid ${conditionColors[inst.key] || '#666'}` }}
                onClick={() => startInstrument(inst.key)}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{conditionIcons[inst.key]}</div>
                <h3 style={{ margin: '0 0 0.25rem' }}>{inst.label}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.25rem' }}>{inst.full_name}</p>
                <span className="badge" style={{ background: conditionColors[inst.key] + '18', color: conditionColors[inst.key], marginBottom: '0.75rem', display: 'inline-block' }}>
                  {inst.condition}
                </span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{inst.description}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{inst.question_count} questions</p>
              </div>
            ))}
          </div>
        )}

        {/* ─── Questions ─── */}
        {phase === 'questions' && questionnaire && (
          <div>
            <h2>{questionnaire.title}</h2>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginBottom: '1.5rem' }}>
              <div style={{ height: '100%', width: `${(answeredCount / totalQ) * 100}%`, background: conditionColors[selectedInstrument] || 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{questionnaire.description}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {questions.map((q, idx) => (
                <div key={q.id} className="card" style={{ border: answers[q.id] !== undefined ? `2px solid ${conditionColors[selectedInstrument] || 'var(--primary)'}` : '2px solid transparent' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: conditionColors[selectedInstrument] || 'var(--primary)', minWidth: 28 }}>{idx + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ marginBottom: '0.75rem', fontWeight: 500 }}>{q.text}</p>
                      {q.domain && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{q.domain}</span>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {(q.options || questionnaire.response_options).map(opt => (
                          <button key={opt.value} onClick={() => handleAnswer(q.id, opt.value)}
                            style={{
                              padding: '0.5rem 1rem', borderRadius: 8, border: '2px solid',
                              borderColor: answers[q.id] === opt.value ? (conditionColors[selectedInstrument] || 'var(--primary)') : '#e2e8f0',
                              background: answers[q.id] === opt.value ? (conditionColors[selectedInstrument] || 'var(--primary)') : 'white',
                              color: answers[q.id] === opt.value ? 'white' : 'var(--text-primary)',
                              cursor: 'pointer', fontSize: '0.85rem',
                            }}>
                            {opt.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button className="btn btn-primary" disabled={answeredCount < totalQ || loading} onClick={handleSubmit}
                style={{ padding: '0.75rem 3rem', fontSize: '1.1rem', background: conditionColors[selectedInstrument] }}>
                {loading ? 'Submitting...' : `Submit (${answeredCount}/${totalQ})`}
              </button>
            </div>
          </div>
        )}

        {/* ─── Result ─── */}
        {phase === 'result' && result && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{conditionIcons[result.instrument]}</div>
              <h2>{instruments.find(i => i.key === result.instrument)?.full_name || result.instrument}</h2>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: severityColors[result.severity] || '#666' }}>
                {result.total_score}<span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>/{result.max_score}</span>
              </div>
              <div style={{
                display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: 20, fontWeight: 600,
                background: (severityColors[result.severity] || '#888') + '18',
                color: severityColors[result.severity] || '#888',
              }}>
                {(result.severity || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            </div>

            {result.clinical_flags && Object.keys(result.clinical_flags).length > 0 && (
              <div className="card" style={{ borderLeft: '4px solid #e53e3e', marginBottom: '1rem' }}>
                <h3 style={{ color: '#e53e3e' }}>⚠ Clinical Flags</h3>
                {result.clinical_flags.suicidal_ideation && (
                  <p style={{ fontWeight: 600 }}>Positive response on suicidal ideation item. Please seek immediate support if you are in crisis. 
                    Contact: National Suicide Prevention Lifeline <strong>988</strong> or Crisis Text Line: Text HOME to <strong>741741</strong>.</p>
                )}
                {result.clinical_flags.asrs_threshold_met && (
                  <p>ADHD screening threshold met on key items. Consider a comprehensive ADHD evaluation.</p>
                )}
              </div>
            )}

            {result.interpretation && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3>Interpretation</h3>
                <p style={{ lineHeight: 1.6 }}>{result.interpretation}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => navigate('/analysis')}>View Full Analysis →</button>
              <button className="btn btn-secondary" onClick={() => { setPhase('select'); setResult(null) }}>Take Another</button>
            </div>
          </div>
        )}

        {/* ─── History ─── */}
        {phase === 'history' && (
          <div>
            <h2>Screening History</h2>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No comorbidity screenings completed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {history.map(s => (
                  <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${conditionColors[s.instrument] || '#666'}` }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{conditionIcons[s.instrument]}</span>
                        <h3 style={{ margin: 0 }}>{instruments.find(i => i.key === s.instrument)?.label || s.instrument.toUpperCase()}</h3>
                      </div>
                      <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {formatDateOnlyIST(s.completed_at)} • Score: {s.total_score}/{s.max_score}
                      </p>
                    </div>
                    <span style={{
                      padding: '0.4rem 1rem', borderRadius: 16, fontWeight: 600, fontSize: '0.85rem',
                      background: (severityColors[s.severity] || '#888') + '18', color: severityColors[s.severity] || '#888',
                    }}>
                      {(s.severity || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
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
