function Navbar({ onLogoClick, user, onLoginClick, onHistoryClick, onLogout }) {
  return (
    <nav className="navbar">
      <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); onLogoClick() }}>
        <i className="fas fa-language"></i> PDF Translator
      </a>
      <div className="nav-actions">
        {user ? (
          <>
            <button className="nav-btn" onClick={onHistoryClick}>
              <i className="fas fa-history"></i> History
            </button>
            <span className="nav-user">
              <i className="fas fa-user-circle"></i> {user.name}
            </span>
            <button className="nav-btn nav-btn-outline" onClick={onLogout}>
              <i className="fas fa-sign-out-alt"></i> Log Out
            </button>
          </>
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
