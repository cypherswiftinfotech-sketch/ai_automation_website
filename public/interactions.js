// ═════════════════════════════════════════════════════════════════
// CYPHER SWIFT — Clean Interaction Engine
// Scroll reveal · Stat count-up — No gimmicks
// ═════════════════════════════════════════════════════════════════

(function () {

    // ── 1. Staggered entrance for grid items ──────────────────────
    const staggerTargets = document.querySelectorAll(
        '.industry-card, .challenge-card, .service-card, .why-point-item, .arch-row'
    );

    const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.stagger || 0;
                entry.target.style.transitionDelay = `${delay}s`;
                entry.target.classList.add('visible');
                staggerObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    staggerTargets.forEach((el, i) => {
        el.dataset.stagger = (i % 6) * 0.08;
        staggerObserver.observe(el);
    });

    // ── 2. Nav link active glow ───────────────────────────────────
    document.querySelectorAll('.nav-link.active').forEach(link => {
        link.style.color = 'var(--color-accent-indigo)';
    });

    // ── 3. Count-up animation for visible stats ───────────────────
    function animateCount(el, end, suffix, duration = 1800) {
        let start = 0;
        const step = end / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { start = end; clearInterval(timer); }
            el.textContent = (Number.isInteger(end) ? Math.floor(start) : start.toFixed(1)) + suffix;
        }, 16);
    }

    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                if (el.dataset.counted) return;
                el.dataset.counted = '1';
                const raw = el.dataset.count;
                const suffix = el.dataset.suffix || '';
                if (raw) animateCount(el, parseFloat(raw), suffix);
                statObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    const statMap = [
        { sel: '.stat-revenue-val', count: 3, suffix: 'Cr+' },
        { sel: '.stat-growth-val',  count: 2.5, suffix: 'x' },
        { sel: '.stat-automation-val', count: 70, suffix: '%' },
    ];
    statMap.forEach(({ sel, count, suffix }) => {
        document.querySelectorAll(sel).forEach(el => {
            el.dataset.count  = count;
            el.dataset.suffix = suffix;
            statObserver.observe(el);
        });
    });

})();
