/**
 * App-wide title case for buttons, labels, dropdown options, and headings.
 */
(function (global) {
  const SMALL_WORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to',
    'from', 'by', 'of', 'in', 'with', 'as', 'vs', 'via', 'per', 'etc.'
  ]);

  const PRESERVED_PHRASES = [
    'Interac e-Transfer',
    'OHIP / RAMQ / MSP / etc.',
    'Declined to Disclose',
    'Two or More Races'
  ];

  const SKIP_SELECTORS = [
    '[data-skip-title-case]',
    '.no-title-case',
    'script',
    'style',
    'noscript',
    'code',
    'pre',
    'svg',
    'tbody td',
    '.status-badge',
    '.patient-race-help'
  ].join(',');

  const TARGET_SELECTORS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'label', 'legend',
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'a.btn',
    '.btn',
    '.intake-primary-button',
    '.intake-secondary-button',
    'th',
    'option',
    'optgroup',
    '.page-title',
    '#page-title'
  ].join(',');

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest(SKIP_SELECTORS)) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function formatToken(token, isFirst, isLast) {
    if (!token) return token;
    if (/^e\.g\.$/i.test(token)) return 'e.g.';
    if (/^[A-Z0-9]{2,}$/.test(token.replace(/[^\w]/g, '')) && /[A-Z]/.test(token)) return token;

    const match = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'.]*)([^A-Za-z0-9]*)$/);
    if (!match) return token;

    const [, prefix, core, suffix] = match;
    const lower = core.toLowerCase();
    const useLower = !isFirst && !isLast && SMALL_WORDS.has(lower.replace(/\.$/, ''));
    const formatted = useLower
      ? lower
      : lower.charAt(0).toUpperCase() + lower.slice(1);
    return `${prefix || ''}${formatted}${suffix || ''}`;
  }

  function toTitleCase(input) {
    if (input == null) return input;
    const text = String(input);
    const trimmed = text.trim();
    if (!trimmed) return text;

    for (let i = 0; i < PRESERVED_PHRASES.length; i += 1) {
      if (trimmed.toLowerCase() === PRESERVED_PHRASES[i].toLowerCase()) {
        return PRESERVED_PHRASES[i];
      }
    }

    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('@')) return text;
    if (/^[\d\s\-+().,/]+$/.test(trimmed)) return text;
    if (/^--\s/.test(trimmed) && /\s--$/.test(trimmed)) {
      const inner = trimmed.replace(/^--\s*|\s*--$/g, '');
      return `-- ${toTitleCase(inner)} --`;
    }

    const words = trimmed.split(/\s+/);
    return words.map((word, index) => {
      if (word.includes('/')) {
        return word.split('/').map((part, partIndex) => (
          formatToken(part, index === 0 && partIndex === 0, index === words.length - 1)
        )).join('/');
      }
      return formatToken(word, index === 0, index === words.length - 1);
    }).join(' ');
  }

  function applyToTextNode(el, property) {
    const current = el[property];
    if (typeof current !== 'string' || !current.trim()) return;
    const next = toTitleCase(current);
    if (next !== current) el[property] = next;
  }

  function applyToElement(el) {
    if (shouldSkip(el)) return;

    if (el.matches('input, textarea')) {
      if (el.hasAttribute('placeholder')) {
        applyToTextNode(el, 'placeholder');
      }
      if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit' || el.type === 'reset')) {
        applyToTextNode(el, 'value');
      }
      return;
    }

    if (el.matches('option, optgroup')) {
      applyToTextNode(el, 'label');
      applyToTextNode(el, 'textContent');
      return;
    }

    if (el.matches(TARGET_SELECTORS)) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        applyToTextNode(el, 'textContent');
        return;
      }
      el.childNodes.forEach((node) => {
        if (node.nodeType === 3 && node.textContent.trim()) {
          const next = toTitleCase(node.textContent);
          if (next !== node.textContent) node.textContent = next;
        }
      });
    }
  }

  function applyTitleCase(root) {
    const scope = root || document.body;
    if (!scope) return;

    scope.querySelectorAll(TARGET_SELECTORS).forEach(applyToElement);
    scope.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
      if (!shouldSkip(el)) applyToTextNode(el, 'placeholder');
    });
    if (document.title) {
      document.title = toTitleCase(document.title);
    }
  }

  function initTitleCase() {
    applyTitleCase(document.body);

    if (global.__mediforgeTitleCaseObserver) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          applyToElement(node);
          if (node.querySelectorAll) {
            node.querySelectorAll(TARGET_SELECTORS).forEach(applyToElement);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    global.__mediforgeTitleCaseObserver = observer;
  }

  global.MediForgeTitleCase = {
    toTitleCase,
    apply: applyTitleCase,
    init: initTitleCase
  };

  function boot() {
    initTitleCase();
    global.addEventListener('load', () => applyTitleCase(document.body));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
