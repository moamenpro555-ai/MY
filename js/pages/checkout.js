(function () {
  'use strict';

  var COUPON_KEY = 'appliedCoupon';
  var root = document.getElementById('checkout-root');
  var cart = null;
  var addresses = [];
  var methods = [];
  var selectedAddressId = '';
  var selectedMethod = '';
  var submitting = false;

  function getSavedCoupon() {
    try { return sessionStorage.getItem(COUPON_KEY) || ''; } catch (e) { return ''; }
  }
  function saveCoupon(code) {
    try {
      if (code) sessionStorage.setItem(COUPON_KEY, code); else sessionStorage.removeItem(COUPON_KEY);
    } catch (e) { /* storage unavailable */ }
  }
  function notify(count) {
    window.dispatchEvent(new CustomEvent('cart:changed', { detail: { itemCount: count } }));
  }
  function $(id) { return document.getElementById(id); }

  /* ---------------- data ---------------- */
  async function fetchCart() {
    var res = await Api.get('/cart', { params: { coupon: getSavedCoupon() || undefined } });
    cart = res.data;
    var s = cart.summary || {};
    if (!(s.coupon && s.coupon.code) && getSavedCoupon()) saveCoupon('');
    notify(s.itemCount || 0);
    return cart;
  }

  function hasUnavailable() {
    return cart.items.some(function (i) { return i.available === false; });
  }

  /* ---------------- rendering ---------------- */
  function skeleton() {
    return '<div class="checkout-layout"><div class="co-main">' +
      '<div class="card card-body"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short"></div></div>' +
      '<div class="card card-body"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div></div></div>' +
      '<div class="card card-body"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-btn"></div></div></div>';
  }

  function addressCardHTML(a) {
    var id = UI.escapeHtml(a.id);
    return '<label class="radio-card" for="addr-' + id + '">' +
      '<input type="radio" name="addressId" id="addr-' + id + '" value="' + id + '"' + (a.id === selectedAddressId ? ' checked' : '') + '>' +
      '<span class="co-card-content"><span class="co-card-title">' + UI.escapeHtml(a.fullName) +
      (a.label ? ' <span class="badge badge-primary">' + UI.escapeHtml(a.label) + '</span>' : '') +
      (a.isDefault ? ' <span class="badge badge-success">افتراضي</span>' : '') + '</span>' +
      '<span class="co-card-line">' + UI.escapeHtml(a.governorate) + ' - ' + UI.escapeHtml(a.city) + '</span>' +
      '<span class="co-card-line text-muted">' + UI.escapeHtml(a.addressLine) + '</span>' +
      '<span class="co-card-line ltr">' + UI.escapeHtml(a.phone) + '</span></span></label>';
  }

  function addressFormHTML(open) {
    var u = Auth.user || {};
    var govs = UI.GOVERNORATES.map(function (g) {
      return '<option value="' + UI.escapeHtml(g) + '">' + UI.escapeHtml(g) + '</option>';
    }).join('');
    return '<form id="address-form" class="address-form" novalidate' + (open ? '' : ' hidden') + ' aria-label="إضافة عنوان جديد">' +
      '<h3 class="address-form-title">عنوان جديد</h3>' +
      '<div class="form-row"><div class="form-group"><label class="form-label" for="af-fullName">الاسم الكامل <span class="required-mark">*</span></label>' +
        '<input class="form-control" id="af-fullName" name="fullName" type="text" autocomplete="name" required value="' + UI.escapeHtml(u.fullName || '') + '"><div class="field-error"></div></div>' +
      '<div class="form-group"><label class="form-label" for="af-phone">رقم الهاتف <span class="required-mark">*</span></label>' +
        '<input class="form-control ltr" id="af-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required value="' + UI.escapeHtml(u.phone || '') + '"><div class="field-error"></div></div></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label" for="af-governorate">المحافظة <span class="required-mark">*</span></label>' +
        '<select class="form-select" id="af-governorate" name="governorate" autocomplete="address-level1" required><option value="">اختر المحافظة</option>' + govs + '</select><div class="field-error"></div></div>' +
      '<div class="form-group"><label class="form-label" for="af-city">المدينة / المنطقة <span class="required-mark">*</span></label>' +
        '<input class="form-control" id="af-city" name="city" type="text" autocomplete="address-level2" required><div class="field-error"></div></div></div>' +
      '<div class="form-group"><label class="form-label" for="af-addressLine">العنوان بالتفصيل <span class="required-mark">*</span></label>' +
        '<input class="form-control" id="af-addressLine" name="addressLine" type="text" autocomplete="street-address" required placeholder="الشارع، رقم المبنى، الشقة"><div class="field-error"></div></div>' +
      '<label class="form-check"><input type="checkbox" name="isDefault"><span class="form-check-label">اجعله عنواني الافتراضي</span></label>' +
      '<div class="form-actions mt-3"><button type="submit" class="btn btn-primary" id="address-save">حفظ العنوان</button>' +
      (addresses.length ? '<button type="button" class="btn btn-outline" data-action="cancel-address">إلغاء</button>' : '') + '</div></form>';
  }

  function methodHTML(m) {
    var id = 'pm-' + UI.escapeHtml(m.method);
    var label = m.label || UI.paymentMethodLabel(m.method);
    return '<label class="radio-card' + (m.enabled ? '' : ' is-disabled') + '" for="' + id + '">' +
      '<input type="radio" name="paymentMethod" id="' + id + '" value="' + UI.escapeHtml(m.method) + '"' +
      (m.enabled ? '' : ' disabled') + (m.method === selectedMethod ? ' checked' : '') + '>' +
      '<span class="co-card-content"><span class="co-card-title">' + UI.escapeHtml(label) + '</span>' +
      (m.enabled ? '' : '<span class="co-card-line text-muted text-sm">غير متاحة حالياً</span>') + '</span></label>';
  }

  function summaryHTML() {
    var s = cart.summary;
    var shippingFree = Number(s.shipping) === 0;
    var rows = cart.items.map(function (it) {
      var img = UI.safeUrl(it.image);
      var meta = [it.size, it.color].filter(Boolean).map(UI.escapeHtml).join(' · ');
      return '<li class="co-line' + (it.available === false ? ' is-unavailable' : '') + '">' +
        (img ? '<img class="co-line-img" src="' + UI.escapeHtml(img) + '" alt="" loading="lazy">' : '<span class="co-line-img"></span>') +
        '<span class="co-line-info"><span class="co-line-name">' + UI.escapeHtml(it.name) + '</span>' +
        (meta ? '<span class="text-muted text-xs">' + meta + '</span>' : '') +
        '<span class="text-muted text-xs">الكمية: ' + UI.formatNumber(it.quantity) + '</span></span>' +
        '<span class="co-line-total">' + UI.formatPrice(it.lineTotal) + '</span></li>';
    }).join('');
    return '<h2 class="summary-title">ملخص الطلب</h2><ul class="co-lines">' + rows + '</ul>' +
      '<div class="summary-rows">' +
      '<div class="summary-row"><span>المجموع الفرعي</span><span>' + UI.formatPrice(s.subtotal) + '</span></div>' +
      (Number(s.discount) > 0 ? '<div class="summary-row"><span>الخصم' + (s.coupon ? ' (<span class="ltr">' + UI.escapeHtml(s.coupon.code) + '</span>)' : '') + '</span><span class="discount">- ' + UI.formatPrice(s.discount) + '</span></div>' : '') +
      '<div class="summary-row"><span>الشحن</span><span>' + (shippingFree ? '<span class="text-success fw-bold">مجاني</span>' : UI.formatPrice(s.shipping)) + '</span></div>' +
      '<div class="summary-row total"><span>الإجمالي</span><span>' + UI.formatPrice(s.total) + '</span></div></div>' +
      '<p class="text-muted text-sm">الدفع عند الاستلام متاح حالياً. بتأكيد الطلب فأنت توافق على سياسة المتجر.</p>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" id="place-order" data-action="place-order">تأكيد الطلب</button>' +
      '<a class="btn btn-ghost btn-block mt-2" href="cart.html">تعديل السلة</a>';
  }

  function alertHTML() {
    if (hasUnavailable()) {
      return '<div class="alert alert-danger" role="alert"><span>يوجد منتجات غير متاحة في سلتك. <a class="fw-bold" href="cart.html">عدّل السلة</a> ثم أكمل الطلب.</span></div>';
    }
    return '';
  }

  function refreshSummary() {
    var box = $('co-summary');
    if (box) box.innerHTML = summaryHTML();
    var al = $('co-alert');
    if (al) al.innerHTML = alertHTML();
    updateSubmitState();
  }

  function updateSubmitState() {
    var btn = $('place-order');
    if (!btn || submitting) return;
    btn.disabled = hasUnavailable() || !selectedAddressId || !selectedMethod;
  }

  function renderPage() {
    var u = Auth.user || {};
    var addrList = addresses.map(addressCardHTML).join('');
    root.innerHTML = '<div class="checkout-layout"><div class="co-main">' +
      '<div id="co-alert" role="alert">' + alertHTML() + '</div>' +
      '<section class="card card-body co-section" aria-labelledby="h-customer"><h2 class="co-title" id="h-customer">' + UI.icon('user') + ' بيانات العميل</h2>' +
        '<dl class="kv-list"><dt>الاسم</dt><dd>' + UI.escapeHtml(u.fullName || '-') + '</dd>' +
        '<dt>البريد الإلكتروني</dt><dd class="ltr">' + UI.escapeHtml(u.email || '-') + '</dd>' +
        (u.phone ? '<dt>الهاتف</dt><dd class="ltr">' + UI.escapeHtml(u.phone) + '</dd>' : '') + '</dl></section>' +
      '<section class="card card-body co-section" aria-labelledby="h-address"><div class="co-title-row"><h2 class="co-title" id="h-address">' + UI.icon('map-pin') + ' عنوان التوصيل</h2>' +
        (addresses.length ? '<button type="button" class="btn btn-outline btn-sm" id="show-address-form" data-action="show-address">' + UI.icon('plus') + ' إضافة عنوان جديد</button>' : '') + '</div>' +
        '<div class="co-options" id="address-list" role="radiogroup" aria-labelledby="h-address">' + addrList + '</div>' +
        '<div id="address-error" class="alert alert-danger" role="alert" hidden></div>' +
        addressFormHTML(!addresses.length) + '</section>' +
      '<section class="card card-body co-section" aria-labelledby="h-pay"><h2 class="co-title" id="h-pay">' + UI.icon('shield') + ' طريقة الدفع</h2>' +
        (methods.length ? '<div class="co-options" role="radiogroup" aria-labelledby="h-pay">' + methods.map(methodHTML).join('') + '</div>'
          : '<div class="alert alert-warning">تعذر تحميل طرق الدفع. حدّث الصفحة وحاول مجدداً.</div>') + '</section>' +
      '<section class="card card-body co-section" aria-labelledby="h-notes"><h2 class="co-title" id="h-notes">ملاحظات على الطلب <span class="text-muted text-sm">(اختياري)</span></h2>' +
        '<div class="form-group mb-0"><label class="sr-only" for="notes">ملاحظات</label><textarea class="form-control" id="notes" name="notes" rows="3" maxlength="500" placeholder="مثال: الاتصال قبل التوصيل"></textarea>' +
        '<div class="form-hint"><span id="notes-count">0</span> / 500</div></div></section>' +
      '</div><aside class="card card-body cart-summary sticky-top" id="co-summary" aria-label="ملخص الطلب">' + summaryHTML() + '</aside></div>';
    updateSubmitState();
  }

  /* ---------------- actions ---------------- */
  function showAddressError(msg) {
    var box = $('address-error');
    if (!box) return;
    box.textContent = msg || '';
    box.hidden = !msg;
  }

  async function saveAddress(form) {
    UI.clearFieldErrors(form);
    var btn = $('address-save');
    var body = {
      fullName: form.elements.fullName.value.trim(),
      phone: form.elements.phone.value.trim(),
      governorate: form.elements.governorate.value,
      city: form.elements.city.value.trim(),
      addressLine: form.elements.addressLine.value.trim(),
      isDefault: form.elements.isDefault.checked
    };
    var errors = [];
    if (!body.fullName) errors.push({ field: 'fullName', message: 'الاسم مطلوب' });
    if (!body.phone) errors.push({ field: 'phone', message: 'رقم الهاتف مطلوب' });
    if (!body.governorate) errors.push({ field: 'governorate', message: 'اختر المحافظة' });
    if (!body.city) errors.push({ field: 'city', message: 'المدينة مطلوبة' });
    if (!body.addressLine) errors.push({ field: 'addressLine', message: 'العنوان مطلوب' });
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    UI.setLoading(btn, true, 'جارٍ الحفظ...');
    try {
      var res = await Api.post('/users/me/addresses', body);
      var created = res.data;
      if (created.isDefault) addresses.forEach(function (a) { a.isDefault = false; });
      addresses.push(created);
      selectedAddressId = created.id;
      renderAddressesOnly();
      UI.toast('تمت إضافة العنوان', 'success');
    } catch (err) {
      UI.handleError(err, form);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  function renderAddressesOnly() {
    var notes = $('notes') ? $('notes').value : '';
    var sec = $('address-list').closest('section');
    var wasOpen = false;
    sec.innerHTML = '<div class="co-title-row"><h2 class="co-title" id="h-address">' + UI.icon('map-pin') + ' عنوان التوصيل</h2>' +
      '<button type="button" class="btn btn-outline btn-sm" id="show-address-form" data-action="show-address">' + UI.icon('plus') + ' إضافة عنوان جديد</button></div>' +
      '<div class="co-options" id="address-list" role="radiogroup" aria-labelledby="h-address">' + addresses.map(addressCardHTML).join('') + '</div>' +
      '<div id="address-error" class="alert alert-danger" role="alert" hidden></div>' + addressFormHTML(wasOpen);
    if ($('notes')) $('notes').value = notes;
    updateSubmitState();
  }

  async function placeOrder(btn) {
    if (submitting) return;
    if (!selectedAddressId) { showAddressError('اختر عنوان التوصيل أولاً'); return; }
    if (!selectedMethod) { UI.toast('اختر طريقة الدفع', 'error'); return; }
    submitting = true;
    UI.setLoading(btn, true, 'جارٍ تأكيد الطلب...');
    showAddressError('');
    var body = { addressId: selectedAddressId, paymentMethod: selectedMethod };
    var code = cart.summary.coupon && cart.summary.coupon.code;
    if (code) body.couponCode = code;
    var notes = $('notes').value.trim();
    if (notes) body.notes = notes.slice(0, 500);
    try {
      var res = await Api.post('/orders', body);
      saveCoupon('');
      notify(0);
      location.href = 'order-details.html?id=' + encodeURIComponent(res.data.id) + '&placed=1';
    } catch (err) {
      submitting = false;
      UI.setLoading(btn, false);
      UI.handleError(err);
      try {
        await fetchCart();
        if (!cart.items.length) { location.replace('cart.html'); return; }
        refreshSummary();
      } catch (e) { /* keep page as is */ }
    }
  }

  /* ---------------- events ---------------- */
  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'place-order') placeOrder(btn);
    else if (action === 'show-address') {
      var f = $('address-form');
      f.hidden = false;
      btn.hidden = true;
      f.elements.fullName.focus();
    } else if (action === 'cancel-address') {
      $('address-form').hidden = true;
      var sb = $('show-address-form');
      if (sb) sb.hidden = false;
    }
  });

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'addressId') { selectedAddressId = t.value; showAddressError(''); updateSubmitState(); }
    else if (t.name === 'paymentMethod') { selectedMethod = t.value; updateSubmitState(); }
  });

  root.addEventListener('input', function (e) {
    if (e.target.id === 'notes') $('notes-count').textContent = String(e.target.value.length);
  });

  root.addEventListener('submit', function (e) {
    if (e.target.id === 'address-form') {
      e.preventDefault();
      saveAddress(e.target);
    }
  });

  /* ---------------- init ---------------- */
  async function init() {
    await window.appReady;
    if (!Auth.requireLogin()) return;
    root.innerHTML = skeleton();
    try {
      var results = await Promise.all([
        fetchCart(),
        Api.get('/users/me/addresses'),
        Api.get('/payments/methods').catch(function () { return { data: [] }; })
      ]);
      if (!cart.items.length) { location.replace('cart.html'); return; }
      addresses = results[1].data || [];
      methods = results[2].data || [];
      var def = addresses.filter(function (a) { return a.isDefault; })[0] || addresses[0];
      selectedAddressId = def ? def.id : '';
      var cod = methods.filter(function (m) { return m.enabled && m.method === 'CASH_ON_DELIVERY'; })[0] ||
        methods.filter(function (m) { return m.enabled; })[0];
      selectedMethod = cod ? cod.method : '';
      renderPage();
    } catch (err) {
      root.innerHTML = '<div class="alert alert-danger">' + UI.escapeHtml(err.message || 'تعذر تحميل الصفحة') + '</div>' +
        '<a class="btn btn-primary" href="cart.html">العودة إلى السلة</a>';
    }
  }
  init();
})();
