import { NavLink } from 'react-router-dom'

export default function Header() {
  return (
    <header className="header">
      <NavLink to="/" className="header-logo">Fitter</NavLink>
      <nav className="header-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          Sessions
        </NavLink>
        <NavLink to="/programs" className={({ isActive }) => isActive ? 'active' : ''}>
          Programs
        </NavLink>
        <NavLink to="/exercises" className={({ isActive }) => isActive ? 'active' : ''}>
          Exercises
        </NavLink>
      </nav>
    </header>
  )
}
