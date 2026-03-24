import { useState, useRef, useEffect } from 'react'

function Navbar({ onLogoClick, user, onLoginClick, onHistoryClick, onLogout, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <nav className="navbar">
      <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); onLogoClick() }}>
        <i className="fas fa-language"></i> PDF Translator
      </a>
      <div className="nav-actions">
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'}></i>
        </button>
        {user ? (
          <div className="nav-profile-wrapper" ref={menuRef}>
            <button
              className="nav-profile-btn"
              onClick={() => setMenuOpen((v) => !v)}
              title={user.name}
            >
              <i className="fas fa-user-circle"></i>
              <span className="nav-profile-name">{user.name}</span>
              <i className={`fas fa-chevron-${menuOpen ? 'up' : 'down'} nav-profile-arrow`}></i>
            </button>
            {menuOpen && (
              <div className="nav-dropdown">
                <button className="nav-dropdown-item" onClick={() => { setMenuOpen(false); onHistoryClick() }}>
                  <i className="fas fa-history"></i> History
                </button>
                <div className="nav-dropdown-divider" />
                <button className="nav-dropdown-item nav-dropdown-danger" onClick={() => { setMenuOpen(false); onLogout() }}>
                  <i className="fas fa-sign-out-alt"></i> Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="nav-btn nav-btn-primary" onClick={onLoginClick}>
            <i className="fas fa-sign-in-alt"></i> Log In
          </button>
        )}
      </div>
    </nav>
  )
}

export default Navbar
