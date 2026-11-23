/**
 * ui.js — shared UI helpers (toasts, modals, formatting, HTML builders).
 * Requires: config.js. (Api is used only if present, never required.)
 * RULE: every dynamic string put into HTML MUST go through UI.escapeHtml (done here for all builders).
 */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var CURRENCY = CFG.CURRENCY || 'ج.م';

  /* ------------------------------------------------------------------ */
  /* Basic helpers                                                       */
  /* ------------------------------------------------------------------ */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Allows only http(s), data:image and relative URLs; otherwise returns ''. Result is NOT escaped. */
  function safeUrl(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^data:image\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
    return u;
  }

  function root() {
    return (document.body && document.body.dataset.root) || '';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms == null ? 300 : ms);
    };
  }

  function getParam(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ */
  /* Formatting                                                          */
  /* ------------------------------------------------------------------ */
  var numberFmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });

  function formatNumber(n) {
    var v = Number(n);
    return numberFmt.format(isFinite(v) ? v : 0);
  }

  function formatPrice(n) {
    return formatNumber(n) + ' ' + CURRENCY;
  }

  function toDate(d) {
    var dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function formatDate(d) {
    var dt = toDate(d);
    if (!dt) return '';
    return dt.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateTime(d) {
    var dt = toDate(d);
    if (!dt) return '';
    return dt.toLocaleString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  var ORDER_STATUS = {
    PENDING: 'قيد الانتظار', CONFIRMED: 'تم التأكيد', PROCESSING: 'قيد التجهيز',
    SHIPPED: 'تم الشحن', DELIVERED: 'تم التوصيل', CANCELLED: 'ملغي'
  };
  var PAYMENT_STATUS = { PENDING: 'قيد الانتظار', PAID: 'تم الدفع', FAILED: 'فشل الدفع', REFUNDED: 'تم الاسترداد' };
  var PAYMENT_METHOD = { CASH_ON_DELIVERY: 'الدفع عند الاستلام', CARD: 'بطاقة بنكية', WALLET: 'محفظة إلكترونية' };

  function statusLabel(s) { return ORDER_STATUS[s] || String(s || ''); }
  /** Returns full class string, e.g. "status status-pending". */
  function statusClass(s) { return 'status status-' + String(s || 'pending').toLowerCase(); }
  function paymentStatusLabel(s) { return PAYMENT_STATUS[s] || String(s || ''); }
  /** Returns "status status-paid" / "status status-failed" / "status status-pending" / "status status-refunded". */
  function paymentStatusClass(s) { return 'status status-pay-' + String(s || 'pending').toLowerCase(); }
  function paymentMethodLabel(m) { return PAYMENT_METHOD[m] || String(m || ''); }

  var GOVERNORATES = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر', 'البحيرة', 'الفيوم', 'الغربية',
    'الإسماعيلية', 'المنوفية', 'المنيا', 'القليوبية', 'الوادي الجديد', 'السويس', 'الشرقية', 'أسوان',
    'أسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'جنوب سيناء', 'كفر الشيخ', 'مطروح', 'الأقصر', 'قنا',
    'شمال سيناء', 'سوهاج'
  ];

  /* ------------------------------------------------------------------ */
  /* Icons                                                               */
  /* ------------------------------------------------------------------ */
  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    'search': '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    'cart': '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
    'heart': '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 22l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    'heart-fill': '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 22l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" fill="currentColor"/>',
    'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'menu': '<path d="M3 6h18M3 12h18M3 18h18"/>',
    'close': '<path d="M18 6 6 18M6 6l12 12"/>',
    'star': '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/>',
    'trash': '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'minus': '<path d="M5 12h14"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'truck': '<path d="M1 3h13v13H1z"/><path d="M14 8h4l4 4v4h-8"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    'box': '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    'logout': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'home': '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    'package': '<path d="m16.5 9.4-9-5.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    'tag': '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    'refresh': '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'phone': '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    'map-pin': '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
  };

  /** Returns an inline SVG string (aria-hidden, 1em, currentColor). Unknown name -> empty string. */
  function icon(name) {
    if (name === 'google') {
      return '<svg class="icon icon-google" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">' +
        '<path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8.1z"/>' +
        '<path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.4v2.8A11 11 0 0 0 12 23z"/>' +
        '<path fill="#FBBC05" d="M6 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.4a11 11 0 0 0 0 9.8z"/>' +
        '<path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.4 7.1L6 9.9c.8-2.6 3.2-4.5 6-4.5z"/></svg>';
    }
    var body = ICONS[name];
    if (!body) return '';
    return '<svg class="icon icon-' + name + '" viewBox="0 0 24 24" width="1em" height="1em" ' + S +
      ' aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /** 5 stars HTML, filled according to rating (rounded to nearest integer). */
  function stars(rating) {
    var r = Number(rating);
    if (!isFinite(r)) r = 0;
    r = Math.max(0, Math.min(5, r));
    var filled = Math.round(r);
    var out = '<span class="stars" role="img" aria-label="التقييم ' + escapeHtml(formatNumber(Math.round(r * 10) / 10)) + ' من 5">';
    for (var i = 1; i <= 5; i++) {
      var star = icon('star').replace('class="icon icon-star"', 'class="icon icon-star ' + (i <= filled ? 'star-filled' : 'star-empty') + '"');
      out += star;
    }
    return out + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */
  function getToastContainer() {
    var c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      c.setAttribute('aria-live', 'polite');
      c.setAttribute('aria-atomic', 'false');
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type) {
    type = type === 'success' || type === 'error' ? type : 'info';
    var c = getToastContainer();
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    var ic = type === 'success' ? 'check' : type === 'error' ? 'x' : 'shield';
    el.innerHTML = '<span class="toast-icon">' + icon(ic) + '</span><span class="toast-text"></span>' +
      '<button type="button" class="toast-close" aria-label="إغلاق">' + icon('close') + '</button>';
    el.querySelector('.toast-text').textContent = String(message == null ? '' : message);
    var removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      el.classList.add('is-leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }
    el.querySelector('.toast-close').addEventListener('click', remove);
    c.appendChild(el);
    while (c.children.length > 4) c.removeChild(c.firstChild);
    setTimeout(remove, type === 'error' ? 6000 : 3500);
    return el;
  }

  /* ------------------------------------------------------------------ */
  /* Modals                                                              */
  /* ------------------------------------------------------------------ */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var modalStack = [];

  function focusables(el) {
    return Array.prototype.filter.call(el.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
  }

  function onDocKeydown(e) {
    if (!modalStack.length) return;
    var top = modalStack[modalStack.length - 1];
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof top.onCancel === 'function') top.onCancel(); else closeModal(top.el);
      return;
    }
    if (e.key === 'Tab') {
      var f = focusables(top.el);
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.el.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !top.el.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    }
  }
  document.addEventListener('keydown', onDocKeydown);

  /**
   * Opens a modal. `el` is a `.modal-backdrop` element (containing a `.modal`).
   * Backdrop click and any `[data-close-modal]` inside close it. Fires 'modal:closed' on el.
   * @param {HTMLElement} el
   * @param {{onCancel?:Function}} [opts]
   */
  function openModal(el, opts) {
    if (!el) return;
    for (var i = 0; i < modalStack.length; i++) if (modalStack[i].el === el) return;
    var entry = { el: el, prevFocus: document.activeElement, onCancel: opts && opts.onCancel };
    entry.onClick = function (e) {
      if (e.target === el || (e.target.closest && e.target.closest('[data-close-modal]'))) {
        if (typeof entry.onCancel === 'function') entry.onCancel(); else closeModal(el);
      }
    };
    el.addEventListener('click', entry.onClick);
    modalStack.push(entry);
    el.hidden = false;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    var dlg = el.querySelector('.modal');
    if (dlg) {
      if (!dlg.hasAttribute('role')) dlg.setAttribute('role', 'dialog');
      dlg.setAttribute('aria-modal', 'true');
      if (!dlg.hasAttribute('tabindex')) dlg.setAttribute('tabindex', '-1');
    }
    document.body.classList.add('modal-open');
    var target = el.querySelector('[data-autofocus]') || focusables(el)[0] || dlg;
    if (target) setTimeout(function () { target.focus(); }, 30);
  }

  function closeModal(el) {
    if (!el) return;
    var idx = -1;
    for (var i = 0; i < modalStack.length; i++) if (modalStack[i].el === el) idx = i;
    if (idx === -1) return;
    var entry = modalStack.splice(idx, 1)[0];
    el.removeEventListener('click', entry.onClick);
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    el.hidden = true;
    if (!modalStack.length) document.body.classList.remove('modal-open');
    if (entry.prevFocus && typeof entry.prevFocus.focus === 'function' && document.contains(entry.prevFocus)) {
      entry.prevFocus.focus();
    }
    el.dispatchEvent(new CustomEvent('modal:closed'));
  }

  /**
   * Accessible confirm dialog. Resolves true (confirm) / false (cancel, Esc, backdrop).
   * @returns {Promise<boolean>}
   */
  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var id = 'confirm-' + Math.random().toString(36).slice(2, 8);
      var el = document.createElement('div');
      el.className = 'modal-backdrop';
      el.hidden = true;
      el.innerHTML =
        '<div class="modal modal-sm" role="alertdialog" aria-labelledby="' + id + '-t" aria-describedby="' + id + '-m">' +
        '<div class="modal-body">' +
        '<h2 class="modal-title" id="' + id + '-t">' + escapeHtml(opts.title || 'تأكيد الإجراء') + '</h2>' +
        '<p class="modal-text" id="' + id + '-m">' + escapeHtml(opts.message || 'هل أنت متأكد؟') + '</p>' +
        '</div><div class="modal-footer">' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-confirm-ok data-autofocus>' +
        escapeHtml(opts.confirmText || 'تأكيد') + '</button>' +
        '<button type="button" class="btn btn-outline" data-confirm-cancel>' + escapeHtml(opts.cancelText || 'إلغاء') + '</button>' +
        '</div></div>';
      document.body.appendChild(el);
      var done = false;
      function finish(result) {
        if (done) return;
        done = true;
        closeModal(el);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 0);
        resolve(result);
      }
      el.querySelector('[data-confirm-ok]').addEventListener('click', function () { finish(true); });
      el.querySelector('[data-confirm-cancel]').addEventListener('click', function () { finish(false); });
      openModal(el, { onCancel: function () { finish(false); } });
    });
  }

  /* ------------------------------------------------------------------ */
  /* HTML builders                                                       */
  /* ------------------------------------------------------------------ */
  /**
   * Product card HTML. Buttons `[data-action="add-to-cart"]` / `[data-action="toggle-fav"]` are handled globally by layout.js.
   * @param {object} p productCard DTO
   * @param {{favIds?:Set<string>}} [opts]
   */
  function productCardHTML(p, opts) {
    p = p || {};
    var favIds = opts && opts.favIds;
    var isFav = !!(favIds && favIds.has && favIds.has(p.id));
    var id = escapeHtml(p.id);
    var name = escapeHtml(p.name);
    var href = escapeHtml(root() + 'pages/product-details.html?id=' + encodeURIComponent(p.id));
    var eff = p.effectivePrice != null ? p.effectivePrice : (p.salePrice != null ? p.salePrice : p.price);
    var hasDiscount = p.price != null && Number(eff) < Number(p.price);
    var img = safeUrl(p.image);
    var inStock = p.inStock !== false && (p.stock == null || p.stock > 0);

    var html = '<article class="product-card' + (inStock ? '' : ' is-out') + '" data-product-id="' + id + '">';
    html += '<a class="product-card-media" href="' + href + '" tabindex="-1" aria-hidden="true">';
    if (img) html += '<img class="product-card-img" src="' + escapeHtml(img) + '" alt="' + name + '" loading="lazy" decoding="async">';
    html += '</a>';
    if (hasDiscount && p.discountPercent) html += '<span class="badge badge-discount">-' + escapeHtml(formatNumber(p.discountPercent)) + '%</span>';
    if (!inStock) html += '<span class="badge badge-out">نفدت الكمية</span>';
    html += '<button type="button" class="product-card-fav' + (isFav ? ' is-active' : '') + '" data-action="toggle-fav" data-id="' + id + '" aria-pressed="' + isFav +
      '" aria-label="' + (isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة') + '">' + icon(isFav ? 'heart-fill' : 'heart') + '</button>';
    html += '<div class="product-card-body">';
    if (p.category && p.category.name) html += '<span class="product-card-cat">' + escapeHtml(p.category.name) + '</span>';
    html += '<h3 class="product-card-title"><a href="' + href + '">' + name + '</a></h3>';
    html += '<div class="product-card-rating">' + stars(p.ratingAvg) + '<span class="product-card-rating-count">(' + escapeHtml(formatNumber(p.ratingCount || 0)) + ')</span></div>';
    html += '<div class="product-card-prices"><span class="price-current">' + escapeHtml(formatPrice(eff)) + '</span>';
    if (hasDiscount) html += '<del class="price-old">' + escapeHtml(formatPrice(p.price)) + '</del>';
    html += '</div>';
    html += '<button type="button" class="btn btn-primary btn-block btn-sm product-card-add" data-action="add-to-cart" data-id="' + id + '"' + (inStock ? '' : ' disabled') + '>' +
      icon('cart') + '<span>' + (inStock ? 'أضف إلى السلة' : 'غير متوفر') + '</span></button>';
    html += '</div></article>';
    return html;
  }

  /** n skeleton product cards. */
  function skeletonCards(n) {
    var out = '';
    n = n == null ? 8 : n;
    for (var i = 0; i < n; i++) {
      out += '<div class="product-card product-card-skeleton" aria-hidden="true">' +
        '<div class="skeleton skeleton-img"></div><div class="product-card-body">' +
        '<div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div>' +
        '<div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-btn"></div></div></div>';
    }
    return out;
  }

  /**
   * Empty-state block. `icon` is an icon name; `actionHtml` is TRUSTED html (build it yourself with escapeHtml).
   */
  function emptyState(o) {
    o = o || {};
    return '<div class="empty-state">' +
      '<div class="empty-state-icon">' + icon(o.icon || 'box') + '</div>' +
      '<h3 class="empty-state-title">' + escapeHtml(o.title || '') + '</h3>' +
      (o.text ? '<p class="empty-state-text">' + escapeHtml(o.text) + '</p>' : '') +
      (o.actionHtml ? '<div class="empty-state-action">' + o.actionHtml + '</div>' : '') +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Forms                                                               */
  /* ------------------------------------------------------------------ */
  /** Disables the button and shows a spinner; restores original content when `loading` is false. */
  function setLoading(button, loading, loadingText) {
    if (!button) return;
    if (loading) {
      if (button.dataset.origHtml === undefined) button.dataset.origHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + (loadingText ? '<span>' + escapeHtml(loadingText) + '</span>' : '');
    } else {
      if (button.dataset.origHtml !== undefined) {
        button.innerHTML = button.dataset.origHtml;
        delete button.dataset.origHtml;
      }
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    }
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }

  function errorSlot(field) {
    var group = field.closest('.form-group') || field.parentNode;
    var slot = null;
    var n = field.nextElementSibling;
    while (n) { if (n.classList && n.classList.contains('field-error')) { slot = n; break; } n = n.nextElementSibling; }
    if (!slot && group) slot = group.querySelector('.field-error');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'field-error';
      field.insertAdjacentElement('afterend', slot);
    }
    return slot;
  }

  function clearFieldErrors(form) {
    if (!form) return;
    Array.prototype.forEach.call(form.querySelectorAll('.is-invalid'), function (f) {
      f.classList.remove('is-invalid');
      f.removeAttribute('aria-invalid');
    });
    Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (e) { e.textContent = ''; });
  }

  /** errors: [{field, message}]. Returns the number of errors mapped onto fields. */
  function showFieldErrors(form, errors) {
    if (!form || !Array.isArray(errors)) return 0;
    clearFieldErrors(form);
    var mapped = 0, firstField = null;
    errors.forEach(function (er) {
      if (!er || !er.field) return;
      var f = form.querySelector('[name="' + cssEscape(er.field) + '"]');
      if (!f) return;
      f.classList.add('is-invalid');
      f.setAttribute('aria-invalid', 'true');
      var slot = errorSlot(f);
      slot.textContent = er.message || '';
      if (!firstField) firstField = f;
      mapped++;
    });
    if (firstField && typeof firstField.focus === 'function') firstField.focus();
    return mapped;
  }

  /** Toasts err.message and maps validation errors onto `form` (if given). */
  function handleError(err, form) {
    var message = (err && err.message) || 'حدث خطأ غير متوقع';
    var errors = err && err.errors;
    var mapped = 0;
    if (form && Array.isArray(errors) && errors.length) mapped = showFieldErrors(form, errors);
    if (mapped === 0 && Array.isArray(errors) && errors.length && errors[0].message) {
      message = errors[0].message;
    }
    toast(message, 'error');
    if (err && !(err.status >= 0) && window.console) console.error(err);
  }

  /* ------------------------------------------------------------------ */
  /* Pagination                                                          */
  /* ------------------------------------------------------------------ */
  /**
   * Renders prev/next + page numbers into `container`. meta = {page,totalPages}. Hides itself when totalPages <= 1.
   * onPage(pageNumber) is called when the user picks a page.
   */
  function renderPagination(container, meta, onPage) {
    if (!container) return;
    var page = Number(meta && meta.page) || 1;
    var total = Number(meta && meta.totalPages) || 1;
    if (container._pgHandler) container.removeEventListener('click', container._pgHandler);
    if (total <= 1) { container.innerHTML = ''; container.hidden = true; return; }
    container.hidden = false;

    var pages = [];
    var add = function (p) { if (p >= 1 && p <= total && pages.indexOf(p) === -1) pages.push(p); };
    add(1); add(2);
    for (var i = page - 1; i <= page + 1; i++) add(i);
    add(total - 1); add(total);
    pages.sort(function (a, b) { return a - b; });

    var html = '<nav class="pagination" aria-label="التنقل بين الصفحات">';
    html += '<button type="button" class="page-btn page-prev" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="السابق">' + icon('chevron-left').replace('icon-chevron-left', 'icon-chevron-left flip-rtl') + '<span class="page-btn-text">السابق</span></button>';
    var prev = 0;
    pages.forEach(function (p) {
      if (prev && p - prev > 1) html += '<span class="page-ellipsis" aria-hidden="true">…</span>';
      html += '<button type="button" class="page-btn' + (p === page ? ' is-active' : '') + '" data-page="' + p + '"' + (p === page ? ' aria-current="page"' : '') + ' aria-label="صفحة ' + p + '">' + escapeHtml(formatNumber(p)) + '</button>';
      prev = p;
    });
    html += '<button type="button" class="page-btn page-next" data-page="' + (page + 1) + '"' + (page >= total ? ' disabled' : '') + ' aria-label="التالي"><span class="page-btn-text">التالي</span>' + icon('chevron-left') + '</button>';
    html += '</nav>';
    container.innerHTML = html;

    container._pgHandler = function (e) {
      var btn = e.target.closest && e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      var p = Number(btn.dataset.page);
      if (p >= 1 && p <= total && p !== page && typeof onPage === 'function') onPage(p);
    };
    container.addEventListener('click', container._pgHandler);
  }

  window.UI = {
    toast: toast,
    confirm: confirmDialog,
    openModal: openModal,
    closeModal: closeModal,
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    formatNumber: formatNumber,
    formatPrice: formatPrice,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    statusLabel: statusLabel,
    statusClass: statusClass,
    paymentStatusLabel: paymentStatusLabel,
    paymentStatusClass: paymentStatusClass,
    paymentMethodLabel: paymentMethodLabel,
    stars: stars,
    icon: icon,
    productCardHTML: productCardHTML,
    skeletonCards: skeletonCards,
    emptyState: emptyState,
    debounce: debounce,
    getParam: getParam,
    setLoading: setLoading,
    showFieldErrors: showFieldErrors,
    clearFieldErrors: clearFieldErrors,
    renderPagination: renderPagination,
    handleError: handleError,
    GOVERNORATES: GOVERNORATES
  };
})();
