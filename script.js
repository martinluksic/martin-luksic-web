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
        }, 1500);
    }


    // ============ MATRIX DIGITAL RAIN (canvas) ============
    // Efecto discreto de lluvia de caracteres como fondo
    function initMatrixRain() {
        const canvas = document.getElementById('matrix-canvas');
        if (!canvas) return;

        // Respetar preferencia de movimiento reducido
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            canvas.style.display = 'none';
            return;
        }

        const ctx = canvas.getContext('2d');
        let animationId;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resizeCanvas();

        // Caracteres para la lluvia (mezcla de katakana, números y símbolos)
        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]|/\\';
        const charArray = chars.split('');

        // Configuración de columnas
        const fontSize = 14;
        let columns = Math.floor(canvas.width / fontSize);
        let drops = new Array(columns).fill(1);

        // Velocidades aleatorias para cada columna
        let speeds = [];
        for (let i = 0; i < columns; i++) {
            speeds.push(0.3 + Math.random() * 0.7);
            drops[i] = Math.random() * -100;
        }

        function draw() {
            // Fondo semitransparente para efecto de desvanecimiento
            ctx.fillStyle = 'rgba(2, 4, 3, 0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#00ff66';
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < drops.length; i++) {
                // Selección aleatoria de carácter
                const text = charArray[Math.floor(Math.random() * charArray.length)];
                const x = i * fontSize;
                const y = drops[i] * fontSize;

                // Variar la opacidad entre columnas
                ctx.globalAlpha = 0.15 + Math.random() * 0.2;
                ctx.fillText(text, x, y);
                ctx.globalAlpha = 1;

                // Reiniciar columna cuando sale de pantalla
                if (y > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }

                drops[i] += speeds[i];
            }

            animationId = requestAnimationFrame(draw);
        }

        draw();

        // Recalcular al cambiar el tamaño de ventana
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resizeCanvas();
                columns = Math.floor(canvas.width / fontSize);
                drops = new Array(columns).fill(1);
                speeds = [];
                for (let i = 0; i < columns; i++) {
                    speeds.push(0.3 + Math.random() * 0.7);
                    drops[i] = Math.random() * -100;
                }
            }, 200);
        });

        // Pausar la animación cuando la pestaña no está visible (ahorro de recursos)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(animationId);
            } else {
                draw();
            }
        });
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
    // Simula escritura tipo terminal en el hero
    function initTypingEffect() {
        const typedElement = document.getElementById('typed-text');
        if (!typedElement) return;

        const text = 'Ingeniero de Ejecución en Gestión Industrial';
        let index = 0;

        // Esperar a que el loader termine
        setTimeout(() => {
            function type() {
                if (index < text.length) {
                    typedElement.textContent += text.charAt(index);
                    index++;
                    setTimeout(type, 40 + Math.random() * 30);
                }
            }
            type();
        }, 2300);
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
                // Mostrar notificación de integración pendiente
                notification.classList.add('show');
                notification.textContent = 'SYSTEM: Integración con backend pendiente. El mensaje no fue enviado a ningún servidor.';

                // Ocultar notificación después de 5 segundos
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 5000);
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
