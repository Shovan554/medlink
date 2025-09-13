import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import './Auth.css'
import API_BASE_URL from '../config/api'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Check for success message from signup
    if (location.state?.message) {
      setSuccessMessage(location.state.message)
      // Pre-fill email if provided
      if (location.state.email) {
        setFormData(prev => ({ ...prev, email: location.state.email }))
      }
    }
  }, [location.state])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'

    if (!formData.password) newErrors.password = 'Password is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store user data and token
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      localStorage.setItem('userID', data.user.id);

      // Log userID to console
      console.log('User ID stored:', data.user.id);

      // Redirect based on role
      if (data.user.role === 'doctor') {
        navigate('/patients-dashboard');
      } else {
        navigate('/dashboard');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: error.message || 'Invalid email or password. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <Logo />
      <div className="auth-card">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to your Medlink account</p>

        {successMessage && (
          <div className="success-message" style={{ 
            color: '#10b981', 
            backgroundColor: '#d1fae5', 
            padding: '12px', 
            borderRadius: '6px', 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          {errors.submit && <div className="error-text">{errors.submit}</div>}

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-link">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
