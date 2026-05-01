import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { additionalScreeningService } from '../services/clinicalService'
import Navbar from '../components/NavBar'
import { formatDateOnlyIST } from '../utils/formatDate'
import '../index.css'

export default function AdditionalScreening() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('instrument')

  const [instruments, setInstruments] = useState([])
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [phase, setPhase] = useState('select') // select | questions | result | history

  useEffect(() => {
    loadInstruments()
    loadHistory()
  }, [])

  useEffect(() => {
    if (preselected && instruments.length > 0) {
      const inst = instruments.find(i => i.key === preselected)
      if (inst) startInstrument(inst.key)
    }
  }, [preselected, instruments])

  const loadInstruments = async () => {
    try {
      const res = await additionalScreeningService.getInstruments()
      setInstruments(res.data)
    } catch (e) { console.error(e) }
  }

  const loadHistory = async () => {
    try {
      const res = await additionalScreeningService.getHistory()
      setHistory(res.data)
    } catch (e) { console.error(e) }
  }

  const startInstrument = async (key) => {
    setLoading(true)
    try {
      const res = await additionalScreeningService.getQuestions(key)
      setQuestionnaire(res.data)
      setSelectedInstrument(key)
      setAnswers({})
      setCurrentQ(0)
      setPhase('questions')
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const responses = Object.entries(answers).map(([qId, answer]) => ({
        question_id: parseInt(qId),
        answer: answer,
      }))
      const res = await additionalScreeningService.submit({
        instrument: selectedInstrument,
        responses,
      })
      setResult(res.data)
      setPhase('result')
      loadHistory()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const questions = questionnaire?.questions || []
  const responseOptions = questionnaire?.response_options || []
  const totalQ = questions.length
  const answeredCount = Object.keys(answers).length

  const severityColors = {
    non_clinical: '#38a169', within_normal: '#38a169', mild: '#d69e2e',
    moderate: '#dd6b20', severe: '#e53e3e', clinical: '#c53030',
  }

  const instrumentLabels = { raads_r: 'RAADS-R', cast: 'CAST', scq: 'SCQ', srs_2: 'SRS-2' }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>Additional ASD Screening</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {phase !== 'select' && (
              <button className="btn btn-secondary" onClick={() => { setPhase('select'); setResult(null) }}>
                ← Back to Instruments
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setPhase(phase === 'history' ? 'select' : 'history')}>
              {phase === 'history' ? 'Back' : 'View History'}
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Supplementary ASD screening instruments that provide additional clinical evidence alongside the AQ-10.
          These do <strong>not</strong> affect the ML prediction.
        </p>

        {/* ─── Instrument Selection ─── */}
        {phase === 'select' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {instruments.map(inst => (
              <div key={inst.key} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => startInstrument(inst.key)}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>{inst.label}</h3>
                  <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.75rem' }}>
                    {inst.age_range}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {inst.description}
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }}>Start Assessment →</button>
              </div>
            ))}
          </div>
        )}

        {/* ─── Questions ─── */}
        {phase === 'questions' && questionnaire && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>{questionnaire.title}</h2>
              <span style={{ color: 'var(--text-secondary)' }}>{answeredCount}/{totalQ} answered</span>
            </div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginBottom: '1.5rem' }}>
              <div style={{ height: '100%', width: `${(answeredCount / totalQ) * 100}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{questionnaire.description}</p>

            {/* Question cards - show all for scrollable view */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {questions.map((q, idx) => (
                <div key={q.id} className="card" style={{ border: answers[q.id] !== undefined ? '2px solid var(--primary)' : '2px solid transparent' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: 28 }}>{idx + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ marginBottom: '0.75rem', fontWeight: 500 }}>{q.text}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(q.options || responseOptions).map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleAnswer(q.id, opt.value)}
                            style={{
                              padding: '0.5rem 1rem', borderRadius: 8, border: '2px solid',
                              borderColor: answers[q.id] === opt.value ? 'var(--primary)' : '#e2e8f0',
                              background: answers[q.id] === opt.value ? 'var(--primary)' : 'white',
                              color: answers[q.id] === opt.value ? 'white' : 'var(--text-primary)',
                              cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
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
              <button className="btn btn-primary" disabled={answeredCount < totalQ || loading}
                onClick={handleSubmit} style={{ padding: '0.75rem 3rem', fontSize: '1.1rem' }}>
                {loading ? 'Submitting...' : `Submit (${answeredCount}/${totalQ})`}
              </button>
            </div>
          </div>
        )}

        {/* ─── Result ─── */}
        {phase === 'result' && result && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '0.5rem' }}>{instrumentLabels[result.instrument] || result.instrument} Results</h2>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: severityColors[result.severity] || 'var(--text-primary)' }}>
                {result.total_score}<span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>/{result.max_score}</span>
              </div>
              <div style={{
                display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: 20, fontWeight: 600, marginTop: '0.5rem',
                background: (severityColors[result.severity] || '#888') + '18',
                color: severityColors[result.severity] || '#888',
              }}>
                {(result.severity || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            </div>

            {result.domain_scores && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3>Domain Scores</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {Object.entries(result.domain_scores).map(([key, val]) => (
                    <div key={key} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.interpretation && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3>Clinical Interpretation</h3>
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
              <p style={{ color: 'var(--text-secondary)' }}>No additional screenings completed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {history.map(s => (
                  <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{instrumentLabels[s.instrument] || s.instrument}</h3>
                      <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {formatDateOnlyIST(s.completed_at)} • Score: {s.total_score}/{s.max_score}
                      </p>
                    </div>
                    <span style={{
                      padding: '0.4rem 1rem', borderRadius: 16, fontWeight: 600, fontSize: '0.85rem',
                      background: (severityColors[s.severity] || '#888') + '18',
                      color: severityColors[s.severity] || '#888',
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
