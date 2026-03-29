/**
 * Screening Result Detail Page
 * 
 * Shows detailed results of a specific screening session.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import screeningService from '../services/screeningService'
import NavBar from '../components/NavBar'
import './ScreeningResult.css'

function ScreeningResultDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchResult()
  }, [sessionId])

  const fetchResult = async () => {
    try {
      setLoading(true)
      const data = await screeningService.getResult(sessionId)
      setResult(data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Screening result not found')
      } else {
        setError('Failed to load screening result')
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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
        return { color: 'green', text: 'Low Likelihood', desc: 'AI model did not detect significant ASD-related patterns.' }
      case 'moderate':
        return { color: 'yellow', text: 'Moderate Likelihood', desc: 'AI model detected some ASD-related patterns. Consider a professional evaluation.' }
      case 'high':
        return { color: 'orange', text: 'High Likelihood', desc: 'AI model detected notable ASD-related patterns. Professional evaluation is recommended.' }
      case 'very_high':
        return { color: 'red', text: 'Very High Likelihood', desc: 'AI model detected strong ASD-related patterns. Professional evaluation is strongly recommended.' }
      default:
        return { color: 'gray', text: 'Assessment Unavailable', desc: 'ML prediction was not available for this session.' }
    }
  }

  if (loading) {
    return (
      <div className="result-detail-container">
        <div className="result-loading">
          <div className="spinner"></div>
          <p>Loading result...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="result-detail-container">
        <div className="result-error">
          <h2>Error</h2>
          <p>{error}</p>
          <Link to="/screening/history" className="btn btn-primary">
            Back to History
          </Link>
        </div>
      </div>
    )
  }

  const riskColor = getRiskColor(result.risk_level)
  const probConfig = getProbabilityConfig(result.ml_probability_label)

  return (
    <div className="result-detail-container">
      <NavBar />
      {/* Header */}
      <div className="result-detail-header">
        <Link to="/screening/history" className="back-link">
          ← Back to History
        </Link>
        <h1>Screening Result</h1>
        <p className="result-date">
          {new Date(result.completed_at).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Score Summary */}
      <div className={`score-summary score-${riskColor}`}>
        <div className="score-main">
          <span className="score-number">{result.raw_score}</span>
          <span className="score-of">/ {result.max_score}</span>
        </div>
        <div className="risk-info">
          <span className="risk-level capitalize">AQ Score: {result.risk_level} Risk</span>
        </div>
      </div>

      {/* ML Prediction Block */}
      {result.ml_probability_label && (
        <div className={`ml-prediction-block ml-${probConfig.color}`}>
          <div className="ml-prediction-header">
            <div>
              <h3>AI Model Assessment</h3>
              <span className="ml-probability-label">{probConfig.text}</span>
            </div>
            <div className="ml-badge">
              {result.ml_risk_score != null
                ? `${(result.ml_risk_score * 100).toFixed(1)}% probability`
                : result.ml_prediction === 1 ? 'ASD Traits Detected' : 'No ASD Traits Detected'
              }
            </div>
          </div>
          <p className="ml-description">{probConfig.desc}</p>
        </div>
      )}

      {/* Description */}
      <div className="section">
        <h2>What This Means</h2>
        <p className="description-text">{result.risk_description}</p>
      </div>

      {/* Connect to professional suggestion */}
      {(result.risk_level?.toLowerCase() === 'moderate' || result.risk_level?.toLowerCase() === 'high') && (
        <div className="connect-professional-banner">
          <p>Based on your results, we recommend consulting with a professional for further evaluation.</p>
          <button onClick={() => navigate('/connect-professional')} className="btn btn-primary">
            Connect to a Professional →
          </button>
        </div>
      )}

      {/* Recommendations */}
      <div className="section">
        <h2>Recommendations</h2>
        <div className="recommendations-list">
          {result.recommendations.map((rec, index) => (
            <div key={index} className="recommendation-item">
              <span className="rec-icon">✓</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Response Details */}
      <div className="section">
        <h2>Your Responses</h2>
        <div className="responses-list">
          {result.responses.map((response, index) => (
            <div key={index} className="response-item">
              <div className="response-question">
                <span className="question-number">Q{index + 1}</span>
                <span className="question-text">{response.question_text}</span>
              </div>
              <div className="response-answer">
                <span className="answer-text">{response.selected_option_text}</span>
                <span className={`answer-score ${response.score_value > 0 ? 'scored' : ''}`}>
                  {response.score_value > 0 ? `+${response.score_value}` : '0'}
                </span>
              </div>
              {response.response_time_ms && (
                <div className="response-time">
                  Response time: {(response.response_time_ms / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer-box">
        <strong>Important Disclaimer:</strong> This screening tool is not a diagnostic instrument. 
        The AQ-10 is designed to identify traits that may warrant further professional evaluation. 
        Only a qualified healthcare professional can provide a diagnosis of autism spectrum disorder. 
        If you have concerns, please consult with a healthcare provider.
      </div>

      {/* Actions */}
      <div className="result-detail-actions">
        <button onClick={() => navigate('/screening')} className="btn btn-primary">
          Take New Screening
        </button>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          Back to Dashboard
        </button>
        <button onClick={() => window.print()} className="btn btn-outline">
          Print Results
        </button>
      </div>
    </div>
  )
}

export default ScreeningResultDetail
