import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import './LoadingPage.css'

function LoadingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Mark that user has visited loading page
    sessionStorage.setItem('hasVisitedLoading', 'true')
    
    const timer = setTimeout(() => {
      // Check if user is logged in
      const user = localStorage.getItem('user')
      if (user) {
        const userData = JSON.parse(user)
        // Redirect based on user role
        if (userData.role === 'doctor') {
          navigate('/patients-dashboard')
        } else {
          navigate('/dashboard')
        }
      } else {
        navigate('/login')
      }
    }, 2500)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="loading-container">
      <Logo />
    </div>
  )
}

export default LoadingPage
