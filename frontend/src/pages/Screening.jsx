/**
 * AQ-10 Screening Page
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NavBar from '../components/NavBar'
import screeningService from '../services/screeningService'
import './Screening.css'

function Screening() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [startTime, setStartTime] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  // Pre-screening state
  const [showPreScreening, setShowPreScreening] = useState(true)
  const [preScreening, setPreScreening] = useState({
    family_asd: '',
    jaundice: '',
    completed_by: ''
  })
  // Profile completeness state
  const [profileGender, setProfileGender] = useState(user?.gender || '')
  const [profileEthnicity, setProfileEthnicity] = useState(user?.ethnicity || '')
  const [profileSaving, setProfileSaving] = useState(false)

  const profileComplete = !!(user?.gender && user?.ethnicity && user?.date_of_birth)
  const preScreeningComplete = preScreening.family_asd && preScreening.jaundice && preScreening.completed_by

  const startScreening = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await screeningService.startScreening({
        family_asd: preScreening.family_asd,
        jaundice: preScreening.jaundice,
        completed_by: preScreening.completed_by
      })
      setSession({ id: data.session_id, started_at: data.started_at })
      setQuestions(data.questions)
      setStartTime(Date.now())
      setShowPreScreening(false)
    } catch (err) {
      setError('Failed to start screening. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setProfileSaving(true)
      await updateUser({ gender: profileGender, ethnicity: profileEthnicity })
    } catch (err) {
      setError('Failed to save profile. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAnswer = useCallback((questionId, optionId) => {
    const responseTime = Date.now() - startTime
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        selected_option_id: optionId,
        response_time_ms: responseTime
      }
    }))
    setStartTime(Date.now())
  }, [startTime])

  const goToNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1)
  }
  const goToPrevious = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1)
  }
  const goToQuestion = (index) => setCurrentIndex(index)

  const submitScreening = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all questions before submitting.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const answersArray = Object.values(answers)
      const resultData = await screeningService.submitScreening(session.id, answersArray)
      setResult(resultData)
    } catch (err) {
      setError('Failed to submit screening. Please try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // Compute age group label
  const getAgeGroupLabel = () => {
    if (!user?.date_of_birth) return null
    const dob = new Date(user.date_of_birth)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    if (age <= 11) return 'Child (4–11)'
    if (age <= 15) return 'Adolescent (12–15)'
    return 'Adult (16+)'
  }
  const ageGroupLabel = getAgeGroupLabel()

  const currentQuestion = questions[currentIndex]
  const isAnswered = currentQuestion && answers[currentQuestion.id]
  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length
  const progress = questions.length > 0 ? (Object.keys(answers).length / questions.length) * 100 : 0

  // Pre-screening / profile gate
  if (showPreScreening && !session) {
    return (
      <div className="screening-container">
        <NavBar />
        <div className="screening-inner">
          <div className="screening-header">
            <h1>AQ-10 Screening</h1>
            <p className="screening-subtitle">Before we begin, please complete the following details.</p>
          </div>

          {/* Profile completeness check */}
          {!profileComplete && (
            <div className="pre-screening-card">
              <h3>Complete Your Profile</h3>
              <p className="pre-screening-note">Gender and ethnicity are required before taking the screening.</p>
              {!user?.date_of_birth && (
                <p className="pre-screening-warning">⚠ Date of birth is required. Please update it on your <Link to="/profile">Profile page</Link>.</p>
              )}
              <div className="pre-form-grid">
                {!user?.gender && (
                  <div className="form-field">
                    <label>Gender</label>
                    <select value={profileGender} onChange={e => setProfileGender(e.target.value)}>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
                {!user?.ethnicity && (
                  <div className="form-field">
                    <label>Ethnicity</label>
                    <select value={profileEthnicity} onChange={e => setProfileEthnicity(e.target.value)}>
                      <option value="">Select ethnicity</option>
                      <option value="Asian">Asian</option>
                      <option value="Middle Eastern">Middle Eastern</option>
                      <option value="White European">White European</option>
                      <option value="Hispanic">Hispanic</option>
                      <option value="Latino">Latino</option>
                      <option value="South Asian">South Asian</option>
                      <option value="Mixed">Mixed</option>
                      <option value="Native Indian">Native Indian</option>
                      <option value="Pacifica">Pacifica</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                )}
              </div>
              {(profileGender || profileEthnicity) && (
                <button
                  className="btn btn-primary"
                  onClick={handleSaveProfile}
                  disabled={profileSaving || (!profileGender && !user?.gender) || (!profileEthnicity && !user?.ethnicity)}
                >
                  {profileSaving ? 'Saving…' : 'Save Profile'}
                </button>
              )}
            </div>
          )}

          {/* Pre-screening questions */}
          {profileComplete && (
            <div className="pre-screening-card">
              <h3>Pre-Screening Information</h3>
              {ageGroupLabel && <span className="age-group-badge">{ageGroupLabel} Screening</span>}
              <div className="pre-form-grid">
                <div className="form-field">
                  <label>Family member with ASD?</label>
                  <div className="radio-group">
                    <label className={`radio-option ${preScreening.family_asd === 'Yes' ? 'selected' : ''}`}>
                      <input type="radio" name="family_asd" value="Yes" checked={preScreening.family_asd === 'Yes'} onChange={e => setPreScreening(p => ({ ...p, family_asd: e.target.value }))} />
                      Yes
                    </label>
                    <label className={`radio-option ${preScreening.family_asd === 'No' ? 'selected' : ''}`}>
                      <input type="radio" name="family_asd" value="No" checked={preScreening.family_asd === 'No'} onChange={e => setPreScreening(p => ({ ...p, family_asd: e.target.value }))} />
                      No
                    </label>
                  </div>
                </div>
                <div className="form-field">
                  <label>Jaundice at birth?</label>
                  <div className="radio-group">
                    <label className={`radio-option ${preScreening.jaundice === 'Yes' ? 'selected' : ''}`}>
                      <input type="radio" name="jaundice" value="Yes" checked={preScreening.jaundice === 'Yes'} onChange={e => setPreScreening(p => ({ ...p, jaundice: e.target.value }))} />
                      Yes
                    </label>
                    <label className={`radio-option ${preScreening.jaundice === 'No' ? 'selected' : ''}`}>
                      <input type="radio" name="jaundice" value="No" checked={preScreening.jaundice === 'No'} onChange={e => setPreScreening(p => ({ ...p, jaundice: e.target.value }))} />
                      No
                    </label>
                  </div>
                </div>
                <div className="form-field">
                  <label>Who is completing this test?</label>
                  <select value={preScreening.completed_by} onChange={e => setPreScreening(p => ({ ...p, completed_by: e.target.value }))}>
                    <option value="">Select…</option>
                    <option value="Self">Self</option>
                    <option value="Family Member">Family Member</option>
                    <option value="Health Care Professional">Health Care Professional</option>
                    <option value="School and NGO">School and NGO</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              {error && <div className="screening-inline-error">⚠ {error}</div>}
              <div className="pre-screening-actions">
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Cancel</button>
                <button onClick={startScreening} disabled={!preScreeningComplete || loading} className="btn btn-primary">
                  {loading ? 'Starting…' : 'Begin Screening →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="screening-container">
        <div className="screening-loading">
          <div className="spinner"></div>
          <p>Loading questionnaire…</p>
        </div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="screening-container">
        <div className="screening-error">
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button onClick={startScreening} className="btn btn-primary">Try Again</button>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Back to Dashboard</button>
        </div>
      </div>
    )
  }

  if (result) {
    return <ScreeningResultInline result={result} onNewScreening={() => {
      setResult(null); setAnswers({}); setCurrentIndex(0); setShowPreScreening(true)
    }} />
  }

  return (
    <div className="screening-container">
      <NavBar />

      <div className="screening-inner">
        <div className="screening-header">
          <h1>AQ-10 Screening</h1>
          <p className="screening-subtitle">
            Answer the following questions based on how you typically behave or feel.
          </p>
        </div>

        {/* Progress bar */}
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="progress-text">{Object.keys(answers).length} of {questions.length} answered</span>
        </div>

        {/* Question navigation dots */}
        <div className="question-nav">
          {questions.map((q, index) => (
            <button
              key={q.id}
              className={`nav-dot ${index === currentIndex ? 'active' : ''} ${answers[q.id] ? 'answered' : ''}`}
              onClick={() => goToQuestion(index)}
              title={`Question ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {/* Current question */}
        {currentQuestion && (
          <div className="question-card">
            <div className="question-number">Question {currentIndex + 1} of {questions.length}</div>
            <h2 className="question-text">{currentQuestion.text}</h2>
            <div className="options-list">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.id}
                  className={`option-button ${answers[currentQuestion.id]?.selected_option_id === option.id ? 'selected' : ''}`}
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                >
                  {option.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && <div className="screening-inline-error">⚠ {error}</div>}

        {/* Navigation buttons */}
        <div className="navigation-buttons">
          <button onClick={goToPrevious} disabled={currentIndex === 0} className="btn btn-secondary">← Previous</button>
          {currentIndex < questions.length - 1 ? (
            <button onClick={goToNext} disabled={!isAnswered} className="btn btn-primary">Next →</button>
          ) : (
            <button onClick={submitScreening} disabled={!allAnswered || submitting} className="btn btn-success">
              {submitting ? (
                <span className="submitting-label">
                  <span className="spinner-inline"></span>
                  Analysing with AI…
                </span>
              ) : 'Submit Screening ✓'}
            </button>
          )}
        </div>

        <div className="screening-footer">
          <button onClick={() => navigate('/dashboard')} className="link-button">
            Save & Exit (you can resume later)
          </button>
        </div>
      </div>
    </div>
  )
}


/**
 * Screening Result Component (inline, after completing test)
 */
function ScreeningResultInline({ result, onNewScreening }) {
  const navigate = useNavigate()

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'green'
      case 'moderate': return 'yellow'
      case 'high': return 'red'
      default: return 'gray'
    }
  }

  const getProbabilityConfig = (label) => {
    switch (label?.toLowerCase()) {
      case 'low':
        return { color: 'green', text: 'Low Likelihood', icon: '✓', desc: 'The AI model did not detect significant ASD-related patterns in your responses.' }
      case 'moderate':
        return { color: 'yellow', text: 'Moderate Likelihood', icon: '⚠', desc: 'The AI model detected some ASD-related patterns. A professional evaluation may be helpful.' }
      case 'high':
        return { color: 'orange', text: 'High Likelihood', icon: '⚠', desc: 'The AI model detected notable ASD-related patterns. Professional evaluation is recommended.' }
      case 'very_high':
        return { color: 'red', text: 'Very High Likelihood', icon: '!', desc: 'The AI model detected strong ASD-related patterns. We strongly recommend seeking a professional evaluation.' }
      default:
        return { color: 'gray', text: 'Assessment Unavailable', icon: '?', desc: 'ML prediction could not be computed. Use the AQ score above as a guide.' }
    }
  }

  const riskColor = getRiskColor(result.risk_level)
  const probConfig = getProbabilityConfig(result.ml_probability_label)
  const mlPrediction = result.ml_prediction  // 0 or 1

  return (
    <div className="screening-container">
      <NavBar />
      <div className="result-card">
        <div className="result-header">
          <h1>Screening Complete</h1>
          <p className="result-date">
            Completed on {new Date(result.completed_at).toLocaleDateString()}
          </p>
        </div>

        {/* AQ Score display */}
        <div className={`score-display score-${riskColor}`}>
          <div className="score-circle">
            <span className="score-value">{result.raw_score}</span>
            <span className="score-max">/{result.max_score}</span>
          </div>
          <div className="risk-label">
            AQ Score Risk: <strong className="capitalize">{result.risk_level}</strong>
          </div>
        </div>

        {/* ML Prediction Block */}
        <div className={`ml-prediction-block ml-${probConfig.color}`}>
          <div className="ml-prediction-header">
            <span className="ml-icon">{probConfig.icon}</span>
            <div>
              <h3>AI Model Assessment</h3>
              <span className="ml-probability-label">{probConfig.text}</span>
            </div>
            <div className="ml-badge">
              {mlPrediction === 1 ? 'ASD Traits Detected' : mlPrediction === 0 ? 'No ASD Traits Detected' : 'N/A'}
            </div>
          </div>
          <p className="ml-description">{probConfig.desc}</p>
        </div>

        {/* Risk description */}
        <div className="result-description">
          <p>{result.risk_description}</p>
        </div>

        {/* Connect to professional suggestion */}
        {(result.risk_level?.toLowerCase() === 'moderate' || result.risk_level?.toLowerCase() === 'high') && (
          <div className="connect-professional-banner">
            <p>Based on your results, we recommend consulting with a professional.</p>
            <button onClick={() => navigate('/connect-professional')} className="btn btn-primary">
              Connect to a Professional →
            </button>
          </div>
        )}

        {/* Recommendations */}
        <div className="recommendations">
          <h3>Recommendations</h3>
          <ul>
            {result.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="disclaimer">
          <strong>Important:</strong> This screening tool is not a diagnostic instrument. 
          It is designed to help identify traits that may warrant further professional evaluation. 
          Only a qualified healthcare professional can provide a diagnosis.
        </div>

        {/* Actions */}
        <div className="result-actions">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={() => navigate('/connect-professional')}
            className="btn btn-secondary"
          >
            Connect to Professional
          </button>
          <button 
            onClick={() => navigate('/screening/history')}
            className="btn btn-secondary"
          >
            View History
          </button>
          <button 
            onClick={onNewScreening}
            className="btn btn-outline"
          >
            Take Another Screening
          </button>
        </div>
      </div>
    </div>
  )
}

export default Screening
