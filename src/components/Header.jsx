import rsBeautyLogo from '../assets/categories/rs-beauty-logo.png';

function Header({ cartCount, onCartClick }) {
  return (
    <header className="premium-header">
      <style>{`
        .premium-header { background: #FAF6F0; }
        .premium-header .premium-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 220px;
          height: 56px;
          min-width: 0;
          flex-shrink: 0;
          overflow: hidden;
          line-height: 0;
        }
        .premium-header .premium-logo img {
          display: block;
          width: 220px;
          max-width: none;
          height: auto;
          flex-shrink: 0;
        }
        .premium-header .premium-logo:focus-visible {
          outline: 2px solid #956447;
          outline-offset: 3px;
          border-radius: 4px;
        }
        @media (max-width: 820px) {
          .premium-header .premium-logo { width: 160px; height: 48px; }
          .premium-header .premium-logo img { width: 160px; }
        }
        @media (max-width: 380px) {
          .premium-header .premium-logo { width: 135px; height: 42px; }
          .premium-header .premium-logo img { width: 135px; }
        }
      `}</style>
      <div className="premium-header-inner">
        <a href="/" className="premium-logo" aria-label="RS BEAUTY home">
          <img src={rsBeautyLogo} alt="RS BEAUTY" width="2073" height="759" />
        </a>
        <nav className="desktop-nav">
          <a href="/shop">Shop</a>
          <a href="/#best-sellers">Best Sellers</a>
          <a href="/#about">About Us</a>
        </nav>
        <div className="header-actions">
          <a href="/shop" className="header-icon-button" aria-label="Search">⌕</a>
          <button className="header-icon-button" aria-label="Account" type="button">♙</button>
          <button className="header-cart-button" onClick={onCartClick} type="button">
            <span>Bag</span>
            <span className="header-cart-count">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
