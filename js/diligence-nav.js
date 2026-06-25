/**
 * Mobile menu for Strategic Partner / Ontario readiness navigation bars.
 */
(function () {
  'use strict';

  function wrapFlatLinks(nav) {
    const directLinks = Array.from(nav.children).filter(function (el) {
      return el.tagName === 'A';
    });
    if (!directLinks.length) return null;

    const panel = document.createElement('div');
    panel.className = 'diligence-nav-panel diligence-nav-links';
    directLinks.forEach(function (a) {
      panel.appendChild(a);
    });
    return panel;
  }

  function enhanceNav(nav) {
    if (nav.dataset.diligenceEnhanced === '1') return;
    nav.dataset.diligenceEnhanced = '1';
    nav.classList.add('diligence-nav-enhanced');

    var titleEl = nav.querySelector('.nav-logo, strong, .diligence-nav-title');
    var panel = nav.querySelector('.nav-links, .diligence-nav-panel');

    if (!panel) {
      panel = wrapFlatLinks(nav);
      if (panel) nav.appendChild(panel);
    }

    if (!panel) return;

    panel.classList.add('diligence-nav-panel');
    if (panel.classList.contains('nav-links')) {
      panel.classList.add('diligence-nav-links');
    }

    if (!titleEl) {
      titleEl = document.createElement('span');
      titleEl.className = 'diligence-nav-title';
      titleEl.textContent = (document.title || 'MediForge').split('|')[0].trim();
      nav.insertBefore(titleEl, panel);
    }

    if (titleEl.parentNode === nav && !nav.querySelector('.diligence-nav-header')) {
      var header = document.createElement('div');
      header.className = 'diligence-nav-header';
      nav.insertBefore(header, nav.firstChild);
      header.appendChild(titleEl);
    } else if (!nav.querySelector('.diligence-nav-header')) {
      var headerWrap = document.createElement('div');
      headerWrap.className = 'diligence-nav-header';
      nav.insertBefore(headerWrap, panel);
      headerWrap.appendChild(titleEl);
    }

    var headerEl = nav.querySelector('.diligence-nav-header');
    if (!headerEl.querySelector('.diligence-nav-toggle')) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'diligence-nav-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      toggle.textContent = 'Menu';
      headerEl.appendChild(toggle);

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
    }
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
