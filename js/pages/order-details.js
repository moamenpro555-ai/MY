(function () {
  'use strict';

  var root = document.getElementById('order-root');
  var esc = UI.escapeHtml;
  var STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

  function timeline(status) {
    if (status === 'CANCELLED') {
      return '<div class="alert alert-danger">تم إلغاء هذا الطلب.</div>';
    }
    var current = STEPS.indexOf(status);
    return '<ol class="timeline" aria-label="مراحل الطلب">' + STEPS.map(function (s, i) {
      var done = i <= current;
      return '<li class="timeline-step' + (done ? ' is-done' : '') + '"' + (i === current ? ' aria-current="step"' : '') + '>' +
        '<span class="timeline-dot">' + (done ? UI.icon('check') : '') + '</span>' +
        '<span class="timeline-label">' + esc(UI.statusLabel(s)) + '</span></li>';
    }).join('') + '</ol>';
  }

  function itemsTable(o) {
    var rows = o.items.map(function (i) {
      var src = i.image ? UI.safeUrl(i.image) : '';
      var opts = [i.size, i.color].filter(Boolean).map(esc).join(' · ');
      var name = esc(i.name);
      var link = i.productId ? '<a href="product-details.html?id=' + encodeURIComponent(i.productId) + '">' + name + '</a>' : name;
      return '<tr>' +
        '<td data-label="المنتج"><div class="flex items-center gap-2">' +
          (src ? '<img class="table-img" src="' + esc(src) + '" alt="" loading="lazy">' : '') +
          '<div>' + link + (opts ? '<div class="text-muted text-sm">' + opts + '</div>' : '') + '</div></div></td>' +
        '<td data-label="السعر">' + esc(UI.formatPrice(i.unitPrice)) + '</td>' +
        '<td data-label="الكمية">' + i.quantity + '</td>' +
        '<td data-label="الإجمالي" class="fw-bold">' + esc(UI.formatPrice(i.lineTotal)) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>المنتج</th><th>السعر وقت الشراء</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function render(o, placed) {
    var s = o.shipping;
    root.innerHTML =
      (placed ? '<div class="alert alert-success order-placed">' + UI.icon('check') + '<div><strong>تم استلام طلبك بنجاح</strong><div>سنتواصل معك لتأكيد الطلب وتوصيله. رقم طلبك: <span class="ltr">' + esc(o.orderNumber) + '</span></div></div></div>' : '') +
      '<div class="section-head no-print"><h1 class="page-title">طلب <span class="ltr">' + esc(o.orderNumber) + '</span></h1>' +
        '<div class="flex gap-2">' +
          '<button type="button" class="btn btn-outline btn-sm" id="print-btn">طباعة</button>' +
          (o.canCancel ? '<button type="button" class="btn btn-danger btn-sm" id="cancel-btn">إلغاء الطلب</button>' : '') +
        '</div></div>' +
      '<div class="card card-body mb-3"><div class="flex items-center justify-between flex-wrap gap-2 mb-3">' +
        '<span class="text-muted">' + esc(UI.formatDateTime(o.createdAt)) + '</span>' +
        '<span class="' + UI.statusClass(o.status) + '">' + esc(UI.statusLabel(o.status)) + '</span></div>' +
        timeline(o.status) + '</div>' +
      '<div class="order-detail-layout">' +
        '<div>' +
          '<div class="card card-body mb-3"><h2 class="section-title">المنتجات</h2>' + itemsTable(o) + '</div>' +
        '</div>' +
        '<aside>' +
          '<div class="card card-body mb-3"><h2 class="section-title">ملخص الطلب</h2>' +
            '<div class="summary-row"><span>المجموع الفرعي</span><span>' + esc(UI.formatPrice(o.subtotal)) + '</span></div>' +
            (o.discountTotal > 0 ? '<div class="summary-row"><span>الخصم' + (o.couponCode ? ' (<span class="ltr">' + esc(o.couponCode) + '</span>)' : '') + '</span><span class="discount">-' + esc(UI.formatPrice(o.discountTotal)) + '</span></div>' : '') +
            '<div class="summary-row"><span>الشحن</span><span>' + (o.shippingCost > 0 ? esc(UI.formatPrice(o.shippingCost)) : 'مجاني') + '</span></div>' +
            '<div class="summary-row total"><span>الإجمالي</span><span>' + esc(UI.formatPrice(o.total)) + '</span></div></div>' +
          '<div class="card card-body mb-3"><h2 class="section-title">عنوان التوصيل</h2>' +
            '<p class="fw-bold">' + esc(s.fullName) + '</p>' +
            '<p>' + esc(s.governorate) + ' - ' + esc(s.city) + '</p><p>' + esc(s.addressLine) + '</p>' +
            '<p class="ltr">' + esc(s.phone) + '</p></div>' +
          '<div class="card card-body"><h2 class="section-title">الدفع</h2>' +
            '<p>' + esc(UI.paymentMethodLabel(o.paymentMethod)) + '</p>' +
            '<p><span class="' + UI.paymentStatusClass(o.paymentStatus) + '">' + esc(UI.paymentStatusLabel(o.paymentStatus)) + '</span></p>' +
            (o.notes ? '<h3 class="mt-3 text-sm text-muted">ملاحظات</h3><p>' + esc(o.notes) + '</p>' : '') + '</div>' +
        '</aside></div>';

    document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
    var cancel = document.getElementById('cancel-btn');
    if (cancel) cancel.addEventListener('click', function () { cancelOrder(o, cancel); });
  }

  async function cancelOrder(o, btn) {
    var ok = await UI.confirm({
      title: 'إلغاء الطلب',
      message: 'هل تريد إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'نعم، إلغاء الطلب',
      cancelText: 'تراجع',
      danger: true
    });
    if (!ok) return;
    UI.setLoading(btn, true, 'جارٍ الإلغاء...');
    try {
      var res = await Api.post('/orders/' + encodeURIComponent(o.id) + '/cancel');
      UI.toast('تم إلغاء الطلب', 'success');
      render(res.data, false);
    } catch (err) {
      UI.setLoading(btn, false);
      UI.handleError(err);
    }
  }

  (async function init() {
    await window.appReady;
    if (!Auth.requireLogin()) return;
    var id = UI.getParam('id');
    if (!id) {
      root.innerHTML = UI.emptyState({ icon: 'package', title: 'الطلب غير موجود', text: 'رابط الطلب غير صالح.', actionHtml: '<a class="btn btn-primary" href="orders.html">طلباتي</a>' });
      return;
    }
    root.innerHTML = '<div class="page-loader"><div class="spinner spinner-lg"></div></div>';
    try {
      var res = await Api.get('/orders/' + encodeURIComponent(id));
      render(res.data, UI.getParam('placed') === '1');
    } catch (err) {
      root.innerHTML = err.status === 404
        ? UI.emptyState({ icon: 'package', title: 'الطلب غير موجود', text: 'لم نعثر على هذا الطلب في حسابك.', actionHtml: '<a class="btn btn-primary" href="orders.html">طلباتي</a>' })
        : '<div class="alert alert-danger">' + esc(err.message) + '</div>';
    }
  })();
})();
