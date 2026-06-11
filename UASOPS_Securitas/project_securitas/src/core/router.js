/**
 * router.js — Navegación entre Secciones
 * ========================================
 * v7: Sidebar-aware. Genera botones con icon + label separados.
 */

const Router = (() => {

  let _currentSection = 'dashboard';
  const _hooks = {};

  return {

    navigate(sectionId) {
      const prev = document.getElementById(_currentSection);
      if (prev) prev.classList.remove('section--active');

      document.querySelectorAll('.nav__btn').forEach(btn =>
        btn.classList.remove('nav__btn--active')
      );
      const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
      if (activeBtn) activeBtn.classList.add('nav__btn--active');

      const next = document.getElementById(sectionId);
      if (next) {
        next.classList.add('section--active');
        // Emil: section transition — once per nav, ease-out, no scale(0)
        next.style.animation = 'none';
        next.offsetHeight; // reflow
        next.style.animation = '';
        next.classList.add('animate-section-in');
        setTimeout(() => next.classList.remove('animate-section-in'), 280);
      }

      if (_hooks[sectionId]) _hooks[sectionId].forEach(fn => fn());

      _currentSection = sectionId;
      State.set('activeSection', sectionId);
    },

    onEnter(sectionId, fn) {
      if (!_hooks[sectionId]) _hooks[sectionId] = [];
      _hooks[sectionId].push(fn);
    },

    current() { return _currentSection; },

    init() {
      const nav = document.getElementById('nav');
      if (!nav) return;

      APP_CONFIG.navigation.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'nav__btn';
        btn.dataset.section = item.id;

        // Sidebar structure: icon + text span
        const iconEl = document.createElement('span');
        iconEl.className = 'nav__btn-icon';
        iconEl.textContent = item.icon;

        const textEl = document.createElement('span');
        textEl.className = 'nav__btn-text';
        textEl.textContent = item.label;

        btn.appendChild(iconEl);
        btn.appendChild(textEl);
        btn.addEventListener('click', () => this.navigate(item.id));
        nav.appendChild(btn);
      });

      this.navigate(_currentSection);
    },
  };

})();
