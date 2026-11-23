(function () {
  'use strict';

  var MAX_QTY = 20;
  var COUPON_KEY = 'appliedCoupon';
  var root = document.getElementById('cart-root');
  var cart = null;          // last { items, summary }
  var couponError = '';     // inline message shown under the coupon input
  var couponDraft = '';     // text typed in the coupon input
  var qtyTimers = {};
  var seq = 0;

  function getSavedCoupon() {
    try { return sessionStorage.getItem(COUPON_KEY) || ''; } catch (e) { return ''; }
  }
  function saveCoupon(code) {
    try {
      if (code) sessionStorage.setItem(COUPON_KEY, code); else sessionStorage.removeItem(COUPON_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  function notifyCart(summary) {
    window.dispatchEvent(new CustomEvent('cart:changed', { detail: { itemCount: summary ? summary.itemCount : 0 } }));
  }

  function maxFor(item) {
    var stock = Number(item.stock);
    return Math.max(1, Math.min(MAX_QTY, isFinite(stock) && stock > 0 ? stock : MAX_QTY));
  }

  /* ---------------- rendering ---------------- */
  function skeleton() {
    var rows = '';
    for (var i = 0; i < 3; i++) {
      rows += '<div class="cart-item"><div class="skeleton skeleton-img cart-skel-img"></div>' +
        '<div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>' +
        '<div class="skeleton skeleton-btn"></div></div>';
    }
    return '<div class="checkout-layout"><div class="card">' + rows + '</div>' +
      '<div class="card card-body"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div>' +
      '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-btn"></div></div></div>';
  }

  function itemHTML(it) {
    var img = UI.escapeHtml(UI.safeUrl(it.image) || '');
    var href = 'product-details.html?id=' + encodeURIComponent(it.productId || '');
    var name = UI.escapeHtml(it.name);
    var meta = [];
    if (it.size) meta.push('المقاس: ' + UI.escapeHtml(it.size));
    if (it.color) meta.push('اللون: ' + UI.escapeHtml(it.color));
    var hasOld = Number(it.originalPrice) > Number(it.unitPrice);
    var max = maxFor(it);
    var id = UI.escapeHtml(it.id);
    var unavailable = it.available === false;
    return '<article class="cart-item' + (unavailable ? ' is-unavailable' : '') + '" data-item-id="' + id + '">' +
      '<a href="' + UI.escapeHtml(href) + '" class="cart-item-media">' +
        (img ? '<img class="cart-item-img" src="' + img + '" alt="' + name + '" loading="lazy">' : '<span class="cart-item-img"></span>') + '</a>' +
      '<div class="cart-item-body">' +
        '<h2 class="cart-item-name"><a href="' + UI.escapeHtml(href) + '">' + name + '</a></h2>' +
        (meta.length ? '<p class="cart-item-meta">' + meta.join(' · ') + '</p>' : '') +
        '<p class="cart-item-price"><span class="price-current">' + UI.formatPrice(it.unitPrice) + '</span>' +
          (hasOld ? ' <del class="price-old">' + UI.formatPrice(it.originalPrice) + '</del>' : '') + '</p>' +
        (unavailable ? '<p class="cart-item-warn text-danger text-sm fw-bold">هذا المنتج غير متاح حالياً أو نفدت الكمية. يرجى إزالته للمتابعة.</p>'
          : (Number(it.stock) > 0 && Number(it.stock) <= 5 ? '<p class="cart-item-warn text-warning text-sm">متبقي ' + UI.formatNumber(it.stock) + ' فقط</p>' : '')) +
      '</div>' +
      '<div class="cart-item-actions">' +
        '<div class="quantity-control" role="group" aria-label="الكمية">' +
          '<button type="button" data-action="qty-dec" aria-label="إنقاص الكمية"' + (unavailable ? ' disabled' : '') + '>' + UI.icon('minus') + '</button>' +
          '<input type="number" inputmode="numeric" min="1" max="' + max + '" value="' + UI.escapeHtml(it.quantity) + '" data-role="qty" aria-label="الكمية"' + (unavailable ? ' disabled' : '') + '>' +
          '<button type="button" data-action="qty-inc" aria-label="زيادة الكمية"' + (unavailable ? ' disabled' : '') + '>' + UI.icon('plus') + '</button>' +
        '</div>' +
        '<strong class="cart-item-total" data-role="line-total">' + UI.formatPrice(it.lineTotal) + '</strong>' +
        '<button type="button" class="btn btn-ghost btn-sm text-danger" data-action="remove" aria-label="حذف ' + name + ' من السلة">' + UI.icon('trash') + ' <span>حذف</span></button>' +
      '</div></article>';
  }

  function summaryHTML() {
    var s = cart.summary;
    var items = cart.items;
    var hasUnavailable = items.some(function (i) { return i.available === false; });
    var applied = s.coupon && s.coupon.code;
    var threshold = Number(s.freeShippingThreshold) || 0;
    var afterDiscount = Number(s.subtotal) - Number(s.discount || 0);
    var shippingFree = Number(s.shipping) === 0;
    var progress = '';
    if (threshold > 0) {
      var pct = Math.max(0, Math.min(100, (afterDiscount / threshold) * 100));
      progress = '<div class="free-ship">' +
        '<p class="free-ship-text">' + (shippingFree
          ? UI.icon('truck') + ' <span>مبروك! حصلت على شحن مجاني</span>'
          : UI.icon('truck') + ' <span>أضف منتجات بقيمة <strong>' + UI.formatPrice(Math.max(0, threshold - afterDiscount)) + '</strong> للحصول على شحن مجاني</span>') + '</p>' +
        '<div class="free-ship-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="التقدم نحو الشحن المجاني">' +
        '<span class="free-ship-fill" data-pct="' + pct.toFixed(1) + '"></span></div></div>';
    }
    var couponBox;
    if (applied) {
      couponBox = '<div class="coupon-applied"><span class="badge badge-success">' + UI.icon('tag') + ' <span class="ltr">' + UI.escapeHtml(s.coupon.code) + '</span></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="remove-coupon">إزالة الكوبون</button></div>';
    } else {
      couponBox = '<form class="coupon-form" id="coupon-form" novalidate><label class="form-label" for="coupon-input">لديك كوبون خصم؟</label>' +
        '<div class="input-group"><input class="form-control ltr" id="coupon-input" name="coupon" type="text" autocomplete="off" maxlength="40" placeholder="أدخل الكود" value="' + UI.escapeHtml(couponDraft) + '"' + (couponError ? ' aria-describedby="coupon-error"' : '') + '>' +
        '<button type="submit" class="btn btn-outline" id="coupon-btn">تطبيق</button></div>' +
        '<div class="field-error coupon-error" id="coupon-error" role="alert">' + UI.escapeHtml(couponError) + '</div></form>';
    }
    return '<h2 class="summary-title">ملخص الطلب</h2>' + couponBox +
      '<div class="summary-rows">' +
      '<div class="summary-row"><span>المجموع الفرعي (' + UI.formatNumber(s.itemCount) + ' قطعة)</span><span>' + UI.formatPrice(s.subtotal) + '</span></div>' +
      (Number(s.discount) > 0 ? '<div class="summary-row"><span>الخصم</span><span class="discount">- ' + UI.formatPrice(s.discount) + '</span></div>' : '') +
      '<div class="summary-row"><span>الشحن</span><span>' + (shippingFree ? '<span class="text-success fw-bold">مجاني</span>' : UI.formatPrice(s.shipping)) + '</span></div>' +
      '<div class="summary-row total"><span>الإجمالي</span><span>' + UI.formatPrice(s.total) + '</span></div></div>' +
      progress +
      (hasUnavailable ? '<div class="alert alert-warning">يوجد منتجات غير متاحة في سلتك. أزلها لإتمام الطلب.</div>' : '') +
      (hasUnavailable
        ? '<button type="button" class="btn btn-primary btn-lg btn-block" disabled>إتمام الطلب</button>'
        : '<a class="btn btn-primary btn-lg btn-block" href="checkout.html">إتمام الطلب</a>') +
      '<a class="btn btn-ghost btn-block mt-2" href="products.html">متابعة التسوق</a>';
  }

  function applyProgress() {
    var fill = root.querySelector('.free-ship-fill');
    if (fill) fill.style.setProperty('--w', fill.getAttribute('data-pct') + '%');
  }

  function renderSummary() {
    var box = document.getElementById('cart-summary');
    if (!box) return;
    box.innerHTML = summaryHTML();
    applyProgress();
  }

  function renderAll() {
    if (!cart || !cart.items.length) {
      root.innerHTML = UI.emptyState({
        icon: 'cart', title: 'سلتك فارغة', text: 'لم تضف أي منتجات بعد. تصفح منتجاتنا وابدأ التسوق.',
        actionHtml: '<a class="btn btn-primary" href="products.html">تسوق الآن</a>'
      });
      return;
    }
    root.innerHTML = '<div class="checkout-layout">' +
      '<section class="card cart-card" aria-label="منتجات السلة">' +
        '<div class="cart-card-head"><h2 class="cart-card-title">المنتجات (' + UI.formatNumber(cart.summary.itemCount) + ')</h2>' +
        '<button type="button" class="btn btn-ghost btn-sm text-danger" data-action="clear">' + UI.icon('trash') + ' <span>إفراغ السلة</span></button></div>' +
        '<div id="cart-items">' + cart.items.map(itemHTML).join('') + '</div></section>' +
      '<aside class="card card-body cart-summary sticky-top" id="cart-summary" aria-label="ملخص الطلب"></aside></div>';
    renderSummary();
  }

  /* update only the changed bits so focus is kept while editing quantities */
  function sameStructure(prev, next) {
    if (!prev || prev.items.length !== next.items.length) return false;
    for (var i = 0; i < prev.items.length; i++) {
      if (prev.items[i].id !== next.items[i].id || (prev.items[i].available === false) !== (next.items[i].available === false)) return false;
    }
    return true;
  }

  function applyCart(data) {
    var prev = cart;
    cart = data;
    var s = data.summary || {};
    var code = s.coupon && s.coupon.code;
    if (code) { saveCoupon(code); couponError = ''; couponDraft = ''; }
    notifyCart(s);
    if (sameStructure(prev, data) && data.items.length) {
      data.items.forEach(function (it) {
        var row = root.querySelector('[data-item-id="' + (window.CSS && CSS.escape ? CSS.escape(it.id) : it.id) + '"]');
        if (!row) return;
        var tot = row.querySelector('[data-role="line-total"]');
        if (tot) tot.textContent = UI.formatPrice(it.lineTotal);
        var inp = row.querySelector('[data-role="qty"]');
        if (inp) {
          inp.max = String(maxFor(it));
          if (document.activeElement !== inp && !qtyTimers[it.id]) inp.value = it.quantity;
        }
      });
      var head = root.querySelector('.cart-card-title');
      if (head) head.textContent = 'المنتجات (' + UI.formatNumber(s.itemCount) + ')';
      renderSummary();
    } else {
      renderAll();
    }
  }

  /* ---------------- data ---------------- */
  async function fetchCart(code) {
    return Api.get('/cart', { params: { coupon: code || undefined } });
  }

  async function load(initial) {
    var mine = ++seq;
    if (initial) root.innerHTML = skeleton();
    try {
      var res = await fetchCart(getSavedCoupon());
      if (mine !== seq) return;
      var s = res.data.summary || {};
      if (!(s.coupon && s.coupon.code) && getSavedCoupon()) {
        // saved coupon was rejected by the server
        if (s.couponError) couponError = s.couponError;
        saveCoupon('');
      }
      applyCart(res.data);
    } catch (err) {
      if (mine !== seq) return;
      root.innerHTML = '<div class="alert alert-danger">' + UI.escapeHtml(err.message || 'تعذر تحميل السلة') + '</div>' +
        '<button type="button" class="btn btn-primary" data-action="retry">إعادة المحاولة</button>';
    }
  }

  // After a mutation: re-fetch with the coupon so the discount stays accurate.
  async function afterMutation(res) {
    var code = getSavedCoupon();
    if (code) {
      try {
        var withCoupon = await fetchCart(code);
        var s = withCoupon.data.summary || {};
        if (!(s.coupon && s.coupon.code)) { saveCoupon(''); if (s.couponError) couponError = s.couponError; }
        return withCoupon.data;
      } catch (e) { /* fall back to mutation response */ }
    }
    return res.data;
  }

  async function updateQty(id, qty) {
    var mine = ++seq;
    try {
      var res = await Api.patch('/cart/items/' + encodeURIComponent(id), { quantity: qty });
      var data = await afterMutation(res);
      if (mine === seq) applyCart(data);
    } catch (err) {
      UI.handleError(err);
      if (mine === seq) load(false);
    }
  }

  function scheduleQty(row, id, input, qty) {
    var item = cart.items.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    qty = Math.max(1, Math.min(maxFor(item), Math.floor(Number(qty)) || 1));
    input.value = qty;
    clearTimeout(qtyTimers[id]);
    qtyTimers[id] = setTimeout(function () {
      delete qtyTimers[id];
      if (qty !== item.quantity) updateQty(id, qty); else if (document.activeElement !== input) input.value = item.quantity;
    }, 500);
  }

  async function removeItem(id, btn) {
    var ok = await UI.confirm({ title: 'حذف المنتج', message: 'هل تريد حذف هذا المنتج من السلة؟', confirmText: 'حذف', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    UI.setLoading(btn, true);
    var mine = ++seq;
    try {
      var res = await Api.del('/cart/items/' + encodeURIComponent(id));
      var data = await afterMutation(res);
      if (mine === seq) applyCart(data);
      UI.toast('تم حذف المنتج من السلة', 'success');
    } catch (err) {
      UI.setLoading(btn, false);
      UI.handleError(err);
    }
  }

  async function clearCart(btn) {
    var ok = await UI.confirm({ title: 'إفراغ السلة', message: 'سيتم حذف كل المنتجات من السلة. هل أنت متأكد؟', confirmText: 'إفراغ السلة', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    UI.setLoading(btn, true);
    try {
      var res = await Api.del('/cart');
      saveCoupon('');
      couponError = '';
      seq++;
      applyCart(res.data);
      UI.toast('تم إفراغ السلة', 'success');
    } catch (err) {
      UI.setLoading(btn, false);
      UI.handleError(err);
    }
  }

  async function applyCoupon(form) {
    var input = form.elements.coupon;
    var code = input.value.trim().toUpperCase();
    couponDraft = code;
    if (!code) { couponError = 'أدخل كود الكوبون'; renderSummary(); return; }
    var btn = form.querySelector('#coupon-btn');
    UI.setLoading(btn, true);
    var mine = ++seq;
    try {
      var res = await fetchCart(code);
      if (mine !== seq) return;
      var s = res.data.summary || {};
      if (s.coupon && s.coupon.code) {
        UI.toast('تم تطبيق الكوبون', 'success');
      } else {
        couponError = s.couponError || 'الكوبون غير صالح';
        saveCoupon('');
      }
      applyCart(res.data);
    } catch (err) {
      UI.setLoading(btn, false);
      couponError = err.message || 'تعذر تطبيق الكوبون';
      renderSummary();
    }
  }

  async function removeCoupon() {
    saveCoupon('');
    couponError = '';
    couponDraft = '';
    var mine = ++seq;
    try {
      var res = await fetchCart('');
      if (mine === seq) applyCart(res.data);
    } catch (err) { UI.handleError(err); }
  }

  /* ---------------- events ---------------- */
  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn || !root.contains(btn)) return;
    var action = btn.getAttribute('data-action');
    var row = btn.closest('[data-item-id]');
    var id = row ? row.getAttribute('data-item-id') : null;
    if (action === 'qty-inc' || action === 'qty-dec') {
      var input = row.querySelector('[data-role="qty"]');
      scheduleQty(row, id, input, Number(input.value) + (action === 'qty-inc' ? 1 : -1));
    } else if (action === 'remove') removeItem(id, btn);
    else if (action === 'clear') clearCart(btn);
    else if (action === 'remove-coupon') removeCoupon();
    else if (action === 'retry') load(true);
  });

  root.addEventListener('change', function (e) {
    if (e.target.matches('[data-role="qty"]')) {
      var row = e.target.closest('[data-item-id]');
      scheduleQty(row, row.getAttribute('data-item-id'), e.target, e.target.value);
    }
  });

  root.addEventListener('submit', function (e) {
    if (e.target.id === 'coupon-form') {
      e.preventDefault();
      applyCoupon(e.target);
    }
  });

  (async function init() {
    await window.appReady;
    if (!Auth.requireLogin()) return;
    load(true);
  })();
})();
