/**
 * Shared lab/imaging order picker: category groups, search filter, per-test doctor notes.
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeSearch(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getDoctorNote(index) {
    const el = document.getElementById('order-note-' + index);
    return el ? el.value.trim() : '';
  }

  window.mfGetDoctorNoteForOrderIndex = getDoctorNote;

  window.mfBuildOrderItemWithNote = function (test, index) {
    if (!test) return null;
    const item = Object.assign({}, test);
    const doctorNote = getDoctorNote(index);
    if (doctorNote) item.doctorNote = doctorNote;
    return item;
  };

  window.mfFormatOrderItemNotes = function (row) {
    if (!row) return 'N/A';
    const catalog = row.notes ? String(row.notes).trim() : '';
    const doc = row.doctorNote ? String(row.doctorNote).trim() : '';
    if (catalog && doc) return catalog + ' | Ordering note: ' + doc;
    if (doc) return doc;
    return catalog || 'N/A';
  };

  function DiagnosticOrderPicker(options) {
    this.tests = options.tests || [];
    this.tbodyId = options.tbodyId;
    this.tableClass = options.tableClass || 'diagnostic-tests-table';
    this.type = options.type || 'lab';
    this.getCategory = options.getCategory || function (t) {
      return t.category || 'Other';
    };
    this.renderRow = options.renderRow;
    this.onFilterChange = options.onFilterChange || function () {};
    this.searchQuery = '';
    this.categoryFilter = 'all';
    this.categorySelectId = options.categorySelectId || null;
    this.searchInputId = options.searchInputId || null;
    this.resultCountId = options.resultCountId || null;
  }

  DiagnosticOrderPicker.prototype.getCategories = function () {
    const seen = new Set();
    const ordered = [];
    this.tests.forEach((t) => {
      const c = this.getCategory(t);
      if (!seen.has(c)) {
        seen.add(c);
        ordered.push(c);
      }
    });
    return ordered;
  };

  DiagnosticOrderPicker.prototype.populateCategorySelect = function () {
    if (!this.categorySelectId) return;
    const sel = document.getElementById(this.categorySelectId);
    if (!sel) return;
    const current = sel.value || 'all';
    sel.innerHTML = '<option value="all">All categories</option>';
    this.getCategories().forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    if (current && (current === 'all' || this.getCategories().includes(current))) {
      sel.value = current;
    }
    this.categoryFilter = sel.value || 'all';
  };

  DiagnosticOrderPicker.prototype.testMatchesFilter = function (test) {
    const cat = this.getCategory(test);
    if (this.categoryFilter !== 'all' && cat !== this.categoryFilter) return false;
    if (!this.searchQuery) return true;
    const hay = normalizeSearch(
      [test.name, test.category, test.cpt, test.modality, test.specimen, test.container].filter(Boolean).join(' ')
    );
    const terms = this.searchQuery.split(/\s+/).filter(Boolean);
    return terms.every((term) => hay.includes(term));
  };

  DiagnosticOrderPicker.prototype.updateResultCount = function (visible) {
    if (!this.resultCountId) return;
    const el = document.getElementById(this.resultCountId);
    if (!el) return;
    const total = this.tests.length;
    if (!this.searchQuery && this.categoryFilter === 'all') {
      el.textContent = total + ' tests';
    } else {
      el.textContent = visible + ' of ' + total + ' tests shown';
    }
  };

  DiagnosticOrderPicker.prototype.render = function () {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    let lastCategory = null;
    let visibleCount = 0;
    const colspan = this.type === 'lab' ? 8 : 8;

    this.tests.forEach((test, index) => {
      if (!this.testMatchesFilter(test)) return;

      const category = this.getCategory(test);
      if (category !== lastCategory) {
        lastCategory = category;
        const headerRow = document.createElement('tr');
        headerRow.className = 'category-header-row';
        headerRow.dataset.category = category;
        headerRow.innerHTML =
          '<td colspan="' +
          colspan +
          '" class="category-header">' +
          escapeHtml(category) +
          '</td>';
        tbody.appendChild(headerRow);
      }

      const row = document.createElement('tr');
      row.className = 'test-data-row';
      row.dataset.testIndex = String(index);
      row.dataset.category = category;
      row.innerHTML = this.renderRow(test, index);
      tbody.appendChild(row);
      visibleCount++;
    });

    if (visibleCount === 0) {
      const empty = document.createElement('tr');
      empty.innerHTML =
        '<td colspan="' +
        colspan +
        '" style="padding: 24px; text-align: center; color: #666;">No tests match your search. Try a different term or category.</td>';
      tbody.appendChild(empty);
    }

    this.updateResultCount(visibleCount);
    this.onFilterChange(visibleCount);
  };

  DiagnosticOrderPicker.prototype.bind = function () {
    const self = this;
    if (this.searchInputId) {
      const searchEl = document.getElementById(this.searchInputId);
      if (searchEl) {
        searchEl.addEventListener('input', function () {
          self.searchQuery = normalizeSearch(searchEl.value);
          self.render();
        });
      }
    }
    if (this.categorySelectId) {
      const catEl = document.getElementById(this.categorySelectId);
      if (catEl) {
        catEl.addEventListener('change', function () {
          self.categoryFilter = catEl.value || 'all';
          self.render();
        });
      }
    }
    this.populateCategorySelect();
    this.render();
  };

  window.DiagnosticOrderPicker = DiagnosticOrderPicker;
})();
