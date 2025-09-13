import Lottie from 'lottie-react'
import logoAnimation from '../assets/animations/logo.json'

function Logo() {
  return (
    <div className="nav-header">
      <div className="nav-logo-container">
        <Lottie animationData={logoAnimation} loop={true} />
      </div>
      <h2 className="nav-title">Medlink</h2>
    </div>
  )
}

export default Logo
