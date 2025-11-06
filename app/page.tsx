'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type AppScreen = 'dashboard' | 'explanation' | 'quiz' | 'results'
type MasteryLevel = 'Beginner' | 'Intermediate' | 'Advanced'

interface ExplanationSection {
  title: string
  content: string
  example?: string
  visual_description?: string
}

interface QuizQuestion {
  question_number: number
  difficulty: string
  question_text: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
}

interface StudentAnswer {
  question_number: number
  student_answer: string
  is_correct: boolean
  feedback: string
}

interface QuizResult {
  score: number
  total: number
  mastery_level: MasteryLevel
  answers: StudentAnswer[]
}

const SAMPLE_TOPICS = [
  { name: 'Photosynthesis', category: 'Science' },
  { name: 'Fractions', category: 'Math' },
  { name: 'Water Cycle', category: 'Science' },
  { name: 'Verbs', category: 'English' },
  { name: 'Solar System', category: 'Science' },
  { name: 'Decimals', category: 'Math' },
]

export default function HomePage() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [explanationContent, setExplanationContent] = useState<ExplanationSection[]>([])
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [showFeedback, setShowFeedback] = useState<boolean>(false)
  const [currentAnswerFeedback, setCurrentAnswerFeedback] = useState<StudentAnswer | null>(null)
  const [learningHistory, setLearningHistory] = useState<string[]>([])

  // Load learning history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('learningHistory')
    if (history) {
      setLearningHistory(JSON.parse(history))
    }
  }, [])

  // Save topic to learning history
  const saveTopic = (topic: string) => {
    const updated = [topic, ...learningHistory.filter(t => t !== topic)].slice(0, 3)
    setLearningHistory(updated)
    localStorage.setItem('learningHistory', JSON.stringify(updated))
  }

  const callLearningAgent = async (
    message: string,
    requestType: 'explain' | 'quiz' | 'evaluate'
  ) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          agent_id: '68fd263d71c6b27d6c8eb80f',
          request_type: requestType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.error || data.details || 'Failed to fetch from agent'
        throw new Error(errorMsg)
      }

      if (!data.success) {
        throw new Error(data.details || 'Agent request failed')
      }

      return data.response
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred'
      console.error('Agent call error:', errorMsg)
      setError(errorMsg)
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleStartLearning = async (topic: string) => {
    setSelectedTopic(topic)
    saveTopic(topic)

    const explanationData = await callLearningAgent(
      `Explain the concept of "${topic}" in simple language suitable for rural students. Use rural-context examples like farming, local environment, and daily life. Provide step-by-step breakdown.`,
      'explain'
    )

    if (explanationData) {
      // Parse explanation sections from response
      const sections = explanationData.explanation_sections || [
        {
          title: `Introduction to ${topic}`,
          content: explanationData.content || explanationData.explanation || '',
          example: explanationData.example || '',
          visual_description: explanationData.visual_description || '',
        },
      ]
      setExplanationContent(sections)
      setCurrentScreen('explanation')
    }
  }

  const handleStartQuiz = async () => {
    const quizData = await callLearningAgent(
      `Generate 8 multiple choice questions to test understanding of "${selectedTopic}". Include mix of easy, medium, and hard difficulty. Return questions directly tied to the concept.`,
      'quiz'
    )

    if (quizData) {
      const questions = quizData.questions || [quizData]
      setQuizQuestions(questions)
      setCurrentQuestionIndex(0)
      setSelectedAnswers({})
      setShowFeedback(false)
      setCurrentScreen('quiz')
    }
  }

  const handleSubmitAnswer = async () => {
    const currentQuestion = quizQuestions[currentQuestionIndex]
    const studentAnswer = selectedAnswers[currentQuestionIndex]

    if (!studentAnswer) {
      setError('Please select an answer')
      return
    }

    const evaluationData = await callLearningAgent(
      `Evaluate this answer: Question: "${currentQuestion.question_text}" Student's answer: "${studentAnswer}" (option). Correct answer: "${currentQuestion.correct_answer}". Provide detailed feedback explaining why the correct answer is right and why the student's answer might be wrong.`,
      'evaluate'
    )

    if (evaluationData) {
      const feedback: StudentAnswer = {
        question_number: currentQuestion.question_number,
        student_answer: studentAnswer,
        is_correct: studentAnswer === currentQuestion.correct_answer,
        feedback:
          evaluationData.feedback ||
          evaluationData.explanation ||
          `Correct answer: ${currentQuestion.correct_answer}`,
      }
      setCurrentAnswerFeedback(feedback)
      setShowFeedback(true)
    }
  }

  const handleNextQuestion = () => {
    if (currentAnswerFeedback) {
      const updatedAnswers = { ...selectedAnswers }
      updatedAnswers[currentQuestionIndex] = currentAnswerFeedback.student_answer

      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        setShowFeedback(false)
        setCurrentAnswerFeedback(null)
        setSelectedAnswers(updatedAnswers)
      } else {
        // Quiz complete - calculate results
        const correctCount = Object.entries(updatedAnswers).filter(([idx, answer]) => {
          return quizQuestions[parseInt(idx)]?.correct_answer === answer
        }).length

        let masteryLevel: MasteryLevel = 'Beginner'
        if (correctCount >= 7) {
          masteryLevel = 'Advanced'
        } else if (correctCount >= 5) {
          masteryLevel = 'Intermediate'
        }

        setQuizResult({
          score: correctCount,
          total: quizQuestions.length,
          mastery_level: masteryLevel,
          answers: Object.entries(updatedAnswers).map(([idx, answer]) => ({
            question_number: parseInt(idx) + 1,
            student_answer: answer,
            is_correct: quizQuestions[parseInt(idx)]?.correct_answer === answer,
            feedback: '', // Would need to store during evaluation
          })),
        })
        setCurrentScreen('results')
      }
    }
  }

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswers({})
    setShowFeedback(false)
    setCurrentAnswerFeedback(null)
    setQuizResult(null)
    handleStartQuiz()
  }

  const handleReviewExplanation = () => {
    setCurrentScreen('explanation')
  }

  const handleLearnNewConcept = () => {
    setCurrentScreen('dashboard')
    setSelectedTopic('')
    setExplanationContent([])
    setQuizQuestions([])
    setSelectedAnswers({})
    setQuizResult(null)
    setShowFeedback(false)
    setCurrentAnswerFeedback(null)
  }

  // Dashboard Screen
  if (currentScreen === 'dashboard') {
    const filteredTopics = SAMPLE_TOPICS.filter(
      topic =>
        topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.category.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
        {/* Header */}
        <div className="max-w-4xl mx-auto mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Rural Learning Assistant</h1>
          <p className="text-lg text-gray-600">Learn complex concepts with simple explanations and rural examples</p>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto mb-12">
          <Input
            type="text"
            placeholder="What do you want to learn today? (e.g., Photosynthesis, Fractions)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-6 py-4 text-lg border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none"
          />
        </div>

        {/* Recent Learning History */}
        {learningHistory.length > 0 && (
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Continue Learning</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {learningHistory.map(topic => (
                <Button
                  key={topic}
                  onClick={() => handleStartLearning(topic)}
                  variant="outline"
                  className="h-20 text-left text-gray-900 border-2 border-blue-300 hover:bg-blue-50"
                >
                  <span className="text-lg font-medium">{topic}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Topic Categories */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {searchQuery ? 'Search Results' : 'Suggested Topics'}
          </h2>

          {filteredTopics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTopics.map(topic => (
                <Card
                  key={topic.name}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-green-400"
                  onClick={() => handleStartLearning(topic.name)}
                >
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-900">{topic.name}</CardTitle>
                    <CardDescription className="text-gray-600">{topic.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      Start Learning
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-2 border-gray-200 bg-white">
              <CardContent className="py-12 text-center">
                <p className="text-gray-600 text-lg">No topics found. Try a different search.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {error && (
          <div className="max-w-4xl mx-auto mt-6">
            <Alert className="border-red-400 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {loading && (
          <div className="max-w-4xl mx-auto mt-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-6 text-center">
                <p className="text-blue-900 font-medium">Loading learning content...</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // Explanation Screen
  if (currentScreen === 'explanation') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button
              onClick={() => setCurrentScreen('dashboard')}
              variant="ghost"
              className="mb-4 text-gray-700 hover:text-gray-900"
            >
              Back to Dashboard
            </Button>
            <h1 className="text-4xl font-bold text-gray-900">{selectedTopic}</h1>
            <p className="text-gray-600 mt-2">Learn in simple language with rural examples</p>
          </div>

          {error && (
            <Alert className="mb-6 border-red-400 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-12 text-center">
                <p className="text-blue-900 font-medium">Generating explanation...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Explanation Content */}
              <div className="space-y-6 mb-8">
                {explanationContent.length > 0 ? (
                  explanationContent.map((section, idx) => (
                    <Card key={idx} className="border-2 border-green-200 bg-white">
                      <CardHeader className="bg-green-50">
                        <CardTitle className="text-xl text-gray-900">
                          Section {idx + 1} of {explanationContent.length}: {section.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div>
                          <p className="text-gray-800 leading-relaxed text-lg">{section.content}</p>
                        </div>

                        {section.visual_description && (
                          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Visual Description:</p>
                            <p className="text-gray-800">{section.visual_description}</p>
                          </div>
                        )}

                        {section.example && (
                          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                            <p className="text-sm font-semibold text-green-900 mb-2">Rural Example:</p>
                            <p className="text-gray-800">{section.example}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-2 border-gray-200 bg-white">
                    <CardContent className="py-8 text-center">
                      <p className="text-gray-600">Explanation content will appear here</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* CTA Button - Sticky at bottom */}
              <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 py-4 px-4 -mx-4">
                <Button
                  onClick={handleStartQuiz}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-6 rounded-lg font-semibold"
                >
                  I'm Ready for Quiz
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // Quiz Screen
  if (currentScreen === 'quiz' && quizQuestions.length > 0) {
    const currentQuestion = quizQuestions[currentQuestionIndex]
    const isAnswered = selectedAnswers[currentQuestionIndex] !== undefined
    const progressPercent = ((currentQuestionIndex + 1) / quizQuestions.length) * 100

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Question {currentQuestionIndex + 1} of {quizQuestions.length}
              </h1>
              <div className="text-lg font-semibold text-blue-600">
                Score: {Object.values(selectedAnswers).filter((ans, idx) => quizQuestions[idx]?.correct_answer === ans).length}/{quizQuestions.length}
              </div>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {error && (
            <Alert className="mb-6 border-red-400 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Question Card */}
          <Card className="mb-8 border-2 border-purple-200 bg-white">
            <CardHeader className="bg-purple-50">
              <CardTitle className="text-2xl text-gray-900">{currentQuestion.question_text}</CardTitle>
              <CardDescription>
                Difficulty: <span className="font-semibold text-gray-700">{currentQuestion.difficulty}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-8">
              {!showFeedback ? (
                <>
                  {/* Answer Options */}
                  <RadioGroup
                    value={selectedAnswers[currentQuestionIndex] || ''}
                    onValueChange={value => {
                      const updated = { ...selectedAnswers }
                      updated[currentQuestionIndex] = value
                      setSelectedAnswers(updated)
                    }}
                  >
                    <div className="space-y-4">
                      {Object.entries(currentQuestion.options).map(([letter, text]) => (
                        <div key={letter} className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 cursor-pointer">
                          <RadioGroupItem value={letter} id={letter} />
                          <Label htmlFor={letter} className="text-lg text-gray-800 cursor-pointer flex-1">
                            <span className="font-bold text-purple-600">{letter}.</span> {text}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!isAnswered || loading}
                    className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white text-lg py-6 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Evaluating...' : 'Submit Answer'}
                  </Button>
                </>
              ) : (
                <>
                  {/* Feedback Panel */}
                  <div className={`mb-6 p-6 rounded-lg border-l-4 ${currentAnswerFeedback?.is_correct ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    <p className={`text-lg font-bold mb-3 ${currentAnswerFeedback?.is_correct ? 'text-green-900' : 'text-red-900'}`}>
                      {currentAnswerFeedback?.is_correct ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p className={`text-gray-800 mb-4 ${currentAnswerFeedback?.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                      {currentAnswerFeedback?.feedback}
                    </p>
                    {!currentAnswerFeedback?.is_correct && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-semibold">Correct answer:</span> {currentQuestion.correct_answer}
                      </p>
                    )}
                  </div>

                  {/* Next Button */}
                  <Button
                    onClick={handleNextQuestion}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-6 rounded-lg font-semibold"
                  >
                    {currentQuestionIndex === quizQuestions.length - 1 ? 'View Results' : 'Next Question'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Results Screen
  if (currentScreen === 'results' && quizResult) {
    const percentage = Math.round((quizResult.score / quizResult.total) * 100)

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Score Display */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Quiz Complete!</h1>

            <div className="relative w-48 h-48 mx-auto mb-8">
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke={
                    quizResult.mastery_level === 'Advanced'
                      ? '#16a34a'
                      : quizResult.mastery_level === 'Intermediate'
                        ? '#2563eb'
                        : '#f59e0b'
                  }
                  strokeWidth="20"
                  strokeDasharray={`${(percentage / 100) * 565.48} 565.48`}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-gray-900">{percentage}%</div>
                  <div className="text-gray-600 text-sm">Score</div>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold mb-2 text-gray-900">You scored {quizResult.score}/{quizResult.total}</h2>

            {/* Mastery Badge */}
            <div className="inline-block mb-8">
              <div
                className={`px-8 py-4 rounded-full text-white text-xl font-bold ${
                  quizResult.mastery_level === 'Advanced'
                    ? 'bg-green-600'
                    : quizResult.mastery_level === 'Intermediate'
                      ? 'bg-blue-600'
                      : 'bg-amber-600'
                }`}
              >
                {quizResult.mastery_level} Level
              </div>
            </div>

            {/* Mastery Description */}
            <p className="text-gray-700 text-lg mb-8">
              {quizResult.mastery_level === 'Advanced' &&
                'Excellent! You have a solid understanding of this concept. You can move on to more advanced topics.'}
              {quizResult.mastery_level === 'Intermediate' &&
                'Good progress! You understand most aspects of this concept. Review the explanation to strengthen your knowledge.'}
              {quizResult.mastery_level === 'Beginner' &&
                'You are just starting with this concept. Retake the quiz after reviewing the explanation for better mastery.'}
            </p>
          </div>

          {/* Answer Breakdown */}
          <Card className="mb-8 border-2 border-gray-200">
            <CardHeader className="bg-gray-50">
              <CardTitle className="text-gray-900">Answer Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {quizResult.answers.map(answer => (
                  <div
                    key={answer.question_number}
                    className={`p-4 rounded-lg border-l-4 ${
                      answer.is_correct ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
                    }`}
                  >
                    <p className={`font-semibold mb-1 ${answer.is_correct ? 'text-green-900' : 'text-red-900'}`}>
                      Question {answer.question_number}: {answer.is_correct ? 'Correct' : 'Incorrect'}
                    </p>
                    <p className="text-sm text-gray-700">Your answer: {answer.student_answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleLearnNewConcept}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6 rounded-lg font-semibold"
            >
              Learn Another Concept
            </Button>
            <Button
              onClick={handleRetakeQuiz}
              variant="outline"
              className="w-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 text-lg py-6 rounded-lg font-semibold"
            >
              Retake Quiz
            </Button>
            <Button
              onClick={handleReviewExplanation}
              variant="outline"
              className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 text-lg py-6 rounded-lg font-semibold"
            >
              Review Explanation
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
