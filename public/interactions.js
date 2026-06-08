// ═════════════════════════════════════════════════════════════════
// CYPHER SWIFT — Premium Interaction Engine
// Custom cursor · Magnetic buttons · Ripple · Particle burst
// Card 3D tilt · Background follow glow · Staggered entrance
// ═════════════════════════════════════════════════════════════════

(function () {
    // ── 1. Custom Cursor with Velocity Stretch ───────────────────
    const dot   = document.createElement('div');
    const ring  = document.createElement('div');
    dot.id  = 'cs-cursor';
    ring.id = 'cs-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = window.innerWidth / 2, my = window.innerHeight / 2; // Mouse target position
    let dx = mx, dy = my; // Dot interpolated position
    let rx = mx, ry = my; // Ring interpolated position
    
    let lastTime = Date.now();
    let speed = 0;
    let angle = 0;

    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
    });

    // Hardware accelerated tick loop for custom cursor rendering
    function tickCursor() {
        const now = Date.now();
        const dt = Math.max((now - lastTime) / 16, 0.1);
        lastTime = now;

        // Dot follows quickly
        dx += (mx - dx) * 0.25 * dt;
        dy += (my - dy) * 0.25 * dt;
        dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;

        // Ring follows with lagging inertia
        const vx = mx - rx;
        const vy = my - ry;
        
        rx += vx * 0.12 * dt;
        ry += vy * 0.12 * dt;

        // Calculate velocity vector length and angle
        const distance = Math.sqrt(vx * vx + vy * vy);
        speed += (distance - speed) * 0.15 * dt;
        
        if (distance > 1) {
            angle = Math.atan2(vy, vx);
        }

        // Map velocity to dynamic scale and stretch
        const stretch = Math.min(speed * 0.012, 0.7); // cap stretching at 70%
        
        const isHovering = document.body.classList.contains('cursor-hover');
        const isClicking = document.body.classList.contains('cursor-clicking');
        
        let baseScale = 1;
        if (isHovering) baseScale = 1.35;
        if (isClicking) baseScale = 0.75;

        // Apply 3D translate, rotation, and non-uniform scaling (stretch along velocity vector)
        ring.style.transform = `
            translate3d(${rx}px, ${ry}px, 0) 
            translate(-50%, -50%) 
            rotate(${angle}rad) 
            scale(${baseScale}) 
            scaleX(${1 + stretch}) 
            scaleY(${1 - stretch * 0.35})
        `;

        requestAnimationFrame(tickCursor);
    }
    tickCursor();

    // Cursor states on interactive elements
    const hoverTargets = 'a, button, .btn, .glass-card, .industry-card, .challenge-card, .nav-link, input, select, textarea, label, [role="button"], .admin-nav-item';
    document.addEventListener('mouseover', e => {
        if (e.target.closest(hoverTargets)) document.body.classList.add('cursor-hover');
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest(hoverTargets)) document.body.classList.remove('cursor-hover');
    });
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-clicking'));
    document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-clicking'));

    // ── 2. Follow glow behind cursor ─────────────────────────────
    const followGlow = document.createElement('div');
    followGlow.id = 'cs-follow-glow';
    document.body.appendChild(followGlow);

    document.addEventListener('mousemove', e => {
        followGlow.style.left = e.clientX + 'px';
        followGlow.style.top  = e.clientY + 'px';
    });

    // ── 3. Magnetic Buttons ───────────────────────────────────────
    function addMagnetic(el) {
        const strength = 0.35;
        el.addEventListener('mousemove', e => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top  + rect.height / 2;
            const dx = (e.clientX - cx) * strength;
            const dy = (e.clientY - cy) * strength;
            el.style.transform = `translate(${dx}px, ${dy}px) translateY(-3px)`;
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = '';
            el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
        el.addEventListener('mouseenter', () => {
            el.style.transition = 'transform 0.1s linear';
        });
    }

    document.querySelectorAll('.btn').forEach(addMagnetic);

    // ── 4. Ripple on click ────────────────────────────────────────
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const rect   = btn.getBoundingClientRect();
            const size   = Math.max(rect.width, rect.height);
            const ripple = document.createElement('span');
            ripple.classList.add('btn-ripple');
            ripple.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${e.clientX - rect.left - size / 2}px;
                top:  ${e.clientY - rect.top  - size / 2}px;
            `;
            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    });

    // ── 5. Canvas Particle Burst ──────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.id = 'cs-particles';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles = [];

    function spawnParticles(x, y, color = '#5c67f2') {
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
            const speed = 1.5 + Math.random() * 3;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                radius: 2.5 + Math.random() * 2,
                color,
                decay: 0.025 + Math.random() * 0.02
            });
        }
    }

    function drawParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08; // gravity
            p.alpha -= p.decay;
            if (p.alpha <= 0) { particles.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur  = 8;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.restore();
        }
        requestAnimationFrame(drawParticles);
    }
    drawParticles();

    // Spawn particles on primary button clicks
    document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.addEventListener('click', e => {
            const colors = ['#5c67f2', '#a855f7', '#06b6d4', '#10b981'];
            const c = colors[Math.floor(Math.random() * colors.length)];
            spawnParticles(e.clientX, e.clientY, c);
        });
    });

    // Subtle particle on any cursor move occasionally
    let lastParticle = 0;
    document.addEventListener('mousemove', e => {
        const now = Date.now();
        if (now - lastParticle < 80) return;
        lastParticle = now;
        const p = {
            x: e.clientX, y: e.clientY,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.6 - Math.random() * 0.8,
            alpha: 0.5,
            radius: 1.5,
            color: '#5c67f2',
            decay: 0.04
        };
        particles.push(p);
    });

    // ── 6. 3D Tilt on Glass Cards ─────────────────────────────────
    document.querySelectorAll('.glass-card').forEach(card => {
        // Inject shine element
        const shine = document.createElement('div');
        shine.classList.add('card-shine');
        card.style.position = 'relative';
        card.appendChild(shine);

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const cx   = rect.left + rect.width / 2;
            const cy   = rect.top  + rect.height / 2;
            const dx   = (e.clientX - cx) / (rect.width  / 2);
            const dy   = (e.clientY - cy) / (rect.height / 2);
            const tilt = 8;

            card.style.transform = `
                perspective(800px)
                rotateX(${-dy * tilt}deg)
                rotateY(${ dx * tilt}deg)
                translateY(-6px)
            `;

            // Update shine position
            const mx = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
            const my = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
            shine.style.setProperty('--mx', mx + '%');
            shine.style.setProperty('--my', my + '%');
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    // ── 7. Staggered entrance for grid items ──────────────────────
    const staggerTargets = document.querySelectorAll(
        '.industry-card, .challenge-card, .service-card, .why-point-item, .arch-row'
    );

    const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.stagger || 0;
                entry.target.style.transition = `opacity 0.6s ${delay}s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s ${delay}s cubic-bezier(0.34, 1.56, 0.64, 1)`;
                entry.target.style.opacity   = '1';
                entry.target.style.transform = 'translateY(0) scale(1)';
                staggerObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    staggerTargets.forEach((el, i) => {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(24px) scale(0.97)';
        el.dataset.stagger = (i % 6) * 0.07; // max 0.35s delay within a row
        staggerObserver.observe(el);
    });

    // ── 8. Nav link underline morph ───────────────────────────────
    // Already handled by CSS, but add a JS-driven glow on active
    document.querySelectorAll('.nav-link.active').forEach(link => {
        link.style.textShadow = '0 0 20px rgba(92, 103, 242, 0.6)';
    });

    // ── 9. Count-up animation for visible stats ───────────────────
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

    // Mark stat elements with data attributes for count-up
    const statMap = [
        { sel: '.stat-revenue-val', count: 3, suffix: 'Cr+', tag: 'STRONG' },
        { sel: '.stat-growth-val',  count: 2.5, suffix: 'x',  tag: 'STRONG' },
        { sel: '.stat-automation-val', count: 70, suffix: '%', tag: 'STRONG' },
    ];
    statMap.forEach(({ sel, count, suffix }) => {
        document.querySelectorAll(sel).forEach(el => {
            el.dataset.count  = count;
            el.dataset.suffix = suffix;
            statObserver.observe(el);
        });
    });

})();
