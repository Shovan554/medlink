import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'
import './Navigation.css'

function Navigation() {
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/trends', name: 'Trends' },
    { path: '/messages', name: 'Messages' },
    { path: '/alerts', name: 'Alerts' },
    { path: '/reports', name: 'Reports' },
    { path: '/settings', name: 'Settings' }
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

export default Navigation
