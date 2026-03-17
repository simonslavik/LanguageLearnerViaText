import { useState } from 'react'
import Navbar from './components/Navbar'
import UploadForm from './components/UploadForm'
import ResultView from './components/ResultView'
import Footer from './components/Footer'
import './App.css'

const RESULT_KEY = 'translator_last_result'

function loadResult() {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY))
  } catch {
    return null
  }
}

function App() {
  const [result, setResult] = useState(loadResult)

  const handleResult = (data) => {
    setResult(data)
    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(data)) } catch { /* quota */ }
  }

  const handleBack = () => {
    setResult(null)
    sessionStorage.removeItem(RESULT_KEY)
  }

  return (
    <div className="app">
      <Navbar onLogoClick={handleBack} />
      <main className="container">
        {result ? (
          <ResultView result={result} onBack={handleBack} />
        ) : (
          <UploadForm onResult={handleResult} />
        )}
      </main>
      <Footer />
    </div>
  )
}

export default App
