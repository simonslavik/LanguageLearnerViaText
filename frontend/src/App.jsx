import { useState } from 'react'
import Navbar from './components/Navbar'
import UploadForm from './components/UploadForm'
import ResultView from './components/ResultView'
import Footer from './components/Footer'
import './App.css'

function App() {
  const [result, setResult] = useState(null)

  const handleBack = () => setResult(null)

  return (
    <div className="app">
      <Navbar onLogoClick={handleBack} />
      <main className="container">
        {result ? (
          <ResultView result={result} onBack={handleBack} />
        ) : (
          <UploadForm onResult={setResult} />
        )}
      </main>
      <Footer />
    </div>
  )
}

export default App
