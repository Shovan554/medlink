import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'
import './Navigation.css'

function DoctorNavigation() {
  const location = useLocation()

  const navItems = [
    { path: '/patients-dashboard', name: 'Dashboard' },
    { path: '/patients', name: 'Patients' },
    { path: '/doctor-messages', name: 'Messages' },
    { path: '/calendar', name: 'Calendar' },
    { path: '/doctor-reports', name: 'Reports' },
    { path: '/doctor-settings', name: 'Settings' }
  ]

  return (
    <nav className="navigation">
      <div className="nav-logo">
        <Logo />
      </div>
      
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.path}>
            <Link 
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default DoctorNavigation
