import rsBeautyLogo from '../assets/categories/rs-beauty-logo.png';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';
// RS_GLOBAL_HEADER_MOBILE_V1
// RS_GLOBAL_HEADER_CART_DRAWER_V2
function GlobalHeader() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const {
    cartCount,
    openCart,
  } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const overlayOpen = menuOpen || searchOpen;
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [overlayOpen]);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [searchOpen]);
  function closeNavigation() {
    setMenuOpen(false);
    setSearchOpen(false);
  }
  function goTo(path) {
    closeNavigation();
    navigate(path);
    const hash = path.split('#')[1] || '';
    if (hash) {
      window.setTimeout(() => {
        document
          .getElementById(hash)
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
      }, 80);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openSearch() {
    setMenuOpen(false);
    setSearchOpen(true);
  }
  function submitSearch(event) {
    event.preventDefault();
    const normalizedSearch = searchTerm.trim();
    if (!normalizedSearch) {
      searchInputRef.current?.focus();
      return;
    }
    goTo(
      `/shop?search=${encodeURIComponent(
        normalizedSearch
      )}#products`
    );
  }
  return (
    <>
      <style>{`
        .rs-global-header {
          position: sticky;
          top: 0;
          z-index: 1800;
          width: 100%;
          border-bottom: 1px solid #ece8e5;
          background: #FAF6F0;
          color: #111111;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .rs-global-header-inner {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 24px;
          width: min(1120px, calc(100% - 32px));
          height: 74px;
          margin: 0 auto;
        }
        .rs-global-logo {
          justify-self: start;
          border: 0;
          padding: 0;
          background: transparent;
          color: #111111;
          font: inherit;
          font-size: 23px;
          font-weight: 900;
          letter-spacing: 0.12em;
          cursor: pointer;
        }
        .rs-global-desktop-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
        }
        .rs-global-nav-link {
          position: relative;
          border: 0;
          padding: 10px 0;
          background: transparent;
          color: #111111;
          font: inherit;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
        }
        .rs-global-nav-link::after {
          position: absolute;
          right: 0;
          bottom: 4px;
          left: 0;
          height: 1px;
          background: #111111;
          content: '';
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 180ms ease;
        }
        .rs-global-nav-link:hover::after,
        .rs-global-nav-link:focus-visible::after {
          transform: scaleX(1);
        }
        .rs-global-actions {
          display: flex;
          align-items: center;
          justify-self: end;
          gap: 8px;
        }
        .rs-global-icon-button,
        .rs-global-menu-button {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #111111;
          cursor: pointer;
        }
        .rs-global-icon-button:hover,
        .rs-global-menu-button:hover {
          background: #f5f1ef;
        }
        .rs-global-icon-button svg,
        .rs-global-menu-button svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1.8;
        }
        .rs-global-menu-button {
          display: none;
        }
        .rs-global-cart-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          border: 1px solid #111111;
          border-radius: 999px;
          padding: 0 13px 0 16px;
          background: #ffffff;
          color: #111111;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition:
            background 160ms ease,
            color 160ms ease;
        }
        .rs-global-cart-button:hover {
          background: #111111;
          color: #ffffff;
        }
        .rs-global-cart-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #111111;
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
        }
        .rs-global-cart-button:hover
        .rs-global-cart-count {
          background: #ffffff;
          color: #111111;
        }
        .rs-global-overlay {
          position: fixed;
          inset: 0;
          z-index: 3000;
          background: rgba(17, 17, 17, 0.48);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          animation: rsGlobalFadeIn 180ms ease both;
        }
        .rs-global-search-dialog {
          position: absolute;
          top: 96px;
          left: 50%;
          width: min(640px, calc(100% - 32px));
          border-radius: 22px;
          padding: 30px;
          background: #ffffff;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.22);
          transform: translateX(-50%);
          animation: rsGlobalSearchIn 220ms ease both;
        }
        .rs-global-dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }
        .rs-global-dialog-header span {
          color: #76594d;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.2em;
        }
        .rs-global-close-button {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          background: #f4efec;
          color: #111111;
          font-size: 25px;
          line-height: 1;
          cursor: pointer;
        }
        .rs-global-search-form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }
        .rs-global-search-form input {
          width: 100%;
          min-height: 54px;
          border: 1px solid #cfc7c2;
          border-radius: 999px;
          padding: 0 20px;
          background: #ffffff;
          color: #111111;
          font: inherit;
          font-size: 16px;
          outline: none;
        }
        .rs-global-search-form input:focus {
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
        }
        .rs-global-search-submit {
          min-height: 54px;
          border: 1px solid #111111;
          border-radius: 999px;
          padding: 0 24px;
          background: #111111;
          color: #ffffff;
          font: inherit;
          font-weight: 850;
          cursor: pointer;
        }
        .rs-global-menu-panel {
          display: flex;
          flex-direction: column;
          width: min(88vw, 390px);
          min-height: 100dvh;
          padding: 22px;
          background: #ffffff;
          box-shadow: 30px 0 80px rgba(0, 0, 0, 0.18);
          animation: rsGlobalMenuIn 220ms ease both;
        }
        .rs-global-menu-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 21px;
          border-bottom: 1px solid #ece8e5;
        }
        .rs-global-menu-brand {
          font-size: 19px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }
        .rs-global-mobile-nav {
          display: grid;
          gap: 4px;
          padding: 28px 0;
        }
        .rs-global-mobile-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          border: 0;
          border-bottom: 1px solid #ece8e5;
          padding: 17px 2px;
          background: transparent;
          color: #111111;
          font: inherit;
          font-size: 24px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
        }
        .rs-global-mobile-link span:last-child {
          font-size: 20px;
          font-weight: 500;
        }
        .rs-global-mobile-search {
          width: 100%;
          min-height: 52px;
          margin-top: 6px;
          border: 1px solid #111111;
          border-radius: 999px;
          background: #111111;
          color: #ffffff;
          font: inherit;
          font-weight: 850;
          cursor: pointer;
        }
        .rs-global-menu-trust {
          display: grid;
          gap: 9px;
          margin-top: auto;
          border-radius: 18px;
          padding: 18px;
          background: #f5f0ed;
          color: #5f4a40;
          font-size: 12px;
          font-weight: 750;
        }
        @keyframes rsGlobalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rsGlobalSearchIn {
          from {
            opacity: 0;
            transform: translate(-50%, -12px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        @keyframes rsGlobalMenuIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 820px) {
          .rs-global-header-inner {
            grid-template-columns: auto 1fr auto;
            gap: 8px;
            width: min(100% - 20px, 1120px);
            height: 64px;
          }
          .rs-global-menu-button {
            display: inline-grid;
            justify-self: start;
            width: 38px;
            height: 38px;
          }
          .rs-global-logo {
            justify-self: center;
            font-size: 17px;
            letter-spacing: 0.1em;
            white-space: nowrap;
          }
          .rs-global-desktop-nav,
          .rs-global-icon-button {
            display: none;
          }
          .rs-global-actions {
            justify-self: end;
          }
          .rs-global-cart-button {
            min-height: 36px;
            padding: 0 9px 0 11px;
            font-size: 11px;
          }
          .rs-global-cart-count {
            min-width: 19px;
            height: 19px;
            font-size: 10px;
          }
          .rs-global-search-dialog {
            top: 78px;
            border-radius: 18px;
            padding: 21px 18px;
          }
          .rs-global-search-form {
            grid-template-columns: 1fr;
          }
          .rs-global-search-submit {
            width: 100%;
          }
        }
        @media (max-width: 360px) {
          .rs-global-header-inner {
            width: min(100% - 14px, 1120px);
          }
          .rs-global-logo {
            font-size: 15px;
          }
          .rs-global-cart-button {
            padding-left: 9px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rs-global-overlay,
          .rs-global-search-dialog,
          .rs-global-menu-panel {
            animation: none;
          }
        }

        .rs-global-logo,
        .rs-global-menu-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 220px;
          height: 56px;
          min-width: 0;
          overflow: hidden;
          flex-shrink: 0;
          line-height: 0;
        }
        .rs-global-logo img,
        .rs-global-menu-brand img {
          display: block;
          width: 220px;
          max-width: none;
          height: auto;
          flex-shrink: 0;
        }
        .rs-global-menu-brand { width: 190px; }
        .rs-global-menu-brand img { width: 190px; }
        .rs-global-menu-panel { background: #FAF6F0; }
        .rs-global-logo:focus-visible {
          outline: 2px solid #956447;
          outline-offset: 3px;
          border-radius: 4px;
        }
        @media (max-width: 820px) {
          .rs-global-header-inner { grid-template-columns: auto minmax(0, 1fr) auto; }
          .rs-global-logo { width: min(100%, 180px); height: 50px; }
          .rs-global-logo img { width: 180px; }
        }
        @media (max-width: 380px) {
          .rs-global-logo { width: min(100%, 145px); height: 44px; }
          .rs-global-logo img { width: 145px; }
        }
      `}</style>
      <header className="rs-global-header">
        <div className="rs-global-header-inner">
          <button
            className="rs-global-menu-button"
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button
            className="rs-global-logo"
            type="button"
            onClick={() => goTo('/')}
            aria-label="RS BEAUTY home"
          >
            <img src={rsBeautyLogo} alt="RS BEAUTY" width="2073" height="759" />
          </button>
          <nav
            className="rs-global-desktop-nav"
            aria-label="Main navigation"
          >
            <button
              className="rs-global-nav-link"
              type="button"
              onClick={() => goTo('/')}
            >
              Home
            </button>
            <button
              className="rs-global-nav-link"
              type="button"
              onClick={() => goTo('/shop')}
            >
              Shop
            </button>
            <button
              className="rs-global-nav-link"
              type="button"
              onClick={() =>
                goTo('/shop?sort=featured#products')
              }
            >
              Best Sellers
            </button>
          </nav>
          <div className="rs-global-actions">
            <button
              className="rs-global-icon-button"
              type="button"
              aria-label="Search products"
              onClick={openSearch}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>
            <button
              className="rs-global-cart-button"
              type="button"
              onClick={openCart}
              aria-label={`Open bag with ${cartCount} items`}
            >
              <span>Bag</span>
              <span className="rs-global-cart-count">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>
      <CartDrawer />
      {menuOpen && (
        <div
          className="rs-global-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMenuOpen(false);
            }
          }}
        >
          <aside
            className="rs-global-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="rs-global-menu-top">
              <span className="rs-global-menu-brand">
                <img src={rsBeautyLogo} alt="RS BEAUTY" width="2073" height="759" />
              </span>
              <button
                className="rs-global-close-button"
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMenuOpen(false)}
              >
                ×
              </button>
            </div>
            <nav
              className="rs-global-mobile-nav"
              aria-label="Mobile navigation"
            >
              <button
                className="rs-global-mobile-link"
                type="button"
                onClick={() => goTo('/')}
              >
                <span>Home</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="rs-global-mobile-link"
                type="button"
                onClick={() => goTo('/shop')}
              >
                <span>Shop All</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="rs-global-mobile-link"
                type="button"
                onClick={() =>
                  goTo('/shop?sort=featured#products')
                }
              >
                <span>Best Sellers</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="rs-global-mobile-search"
                type="button"
                onClick={openSearch}
              >
                Search Products
              </button>
            </nav>
            <div className="rs-global-menu-trust">
              <span>✓ Secure checkout</span>
              <span>✓ Carefully selected products</span>
              <span>✓ Easy returns</span>
            </div>
          </aside>
        </div>
      )}
      {searchOpen && (
        <div
          className="rs-global-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSearchOpen(false);
            }
          }}
        >
          <section
            className="rs-global-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search RS BEAUTY products"
          >
            <div className="rs-global-dialog-header">
              <span>FIND YOUR NEXT RITUAL</span>
              <button
                className="rs-global-close-button"
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                ×
              </button>
            </div>
            <form
              className="rs-global-search-form"
              onSubmit={submitSearch}
            >
              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search beauty, hair and self-care"
                aria-label="Search products"
              />
              <button
                className="rs-global-search-submit"
                type="submit"
              >
                Search
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
export default GlobalHeader;
