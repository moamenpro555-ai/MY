(function () {
  'use strict';

  var C = window.AdminCommon;
  var esc = C.esc;
  var body = document.getElementById('table-body');
  var pager = document.getElementById('pager');
  var search = document.getElementById('search-input');
  var statusFilter = document.getElementById('status-filter');
  var modal = document.getElementById('order-modal');
  var detail = document.getElementById('order-detail');
  var statusForm = document.getElementById('status-form');
  var statusSelect = document.getElementById('status-select');
  var statusSave = document.getElementById('status-save');
  var COLS = 7;

  // Mirrors the server's allowed transitions (the server enforces them anyway).
  var NEXT = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: []
  };

  var page = 1;
  var current = null;
  var rowsById = {};

  function rowHTML(o) {
    return '<tr data-id="' + esc(o.id) + '">' +
      '<td><span class="ltr fw-bold">' + esc(o.orderNumber) + '</span></td>' +
      '<td>' + esc(o.customer ? o.customer.fullName : o.shipping.fullName) +
        '<div class="text-muted text-sm ltr">' + esc(o.customer ? o.customer.email : '') + '</div></td>' +
      '<td>' + esc(UI.formatDateTime(o.createdAt)) + '</td>' +
      '<td><span class="' + UI.statusClass(o.status) + '">' + esc(UI.statusLabel(o.status)) + '</span></td>' +
      '<td>' + esc(UI.paymentMethodLabel(o.paymentMethod)) + '<div><span class="' + UI.paymentStatusClass(o.paymentStatus) + '">' + esc(UI.paymentStatusLabel(o.paymentStatus)) + '</span></div></td>' +
      '<td class="col-num">' + esc(UI.formatPrice(o.total)) + '</td>' +
      '<td class="col-actions"><button type="button" class="btn btn-outline btn-sm" data-view="' + esc(o.id) + '">التفاصيل</button></td></tr>';
  }

  async function load(p) {
    page = p || 1;
    C.tableLoading(body, COLS, 6);
    try {
      var res = await Api.get('/admin/orders', { params: { page: page, limit: 15, q: search.value.trim(), status: statusFilter.value } });
      rowsById = {};
      res.data.forEach(function (o) { rowsById[o.id] = o; });
      if (!res.data.length) {
        C.tableEmpty(body, COLS, 'لا توجد طلبات', 'لا توجد نتائج مطابقة.');
        pager.innerHTML = '';
        return;
      }
      body.removeAttribute('aria-busy');
      body.innerHTML = res.data.map(rowHTML).join('');
      UI.renderPagination(pager, res.meta, load);
    } catch (err) {
      C.tableError(body, COLS, err, 'retry');
      var retry = document.getElementById('retry');
      if (retry) retry.addEventListener('click', function () { load(page); });
    }
  }

  function detailHTML(o) {
    var s = o.shipping;
    var items = o.items.map(function (i) {
      var src = i.image ? UI.safeUrl(i.image) : '';
      var opts = [i.size, i.color].filter(Boolean).map(esc).join(' · ');
      return '<tr><td><div class="flex items-center gap-2">' + (src ? '<img class="table-img" src="' + esc(src) + '" alt="">' : '') +
        '<div>' + esc(i.name) + (opts ? '<div class="text-muted text-sm">' + opts + '</div>' : '') + '</div></div></td>' +
        '<td>' + esc(UI.formatPrice(i.unitPrice)) + '</td><td>' + i.quantity + '</td><td>' + esc(UI.formatPrice(i.lineTotal)) + '</td></tr>';
    }).join('');
    return '<div class="order-admin-grid">' +
      '<section><h3>العميل</h3><p class="fw-bold">' + esc(o.customer ? o.customer.fullName : '') + '</p>' +
        '<p class="ltr">' + esc(o.customer ? o.customer.email : '') + '</p><p class="ltr">' + esc(o.customer ? o.customer.phone || '' : '') + '</p></section>' +
      '<section><h3>عنوان التوصيل</h3><p class="fw-bold">' + esc(s.fullName) + '</p><p>' + esc(s.governorate) + ' - ' + esc(s.city) + '</p>' +
        '<p>' + esc(s.addressLine) + '</p><p class="ltr">' + esc(s.phone) + '</p></section>' +
      '<section><h3>الطلب</h3><p><span class="ltr fw-bold">' + esc(o.orderNumber) + '</span></p><p>' + esc(UI.formatDateTime(o.createdAt)) + '</p>' +
        '<p><span class="' + UI.statusClass(o.status) + '">' + esc(UI.statusLabel(o.status)) + '</span></p>' +
        '<p>' + esc(UI.paymentMethodLabel(o.paymentMethod)) + ' · <span class="' + UI.paymentStatusClass(o.paymentStatus) + '">' + esc(UI.paymentStatusLabel(o.paymentStatus)) + '</span></p>' +
        (o.notes ? '<p class="text-muted">ملاحظات: ' + esc(o.notes) + '</p>' : '') + '</section></div>' +
      '<div class="table-wrap mt-3"><table class="data-table"><thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>' + items + '</tbody></table></div>' +
      '<div class="order-admin-totals">' +
        '<div class="summary-row"><span>المجموع الفرعي</span><span>' + esc(UI.formatPrice(o.subtotal)) + '</span></div>' +
        (o.discountTotal > 0 ? '<div class="summary-row"><span>الخصم' + (o.couponCode ? ' (' + esc(o.couponCode) + ')' : '') + '</span><span class="discount">-' + esc(UI.formatPrice(o.discountTotal)) + '</span></div>' : '') +
        '<div class="summary-row"><span>الشحن</span><span>' + (o.shippingCost > 0 ? esc(UI.formatPrice(o.shippingCost)) : 'مجاني') + '</span></div>' +
        '<div class="summary-row total"><span>الإجمالي</span><span>' + esc(UI.formatPrice(o.total)) + '</span></div></div>';
  }

  function setupStatusForm(o) {
    var next = NEXT[o.status] || [];
    if (!next.length) {
      statusForm.hidden = true;
      return;
    }
    statusSelect.innerHTML = next.map(function (s) { return '<option value="' + s + '">' + esc(UI.statusLabel(s)) + '</option>'; }).join('');
    statusForm.hidden = false;
  }

  async function openOrder(id) {
    detail.innerHTML = '<div class="page-loader"><div class="spinner spinner-lg"></div></div>';
    statusForm.hidden = true;
    UI.openModal(modal);
    try {
      var res = await Api.get('/admin/orders/' + encodeURIComponent(id));
      current = res.data;
      detail.innerHTML = detailHTML(current);
      setupStatusForm(current);
    } catch (err) {
      detail.innerHTML = '<div class="alert alert-danger">' + esc(err.message) + '</div>';
    }
  }

  body.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-view]');
    if (btn) openOrder(btn.getAttribute('data-view'));
  });

  statusForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!current) return;
    var next = statusSelect.value;
    if (next === 'CANCELLED') {
      var ok = await UI.confirm({
        title: 'إلغاء الطلب',
        message: 'سيتم إلغاء الطلب وإرجاع المخزون. هل أنت متأكد؟',
        confirmText: 'نعم، إلغاء الطلب',
        cancelText: 'تراجع',
        danger: true
      });
      if (!ok) return;
    }
    UI.setLoading(statusSave, true, 'جارٍ التحديث...');
    try {
      var res = await Api.patch('/admin/orders/' + encodeURIComponent(current.id) + '/status', { status: next });
      current = res.data;
      UI.toast('تم تحديث حالة الطلب', 'success');
      detail.innerHTML = detailHTML(current);
      setupStatusForm(current);
      var row = body.querySelector('tr[data-id="' + current.id + '"]');
      if (row) {
        var tmp = document.createElement('tbody');
        tmp.innerHTML = rowHTML(current);
        row.replaceWith(tmp.firstChild);
      }
    } catch (err) {
      UI.handleError(err);
    } finally {
      UI.setLoading(statusSave, false);
    }
  });

  search.addEventListener('input', UI.debounce(function () { load(1); }, 350));
  statusFilter.addEventListener('change', function () { load(1); });

  (async function init() {
    if (!(await C.start())) return;
    var q = UI.getParam('q');
    if (q) search.value = q;
    load(1);
  })();
})();
