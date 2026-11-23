(function () {
  'use strict';

  var SECTIONS = [
    { key: 'bestSellers', el: 'best-grid', empty: 'لا توجد منتجات مبيعاً حالياً', link: 'pages/products.html?sort=best_selling' },
    { key: 'latest', el: 'latest-grid', empty: 'لا توجد منتجات جديدة حالياً', link: 'pages/products.html?sort=newest' },
    { key: 'featured', el: 'featured-grid', empty: 'لا توجد منتجات مميزة حالياً', link: 'pages/products.html?featured=true' },
    { key: 'deals', el: 'deals-grid', empty: 'لا توجد عروض متاحة حالياً', link: 'pages/products.html?onSale=true' }
  ];

  function $(id) { return document.getElementById(id); }

  function setFeatureIcons() {
    var map = { 'feat-truck': 'truck', 'feat-shield': 'shield', 'feat-refresh': 'refresh', 'feat-tag': 'tag' };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = UI.icon(map[id]);
    });
  }

  function errorBlock(message, retryAttr) {
    return '<div class="alert alert-danger home-error" role="alert"><span>' + UI.escapeHtml(message) + '</span> ' +
      '<button type="button" class="btn btn-sm btn-outline" ' + retryAttr + '>إعادة المحاولة</button></div>';
  }

  /* ---------- categories ---------- */
  async function loadCategories() {
    var box = $('categories-grid');
    var sk = '';
    for (var i = 0; i < 6; i++) sk += '<div class="skeleton home-cat-skeleton"></div>';
    box.innerHTML = sk;
    try {
      var res = await Api.get('/categories');
      var list = (res.data || []).filter(function (c) { return !c.parentId; });
      if (!list.length) list = res.data || [];
      if (!list.length) {
        box.innerHTML = UI.emptyState({ icon: 'tag', title: 'لا توجد أقسام حالياً', text: 'سنضيف أقساماً جديدة قريباً.' });
        return;
      }
      box.innerHTML = list.map(function (c) {
        var img = UI.safeUrl(c.imageUrl);
        var media = img
          ? '<img src="' + UI.escapeHtml(img) + '" alt="" loading="lazy" decoding="async">'
          : UI.icon('tag');
        var href = 'pages/products.html?category=' + encodeURIComponent(c.slug);
        return '<a class="home-cat" href="' + UI.escapeHtml(href) + '"><span class="home-cat-media">' + media + '</span>' +
          '<span>' + UI.escapeHtml(c.name) + '</span>' +
          (c.productCount != null ? '<span class="home-cat-count">' + UI.escapeHtml(UI.formatNumber(c.productCount)) + ' منتج</span>' : '') +
          '</a>';
      }).join('');
    } catch (err) {
      box.innerHTML = errorBlock(err.message || 'تعذر تحميل الأقسام', 'data-retry="categories"');
    }
  }

  /* ---------- product sections ---------- */
  function showSkeletons() {
    SECTIONS.forEach(function (s) { $(s.el).innerHTML = UI.skeletonCards(4); });
  }

  async function loadHome() {
    showSkeletons();
    try {
      var res = await Api.get('/products/home');
      var data = res.data || {};
      SECTIONS.forEach(function (s) {
        var list = data[s.key] || [];
        var box = $(s.el);
        if (!list.length) {
          box.classList.remove('product-grid');
          box.innerHTML = UI.emptyState({
            icon: 'box', title: s.empty,
            actionHtml: '<a class="btn btn-outline" href="' + UI.escapeHtml(s.link) + '">تصفح المنتجات</a>'
          });
          return;
        }
        box.classList.add('product-grid');
        box.innerHTML = list.map(function (p) { return UI.productCardHTML(p, { favIds: Layout.favIds }); }).join('');
      });
    } catch (err) {
      SECTIONS.forEach(function (s) {
        var box = $(s.el);
        box.classList.remove('product-grid');
        box.innerHTML = errorBlock(err.message || 'تعذر تحميل المنتجات', 'data-retry="home"');
      });
    }
  }

  function onRetry(e) {
    var btn = e.target.closest && e.target.closest('[data-retry]');
    if (!btn) return;
    if (btn.dataset.retry === 'categories') loadCategories(); else loadHome();
  }

  (async function init() {
    await window.appReady;
    setFeatureIcons();
    document.getElementById('main').addEventListener('click', onRetry);
    loadCategories();
    loadHome();
  })();
})();
