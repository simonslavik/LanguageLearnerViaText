import { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar'
import UploadForm from './components/UploadForm'
import ResultView from './components/ResultView'
import AuthForm from './components/AuthForm'
import History from './components/History'
import Footer from './components/Footer'
import { fetchMe } from './api'
import './App.css'

const RESULT_KEY = 'translator_last_result'
const THEME_KEY = 'translator_theme'

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadResult() {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY))
  } catch {
    return null
  }
}

function App() {
  const [result, setResult] = useState(loadResult)
  const [user, setUser] = useState(null)
  const [view, setView] = useState('home') // home | auth | history
  const [authChecked, setAuthChecked] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)

  // Apply theme to <html> element
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
    if (token) {
      fetchMe()
        .then((u) => setUser(u))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setAuthChecked(true))
    } else {
      setAuthChecked(true)
    }
  }, [])

  const handleResult = (data) => {
    setResult(data)
    setView('home')
    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(data)) } catch { /* quota */ }
  }

  const handleBack = () => {
    setResult(null)
    setView('home')
    sessionStorage.removeItem(RESULT_KEY)
  }

  const handleAuth = (userData) => {
    setUser(userData)
    setView('home')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setResult(null)
    setView('home')
    sessionStorage.removeItem(RESULT_KEY)
  }

  const renderContent = () => {
    if (view === 'auth') {
      return <AuthForm onAuth={handleAuth} />
    }
    if (view === 'history') {
      return (
        <History
          onViewResult={handleResult}
          onClose={() => setView('home')}
        />
      )
    }
    if (result) {
      return <ResultView result={result} onBack={handleBack} />
    }
    return <UploadForm onResult={handleResult} />
  }

  return (
    <div className="app">
      <Navbar
        onLogoClick={handleBack}
        user={user}
        onLoginClick={() => setView('auth')}
        onHistoryClick={() => setView('history')}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="container">
        {renderContent()}
      </main>
      <Footer />
    </div>
  )
}

export default App
