(function () {
  'use strict';

  var TABS = ['info', 'addresses', 'password', 'favorites'];
  var PHONE_RE = /^\+?\d{10,15}$/;
  var $ = function (id) { return document.getElementById(id); };

  var addresses = [];
  var editingId = null;
  var favoritesLoaded = false;
  var modalOpener = null;
  var forcedTab = null; // tab chosen because the profile is incomplete

  /* ---------- helpers ---------- */
  function fillIcons(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll('[data-icon]'), function (el) {
      if (!el.firstChild) el.innerHTML = UI.icon(el.getAttribute('data-icon'));
    });
  }

  function cleanPhone(v) { return String(v || '').replace(/[\s-]/g, ''); }

  function showLoadError(err) {
    $('page-loader').hidden = true;
    var box = $('load-error');
    box.textContent = (err && err.message) || 'تعذر تحميل البيانات';
    box.hidden = false;
  }

  /* ---------- header / avatar ---------- */
  function renderHeader() {
    var u = Auth.user;
    if (!u) return;
    $('profile-name').textContent = u.fullName || '';
    $('profile-email').textContent = u.email || '';
    var av = $('profile-avatar');
    var url = u.avatarUrl ? UI.safeUrl(u.avatarUrl) : '';
    if (url) {
      av.innerHTML = '<img src="' + UI.escapeHtml(url) + '" alt="" referrerpolicy="no-referrer">';
    } else {
      av.textContent = (u.fullName || '؟').trim().charAt(0);
    }
  }

  /* ---------- completion alert ---------- */
  function needsCompletion() {
    return !!Auth.user && !Auth.user.profileCompleted;
  }

  function updateCompletionAlert() {
    var box = $('complete-alert');
    if (!needsCompletion()) { box.hidden = true; return; }
    var noPhone = !Auth.user.phone;
    var noAddr = addresses.length === 0;
    var text = 'أضف رقم هاتفك وعنوان الشحن الخاص بك.';
    if (!noPhone && noAddr) text = 'أضف عنوان شحن واحداً على الأقل من تبويب «عناويني».';
    else if (noPhone && !noAddr) text = 'أضف رقم هاتفك من تبويب «بياناتي».';
    $('complete-text').textContent = text;
    box.hidden = false;
  }

  function completionTab() {
    if (!Auth.user.phone) return 'info';
    return 'addresses';
  }

  /* ---------- tabs ---------- */
  function currentTabFromHash() {
    var h = (window.location.hash || '').replace('#', '');
    return TABS.indexOf(h) !== -1 ? h : null;
  }

  function activateTab(name, opts) {
    if (TABS.indexOf(name) === -1) name = 'info';
    TABS.forEach(function (t) {
      var tab = $('tab-' + t);
      var panel = $('panel-' + t);
      var on = t === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    });
    if (opts && opts.focus) $('tab-' + name).focus();
    if (name === 'favorites' && !favoritesLoaded) loadFavorites();
  }

  function selectTab(name, focus) {
    if (currentTabFromHash() === name) activateTab(name, { focus: focus });
    else {
      window.location.hash = name; // triggers hashchange
      if (focus) $('tab-' + name).focus();
    }
  }

  function onHashChange() {
    activateTab(currentTabFromHash() || forcedTab || 'info');
  }

  function bindTabs() {
    var list = $('profile-tabs');
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (btn) selectTab(btn.getAttribute('data-tab'));
    });
    list.addEventListener('keydown', function (e) {
      var i = TABS.indexOf((e.target.getAttribute && e.target.getAttribute('data-tab')) || '');
      if (i === -1) return;
      var n = null;
      // RTL: ArrowRight goes to previous (visually right) tab
      if (e.key === 'ArrowLeft') n = (i + 1) % TABS.length;
      else if (e.key === 'ArrowRight') n = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = TABS.length - 1;
      if (n === null) return;
      e.preventDefault();
      selectTab(TABS[n], true);
    });
    window.addEventListener('hashchange', onHashChange);
  }

  /* ---------- info ---------- */
  function fillInfoForm() {
    var u = Auth.user || {};
    $('info-fullName').value = u.fullName || '';
    $('info-email').value = u.email || '';
    $('info-phone').value = u.phone || '';
  }

  async function onInfoSubmit(e) {
    e.preventDefault();
    var form = $('info-form');
    var btn = $('info-submit');
    UI.clearFieldErrors(form);
    var name = $('info-fullName').value.trim();
    var phone = cleanPhone($('info-phone').value);
    var errors = [];
    if (name.length < 2) errors.push({ field: 'fullName', message: 'الاسم يجب ألا يقل عن حرفين' });
    if (phone && !PHONE_RE.test(phone)) errors.push({ field: 'phone', message: 'رقم الهاتف غير صحيح (10 إلى 15 رقماً)' });
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    var body = { fullName: name };
    if (phone) body.phone = phone;
    UI.setLoading(btn, true, 'جارٍ الحفظ...');
    try {
      await Api.patch('/users/me', body);
      await Auth.refresh();
      renderHeader();
      fillInfoForm();
      updateCompletionAlert();
      UI.toast('تم حفظ بياناتك بنجاح', 'success');
    } catch (err) {
      UI.handleError(err, form);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* ---------- addresses ---------- */
  function sortAddresses() {
    addresses.sort(function (a, b) { return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0); });
  }

  function renderAddresses() {
    var box = $('addresses-list');
    sortAddresses();
    if (!addresses.length) {
      box.innerHTML = UI.emptyState({
        icon: 'map-pin',
        title: 'لا توجد عناوين محفوظة',
        text: 'أضف عنوان الشحن الخاص بك لتسريع إتمام الطلبات.'
      });
      return;
    }
    box.innerHTML = addresses.map(function (a) {
      var id = UI.escapeHtml(a.id);
      var label = a.label ? UI.escapeHtml(a.label) : 'عنوان';
      var h = '<article class="address-card' + (a.isDefault ? ' is-default' : '') + '" data-id="' + id + '">';
      h += '<div class="address-card-head"><h3 class="address-card-label">' + label + '</h3>';
      if (a.isDefault) h += '<span class="badge badge-success">الافتراضي</span>';
      h += '</div>';
      h += '<p class="fw-bold mb-0">' + UI.escapeHtml(a.fullName) + '</p>';
      h += '<p class="address-card-phone ltr">' + UI.escapeHtml(a.phone) + '</p>';
      h += '<p class="address-card-line">' + UI.escapeHtml([a.governorate, a.city, a.addressLine].filter(Boolean).join('، ')) + '</p>';
      h += '<div class="address-card-actions">';
      h += '<button type="button" class="btn btn-outline btn-sm" data-addr="edit" data-id="' + id + '">تعديل</button>';
      if (!a.isDefault) h += '<button type="button" class="btn btn-outline btn-sm" data-addr="default" data-id="' + id + '">تعيين كافتراضي</button>';
      h += '<button type="button" class="btn btn-ghost btn-sm text-danger" data-addr="delete" data-id="' + id + '">حذف</button>';
      h += '</div></article>';
      return h;
    }).join('');
  }

  function findAddress(id) {
    for (var i = 0; i < addresses.length; i++) if (String(addresses[i].id) === String(id)) return addresses[i];
    return null;
  }

  async function reloadAddresses() {
    var res = await Api.get('/users/me/addresses');
    addresses = Array.isArray(res.data) ? res.data : [];
    renderAddresses();
  }

  async function afterAddressChange() {
    await Auth.refresh();
    updateCompletionAlert();
  }

  function openAddressModal(addr, opener) {
    var form = $('address-form');
    UI.clearFieldErrors(form);
    form.reset();
    editingId = addr ? addr.id : null;
    modalOpener = opener || null;
    $('address-modal-title').textContent = addr ? 'تعديل العنوان' : 'إضافة عنوان';
    var u = Auth.user || {};
    $('addr-label').value = addr ? (addr.label || '') : '';
    $('addr-fullName').value = addr ? addr.fullName : (u.fullName || '');
    $('addr-phone').value = addr ? addr.phone : (u.phone || '');
    $('addr-governorate').value = addr ? addr.governorate : '';
    $('addr-city').value = addr ? addr.city : '';
    $('addr-addressLine').value = addr ? addr.addressLine : '';
    var def = $('addr-isDefault');
    var isFirst = !addr && addresses.length === 0;
    def.checked = addr ? !!addr.isDefault : isFirst;
    def.disabled = (addr && !!addr.isDefault) || isFirst;
    UI.openModal($('address-modal'));
  }

  function validateAddress() {
    var e = [];
    function add(f, m) { e.push({ field: f, message: m }); }
    if ($('addr-fullName').value.trim().length < 2) add('fullName', 'اسم المستلم يجب ألا يقل عن حرفين');
    var phone = cleanPhone($('addr-phone').value);
    if (!phone) add('phone', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(phone)) add('phone', 'رقم الهاتف غير صحيح (10 إلى 15 رقماً)');
    if (!$('addr-governorate').value) add('governorate', 'اختر المحافظة');
    if (!$('addr-city').value.trim()) add('city', 'المدينة مطلوبة');
    if (!$('addr-addressLine').value.trim()) add('addressLine', 'العنوان بالتفصيل مطلوب');
    return e;
  }

  async function onAddressSubmit(e) {
    e.preventDefault();
    var form = $('address-form');
    var btn = $('address-submit');
    UI.clearFieldErrors(form);
    var errors = validateAddress();
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    var body = {
      fullName: $('addr-fullName').value.trim(),
      phone: cleanPhone($('addr-phone').value),
      governorate: $('addr-governorate').value,
      city: $('addr-city').value.trim(),
      addressLine: $('addr-addressLine').value.trim()
    };
    var label = $('addr-label').value.trim();
    if (label || editingId) body.label = label;
    if (!$('addr-isDefault').disabled) body.isDefault = $('addr-isDefault').checked;
    UI.setLoading(btn, true, 'جارٍ الحفظ...');
    try {
      if (editingId) await Api.patch('/users/me/addresses/' + encodeURIComponent(editingId), body);
      else await Api.post('/users/me/addresses', body);
      UI.closeModal($('address-modal'));
      await reloadAddresses();
      await afterAddressChange();
      UI.toast('تم حفظ العنوان', 'success');
    } catch (err) {
      UI.handleError(err, form);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  async function onAddressAction(e) {
    var btn = e.target.closest('[data-addr]');
    if (!btn) return;
    var action = btn.getAttribute('data-addr');
    var id = btn.getAttribute('data-id');
    var addr = findAddress(id);
    if (!addr) return;
    if (action === 'edit') { openAddressModal(addr, btn); return; }
    if (action === 'default') {
      UI.setLoading(btn, true);
      try {
        var res = await Api.post('/users/me/addresses/' + encodeURIComponent(id) + '/default');
        if (Array.isArray(res.data)) { addresses = res.data; renderAddresses(); } else await reloadAddresses();
        UI.toast('تم تعيين العنوان كافتراضي', 'success');
      } catch (err) {
        UI.setLoading(btn, false);
        UI.handleError(err);
      }
      return;
    }
    if (action === 'delete') {
      var ok = await UI.confirm({
        title: 'حذف العنوان',
        message: 'هل أنت متأكد من حذف هذا العنوان؟',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        danger: true
      });
      if (!ok) return;
      UI.setLoading(btn, true);
      try {
        await Api.del('/users/me/addresses/' + encodeURIComponent(id));
        await reloadAddresses();
        await afterAddressChange();
        UI.toast('تم حذف العنوان', 'success');
      } catch (err) {
        UI.setLoading(btn, false);
        UI.handleError(err);
      }
    }
  }

  /* ---------- password ---------- */
  function setupPasswordForm() {
    var has = !!(Auth.user && Auth.user.hasPassword);
    $('current-password-group').hidden = !has;
    $('no-password-note').hidden = has;
    $('password-title').textContent = has ? 'تغيير كلمة المرور' : 'تعيين كلمة مرور';
    $('password-submit').textContent = has ? 'تحديث كلمة المرور' : 'حفظ كلمة المرور';
    $('password-submit').dataset.origHtml === undefined || delete $('password-submit').dataset.origHtml;
  }

  async function onPasswordSubmit(e) {
    e.preventDefault();
    var form = $('password-form');
    var btn = $('password-submit');
    UI.clearFieldErrors(form);
    var has = !!(Auth.user && Auth.user.hasPassword);
    var cur = $('currentPassword').value;
    var np = $('newPassword').value;
    var cp = $('confirmNewPassword').value;
    var errors = [];
    if (has && !cur) errors.push({ field: 'currentPassword', message: 'كلمة المرور الحالية مطلوبة' });
    if (np.length < 8) errors.push({ field: 'newPassword', message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
    else if (!/[A-Za-z؀-ۿ]/.test(np) || !/\d/.test(np)) errors.push({ field: 'newPassword', message: 'كلمة المرور يجب أن تحتوي على حرف ورقم' });
    if (!cp) errors.push({ field: 'confirmNewPassword', message: 'تأكيد كلمة المرور مطلوب' });
    else if (cp !== np) errors.push({ field: 'confirmNewPassword', message: 'كلمتا المرور غير متطابقتين' });
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    var body = { newPassword: np, confirmNewPassword: cp };
    if (has) body.currentPassword = cur;
    UI.setLoading(btn, true, 'جارٍ التحديث...');
    try {
      await Api.put('/users/me/password', body);
      form.reset();
      UI.setLoading(btn, false);
      await Auth.refresh();
      setupPasswordForm();
      UI.toast('تم تحديث كلمة المرور بنجاح', 'success');
    } catch (err) {
      UI.handleError(err, form);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* ---------- favorites ---------- */
  function favEmptyHTML() {
    return UI.emptyState({
      icon: 'heart',
      title: 'قائمة المفضلة فارغة',
      text: 'احفظ المنتجات التي تعجبك لتجدها هنا بسهولة.',
      actionHtml: '<a class="btn btn-primary" href="products.html">تصفح المنتجات</a>'
    });
  }

  async function loadFavorites() {
    var box = $('favorites-content');
    favoritesLoaded = true;
    box.innerHTML = '<div class="product-grid">' + UI.skeletonCards(4) + '</div>';
    try {
      var res = await Api.get('/favorites');
      var items = Array.isArray(res.data) ? res.data : [];
      if (!items.length) { box.innerHTML = favEmptyHTML(); return; }
      box.innerHTML = '<div class="product-grid" id="favorites-grid">' + items.map(function (p) {
        return UI.productCardHTML(p, { favIds: Layout.favIds });
      }).join('') + '</div>';
    } catch (err) {
      favoritesLoaded = false;
      box.innerHTML = '<div class="alert alert-danger" role="alert">' + UI.escapeHtml(err.message || 'تعذر تحميل المفضلة') +
        '</div><button type="button" class="btn btn-outline mt-3" id="fav-retry">إعادة المحاولة</button>';
      $('fav-retry').addEventListener('click', loadFavorites);
    }
  }

  function onFavChanged(e) {
    var d = e.detail || {};
    var grid = $('favorites-grid');
    if (!grid) return;
    if (d.isFav === false) {
      var card = null;
      Array.prototype.forEach.call(grid.querySelectorAll('[data-product-id]'), function (c) {
        if (c.getAttribute('data-product-id') === String(d.id)) card = c;
      });
      if (card) card.remove();
      if (!grid.querySelector('[data-product-id]')) $('favorites-content').innerHTML = favEmptyHTML();
    } else if (d.isFav === true) {
      favoritesLoaded = false; // re-fetch next time the tab opens
    }
  }

  /* ---------- init ---------- */
  async function init() {
    await window.appReady;
    if (!Auth.requireLogin()) return;
    fillIcons();
    $('profile-tabs').parentNode; // sanity
    $('address-modal-close').innerHTML = UI.icon('close');

    var gov = $('addr-governorate');
    (UI.GOVERNORATES || []).forEach(function (g) {
      var o = document.createElement('option');
      o.value = g;
      o.textContent = g;
      gov.appendChild(o);
    });

    try {
      var res = await Api.get('/users/me');
      addresses = Array.isArray(res.data.addresses) ? res.data.addresses : [];
      await Auth.refresh();
    } catch (err) {
      showLoadError(err);
      return;
    }
    if (!Auth.isLoggedIn()) { Auth.requireLogin(); return; }

    renderHeader();
    fillInfoForm();
    renderAddresses();
    setupPasswordForm();
    updateCompletionAlert();

    $('logout-btn').addEventListener('click', function () { Auth.logout(); });
    $('info-form').addEventListener('submit', onInfoSubmit);
    $('add-address-btn').addEventListener('click', function (e) { openAddressModal(null, e.currentTarget); });
    $('addresses-list').addEventListener('click', onAddressAction);
    $('address-form').addEventListener('submit', onAddressSubmit);
    $('address-modal').addEventListener('modal:closed', function () {
      if (modalOpener && document.body.contains(modalOpener)) modalOpener.focus();
      modalOpener = null;
    });
    $('password-form').addEventListener('submit', onPasswordSubmit);
    window.addEventListener('fav:changed', onFavChanged);
    Auth.onChange(function (u) { if (u) renderHeader(); });

    bindTabs();
    if (UI.getParam('complete') === '1' || needsCompletion()) forcedTab = completionTab();
    $('page-loader').hidden = true;
    $('profile-content').hidden = false;
    activateTab(currentTabFromHash() || forcedTab || 'info');
  }
  init();
})();
