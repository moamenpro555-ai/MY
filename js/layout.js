/**
 * layout.js — shared header/footer + global cart/favorite handlers.
 * Requires: config.js, api.js, ui.js, auth.js
 *
 * window.appReady : Promise (defined immediately; resolves after auth + header/footer + fav ids + cart count are ready)
 * window.Layout   : { refreshCartCount(), setCartCount(n), favIds:Set, isFav(id), setFav(id,bool) }
 * Events: 'app:ready' (document-level window event), 'cart:changed' (detail {itemCount}), 'fav:changed' (detail {id,isFav})
 */
(function () {
  'use strict';

  var resolveReady;
  window.appReady = new Promise(function (resolve) { resolveReady = resolve; });

  var CFG = window.APP_CONFIG || {};
  var STORE = CFG.STORE_NAME || 'المتجر';
  var esc = function (v) { return window.UI.escapeHtml(v); };
  var icon = function (n) { return window.UI.icon(n); };

  var cartCount = 0;
  var favIds = new Set();
  var categories = [];
  var headerRendered = false;
  var lastFocus = null;

  function root() {
    return (document.body && document.body.dataset.root) || '';
  }

  /* ------------------------------------------------------------------ */
  /* Cart count                                                          */
  /* ------------------------------------------------------------------ */
  function paintCartCount() {
    var text = window.UI.formatNumber(cartCount);
    Array.prototype.forEach.call(document.querySelectorAll('.cart-badge'), function (el) {
      el.textContent = text;
      el.hidden = cartCount <= 0;
    });
  }

  function setCartCount(n) {
    var v = parseInt(n, 10);
    cartCount = isFinite(v) && v > 0 ? v : 0;
    paintCartCount();
  }

  function refreshCartCount() {
    if (!window.Auth.isLoggedIn()) { setCartCount(0); return Promise.resolve(0); }
    return window.Api.get('/cart').then(function (res) {
      var c = res && res.data && res.data.summary ? res.data.summary.itemCount : 0;
      setCartCount(c);
      return cartCount;
    }).catch(function () { return cartCount; });
  }

  /* ------------------------------------------------------------------ */
  /* Favorites                                                           */
  /* ------------------------------------------------------------------ */
  function isFav(id) { return favIds.has(String(id)); }

  function setFav(id, value) {
    id = String(id);
    if (value) favIds.add(id); else favIds.delete(id);
  }

  function loadFavIds() {
    if (!window.Auth.isLoggedIn()) return Promise.resolve();
    return window.Api.get('/favorites/ids').then(function (res) {
      favIds.clear();
      (Array.isArray(res.data) ? res.data : []).forEach(function (id) { favIds.add(String(id)); });
    }).catch(function () { /* non-fatal */ });
  }

  function paintFavButtons(id, active) {
    var sel = '[data-action="toggle-fav"][data-id="' + String(id).replace(/["\\]/g, '\\$&') + '"]';
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (b) {
      b.classList.toggle('is-fav', active);
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
      b.setAttribute('aria-label', active ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
      var tmp = document.createElement('div');
      tmp.innerHTML = icon(active ? 'heart-fill' : 'heart');
      var fresh = tmp.firstChild;
      var old = b.querySelector('svg.icon');
      if (old && fresh) old.replaceWith(fresh);
      else if (fresh) b.insertBefore(fresh, b.firstChild);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Header / footer markup                                              */
  /* ------------------------------------------------------------------ */
  function categoryLinksHTML(extraClass) {
    var r = root();
    var html = '<li><a class="' + extraClass + '" href="' + r + 'pages/products.html">كل المنتجات</a></li>';
    categories.forEach(function (c) {
      if (!c || !c.slug) return;
      html += '<li><a class="' + extraClass + '" href="' + esc(r + 'pages/products.html?category=' + encodeURIComponent(c.slug)) + '">' + esc(c.name) + '</a></li>';
    });
    return html;
  }

  function categoryOptionsHTML() {
    var html = '<option value="">كل الأقسام</option>';
    categories.forEach(function (c) {
      if (c && c.slug) html += '<option value="' + esc(c.slug) + '">' + esc(c.name) + '</option>';
    });
    return html;
  }

  function accountMenuHTML() {
    var r = root();
    var u = window.Auth.user;
    if (!u) {
      return '<div class="account-menu-guest">' +
        '<a class="account-link" href="' + r + 'pages/login.html">' + icon('user') + '<span>تسجيل الدخول</span></a>' +
        '<a class="account-link" href="' + r + 'pages/register.html">' + icon('plus') + '<span>إنشاء حساب</span></a></div>';
    }
    var html = '<div class="account-menu-head"><strong class="account-name">' + esc(u.fullName) + '</strong>' +
      '<span class="account-email">' + esc(u.email) + '</span></div>' +
      '<a class="account-link" href="' + r + 'pages/profile.html">' + icon('user') + '<span>حسابي</span></a>' +
      '<a class="account-link" href="' + r + 'pages/orders.html">' + icon('package') + '<span>طلباتي</span></a>' +
      '<a class="account-link" href="' + r + 'pages/profile.html#favorites">' + icon('heart') + '<span>المفضلة</span></a>';
    if (window.Auth.isAdmin()) {
      html += '<a class="account-link account-link-admin" href="' + r + 'admin/index.html">' + icon('shield') + '<span>لوحة التحكم</span></a>';
    }
    html += '<button type="button" class="account-link account-logout" data-action="logout">' + icon('logout') + '<span>تسجيل الخروج</span></button>';
    return html;
  }

  function drawerAccountHTML() {
    var r = root();
    var u = window.Auth.user;
    if (!u) {
      return '<div class="drawer-auth">' +
        '<a class="btn btn-primary btn-block" href="' + r + 'pages/login.html">تسجيل الدخول</a>' +
        '<a class="btn btn-outline btn-block" href="' + r + 'pages/register.html">إنشاء حساب</a></div>';
    }
    var html = '<div class="drawer-user">' + icon('user') + '<span>' + esc(u.fullName) + '</span></div><ul class="drawer-list">' +
      '<li><a href="' + r + 'pages/profile.html">' + icon('user') + '<span>حسابي</span></a></li>' +
      '<li><a href="' + r + 'pages/orders.html">' + icon('package') + '<span>طلباتي</span></a></li>' +
      '<li><a href="' + r + 'pages/profile.html#favorites">' + icon('heart') + '<span>المفضلة</span></a></li>';
    if (window.Auth.isAdmin()) html += '<li><a href="' + r + 'admin/index.html">' + icon('shield') + '<span>لوحة التحكم</span></a></li>';
    html += '<li><button type="button" class="drawer-logout" data-action="logout">' + icon('logout') + '<span>تسجيل الخروج</span></button></li></ul>';
    return html;
  }

  function headerHTML() {
    var r = root();
    var u = window.Auth.user;
    return '<a class="skip-link" href="#main">تخطَّ إلى المحتوى</a>' +
      '<div class="topbar"><div class="container topbar-inner"><span>' + icon('truck') + ' شحن مجاني للطلبات فوق ' +
      esc(window.UI.formatPrice(CFG.FREE_SHIPPING_THRESHOLD || 1000)) + '</span><span class="topbar-note">' + icon('shield') + ' الدفع عند الاستلام</span></div></div>' +
      '<div class="header-main"><div class="container header-row">' +
      '<button type="button" class="icon-btn nav-toggle" data-action="open-drawer" aria-label="القائمة" aria-expanded="false" aria-controls="mobile-drawer">' + icon('menu') + '</button>' +
      '<a class="logo" href="' + r + 'index.html" aria-label="' + esc(STORE) + ' - الصفحة الرئيسية">' +
      '<img class="logo-img" src="' + r + 'assets/icons/logo.svg" alt="" width="36" height="36"><span class="logo-text">' + esc(STORE) + '</span></a>' +
      '<form class="header-search" role="search" method="get" action="' + r + 'pages/products.html">' +
      '<select class="header-search-select" name="category" aria-label="القسم">' + categoryOptionsHTML() + '</select>' +
      '<input class="header-search-input" type="search" name="q" placeholder="ابحث عن منتج أو قسم..." aria-label="بحث" autocomplete="off" maxlength="100">' +
      '<button class="header-search-btn" type="submit" aria-label="بحث">' + icon('search') + '</button></form>' +
      '<div class="header-actions">' +
      '<a class="header-action header-fav" href="' + r + 'pages/profile.html#favorites" aria-label="المفضلة">' + icon('heart') + '<span class="header-action-text">المفضلة</span></a>' +
      '<a class="header-action header-cart" href="' + r + 'pages/cart.html" aria-label="السلة">' + icon('cart') +
      '<span class="header-action-text">السلة</span><span class="cart-badge" id="cart-count" hidden>0</span></a>' +
      '<div class="account">' +
      '<button type="button" class="header-action account-toggle" data-action="toggle-account" aria-haspopup="true" aria-expanded="false" aria-controls="account-menu">' +
      icon('user') + '<span class="header-action-text account-label">' + (u ? esc(String(u.fullName || '').split(' ')[0]) : 'حسابي') + '</span>' + icon('chevron-down') + '</button>' +
      '<div class="account-menu" id="account-menu" hidden>' + accountMenuHTML() + '</div></div>' +
      '</div></div></div>' +
      '<nav class="categories-bar" aria-label="الأقسام"><div class="container"><ul class="categories-list" id="categories-list">' + categoryLinksHTML('categories-link') + '</ul></div></nav>' +
      '<div class="drawer-overlay" data-action="close-drawer" hidden></div>' +
      '<aside class="drawer" id="mobile-drawer" aria-hidden="true" aria-label="القائمة الرئيسية" tabindex="-1">' +
      '<div class="drawer-head"><span class="drawer-title">' + esc(STORE) + '</span>' +
      '<button type="button" class="icon-btn" data-action="close-drawer" aria-label="إغلاق القائمة">' + icon('close') + '</button></div>' +
      '<div class="drawer-body"><div id="drawer-account">' + drawerAccountHTML() + '</div>' +
      '<h2 class="drawer-heading">الأقسام</h2><ul class="drawer-list" id="drawer-categories">' + categoryLinksHTML('') + '</ul>' +
      '<h2 class="drawer-heading">روابط سريعة</h2><ul class="drawer-list">' +
      '<li><a href="' + r + 'pages/cart.html">' + icon('cart') + '<span>السلة</span><span class="cart-badge" hidden>0</span></a></li>' +
      '<li><a href="' + r + 'pages/orders.html">' + icon('package') + '<span>تتبع طلباتي</span></a></li></ul></div></aside>';
  }

  function footerHTML() {
    var r = root();
    var year = new Date().getFullYear();
    return '<div class="footer-main"><div class="container footer-grid">' +
      '<section class="footer-col footer-about"><a class="logo logo-footer" href="' + r + 'index.html">' +
      '<img class="logo-img" src="' + r + 'assets/icons/logo.svg" alt="" width="36" height="36"><span class="logo-text">' + esc(STORE) + '</span></a>' +
      '<p>متجرك الإلكتروني الموثوق لتسوّق آمن وسريع، منتجات أصلية بأسعار منافسة وتوصيل لجميع المحافظات.</p></section>' +
      '<nav class="footer-col" aria-label="روابط سريعة"><h2 class="footer-title">روابط سريعة</h2><ul class="footer-links">' +
      '<li><a href="' + r + 'index.html">الرئيسية</a></li>' +
      '<li><a href="' + r + 'pages/products.html">كل المنتجات</a></li>' +
      '<li><a href="' + r + 'pages/cart.html">السلة</a></li>' +
      '<li><a href="' + r + 'pages/orders.html">طلباتي</a></li>' +
      '<li><a href="' + r + 'pages/profile.html">حسابي</a></li></ul></nav>' +
      '<section class="footer-col"><h2 class="footer-title">المتجر</h2><ul class="footer-links">' +
      '<li><a href="' + r + 'pages/about.html">من نحن</a></li>' +
      '<li><a href="' + r + 'pages/about.html#shipping">الشحن والاسترجاع</a></li>' +
      '<li><a href="' + r + 'pages/about.html#contact">تواصل معنا</a></li></ul></section>' +
      '<section class="footer-col"><h2 class="footer-title">الدفع والشحن</h2>' +
      '<p class="footer-pay">' + icon('shield') + '<span>الدفع عند الاستلام</span></p>' +
      '<p class="footer-note">الشحن مجاني للطلبات التي تتجاوز ' + esc(window.UI.formatPrice(CFG.FREE_SHIPPING_THRESHOLD || 1000)) + '.</p></section>' +
      '</div></div><div class="footer-bottom"><div class="container"><p>© ' + esc(window.UI.formatNumber(year).replace(/[٬,]/g, '')) + ' ' + esc(STORE) + '. جميع الحقوق محفوظة.</p></div></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Render + interactions                                               */
  /* ------------------------------------------------------------------ */
  function renderHeader() {
    var host = document.getElementById('site-header');
    if (!host) return;
    var q = host.querySelector('.header-search-input');
    var keepQ = q ? q.value : null;
    host.classList.add('site-header');
    host.innerHTML = headerHTML();
    if (keepQ === null) {
      var urlQ = window.UI.getParam('q');
      if (urlQ) host.querySelector('.header-search-input').value = urlQ;
    } else {
      host.querySelector('.header-search-input').value = keepQ;
    }
    var cat = window.UI.getParam('category');
    var sel = host.querySelector('.header-search-select');
    if (cat && sel) sel.value = cat;
    paintCartCount();
    headerRendered = true;
  }

  function renderFooter() {
    var host = document.getElementById('site-footer');
    if (!host) return;
    host.classList.add('site-footer');
    host.innerHTML = footerHTML();
  }

  function loadCategories() {
    return window.Api.get('/categories').then(function (res) {
      categories = Array.isArray(res.data) ? res.data.filter(function (c) { return !c.parentId; }) : [];
      if (!headerRendered) return;
      var list = document.getElementById('categories-list');
      if (list) list.innerHTML = categoryLinksHTML('categories-link');
      var dl = document.getElementById('drawer-categories');
      if (dl) dl.innerHTML = categoryLinksHTML('');
      var sel = document.querySelector('.header-search-select');
      if (sel) {
        var cur = sel.value || window.UI.getParam('category') || '';
        sel.innerHTML = categoryOptionsHTML();
        sel.value = cur;
      }
    }).catch(function () { /* header must work without categories */ });
  }

  function closeAccount() {
    var menu = document.getElementById('account-menu');
    var btn = document.querySelector('.account-toggle');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openDrawer() {
    var d = document.getElementById('mobile-drawer');
    var ov = document.querySelector('.drawer-overlay');
    if (!d) return;
    closeAccount();
    lastFocus = document.activeElement;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    if (ov) { ov.hidden = false; ov.classList.add('is-open'); }
    document.body.classList.add('drawer-open');
    var t = document.querySelector('.nav-toggle');
    if (t) t.setAttribute('aria-expanded', 'true');
    var first = d.querySelector('a[href],button');
    setTimeout(function () { (first || d).focus(); }, 30);
  }

  function closeDrawer() {
    var d = document.getElementById('mobile-drawer');
    var ov = document.querySelector('.drawer-overlay');
    if (!d || !d.classList.contains('is-open')) return;
    d.classList.remove('is-open');
    d.setAttribute('aria-hidden', 'true');
    if (ov) { ov.classList.remove('is-open'); ov.hidden = true; }
    document.body.classList.remove('drawer-open');
    var t = document.querySelector('.nav-toggle');
    if (t) t.setAttribute('aria-expanded', 'false');
    if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) lastFocus.focus();
  }

  function addToCart(btn) {
    var id = btn.dataset.id;
    if (!id || btn.disabled) return;
    if (!window.Auth.isLoggedIn()) { window.Auth.requireLogin(); return; }
    var qty = parseInt(btn.dataset.qty, 10);
    if (!isFinite(qty) || qty < 1) qty = 1;
    var body = { productId: id, quantity: qty };
    if (btn.dataset.size) body.size = btn.dataset.size;
    if (btn.dataset.color) body.color = btn.dataset.color;
    window.UI.setLoading(btn, true);
    window.Api.post('/cart/items', body).then(function (res) {
      var summary = res && res.data && res.data.summary;
      var count = summary ? summary.itemCount : cartCount;
      window.UI.toast('تمت إضافة المنتج إلى السلة', 'success');
      window.dispatchEvent(new CustomEvent('cart:changed', { detail: { itemCount: count } }));
    }).catch(function (err) {
      window.UI.handleError(err);
    }).then(function () {
      window.UI.setLoading(btn, false);
    });
  }

  function toggleFav(btn) {
    var id = btn.dataset.id;
    if (!id || btn.dataset.busy === '1') return;
    if (!window.Auth.isLoggedIn()) { window.Auth.requireLogin(); return; }
    var wasFav = isFav(id);
    btn.dataset.busy = '1';
    var req = wasFav ? window.Api.del('/favorites/' + encodeURIComponent(id)) : window.Api.post('/favorites/' + encodeURIComponent(id));
    req.then(function () {
      setFav(id, !wasFav);
      paintFavButtons(id, !wasFav);
      window.UI.toast(wasFav ? 'تمت الإزالة من المفضلة' : 'تمت الإضافة إلى المفضلة', 'success');
      window.dispatchEvent(new CustomEvent('fav:changed', { detail: { id: id, isFav: !wasFav } }));
    }).catch(function (err) {
      window.UI.handleError(err);
    }).then(function () {
      delete btn.dataset.busy;
    });
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var actionEl = t.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.dataset.action;
      if (action === 'add-to-cart') { e.preventDefault(); addToCart(actionEl); return; }
      if (action === 'toggle-fav') { e.preventDefault(); toggleFav(actionEl); return; }
      if (action === 'open-drawer') { openDrawer(); return; }
      if (action === 'close-drawer') { closeDrawer(); return; }
      if (action === 'toggle-account') {
        var menu = document.getElementById('account-menu');
        if (menu) {
          var open = menu.hidden;
          menu.hidden = !open;
          actionEl.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        return;
      }
      if (action === 'logout') { e.preventDefault(); actionEl.disabled = true; window.Auth.logout(); return; }
    }

    if (!t.closest('.account')) closeAccount();
    if (t.closest('#mobile-drawer a[href]')) closeDrawer();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAccount();
    closeDrawer();
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 992) closeDrawer();
  });
  window.addEventListener('cart:changed', function (e) {
    setCartCount(e && e.detail ? e.detail.itemCount : 0);
  });

  window.Layout = {
    refreshCartCount: refreshCartCount,
    setCartCount: setCartCount,
    favIds: favIds,
    isFav: isFav,
    setFav: setFav
  };

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  async function boot() {
    try {
      await window.Auth.init();
      renderHeader();
      renderFooter();
      loadCategories();
      await Promise.all([loadFavIds(), refreshCartCount()]);
      window.Auth.onChange(function () {
        renderHeader();
        if (!window.Auth.isLoggedIn()) { favIds.clear(); setCartCount(0); }
      });
    } catch (e) {
      if (window.console) console.error(e);
    } finally {
      resolveReady();
      window.dispatchEvent(new CustomEvent('app:ready'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
