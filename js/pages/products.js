(function () {
  'use strict';

  var LIMIT = 12;
  var SORTS = ['newest', 'price_asc', 'price_desc', 'best_selling', 'rating'];

  function $(id) { return document.getElementById(id); }

  var els = {
    heading: $('page-heading'),
    count: $('result-count'),
    sort: $('sort-select'),
    toggle: $('filters-toggle'),
    toggleIcon: $('filters-toggle-icon'),
    panel: $('filters-panel'),
    reset: $('reset-filters'),
    cats: $('category-list'),
    priceForm: $('price-form'),
    min: $('min-price'),
    max: $('max-price'),
    priceError: $('price-error'),
    ratings: $('rating-chips'),
    onSale: $('on-sale'),
    active: $('active-filters'),
    grid: $('products-grid'),
    pager: $('products-pager'),
    results: document.querySelector('.products-results')
  };

  var state = { q: '', category: '', page: 1, sort: 'newest', minPrice: '', maxPrice: '', minRating: '', onSale: false, featured: false };
  var categories = [];
  var reqId = 0;

  /* ---------- state <-> URL ---------- */
  function numParam(name) {
    var v = UI.getParam(name);
    if (v === null || v === '') return '';
    var n = Number(v);
    return isFinite(n) && n >= 0 ? String(n) : '';
  }

  function readState() {
    var sort = UI.getParam('sort');
    var rating = numParam('minRating');
    state = {
      q: (UI.getParam('q') || '').trim(),
      category: (UI.getParam('category') || '').trim(),
      page: Math.max(1, parseInt(UI.getParam('page'), 10) || 1),
      sort: SORTS.indexOf(sort) !== -1 ? sort : 'newest',
      minPrice: numParam('minPrice'),
      maxPrice: numParam('maxPrice'),
      minRating: ['2', '3', '4'].indexOf(rating) !== -1 ? rating : '',
      onSale: UI.getParam('onSale') === 'true',
      featured: UI.getParam('featured') === 'true'
    };
  }

  function buildQuery() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.sort && state.sort !== 'newest') p.set('sort', state.sort);
    if (state.minPrice !== '') p.set('minPrice', state.minPrice);
    if (state.maxPrice !== '') p.set('maxPrice', state.maxPrice);
    if (state.minRating) p.set('minRating', state.minRating);
    if (state.onSale) p.set('onSale', 'true');
    if (state.featured) p.set('featured', 'true');
    if (state.page > 1) p.set('page', String(state.page));
    return p.toString();
  }

  function pushState(replace) {
    var qs = buildQuery();
    var url = window.location.pathname + (qs ? '?' + qs : '');
    try {
      if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  /* ---------- UI sync ---------- */
  function categoryName(slug) {
    for (var i = 0; i < categories.length; i++) if (categories[i].slug === slug) return categories[i].name;
    return slug;
  }

  function syncControls() {
    els.sort.value = state.sort;
    if (document.activeElement !== els.min) els.min.value = state.minPrice;
    if (document.activeElement !== els.max) els.max.value = state.maxPrice;
    els.onSale.checked = state.onSale;
    Array.prototype.forEach.call(els.ratings.querySelectorAll('[data-rating]'), function (b) {
      var on = b.dataset.rating === state.minRating;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderCategories();
    renderActive();
    els.heading.textContent = state.q ? 'نتائج البحث' : (state.category ? categoryName(state.category) : (state.featured ? 'منتجات مميزة' : 'كل المنتجات'));
    document.title = els.heading.textContent + ' | سوق بلس';
  }

  function renderCategories() {
    if (!categories.length) return;
    var html = '<button type="button" class="category-item' + (!state.category ? ' is-active' : '') + '" role="radio" aria-checked="' + (!state.category) + '" data-cat="">الكل</button>';
    categories.forEach(function (c) {
      var on = c.slug === state.category;
      html += '<button type="button" class="category-item' + (on ? ' is-active' : '') + '" role="radio" aria-checked="' + on + '" data-cat="' + UI.escapeHtml(c.slug) + '">' +
        '<span>' + UI.escapeHtml(c.name) + '</span>' +
        (c.productCount != null ? '<span class="category-count">' + UI.escapeHtml(UI.formatNumber(c.productCount)) + '</span>' : '') + '</button>';
    });
    els.cats.innerHTML = html;
  }

  function renderActive() {
    var chips = [];
    function add(key, label) { chips.push({ key: key, label: label }); }
    if (state.q) add('q', 'بحث: ' + state.q);
    if (state.category) add('category', 'القسم: ' + categoryName(state.category));
    if (state.minPrice !== '') add('minPrice', 'من ' + UI.formatPrice(state.minPrice));
    if (state.maxPrice !== '') add('maxPrice', 'إلى ' + UI.formatPrice(state.maxPrice));
    if (state.minRating) add('minRating', 'تقييم ' + UI.formatNumber(state.minRating) + '+');
    if (state.onSale) add('onSale', 'العروض فقط');
    if (state.featured) add('featured', 'منتجات مميزة');
    if (!chips.length) { els.active.hidden = true; els.active.innerHTML = ''; return; }
    els.active.hidden = false;
    els.active.innerHTML = chips.map(function (c) {
      return '<button type="button" class="filter-chip" data-clear="' + c.key + '" aria-label="إزالة ' + UI.escapeHtml(c.label) + '"><span>' +
        UI.escapeHtml(c.label) + '</span>' + UI.icon('x') + '</button>';
    }).join('');
  }

  /* ---------- loading ---------- */
  function resetPage() { state.page = 1; }

  function apply(opts) {
    pushState(opts && opts.replace);
    syncControls();
    load();
  }

  async function load() {
    var id = ++reqId;
    els.grid.setAttribute('aria-busy', 'true');
    els.results.classList.add('is-loading');
    if (!els.grid.querySelector('.product-card')) els.grid.innerHTML = UI.skeletonCards(LIMIT);
    try {
      var res = await Api.get('/products', {
        params: {
          page: state.page, limit: LIMIT, q: state.q, category: state.category, sort: state.sort,
          minPrice: state.minPrice, maxPrice: state.maxPrice, minRating: state.minRating,
          onSale: state.onSale ? 'true' : '', featured: state.featured ? 'true' : ''
        }
      });
      if (id !== reqId) return;
      var list = res.data || [];
      var meta = res.meta || {};
      var total = meta.total != null ? meta.total : list.length;
      els.count.textContent = total ? UI.formatNumber(total) + ' منتج' : 'لا توجد نتائج';
      if (!list.length) {
        if (state.page > 1 && meta.totalPages) { state.page = meta.totalPages; apply({ replace: true }); return; }
        var hasFilters = !!(state.q || state.category || state.minPrice !== '' || state.maxPrice !== '' || state.minRating || state.onSale || state.featured);
        els.grid.innerHTML = UI.emptyState({
          icon: 'search', title: 'لا توجد منتجات مطابقة',
          text: hasFilters ? 'جرّب تعديل الفلاتر أو البحث بكلمات مختلفة.' : 'لم تتم إضافة منتجات بعد، عد لاحقاً.',
          actionHtml: hasFilters ? '<button type="button" class="btn btn-primary" data-reset-all>مسح الفلاتر</button>' : ''
        });
        UI.renderPagination(els.pager, { page: 1, totalPages: 1 }, function () {});
      } else {
        els.grid.innerHTML = list.map(function (p) { return UI.productCardHTML(p, { favIds: Layout.favIds }); }).join('');
        UI.renderPagination(els.pager, meta, function (p) {
          state.page = p;
          pushState(false);
          load();
          var top = els.results.getBoundingClientRect().top + window.pageYOffset - 90;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        });
      }
    } catch (err) {
      if (id !== reqId) return;
      els.count.textContent = '';
      els.grid.innerHTML = '<div class="alert alert-danger products-error" role="alert"><span>' + UI.escapeHtml(err.message || 'تعذر تحميل المنتجات') +
        '</span><button type="button" class="btn btn-sm btn-outline" data-retry>إعادة المحاولة</button></div>';
      UI.renderPagination(els.pager, { page: 1, totalPages: 1 }, function () {});
    } finally {
      if (id === reqId) {
        els.grid.setAttribute('aria-busy', 'false');
        els.results.classList.remove('is-loading');
      }
    }
  }

  async function loadCategories() {
    try {
      var res = await Api.get('/categories');
      categories = res.data || [];
      renderCategories();
      syncControls();
      if (!categories.length) els.cats.innerHTML = '<p class="text-muted text-sm">لا توجد أقسام.</p>';
    } catch (err) {
      els.cats.innerHTML = '<p class="text-danger text-sm">تعذر تحميل الأقسام.</p> <button type="button" class="btn btn-sm btn-outline" data-retry-cats>إعادة المحاولة</button>';
    }
  }

  /* ---------- price handling ---------- */
  function readPrice() {
    var min = els.min.value.trim();
    var max = els.max.value.trim();
    els.priceError.textContent = '';
    if (min !== '' && (!isFinite(Number(min)) || Number(min) < 0)) { els.priceError.textContent = 'أدخل سعراً صحيحاً'; return false; }
    if (max !== '' && (!isFinite(Number(max)) || Number(max) < 0)) { els.priceError.textContent = 'أدخل سعراً صحيحاً'; return false; }
    if (min !== '' && max !== '' && Number(min) > Number(max)) { els.priceError.textContent = 'الحد الأدنى أكبر من الأعلى'; return false; }
    state.minPrice = min === '' ? '' : String(Number(min));
    state.maxPrice = max === '' ? '' : String(Number(max));
    return true;
  }

  function applyPrice() {
    if (!readPrice()) return;
    resetPage();
    apply();
  }

  function clearKey(key) {
    if (key === 'onSale' || key === 'featured') state[key] = false;
    else state[key] = '';
    resetPage();
  }

  function resetAll() {
    state.q = ''; state.category = ''; state.minPrice = ''; state.maxPrice = '';
    state.minRating = ''; state.onSale = false; state.featured = false; state.page = 1;
    apply();
  }

  /* ---------- events ---------- */
  function bind() {
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; resetPage(); apply(); });

    els.cats.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (b) { state.category = b.dataset.cat; resetPage(); apply(); return; }
      if (e.target.closest('[data-retry-cats]')) loadCategories();
    });

    els.priceForm.addEventListener('submit', function (e) { e.preventDefault(); applyPrice(); });
    var debounced = UI.debounce(applyPrice, 600);
    els.min.addEventListener('input', debounced);
    els.max.addEventListener('input', debounced);

    els.ratings.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rating]');
      if (!b) return;
      state.minRating = state.minRating === b.dataset.rating ? '' : b.dataset.rating;
      resetPage(); apply();
    });

    els.onSale.addEventListener('change', function () { state.onSale = els.onSale.checked; resetPage(); apply(); });

    els.active.addEventListener('click', function (e) {
      var b = e.target.closest('[data-clear]');
      if (!b) return;
      clearKey(b.dataset.clear);
      apply();
    });

    els.reset.addEventListener('click', resetAll);

    els.grid.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset-all]')) resetAll();
      else if (e.target.closest('[data-retry]')) load();
    });

    els.toggle.addEventListener('click', function () {
      var open = !els.panel.classList.contains('is-open');
      els.panel.classList.toggle('is-open', open);
      els.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    window.addEventListener('popstate', function () {
      readState();
      syncControls();
      load();
    });
  }

  async function init() {
    await window.appReady;
    els.toggleIcon.innerHTML = UI.icon('menu');
    readState();
    // header search form may submit with empty params; normalize URL once
    syncControls();
    bind();
    load();
    loadCategories();
  }

  init();
})();
