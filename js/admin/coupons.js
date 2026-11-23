(function () {
  'use strict';

  var C = window.AdminCommon;
  var esc = C.esc;
  var body = document.getElementById('table-body');
  var modal = document.getElementById('coupon-modal');
  var form = document.getElementById('coupon-form');
  var title = document.getElementById('coupon-modal-title');
  var saveBtn = document.getElementById('save-btn');
  var COLS = 9;
  var coupons = [];
  var editingId = null;

  function discountText(c) {
    return c.discountType === 'PERCENTAGE' ? c.discountValue + '%' : UI.formatPrice(c.discountValue);
  }

  function period(c) {
    if (!c.startsAt && !c.expiresAt) return 'بدون حد';
    return (c.startsAt ? UI.formatDate(c.startsAt) : '…') + ' ← ' + (c.expiresAt ? UI.formatDate(c.expiresAt) : '…');
  }

  function rowHTML(c) {
    var expired = c.expiresAt && new Date(c.expiresAt) < new Date();
    var badge = !c.isActive ? '<span class="badge badge-warning">متوقف</span>'
      : expired ? '<span class="badge badge-danger">منتهي</span>' : '<span class="badge badge-success">نشط</span>';
    return '<tr>' +
      '<td><span class="ltr fw-bold">' + esc(c.code) + '</span>' + (c.description ? '<div class="text-muted text-sm">' + esc(c.description) + '</div>' : '') + '</td>' +
      '<td>' + esc(discountText(c)) + '</td>' +
      '<td class="col-num">' + (c.minOrderTotal != null ? esc(UI.formatPrice(c.minOrderTotal)) : '—') + '</td>' +
      '<td class="col-num">' + (c.maxDiscount != null ? esc(UI.formatPrice(c.maxDiscount)) : '—') + '</td>' +
      '<td class="col-num">' + c.usedCount + ' / ' + (c.usageLimit != null ? c.usageLimit : '∞') + '</td>' +
      '<td class="col-num">' + c.perUserLimit + '</td>' +
      '<td>' + esc(period(c)) + '</td>' +
      '<td>' + badge + '</td>' +
      '<td class="col-actions"><div class="flex gap-1">' +
        '<button type="button" class="btn btn-outline btn-sm" data-edit="' + esc(c.id) + '">تعديل</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete="' + esc(c.id) + '">حذف</button></div></td></tr>';
  }

  async function load() {
    C.tableLoading(body, COLS, 5);
    try {
      var res = await Api.get('/admin/coupons');
      coupons = res.data;
      if (!coupons.length) {
        C.tableEmpty(body, COLS, 'لا توجد كوبونات', 'أنشئ كوبون خصم جديداً.');
        return;
      }
      body.removeAttribute('aria-busy');
      body.innerHTML = coupons.map(rowHTML).join('');
    } catch (err) {
      C.tableError(body, COLS, err, 'retry');
      var retry = document.getElementById('retry');
      if (retry) retry.addEventListener('click', load);
    }
  }

  function setVal(el, v) { el.value = v == null ? '' : v; }

  function openForm(c) {
    editingId = c ? c.id : null;
    UI.clearFieldErrors(form);
    form.reset();
    var f = form.elements;
    title.textContent = c ? 'تعديل الكوبون' : 'إضافة كوبون';
    setVal(f.code, c && c.code);
    f.discountType.value = c ? c.discountType : 'PERCENTAGE';
    setVal(f.discountValue, c && c.discountValue);
    setVal(f.minOrderTotal, c && c.minOrderTotal);
    setVal(f.maxDiscount, c && c.maxDiscount);
    setVal(f.usageLimit, c && c.usageLimit);
    setVal(f.perUserLimit, c ? c.perUserLimit : 1);
    setVal(f.description, c && c.description);
    f.startsAt.value = C.toLocalInput(c && c.startsAt);
    f.expiresAt.value = C.toLocalInput(c && c.expiresAt);
    f.isActive.checked = c ? c.isActive : true;
    UI.openModal(modal);
  }

  function validate(p) {
    var errors = [];
    if (p.code.length < 3) errors.push({ field: 'code', message: 'كود الخصم قصير جداً' });
    else if (!/^[A-Za-z0-9_-]+$/.test(p.code)) errors.push({ field: 'code', message: 'حروف إنجليزية وأرقام فقط' });
    if (p.discountValue == null || p.discountValue <= 0) errors.push({ field: 'discountValue', message: 'أدخل قيمة خصم صحيحة' });
    else if (p.discountType === 'PERCENTAGE' && p.discountValue > 100) errors.push({ field: 'discountValue', message: 'النسبة بين 1 و 100' });
    if (p.startsAt && p.expiresAt && new Date(p.expiresAt) <= new Date(p.startsAt)) {
      errors.push({ field: 'expiresAt', message: 'تاريخ الانتهاء يجب أن يكون بعد البداية' });
    }
    return errors;
  }

  document.getElementById('add-btn').addEventListener('click', function () { openForm(null); });

  body.addEventListener('click', async function (e) {
    var edit = e.target.closest('[data-edit]');
    var del = e.target.closest('[data-delete]');
    if (edit) {
      openForm(coupons.find(function (c) { return c.id === edit.getAttribute('data-edit'); }));
    } else if (del) {
      var c = coupons.find(function (x) { return x.id === del.getAttribute('data-delete'); });
      if (!c) return;
      var ok = await UI.confirm({ title: 'حذف الكوبون', message: 'هل تريد حذف الكوبون ' + c.code + '؟', confirmText: 'حذف', cancelText: 'تراجع', danger: true });
      if (!ok) return;
      UI.setLoading(del, true);
      try {
        await Api.del('/admin/coupons/' + encodeURIComponent(c.id));
        UI.toast('تم حذف الكوبون', 'success');
        load();
      } catch (err) {
        UI.setLoading(del, false);
        UI.handleError(err);
      }
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    UI.clearFieldErrors(form);
    var f = form.elements;
    var payload = {
      code: f.code.value.trim().toUpperCase(),
      description: f.description.value.trim() || null,
      discountType: f.discountType.value,
      discountValue: C.num(f.discountValue.value),
      minOrderTotal: C.num(f.minOrderTotal.value),
      maxDiscount: C.num(f.maxDiscount.value),
      usageLimit: C.num(f.usageLimit.value),
      startsAt: C.fromLocalInput(f.startsAt.value),
      expiresAt: C.fromLocalInput(f.expiresAt.value),
      isActive: f.isActive.checked
    };
    var per = C.num(f.perUserLimit.value);
    if (per != null) payload.perUserLimit = per;

    var errors = validate(payload);
    if (errors.length) { UI.showFieldErrors(form, errors); return; }

    UI.setLoading(saveBtn, true, 'جارٍ الحفظ...');
    try {
      if (editingId) await Api.patch('/admin/coupons/' + encodeURIComponent(editingId), payload);
      else await Api.post('/admin/coupons', payload);
      UI.toast('تم حفظ الكوبون', 'success');
      UI.closeModal(modal);
      load();
    } catch (err) {
      UI.handleError(err, form);
    } finally {
      UI.setLoading(saveBtn, false);
    }
  });

  (async function init() {
    if (!(await C.start())) return;
    load();
  })();
})();
