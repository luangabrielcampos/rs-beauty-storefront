import { useEffect, useRef, useState } from 'react';

const heroSlides = [
  {
    image: '/images/hero-01-beauty-ritual.png',
    eyebrow: 'THE RS BEAUTY™ RITUAL',
    title: 'Everyday beauty. Elevated.',
    description:
      'Thoughtfully selected beauty tools for your everyday rituals.',
    button: 'Shop the Collection',
    alt: 'Woman enjoying an elegant RS BEAUTY makeup ritual',
    position: 'center',
    background: '#f2e8e3',
  },
  {
    image: '/images/hero-02-hair-motion.png',
    eyebrow: 'HAIR, ELEVATED',
    title: 'Your hair. Your moment.',
    description:
      'Discover tools that bring a little more care to your hair routine.',
    button: 'Shop Hair Essentials',
    alt: 'Woman with healthy glossy hair in motion',
    position: 'center',
    background: '#e8d8cf',
  },
  {
    image: '/images/hero-03-skin-technology.png',
    eyebrow: 'BEAUTY MEETS INNOVATION',
    title: 'A fresh take on self-care.',
    description:
      'Explore modern beauty tools for moments made for you.',
    button: 'Explore Beauty Technology',
    alt: 'Woman using a modern facial skincare tool',
    position: 'center',
    background: '#ece5eb',
  },
  {
    image: '/images/hero-04-beauty-orbit.png',
    eyebrow: 'CURATED BY RS BEAUTY™',
    title: 'Beauty, beautifully selected.',
    description:
      'Discover our collection and find your next everyday essential.',
    button: 'Discover All Beauty',
    alt: 'Premium makeup and skincare collection in rose gold',
    position: 'center',
    background: '#f1dfda',
  },
  {
    image: '/images/hero-05-mauve-editorial.png',
    eyebrow: 'YOUR BEAUTY. YOUR SIGNATURE.',
    title: 'Make beauty your own.',
    description:
      'Small rituals. Personal touches. Beauty on your terms.',
    button: 'Find Your Favorites',
    alt: 'Luxury editorial beauty portrait with mauve makeup',
    position: 'center',
    background: '#e7d8df',
  },
];

function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [mouseInside, setMouseInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const touchStartX = useRef(null);

  const activeSlide = heroSlides[currentSlide];

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 901px)');
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const updateDevice = () => {
      setIsDesktop(
        desktopQuery.matches && !reducedMotionQuery.matches
      );
    };

    updateDevice();

    desktopQuery.addEventListener('change', updateDevice);
    reducedMotionQuery.addEventListener('change', updateDevice);

    return () => {
      desktopQuery.removeEventListener('change', updateDevice);
      reducedMotionQuery.removeEventListener(
        'change',
        updateDevice
      );
    };
  }, []);

  useEffect(() => {
    if (
      !isDesktop ||
      userPaused ||
      mouseInside ||
      focusInside
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setCurrentSlide(
        (current) => (current + 1) % heroSlides.length
      );
    }, 6500);

    return () => window.clearInterval(interval);
  }, [
    isDesktop,
    userPaused,
    mouseInside,
    focusInside,
  ]);

  function selectSlide(index) {
    setCurrentSlide(
      (index + heroSlides.length) % heroSlides.length
    );

    setUserPaused(true);
  }

  function showPreviousSlide() {
    selectSlide(currentSlide - 1);
  }

  function showNextSlide() {
    selectSlide(currentSlide + 1);
  }

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return;

    const touchEndX = event.changedTouches[0].clientX;
    const distance = touchStartX.current - touchEndX;

    if (Math.abs(distance) > 45) {
      if (distance > 0) {
        showNextSlide();
      } else {
        showPreviousSlide();
      }
    }

    touchStartX.current = null;
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowLeft') {
      showPreviousSlide();
    }

    if (event.key === 'ArrowRight') {
      showNextSlide();
    }
  }

  return (
    <section
      className="rs-hero"
      aria-label="RS BEAUTY featured collections"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setMouseInside(true)}
      onMouseLeave={() => setMouseInside(false)}
      onFocusCapture={() => setFocusInside(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusInside(false);
        }
      }}
      style={{
        '--rs-hero-background': activeSlide.background,
      }}
    >
      <div
        className="rs-hero-content"
        key={`content-${currentSlide}`}
        aria-live={userPaused ? 'polite' : 'off'}
      >
        <span className="rs-hero-eyebrow">
          {activeSlide.eyebrow}
        </span>

        <h1 className="rs-hero-title">
          {activeSlide.title}
        </h1>

        <p className="rs-hero-description">
          {activeSlide.description}
        </p>

        <a
          href="#shop"
          className="rs-hero-button"
        >
          {activeSlide.button}
          <span aria-hidden="true">→</span>
        </a>

        <div className="rs-hero-trust">
          <span>✓ Secure Checkout</span>
          <span>✓ Customer Support</span>
        </div>
      </div>

      <div
        className="rs-hero-visual"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {heroSlides.map((slide, index) => (
          <div
            className={
              index === currentSlide
                ? 'rs-hero-slide is-active'
                : 'rs-hero-slide'
            }
            aria-hidden={index !== currentSlide}
            key={slide.image}
          >
            <img
              src={slide.image}
              alt={
                index === currentSlide
                  ? slide.alt
                  : ''
              }
              className="rs-hero-image"
              style={{
                objectPosition: slide.position,
              }}
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
            />

            <div className="rs-hero-image-shade" />
          </div>
        ))}

        <button
          type="button"
          className="rs-hero-arrow rs-hero-arrow-left"
          onClick={showPreviousSlide}
          aria-label="Previous image"
        >
          ‹
        </button>

        <button
          type="button"
          className="rs-hero-arrow rs-hero-arrow-right"
          onClick={showNextSlide}
          aria-label="Next image"
        >
          ›
        </button>

        <div className="rs-hero-controls">
          <div className="rs-hero-dots">
            {heroSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.image}
                className={
                  index === currentSlide
                    ? 'rs-hero-dot is-active'
                    : 'rs-hero-dot'
                }
                onClick={() => selectSlide(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={
                  index === currentSlide ? 'true' : undefined
                }
              />
            ))}
          </div>

          {isDesktop && (
            <button
              type="button"
              className="rs-hero-play-control"
              onClick={() => setUserPaused((current) => !current)}
              aria-label={
                userPaused
                  ? 'Resume automatic carousel'
                  : 'Pause automatic carousel'
              }
            >
              {userPaused ? '▶' : 'Ⅱ'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .rs-hero {
          width: 100%;
          min-height: 570px;
          margin: 24px 0 58px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          overflow: hidden;
          border-radius: 22px;
          background: var(--rs-hero-background);
          transition: background 700ms ease;
          outline: none;
        }

        .rs-hero:focus-visible {
          outline: 2px solid #655752;
          outline-offset: 4px;
        }

        .rs-hero-content {
          min-width: 0;
          padding: 68px 56px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          animation: rsHeroContentEnter 600ms ease;
        }

        @keyframes rsHeroContentEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .rs-hero-eyebrow {
          margin-bottom: 18px;
          color: #655752;
          font-size: 11px;
          line-height: 1.3;
          font-weight: 900;
          letter-spacing: 2.8px;
        }

        .rs-hero-title {
          max-width: 560px;
          margin: 0;
          color: #111111;
          font-size: clamp(42px, 4.7vw, 66px);
          line-height: 0.98;
          letter-spacing: -2.8px;
          font-weight: 700;
        }

        .rs-hero-description {
          max-width: 510px;
          margin: 25px 0 0;
          color: #564c48;
          font-size: 16px;
          line-height: 1.65;
        }

        .rs-hero-button {
          min-height: 50px;
          margin-top: 31px;
          padding: 0 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1px solid #111111;
          border-radius: 999px;
          background: #111111;
          color: #ffffff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          transition:
            transform 180ms ease,
            background 180ms ease;
        }

        .rs-hero-button:hover {
          transform: translateY(-2px);
          background: #292929;
        }

        .rs-hero-button span {
          font-size: 18px;
          transition: transform 180ms ease;
        }

        .rs-hero-button:hover span {
          transform: translateX(3px);
        }

        .rs-hero-trust {
          margin-top: 31px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 17px;
          color: #5d514d;
          font-size: 11px;
          font-weight: 750;
        }

        .rs-hero-visual {
          min-width: 0;
          min-height: 570px;
          position: relative;
          overflow: hidden;
          touch-action: pan-y;
        }

        .rs-hero-slide {
          position: absolute;
          inset: 20px;
          overflow: hidden;
          border-radius: 17px;
          opacity: 0;
          transform: scale(1.035);
          transition:
            opacity 850ms ease,
            transform 1300ms ease;
          pointer-events: none;
        }

        .rs-hero-slide.is-active {
          z-index: 2;
          opacity: 1;
          transform: scale(1);
          pointer-events: auto;
        }

        .rs-hero-image {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .rs-hero-image-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              transparent 55%,
              rgba(12, 7, 6, 0.18) 100%
            );
          pointer-events: none;
        }

        .rs-hero-arrow {
          width: 43px;
          height: 43px;
          position: absolute;
          top: 50%;
          z-index: 5;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.65);
          border-radius: 50%;
          background: rgba(18, 13, 12, 0.36);
          color: #ffffff;
          font-size: 29px;
          line-height: 1;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transform: translateY(-50%);
          transition:
            background 180ms ease,
            transform 180ms ease;
        }

        .rs-hero-arrow:hover {
          background: rgba(18, 13, 12, 0.7);
        }

        .rs-hero-arrow-left {
          left: 34px;
        }

        .rs-hero-arrow-right {
          right: 34px;
        }

        .rs-hero-controls {
          min-height: 38px;
          position: absolute;
          left: 50%;
          bottom: 34px;
          z-index: 6;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.52);
          border-radius: 999px;
          background: rgba(18, 13, 12, 0.35);
          backdrop-filter: blur(12px);
          transform: translateX(-50%);
        }

        .rs-hero-dots {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .rs-hero-dot {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          transition:
            width 220ms ease,
            background 220ms ease;
        }

        .rs-hero-dot.is-active {
          width: 25px;
          background: #ffffff;
        }

        .rs-hero-play-control {
          width: 23px;
          height: 23px;
          padding: 0;
          display: grid;
          place-items: center;
          border: 0;
          border-left: 1px solid rgba(255, 255, 255, 0.4);
          background: transparent;
          color: #ffffff;
          font-size: 10px;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .rs-hero-content {
            padding: 52px 35px;
          }

          .rs-hero-title {
            font-size: 47px;
          }

          .rs-hero-description {
            font-size: 14px;
          }
        }

        @media (max-width: 640px) {
          .rs-hero {
            min-height: auto;
            margin: 12px 0 34px;
            grid-template-columns: 1fr;
            border-radius: 15px;
          }

          .rs-hero-content {
            padding: 28px 20px 22px;
            align-items: flex-start;
            text-align: left;
          }

          .rs-hero-eyebrow {
            margin-bottom: 13px;
            font-size: 9px;
            letter-spacing: 2.2px;
          }

          .rs-hero-title {
            font-size: clamp(32px, 9.4vw, 44px);
            line-height: 1.06;
            letter-spacing: -1.3px;
            text-wrap: balance;
          }

          .rs-hero-description {
            margin-top: 14px;
            font-size: 14px;
            line-height: 1.55;
          }

          .rs-hero-button {
            width: 100%;
            margin-top: 18px;
          }

          .rs-hero-trust {
            margin-top: 16px;
            gap: 8px 16px;
            font-size: 10px;
          }

          .rs-hero-visual {
            min-height: 340px;
            height: clamp(340px, 106vw, 480px);
          }

          .rs-hero-slide {
            inset: 0 11px 11px;
            border-radius: 13px;
          }

          .rs-hero-arrow {
            width: 38px;
            height: 38px;
            font-size: 25px;
          }

          .rs-hero-arrow-left {
            left: 22px;
          }

          .rs-hero-arrow-right {
            right: 22px;
          }

          .rs-hero-controls {
            bottom: 26px;
          }

          .rs-hero-play-control {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rs-hero-content,
          .rs-hero-slide,
          .rs-hero-button,
          .rs-hero-button span {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}

export default Hero;