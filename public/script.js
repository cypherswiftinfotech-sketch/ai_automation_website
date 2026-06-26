// Cypher Swift Website Interactive JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // Navigation scroll effect
    const header = document.querySelector('.header-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile Hamburger Menu
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = hamburger.querySelector('svg');
            if (navMenu.classList.contains('active')) {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';
            } else {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />';
            }
        });

        // Close menu when links are clicked
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                const icon = hamburger.querySelector('svg');
                if (icon) {
                    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />';
                }
            });
        });
    }

    // Dynamic Active Route Highlight
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const menuLinks = document.querySelectorAll('.nav-link');
    menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Hero animated pipeline background (canvas)
    const heroSection = document.querySelector('.hero');
    const canvas = document.getElementById('heroPipelineCanvas');

    if (heroSection && canvas) {
        const ctx = canvas.getContext('2d');
        let rafId = 0;
        let w = 0;
        let h = 0;
        
        // Scale original SVG viewBox (0..100) into canvas pixels.
        const SV = {
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 100
        };

        function getComputedVars() {
            const cs = getComputedStyle(document.documentElement);
            return {
                indigo: cs.getPropertyValue('--color-accent-indigo').trim(),
                purple: cs.getPropertyValue('--color-accent-purple').trim(),
                cyan: cs.getPropertyValue('--color-accent-cyan').trim(),
            };
        }

        function resize() {
            const rect = heroSection.getBoundingClientRect();
            w = Math.max(10, Math.floor(rect.width));
            h = Math.max(10, Math.floor(rect.height));

            const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // Curve definition matches the static SVG path.
        // We'll approximate the same poly-bezier using the sampled SVG path shape.
        function curvePoint(t) {
            // t in [0..1] over x from 0..100 with a hand-tuned mapping matching the SVG:
            // Path: M 0 80 Q 20 60 40 70 T 80 30 T 100 10
            // We'll build using chained quadratic Beziers.
            const x = 100 * t;

            // Segment breakpoints (based on x): 0->40, 40->80, 80->100
            if (t <= 0.4) {
                // 0..0.4 maps to 0..40
                const u = t / 0.4; // 0..1
                // Quadratic from P0(0,80) to P2(40,70) with control P1(20,60)
                const X0 = 0, Y0 = 80;
                const X1 = 20, Y1 = 60;
                const X2 = 40, Y2 = 70;
                const px = (1-u)*(1-u)*X0 + 2*(1-u)*u*X1 + u*u*X2;
                const py = (1-u)*(1-u)*Y0 + 2*(1-u)*u*Y1 + u*u*Y2;
                return { x: px, y: py };
            }
            if (t <= 0.8) {
                // 0.4..0.8 maps to 40..80
                const u = (t - 0.4) / 0.4;
                // Quadratic from P0(40,70) to P2(80,30) with control derived from 'T'
                // The 'T' reflects the previous control: from first segment control(20,60) reflect around P0(40,70)
                // Reflected control: (60,80)
                const X0 = 40, Y0 = 70;
                const X1 = 60, Y1 = 80;
                const X2 = 80, Y2 = 30;
                const px = (1-u)*(1-u)*X0 + 2*(1-u)*u*X1 + u*u*X2;
                const py = (1-u)*(1-u)*Y0 + 2*(1-u)*u*Y1 + u*u*Y2;
                return { x: px, y: py };
            }

            // 0.8..1 maps to 80..100
            const u = (t - 0.8) / 0.2;
            // Quadratic from P0(80,30) to P2(100,10) with reflected control.
            // Previous control for segment2 (60,80) reflected around P0(80,30) => (100, -20)
            const X0 = 80, Y0 = 30;
            const X1 = 100, Y1 = -20;
            const X2 = 100, Y2 = 10;
            const px = (1-u)*(1-u)*X0 + 2*(1-u)*u*X1 + u*u*X2;
            const py = (1-u)*(1-u)*Y0 + 2*(1-u)*u*Y1 + u*u*Y2;
            return { x: px, y: py };
        }

        function mapToCanvas(px, py) {
            // SVG y increases downward; keep same.
            return {
                x: (px - SV.minX) / (SV.maxX - SV.minX) * w,
                y: (py - SV.minY) / (SV.maxY - SV.minY) * h,
            };
        }

        function drawBackgroundStatsGrid() {
            // faint horizontal grid lines
            ctx.save();
            const gridColor = 'rgba(156, 163, 175, 0.12)';
            ctx.strokeStyle = gridColor;
            ctx.lineWidth = 1;
            const lines = 6;
            for (let i = 1; i < lines; i++) {
                const y = (h / lines) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            ctx.restore();
        }

        function render(progress) {
            ctx.clearRect(0, 0, w, h);
            const vars = getComputedVars();

            // Horizontal grid lines removed per design feedback.

            // Determine current draw endpoint.
            const drawT = progress; // 0..1

            // Sample points along curve for both fill and stroke.
            const samples = 140;
            const pts = [];
            const fillPts = [];

            for (let i = 0; i <= samples; i++) {
                const t = (i / samples) * drawT;
                const sp = curvePoint(t);
                const c = mapToCanvas(sp.x, sp.y);
                pts.push(c);
                fillPts.push(c);
            }

            // Gradient fill (below curve) similar to static SVG chartGrad.
            // We'll create a canvas linear gradient from top->bottom with same stops.
            const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
            // Stop alpha matches the SVG stop-opacity values: 0.3 and 0.0
            fillGrad.addColorStop(0, `${vars.indigo}4D`); // ~0.3
            fillGrad.addColorStop(1, `${vars.purple}00`);

            ctx.save();
            ctx.fillStyle = fillGrad;

            // Build filled area path: follow curve then down to bottom and close.
            if (fillPts.length > 2) {
                ctx.beginPath();
                ctx.moveTo(fillPts[0].x, fillPts[0].y);
                for (let i = 1; i < fillPts.length; i++) {
                    ctx.lineTo(fillPts[i].x, fillPts[i].y);
                }
                ctx.lineTo(fillPts[fillPts.length - 1].x, h);
                ctx.lineTo(fillPts[0].x, h);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // Stroke path drawn up to drawT.
            ctx.save();
            ctx.strokeStyle = vars.indigo;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            if (pts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.stroke();
            }
            ctx.restore();

            // Traveling dot at current progress along full curve (wrap).
            const dotT = progress;
            const dotSp = curvePoint(dotT);
            const dot = mapToCanvas(dotSp.x, dotSp.y);

            ctx.save();
            const dotRadius = 5;
            // glowing dot (indigo)
            ctx.shadowColor = vars.indigo;
            ctx.shadowBlur = 18;
            ctx.fillStyle = vars.indigo;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // pulsing ring
            const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2);
            const ringR = 11 + pulse * 7;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = vars.indigo;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        function loop(ts) {
            const speed = 2500; // ms for a full draw; loops infinitely
            const p = ((ts % speed) / speed);
            // Draw left->right continuously; also keep dot visible early
            render(p);
            rafId = requestAnimationFrame(loop);
        }

        resize();
        window.addEventListener('resize', () => {
            cancelAnimationFrame(rafId);
            resize();
            rafId = requestAnimationFrame(loop);
        }, { passive: true });

        rafId = requestAnimationFrame(loop);

        // Stop SVG path animation (we replaced it with canvas)
        const linePath = document.querySelector('.chart-line-svg path');
        if (linePath) {
            linePath.style.strokeDasharray = '';
            linePath.style.strokeDashoffset = '';
            linePath.style.transition = '';
        }
    }


    // Scroll Fade-in effects
    const fadeElements = document.querySelectorAll('.glass-card, .service-card, .industry-card, .challenge-card');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        scrollObserver.observe(el);
    });

    // API Configuration: Use relative paths (works on both Vercel and local dev)
    const API_BASE = '';

    // Load Global Settings
    async function loadGlobalStats() {
        try {
            const res = await fetch(`${API_BASE}/api/stats`);
            const result = await res.json();
            if (result.success && result.data) {
                const payload = result.data;
                
                // Update Revenue
                document.querySelectorAll('.stat-revenue-val').forEach(el => {
                    if (el.tagName === 'STRONG') {
                        el.textContent = `${payload.revenue} Generated`;
                    } else {
                        el.textContent = payload.revenue;
                    }
                });
                
                // Update Growth
                document.querySelectorAll('.stat-growth-val').forEach(el => {
                    if (el.tagName === 'STRONG') {
                        el.textContent = `${payload.growth} Increase`;
                    } else {
                        el.textContent = payload.growth;
                    }
                });

                // Update Automation
                document.querySelectorAll('.stat-automation-val').forEach(el => {
                    if (el.tagName === 'STRONG') {
                        el.textContent = `${payload.automation} Automation Rate`;
                    } else {
                        el.textContent = payload.automation;
                    }
                });
            }
        } catch (err) {
            console.warn('Failed to load global stats from secure server:', err);
        }
    }
    loadGlobalStats();

    // Load Dynamic Case Studies
    async function loadDynamicCaseStudies() {
        const listContainer = document.querySelector('.case-study-list');
        if (!listContainer) return;

        try {
            const res = await fetch(`${API_BASE}/api/case-studies`);
            const result = await res.json();
            
            if (result.success && result.data && result.data.length > 0) {
                listContainer.innerHTML = result.data.map((payload, idx) => {
                    const colors = [
                        'rgba(92,103,242,0.3)', // Indigo
                        'rgba(168,85,247,0.3)', // Purple
                        'rgba(6,182,212,0.3)', // Cyan
                        'rgba(16,185,129,0.3)' // Emerald
                    ];
                    const selectedColor = colors[idx % colors.length];
                    const tagColor = idx % 4 === 1 ? 'var(--color-accent-purple)' : idx % 4 === 2 ? 'var(--color-accent-cyan)' : idx % 4 === 3 ? 'var(--color-accent-emerald)' : 'var(--color-accent-indigo)';

                    return `
                        <div class="case-study-card" style="opacity: 1; transform: translateY(0);">
                            <div class="case-study-img" style="background: linear-gradient(135deg, var(--bg-secondary) 0%, ${selectedColor} 100%);">
                                <span class="case-study-tag" style="background: ${tagColor};">${payload.category || 'Case'}</span>
                                <div style="position: absolute; bottom: 1rem; left: 1rem; color: #fff; font-weight: bold; font-size: 1.25rem;">Project details</div>
                            </div>
                            <div class="case-study-body">
                                <h3>${payload.title || 'Untitled Case'}</h3>
                                <p style="font-size: 0.9rem; margin-top: 0.5rem;">${payload.summary || ''}</p>
                                <div class="case-study-metrics">
                                    <div class="case-study-metric">
                                        <strong>${payload.metric1_val || ''}</strong>
                                        ${payload.metric1_lbl || ''}
                                    </div>
                                    <div class="case-study-metric">
                                        <strong>${payload.metric2_val || ''}</strong>
                                        ${payload.metric2_lbl || ''}
                                    </div>
                                    <div class="case-study-metric">
                                        <strong>${payload.metric3_val || ''}</strong>
                                        ${payload.metric3_lbl || ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.warn('Failed to load case studies from server, showing defaults.', err);
        }
    }
    loadDynamicCaseStudies();

    // Dynamic Calculator for Diagnostic Value
    const pricingSelect = document.getElementById('company-size');
    const pricingResult = document.getElementById('calc-estimate');
    if (pricingSelect && pricingResult) {
        pricingSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'startup') {
                pricingResult.textContent = '$900 / ₹75,000';
            } else if (val === 'midmarket') {
                pricingResult.textContent = '$1,800 / ₹1,50,000';
            } else if (val === 'enterprise') {
                pricingResult.textContent = 'Custom Strategy Pricing';
            }
        });
    }

    // Dynamic B2B Lead Form Integration (Supabase Table + Formspree Email Notification Router)
    const contactForm = document.getElementById('diagnostic-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Processing Request...</span>';

            const name = document.getElementById('full-name').value;
            const email = document.getElementById('email').value;
            const website = document.getElementById('website').value;
            const size = document.getElementById('company-size').value;
            const type = document.getElementById('request-type').value;
            const context = document.getElementById('message').value;

            // Send email notification and insert lead via unified backend proxy
            try {
                const res = await fetch(`${API_BASE}/api/leads`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        website: website,
                        companySize: size,
                        requestType: type,
                        strategicContext: context
                    })
                });
                const result = await res.json();
                if (!result.success) {
                    console.warn('Lead submission warning:', result.message);
                }
            } catch (err) {
                console.error('Lead submission API error:', err);
            }

            // User alert & feedback dialog
            alert(`Thank you for submitting your Diagnostic Request!\n\nOur lead strategist will email you at ${email} within 2 hours to confirm your scheduling. Your request has also been logged securely in our system database.`);
            contactForm.reset();
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        });
    }
});
