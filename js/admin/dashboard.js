(function () {
  'use strict';
  var C = window.AdminCommon;
  var statGrid = document.getElementById('stat-grid');
  var statusChart = document.getElementById('status-chart');
  var topBox = document.getElementById('top-products');
  var recentBody = document.getElementById('recent-body');
  var errBox = document.getElementById('dash-error');
  var refreshBtn = document.getElementById('refresh-btn');
  var STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  function statCard(icon, label, value, mod) {
    return '<div class="stat-card' + (mod ? ' ' + mod : '') + '"><span class="stat-card-icon" aria-hidden="true">' + UI.icon(icon) + '</span>' +
      '<div><span class="stat-card-label">' + C.esc(label) + '</span><span class="stat-card-value">' + C.esc(value) + '</span></div></div>';
  }

  function renderStats(t) {
    statGrid.innerHTML =
      statCard('tag', 'إجمالي الإيراد', UI.formatPrice(t.revenue || 0), 'is-success') +
      statCard('truck', 'الطلبات', UI.formatNumber(t.orders || 0)) +
      statCard('user', 'العملاء', UI.formatNumber(t.customers || 0)) +
      statCard('package', 'المنتجات', UI.formatNumber(t.products || 0)) +
      statCard('box', 'طلبات قيد الانتظار', UI.formatNumber(t.pendingOrders || 0), 'is-warning') +
      statCard('refresh', 'مخزون منخفض', UI.formatNumber(t.lowStockCount || 0), 'is-danger');
  }

  function renderStatusChart(map) {
    map = map || {};
    var max = 0;
    STATUS_ORDER.forEach(function (s) { max = Math.max(max, Number(map[s]) || 0); });
    if (!max) { statusChart.innerHTML = UI.emptyState({ icon: 'truck', title: 'لا توجد طلبات بعد' }); return; }
    statusChart.innerHTML = '<div class="chart-bars">' + STATUS_ORDER.map(function (s) {
      var n = Number(map[s]) || 0;
      return '<div class="chart-bars-row' + (s === 'CANCELLED' ? ' is-accent' : '') + '" data-v="' + (n / max * 100).toFixed(1) + '"><span class="chart-bars-label">' + C.esc(UI.statusLabel(s)) +
        '</span><span class="chart-bars-track"><span class="chart-bars-fill"></span></span><span class="chart-bars-value">' + UI.formatNumber(n) + '</span></div>';
    }).join('') + '</div>';
    Array.prototype.forEach.call(statusChart.querySelectorAll('.chart-bars-row'), function (row) {
      row.querySelector('.chart-bars-fill').style.setProperty('--w', row.getAttribute('data-v') + '%');
    });
  }

  function renderTop(list) {
    if (!list || !list.length) { topBox.innerHTML = UI.emptyState({ icon: 'package', title: 'لا توجد مبيعات بعد' }); return; }
    topBox.innerHTML = list.map(function (p) {
      var img = UI.safeUrl(p.image);
      return '<div class="top-product">' +
        (img ? '<img class="table-img" src="' + C.esc(img) + '" alt="" loading="lazy">' : '<span class="table-img"></span>') +
        '<span class="top-product-name">' + C.esc(p.name) + '</span><span class="top-product-sold">' + UI.formatNumber(p.soldCount || 0) + ' مبيعات</span></div>';
    }).join('');
  }

  function renderRecent(list) {
    if (!list || !list.length) { C.tableEmpty(recentBody, 5, 'لا توجد طلبات حديثة'); return; }
    recentBody.removeAttribute('aria-busy');
    recentBody.innerHTML = list.map(function (o) {
      return '<tr><td><a href="orders.html?q=' + encodeURIComponent(o.orderNumber) + '" class="fw-bold ltr">' + C.esc(o.orderNumber) + '</a></td>' +
        '<td>' + C.esc(o.customer ? o.customer.fullName : '—') + '</td>' +
        '<td class="nowrap">' + C.esc(UI.formatDate(o.createdAt)) + '</td>' +
        '<td><span class="' + C.esc(UI.statusClass(o.status)) + '">' + C.esc(UI.statusLabel(o.status)) + '</span></td>' +
        '<td class="col-num">' + C.esc(UI.formatPrice(o.total)) + '</td></tr>';
    }).join('');
  }

  async function load() {
    errBox.hidden = true;
    statGrid.innerHTML = '<div class="skeleton skeleton-line"></div>';
    statusChart.innerHTML = topBox.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div>';
    C.tableLoading(recentBody, 5, 4);
    UI.setLoading(refreshBtn, true);
    try {
      var res = await Api.get('/admin/stats');
      var d = res.data || {};
      renderStats(d.totals || {});
      renderStatusChart(d.ordersByStatus);
      renderTop(d.topProducts);
      renderRecent(d.recentOrders);
    } catch (err) {
      errBox.textContent = err.message || 'تعذر تحميل البيانات';
      errBox.hidden = false;
      statGrid.innerHTML = statusChart.innerHTML = topBox.innerHTML = '';
      C.tableError(recentBody, 5, err);
    } finally {
      UI.setLoading(refreshBtn, false);
    }
  }

  (async function init() {
    if (!(await C.start())) return;
    refreshBtn.addEventListener('click', load);
    load();
  })();
})();
