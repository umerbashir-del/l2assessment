import { copyResults } from '../utils/clipboard'
import { appendHistory } from '../utils/historyStorage'
import StorageWarning from '../components/StorageWarning'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { categorizeMessage } from '../utils/llmHelper'
import { assessUrgency, impactQuestions } from '../utils/urgencyScorer'
import { getRecommendedAction } from '../utils/templates'

function AnalyzePage() {
  const [copyStatus, setCopyStatus] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const [message, setMessage] = useState('')
  const [impact, setImpact] = useState({})
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check for example message from home page
    let exampleMessage
    try { exampleMessage = localStorage.getItem('exampleMessage'); localStorage.removeItem('exampleMessage') } catch { setStorageWarning('Browser storage is unavailable. You can still analyze messages, but history may not save.') }
    if (exampleMessage) {
      setMessage(exampleMessage)

    }
  }, [])

  const handleAnalyze = async () => {
    if (!message.trim()) {
      alert('Please enter a message to analyze')
      return
    }

    setIsLoading(true)
    setResults(null)
    setCopyStatus('')
    
    try {
      // Run categorization (LLM call)
      const { category, categories, issues, reasoning, source, fallbackCode, fallbackReason } = await categorizeMessage(message)
      
      // Calculate urgency (rule-based)
      const { urgency, explanation: urgencyExplanation, clarification } = assessUrgency(impact, issues)
      
      // Get recommended action (template-based)
      const recommendedAction = getRecommendedAction(issues, urgency)
      
      const analysisResult = {
        message,
        category,
        categories,
        issues,
        source,
        fallbackCode,
        fallbackReason,
        urgency,
        impact: { ...impact },
        urgencyExplanation,
        clarification,
        recommendedAction,
        reasoning,
        timestamp: new Date().toISOString()
      }

      setResults(analysisResult)

      // Save to history
      setStorageWarning(appendHistory(analysisResult).warning)
    } catch (error) {
      console.error('Error analyzing message:', error)
      alert('Error analyzing message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setMessage('')
    setImpact({})
    setResults(null)
    setCopyStatus('')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analyze Customer Message</h1>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to automatically categorize and prioritize.
          </p>

          <StorageWarning message={storageWarning} />
          {/* Input Section */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setImpact({})
                setResults(null)
    setCopyStatus('')
              }}
              placeholder="Paste customer message here..."
              className="w-full border border-gray-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <div className="text-sm text-gray-500 mt-1">
              {message.length} characters
            </div>
          </div>

          <fieldset className="mb-6 space-y-3" disabled={isLoading}>
            <legend className="font-semibold text-gray-900 mb-2">Reported impact</legend>
            <p className="text-sm text-gray-600">Answer from the customer's report. Unknown answers require review; message length and punctuation do not affect urgency.</p>
            {impactQuestions.map(([key, question]) => (
              <label key={key} className="flex items-center justify-between gap-4 text-sm">
                <span>{question}</span>
                <select className="border rounded p-2" value={impact[key] || 'unknown'}
                  onChange={e => setImpact({ ...impact, [key]: e.target.value })}>
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            ))}
          </fieldset>
          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Message'
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Analysis Results</h2>
            <p className="text-sm text-gray-600 mb-4">Source: {results.source === 'local' ? 'Local rules' : 'AI-based'}</p>
            
            {results.fallbackReason && <p role="status" className="text-sm text-amber-900 mb-4">Using local rules: {results.fallbackReason}</p>}
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Category</div>
                <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
                  {results.categories.join(' · ')}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Urgency Level</div>
                <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${
                  results.urgency === 'Needs Review' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                  results.urgency === 'High' ? 'bg-red-200 text-red-900' :
                  results.urgency === 'Medium' ? 'bg-yellow-200 text-yellow-900' :
                  'bg-green-200 text-green-900'
                }`}>
                  {results.urgency}
                </div>
              </div>

              <p className="text-sm text-gray-700">{results.urgencyExplanation}</p>
              {results.clarification && <p role="alert" className="bg-purple-50 border border-purple-300 text-purple-900 rounded p-4">{results.clarification} Update the impact answers above and analyze again.</p>}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Recommended Action</div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-gray-800">{results.recommendedAction}</p>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">{results.source === 'local' ? 'Local rules — detected evidence' : 'AI-based — detected evidence'}</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>
                      {results.reasoning}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              {copyStatus && <p role="status" className="text-sm text-gray-800 mb-3">{copyStatus}</p>}
              <button
                onClick={async () => {
                  const text = `Category: ${results.categories.join(' · ')}\nUrgency: ${results.urgency}\nRecommendation: ${results.recommendedAction}\n\nReasoning: ${results.reasoning}\n\nUrgency explanation: ${results.urgencyExplanation}\nSource: ${results.source === 'local' ? 'Local rules' : 'AI-based'}`
                  const copied = await copyResults(text + (results.clarification ? '\nClarification needed: ' + results.clarification : '') + (results.fallbackReason ? '\nWhy local rules: ' + results.fallbackReason : ''))
                  setCopyStatus(copied.message)
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-semibold"
              >
                📋 Copy Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyzePage












