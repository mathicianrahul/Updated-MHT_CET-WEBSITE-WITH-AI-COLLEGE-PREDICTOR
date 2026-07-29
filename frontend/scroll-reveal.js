/* ==========================================================================
   SCROLL-TRIGGERED REVEAL ANIMATION ENGINE
   IntersectionObserver with 1-time trigger, spring overshoot & sibling staggering
   ========================================================================== */

(function initScrollRevealEngine() {
    // Respect prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelectorAll('.scroll-reveal').forEach(el => el.classList.add('is-revealed'));
        return;
    }

    function setupObserver() {
        // Auto-target page elements (hero image, college cards, stat numbers, feature cards)
        const selectorsToReveal = [
            '.hero-content',
            '.hero-card',
            '.hero-visual',
            '.photo-viewport',
            '.stat-card',
            '.stat-item',
            '.service-card',
            '.college-card',
            '.feature-card',
            '.section-header',
            '.testimonial-card',
            '.consultation-card',
            '.form-card',
            '.sidebar-panel',
            '.results-panel',
            '.profile-card'
        ];

        selectorsToReveal.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (!el.classList.contains('scroll-reveal')) {
                    el.classList.add('scroll-reveal');
                }
            });
        });

        // Stagger sibling elements (college cards, stat numbers, feature cards) by 90-100ms
        const gridContainers = document.querySelectorAll('.services-grid, .stats-grid, .features-grid, .cards-grid, .stagger-container');
        gridContainers.forEach(container => {
            Array.from(container.children).forEach((child, idx) => {
                if (!child.classList.contains('scroll-reveal')) {
                    child.classList.add('scroll-reveal');
                }
                child.style.transitionDelay = `${idx * 100}ms`;
            });
        });

        // IntersectionObserver Setup
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -40px 0px',
            threshold: 0.12
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    // Trigger ONLY ONCE per element, unobserve after reveal
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe all scroll-reveal elements
        document.querySelectorAll('.scroll-reveal').forEach(el => {
            revealObserver.observe(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupObserver);
    } else {
        setupObserver();
    }
})();
