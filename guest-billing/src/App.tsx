import { useEffect, useState } from 'react'
import './App.css'
import LoveLoader from './components/ui/LoveLoader'
import Dashboard from './pages/Dashboard'
import Header from './components/Header'

function App() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 3000);

      return () => clearTimeout(timer);
    }, []);

    return (
      <div className="overflow-hidden relative font-montserrat w-full min-h-screen flex justify-center items-center">
        { isLoading && <LoveLoader/> }
        <div className="w-full min-h-screen flex flex-col items-center justify-center">
          <Header/>
          <Dashboard/>
        </div>
      </div>
    )
}

export default App
