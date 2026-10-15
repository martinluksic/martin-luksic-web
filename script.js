/* ================================================================
   ML_TERMINAL — Lógica principal (JavaScript vanilla)
   Controla: Loader, Matrix rain, navegación, typing, scroll,
             IntersectionObserver, formulario y menú móvil.
   ================================================================ */

(function () {
    'use strict';

    // ============ LOADER TERMINAL ============
    // Simula el arranque de un sistema con mensajes progresivos
    function initLoader() {
        const loader = document.getElementById('loader');
        const loaderFill = document.getElementById('loader-bar-fill');
        const loaderPercent = document.getElementById('loader-percent');
        const lines = document.querySelectorAll('.loader-line');

        if (!loader) return;

        // Mensajes de boot activados en momentos relativos a la duración total (1400ms)
        const msgDelays = [0, 350, 750, 1100];
        msgDelays.forEach((delay, index) => {
            setTimeout(() => {
                if (lines[index]) {
                    lines[index].classList.add('active');
                    if (index === msgDelays.length - 1) {
                        lines[index].classList.add('success');
                    }
                }
            }, delay);
        });

        // Contador continuo del 1 al 100 en ~1400ms (14ms por unidad)
        let current = 0;
        const totalDuration = 1400;
        const interval = totalDuration / 100;

        const counter = setInterval(() => {
            current++;
            if (loaderFill) {
                loaderFill.style.width = current + '%';
            }
            if (loaderPercent) {
                loaderPercent.textContent = current + '%';
            }
            if (current >= 100) {
                clearInterval(counter);
            }
        }, interval);

        // Ocultar loader tras completar la secuencia
        setTimeout(() => {
            loader.classList.add('hidden');
            document.body.style.overflow = '';
            // Activar scrollbar al mismo tiempo que termina el loader
            document.documentElement.classList.add('scrollbar-ready');
        }, 1500);
    }


    // ============ MATRIX DIGITAL RAIN (canvas) ============
    // Columnas con profundidad fija: la lluvia cae sin acercarse al hacer scroll.
    function initMatrixRain() {
        const canvas = document.getElementById('matrix-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]|/\\';
        const settings = {
            // Profundidad fija en unidades del mundo y fundidos entre capas.
            near: 180, depth: 2200, nearFade: 240, farFade: 450,
            focalLength: 680, fontSize: 14, rowSpacing: 19, maxFontSize: 53,
            worldHeight: 2160, referenceHeight: 900,
            // Densidad: 8 capas x 24 columnas; móvil dibuja una de cada dos.
            layers: 8, columns: 24, mobileBreakpoint: 700,
            desktopFPS: 60, mobileFPS: 30, desktopDPR: 1.75, mobileDPR: 1.5,
            desktopPixels: 4000000, mobilePixels: 1500000,
            // Caída en unidades/segundo; estelas, brillo y respuesta del mouse.
            fallSpeed: 42, fallVariation: 40, minTrail: 12, trailVariation: 12,
            brightness: 0.85, mouseRadius: 150, mouseBoost: 0.7, mouseSmoothing: 0.18
        };
        const pointer = { x: 0, y: 0, active: false, strength: 0 };
        let width = 0;
        let height = 0;
        let mobile = false;
        let rainTime = 0;
        let animationId = null;
        let lastTime = null;
        let needsResize = false;
        const wrap = (value, period) => ((value % period) + period) % period;
        const smoothstep = (value) => {
            const t = Math.max(0, Math.min(1, value));
            return t * t * (3 - 2 * t);
        };
        // Semilla fija: sin regeneración aleatoria por fotograma, scroll o resize.
        let seed = 731;
        const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
        const streams = Array.from({ length: settings.layers * settings.columns }, (_, i) => {
            const column = i % settings.columns;
            const layer = Math.floor(i / settings.columns);
            return {
                column,
                x: ((column + 0.2 + random() * 0.6) / settings.columns - 0.5) * 2.8,
                z: (layer + random()) / settings.layers * settings.depth,
                phase: random(),
                speed: settings.fallSpeed + random() * settings.fallVariation,
                length: settings.minTrail + Math.floor(random() * settings.trailVariation),
                brightness: 0.65 + random() * 0.35,
                brightHead: i % 7 === 0,
                glyphs: Array.from({ length: 64 }, () => chars[Math.floor(random() * chars.length)])
            };
        });

        function resizeCanvas() {
            // Medidas CSS reales: la scrollbar no desplaza el punto de fuga ni el mouse.
            const bounds = canvas.getBoundingClientRect();
            width = bounds.width;
            height = bounds.height;
            mobile = width < settings.mobileBreakpoint;
            const pixelBudget = mobile ? settings.mobilePixels : settings.desktopPixels;
            const scale = Math.min(window.devicePixelRatio || 1,
                mobile ? settings.mobileDPR : settings.desktopDPR,
                Math.sqrt(pixelBudget / Math.max(1, width * height)));
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            needsResize = false;
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            const fallTime = reducedMotion.matches ? 0 : rainTime;
            const centerX = width * 0.5;
            const centerY = height * 0.46;
            const verticalScale = height / settings.referenceHeight;
            for (const stream of streams) {
                if (mobile && stream.column % 2) continue;
                const z = settings.near + stream.z;
                const perspective = settings.focalLength / z;
                const size = settings.fontSize * perspective;
                const fade = smoothstep((z - settings.near) / settings.nearFade)
                    * smoothstep((settings.near + settings.depth - z) / settings.farFade);
                if (fade < 0.005 || size > settings.maxFontSize) continue;
                const x = centerX + stream.x * width * 0.8 * perspective;
                if (x < -size || x > width + size) continue;
                const period = settings.worldHeight + stream.length * settings.rowSpacing;
                const head = wrap(stream.phase * period + fallTime * stream.speed, period) - settings.worldHeight / 2;
                const headRow = Math.floor(head / settings.rowSpacing);
                const depthBrightness = 0.3 + 0.7 * (1 - (z - settings.near) / settings.depth);
                ctx.font = `${Math.round(size * 2) / 2}px monospace`;
                for (let age = stream.length - 1; age >= 0; age--) {
                    const row = headRow - age;
                    const y = centerY + row * settings.rowSpacing * perspective * verticalScale;
                    if (y < -size || y > height + size) continue;
                    const distance = Math.hypot(x - pointer.x, y - pointer.y);
                    const glow = smoothstep(1 - distance / settings.mouseRadius) * pointer.strength;
                    const trail = Math.pow(1 - age / stream.length, 1.5);
                    const isHead = age === 0;
                    const baseAlpha = isHead ? (stream.brightHead ? 0.95 : 0.72) : 0.12 + trail * 0.55;
                    ctx.globalAlpha = fade * Math.min(0.95, baseAlpha * stream.brightness * depthBrightness
                        * settings.brightness + glow * settings.mouseBoost);
                    ctx.fillStyle = isHead && stream.brightHead ? '#9affc1' : '#00ff66';
                    // Brillo por glifo; no filtros ni superficies verdes sobre el contenido.
                    ctx.shadowColor = '#00ff66';
                    ctx.shadowBlur = glow > 0.02 ? 3 + glow * 9 : (isHead && stream.brightHead && z < 1200 ? 4 : 0);
                    ctx.fillText(stream.glyphs[wrap(row, 64)], x, y);
                }
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        function tick(time) {
            animationId = null;
            if (document.hidden || reducedMotion.matches) return;
            if (lastTime === null) lastTime = time;
            const elapsed = time - lastTime;
            const frameInterval = 1000 / (mobile ? settings.mobileFPS : settings.desktopFPS);
            if (elapsed >= frameInterval - 0.5) {
                if (needsResize) resizeCanvas();
                const dt = Math.min(elapsed / 1000, 0.1);
                lastTime = time;
                const target = pointer.active ? 1 : 0;
                pointer.strength += (target - pointer.strength) * (1 - Math.exp(-dt / settings.mouseSmoothing));
                rainTime += dt;
                render();
            }
            animationId = requestAnimationFrame(tick);
        }

        function syncAnimation() {
            if (animationId !== null) cancelAnimationFrame(animationId);
            animationId = null;
            lastTime = null;
            pointer.active = false;
            pointer.strength = 0;
            if (!document.hidden) {
                if (needsResize) resizeCanvas();
                render();
                if (!reducedMotion.matches) animationId = requestAnimationFrame(tick);
            }
        }

        window.addEventListener('pointermove', (event) => {
            if (event.pointerType !== 'mouse' || reducedMotion.matches || document.hidden) return;
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointer.active = true;
        }, { passive: true });
        const releasePointer = () => { pointer.active = false; };
        window.addEventListener('pointerout', (event) => {
            if (!event.relatedTarget) releasePointer();
        }, { passive: true });
        window.addEventListener('blur', releasePointer);
        window.addEventListener('pointercancel', releasePointer, { passive: true });

        window.addEventListener('resize', () => {
            needsResize = true;
            // El ciclo existente coordina resize y dibujo. En modo estático,
            // actualizar una sola imagen no debe iniciar una animación.
            if (reducedMotion.matches && !document.hidden) {
                resizeCanvas();
                render();
            }
        }, { passive: true });
        document.addEventListener('visibilitychange', syncAnimation);
        reducedMotion.addEventListener('change', syncAnimation);
        resizeCanvas();
        syncAnimation();
    }


    // ============ NAVEGACIÓN SCROLL ============
    // Agregar fondo al hacer scroll y resaltar sección activa
    function initNavScroll() {
        const nav = document.getElementById('nav');
        if (!nav) return;

        const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
        const sections = document.querySelectorAll('section[id]');

        window.addEventListener('scroll', () => {
            // Fondo de la navegación
            if (window.scrollY > 80) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }

            // Sección activa en navegación
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 150;
                if (window.scrollY >= sectionTop) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + current) {
                    link.classList.add('active');
                }
            });
        });
    }


    // ============ MENÚ HAMBURGUESA (MÓVIL) ============
    function initHamburger() {
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');

        if (!hamburger || !mobileMenu) return;

        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('open');
            // Prevenir scroll del body cuando el menú está abierto
            document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
        });

        // Cerrar menú al hacer clic en un enlace
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
            });
        });

        // Cerrar menú con la tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
                hamburger.focus();
            }
        });
    }


    // ============ EFECTO DE ESCRITURA (TYPING) ============
    // Simula escritura tipo terminal en el hero, en dos fases secuenciales
    function initTypingEffect() {
        const typedElement = document.getElementById('typed-text');
        if (!typedElement) return;

        const titleCursor = typedElement.nextElementSibling; // .typing-cursor del título

        // Texto de la primera línea (título)
        const titleText = 'Ingeniero y Técnico';

        // Función genérica de tipeo con callback al terminar
        function typeText(element, text, speed, onDone) {
            let index = 0;
            function type() {
                if (index < text.length) {
                    element.textContent += text.charAt(index);
                    index++;
                    setTimeout(type, speed + Math.random() * (speed * 0.6));
                } else if (onDone) {
                    onDone();
                }
            }
            type();
        }

        // Esperar a que el loader termine, luego encadenar tipeo + fadeUp
        setTimeout(() => {

            // FASE 1: tipear el título
            typeText(typedElement, titleText, 40, () => {

                // Al terminar el título: pequeña pausa y fadeUp de las especialidades
                setTimeout(() => {
                    if (titleCursor) titleCursor.style.display = 'none';

                    const specialtiesContainer = document.querySelector('.hero-specialties');
                    if (specialtiesContainer) specialtiesContainer.classList.add('typing-active');

                }, 300); // pausa breve entre fases
            });

        }, 2300); // espera al loader
    }




    // ============ INTERSECTION OBSERVER (animaciones de entrada) ============
    function initScrollAnimations() {
        // Respetar preferencia de movimiento reducido
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
                el.classList.add('visible');
            });
            return;
        }

        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observar todos los elementos con clase de revelado
        document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
            observer.observe(el);
        });

        // Delay escalonado para tarjetas y elementos repetidos
        const staggerElements = document.querySelectorAll(
            '.timeline-item, .project-card, .skill-category, .edu-entry'
        );
        staggerElements.forEach((el, index) => {
            // Agrupar por sección padre para reiniciar el delay
            const parent = el.closest('.section');
            if (parent) {
                const siblings = parent.querySelectorAll(el.tagName + '.' + el.classList[0]);
                const localIndex = Array.from(siblings).indexOf(el);
                el.style.transitionDelay = `${localIndex * 0.1}s`;
            }
        });
    }


    // ============ VALIDACIÓN DEL FORMULARIO DE CONTACTO ============
    function initContactForm() {
        const form = document.getElementById('contact-form');
        const notification = document.getElementById('form-notification');

        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Limpiar errores previos
            form.querySelectorAll('.form-group').forEach(group => {
                group.classList.remove('error');
            });

            let isValid = true;

            // Validar nombre
            const nameInput = form.querySelector('#contact-name');
            if (nameInput && nameInput.value.trim().length < 2) {
                nameInput.closest('.form-group').classList.add('error');
                isValid = false;
            }

            // Validar email
            const emailInput = form.querySelector('#contact-email');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailInput && !emailRegex.test(emailInput.value.trim())) {
                emailInput.closest('.form-group').classList.add('error');
                isValid = false;
            }

            // Validar mensaje
            const messageInput = form.querySelector('#contact-message');
            if (messageInput && messageInput.value.trim().length < 10) {
                messageInput.closest('.form-group').classList.add('error');
                isValid = false;
            }

            if (isValid && notification) {
                const submitBtn = form.querySelector('.submit-btn');
                const originalBtnText = submitBtn.textContent;

                // Deshabilitar botón y mostrar estado
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';
                submitBtn.style.opacity = '0.7';
                submitBtn.style.cursor = 'not-allowed';

                notification.classList.remove('show');

                // Parámetros para la plantilla de EmailJS
                const templateParams = {
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    message: messageInput.value.trim()
                };

                // Enviar usando EmailJS
                emailjs.send('service_2wymkze', 'template_gjypynh', templateParams)
                    .then(() => {
                        // Éxito
                        notification.textContent = 'Mensaje enviado correctamente';
                        notification.style.color = 'var(--green-primary)';
                        notification.classList.add('show');
                        form.reset(); // Limpiar formulario
                    })
                    .catch((error) => {
                        // Error de red o EmailJS
                        console.error('Error al enviar el mensaje:', error);
                        notification.textContent = 'Error al enviar mensaje';
                        notification.style.color = '#ff3333'; // Rojo para error
                        notification.classList.add('show');
                    })
                    .finally(() => {
                        // Restaurar botón
                        submitBtn.disabled = false;
                        submitBtn.textContent = originalBtnText;
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';

                        // Ocultar notificación después de 5 segundos
                        setTimeout(() => {
                            notification.classList.remove('show');
                            // Limpiar estilos en línea después de la transición
                            setTimeout(() => {
                                notification.style.color = '';
                            }, 400);
                        }, 5000);
                    });
            }
        });
    }


    // ============ SMOOTH SCROLL PARA ENLACES INTERNOS ============
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    const navHeight = document.getElementById('nav')?.offsetHeight || 70;
                    const targetPosition = targetElement.offsetTop - navHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }


    // ============ AÑO DINÁMICO EN EL FOOTER ============
    function initDynamicYear() {
        const yearElement = document.getElementById('current-year');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }


    // ============ NAVEGACIÓN POR TECLADO ============
    // Asegurar que el foco sea visible en elementos interactivos
    function initKeyboardNav() {
        // Detectar uso de teclado para mostrar outlines
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });
    }


    // ============ INICIALIZACIÓN PRINCIPAL ============
    // Bloquear scroll durante el loader
    document.body.style.overflow = 'hidden';

    // Esperar a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        initLoader();
        initMatrixRain();
        initNavScroll();
        initHamburger();
        initTypingEffect();
        initScrollAnimations();
        initContactForm();
        initSmoothScroll();
        initDynamicYear();
        initKeyboardNav();
    });

})();
