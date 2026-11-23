(function () {
  'use strict';

  var list = document.getElementById('orders-list');
  var pager = document.getElementById('orders-pager');
  var esc = UI.escapeHtml;

  function thumbs(order) {
    var items = order.items || [];
    var shown = items.slice(0, 4).map(function (i) {
      var src = i.image ? UI.safeUrl(i.image) : '';
      return src
        ? '<img class="order-thumb" src="' + esc(src) + '" alt="' + esc(i.name) + '" loading="lazy">'
        : '<span class="order-thumb order-thumb-empty">' + UI.icon('box') + '</span>';
    }).join('');
    var more = items.length > 4 ? '<span class="order-thumb order-thumb-more">+' + (items.length - 4) + '</span>' : '';
    return '<div class="order-thumbs">' + shown + more + '</div>';
  }

  function cardHTML(o) {
    var count = (o.items || []).reduce(function (s, i) { return s + i.quantity; }, 0);
    return '<article class="card order-card" data-order="' + esc(o.id) + '">' +
      '<div class="order-card-head">' +
        '<div><div class="order-number ltr">' + esc(o.orderNumber) + '</div>' +
        '<div class="text-muted text-sm">' + esc(UI.formatDateTime(o.createdAt)) + '</div></div>' +
        '<span class="' + UI.statusClass(o.status) + '">' + esc(UI.statusLabel(o.status)) + '</span>' +
      '</div>' +
      '<div class="order-card-body">' +
        thumbs(o) +
        '<dl class="kv-list order-kv">' +
          '<div><dt>عدد القطع</dt><dd>' + count + '</dd></div>' +
          '<div><dt>الدفع</dt><dd>' + esc(UI.paymentMethodLabel(o.paymentMethod)) + ' · ' + esc(UI.paymentStatusLabel(o.paymentStatus)) + '</dd></div>' +
          '<div><dt>الإجمالي</dt><dd class="fw-bold">' + esc(UI.formatPrice(o.total)) + '</dd></div>' +
        '</dl>' +
      '</div>' +
      '<div class="order-card-actions">' +
        '<a class="btn btn-outline btn-sm" href="order-details.html?id=' + encodeURIComponent(o.id) + '">عرض التفاصيل</a>' +
        (o.canCancel ? '<button type="button" class="btn btn-danger btn-sm" data-cancel="' + esc(o.id) + '">إلغاء الطلب</button>' : '') +
      '</div>' +
    '</article>';
  }

  function skeleton() {
    var s = '';
    for (var i = 0; i < 3; i++) {
      s += '<div class="card order-card"><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>';
    }
    return '<div class="orders-stack">' + s + '</div>';
  }

  async function load(page) {
    list.innerHTML = skeleton();
    try {
      var res = await Api.get('/orders', { params: { page: page, limit: 8 } });
      if (!res.data.length) {
        list.innerHTML = UI.emptyState({
          icon: 'package',
          title: 'لا توجد طلبات بعد',
          text: 'ابدأ التسوق وستظهر طلباتك هنا.',
          actionHtml: '<a class="btn btn-primary" href="products.html">تسوق الآن</a>'
        });
        pager.innerHTML = '';
        return;
      }
      list.innerHTML = '<div class="orders-stack">' + res.data.map(cardHTML).join('') + '</div>';
      UI.renderPagination(pager, res.meta, function (p) {
        load(p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (err) {
      list.innerHTML = '<div class="alert alert-danger">' + esc(err.message) + '</div>' +
        '<button type="button" class="btn btn-outline" id="retry">إعادة المحاولة</button>';
      var retry = document.getElementById('retry');
      if (retry) retry.addEventListener('click', function () { load(page); });
    }
  }

  list.addEventListener('click', async function (e) {
    var btn = e.target.closest('[data-cancel]');
    if (!btn) return;
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
      var res = await Api.post('/orders/' + encodeURIComponent(btn.getAttribute('data-cancel')) + '/cancel');
      var card = btn.closest('.order-card');
      var tmp = document.createElement('div');
      tmp.innerHTML = cardHTML(res.data);
      card.replaceWith(tmp.firstChild);
      UI.toast('تم إلغاء الطلب', 'success');
    } catch (err) {
      UI.setLoading(btn, false);
      UI.handleError(err);
    }
  });

  (async function init() {
    await window.appReady;
    if (!Auth.requireLogin()) return;
    load(Number(UI.getParam('page')) || 1);
  })();
})();
