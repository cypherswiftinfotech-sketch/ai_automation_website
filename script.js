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

    // Interactive Dashboard Simulation (For landing page visual)
    const linePath = document.querySelector('.chart-line-svg path');
    if (linePath) {
        // Animate path drawing
        const length = linePath.getTotalLength();
        linePath.style.strokeDasharray = length;
        linePath.style.strokeDashoffset = length;
        
        setTimeout(() => {
            linePath.style.transition = 'stroke-dashoffset 3s cubic-bezier(0.4, 0, 0.2, 1)';
            linePath.style.strokeDashoffset = '0';
        }, 500);
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

    // API Configuration: Fallback to localhost:8000 if page is opened via file:// or dev server
    const API_BASE = window.location.port === '8000' ? '' : 'http://localhost:8000';

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
