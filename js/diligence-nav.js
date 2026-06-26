/**
 * Mobile menu for Strategic Partner / Ontario readiness navigation bars.
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  function wrapFlatLinks(nav) {
    const directLinks = Array.from(nav.children).filter(function (el) {
      return el.tagName === 'A';
    });
    if (!directLinks.length) return null;

    const panel = document.createElement('div');
    panel.className = 'diligence-nav-panel diligence-nav-links nav-links';
    directLinks.forEach(function (a) {
      panel.appendChild(a);
    });
    return panel;
  }

  function findLinkPanel(nav) {
    var panel = nav.querySelector('.nav-links, .diligence-nav-panel');
    if (panel) return panel;

    panel = wrapFlatLinks(nav);
    if (panel) {
      nav.appendChild(panel);
      return panel;
    }

    var children = Array.from(nav.children);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.classList && child.classList.contains('diligence-nav-header')) continue;
      if (child.tagName === 'DIV' && child.querySelector('a')) {
        return child;
      }
    }
    return null;
  }

  function enhanceNav(nav) {
    if (nav.dataset.diligenceEnhanced === '1') return;

    var panel = findLinkPanel(nav);
    if (!panel) return;

    var titleEl = nav.querySelector('.nav-logo, strong, .diligence-nav-title');
    if (!titleEl) {
      titleEl = document.createElement('span');
      titleEl.className = 'diligence-nav-title';
      titleEl.textContent = (document.title || 'MediForge').split('|')[0].trim();
      nav.insertBefore(titleEl, panel);
    }

    panel.classList.add('diligence-nav-panel', 'diligence-nav-links', 'nav-links');

    var header = document.createElement('div');
    header.className = 'diligence-nav-header';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'diligence-nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'diligence-nav-panel-' + Math.random().toString(36).slice(2, 9));
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.textContent = 'Menu';

    panel.id = toggle.getAttribute('aria-controls');

    header.appendChild(titleEl);
    header.appendChild(toggle);
    nav.insertBefore(header, panel);

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('diligence-nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
    });

    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('diligence-nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Menu';
      });
    });

    nav.dataset.diligenceEnhanced = '1';
    nav.classList.add('diligence-nav-enhanced');
  }

  function init() {
    document.querySelectorAll('.nav, .brochure-nav').forEach(enhanceNav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
