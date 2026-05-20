import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import UploadForm from './components/UploadForm'
import ResultView from './components/ResultView'
import AuthForm from './components/AuthForm'
import History from './components/History'
import Footer from './components/Footer'
import { fetchMe } from './api'
import type { TranslationResult, User } from './types'
import './App.css'

const RESULT_KEY = 'translator_last_result'
const THEME_KEY = 'translator_theme'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadResult(): TranslationResult | null {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY) || 'null') as TranslationResult | null
  } catch {
    return null
  }
}

function App() {
  const navigate = useNavigate()
  const [result, setResult] = useState<TranslationResult | null>(loadResult)
  const [user, setUser] = useState<User | null>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
  }, [])

  const handleResult = useCallback((data: TranslationResult) => {
    setResult(data)
    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(data)) } catch { /* quota */ }
    navigate('/result')
  }, [navigate])

  const handleBack = useCallback(() => {
    setResult(null)
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/')
  }, [navigate])

  const handleAuth = useCallback((userData: User) => {
    setUser(userData)
    navigate('/')
  }, [navigate])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    setResult(null)
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/')
  }, [navigate])

  return (
    <div className="app">
      <Navbar
        onLogoClick={() => navigate('/')}
        user={user}
        onLoginClick={() => navigate('/auth')}
        onHistoryClick={() => navigate('/history')}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="container">
        <Routes>
          <Route path="/" element={<UploadForm onResult={handleResult} />} />
          <Route
            path="/result"
            element={result ? <ResultView result={result} onBack={handleBack} /> : <Navigate to="/" replace />}
          />
          <Route path="/auth" element={<AuthForm onAuth={handleAuth} />} />
          <Route
            path="/history"
            element={<History onViewResult={handleResult} onClose={() => navigate('/')} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
