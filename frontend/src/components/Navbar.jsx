function Navbar({ onLogoClick }) {
  return (
    <nav className="navbar">
      <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); onLogoClick() }}>
        <i className="fas fa-language"></i> PDF Translator
      </a>
    </nav>
  )
}

export default Navbar
