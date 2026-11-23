(function () {
  'use strict';

  var C = window.AdminCommon;
  var esc = C.esc;
  var form = document.getElementById('report-form');
  var runBtn = document.getElementById('run-btn');
  var exportBtn = document.getElementById('export-btn');
  var errorBox = document.getElementById('report-error');
  var totalsEl = document.getElementById('totals');
  var chartEl = document.getElementById('report-chart');
  var body = document.getElementById('table-body');
  var COLS = 3;
  var lastRows = [];

  function statCard(icon, label, value, mod) {
    return '<div class="stat-card' + (mod ? ' ' + mod : '') + '"><span class="stat-card-icon">' + UI.icon(icon) + '</span>' +
      '<div><div class="stat-card-label">' + esc(label) + '</div><div class="stat-card-value">' + esc(value) + '</div></div></div>';
  }

  function render(res) {
    var t = res.totals;
    totalsEl.innerHTML =
      statCard('package', 'عدد الطلبات', UI.formatNumber(t.orders)) +
      statCard('tag', 'إجمالي الإيراد', UI.formatPrice(t.revenue), 'is-success') +
      statCard('star', 'متوسط قيمة الطلب', UI.formatPrice(t.averageOrderValue));

    lastRows = res.rows;
    exportBtn.disabled = !lastRows.length;

    if (!lastRows.length) {
      chartEl.innerHTML = UI.emptyState({ icon: 'box', title: 'لا توجد مبيعات في هذه الفترة', text: 'جرّب تغيير الفترة الزمنية.' });
      C.tableEmpty(body, COLS, 'لا توجد بيانات', '');
      return;
    }

    var max = Math.max.apply(null, lastRows.map(function (r) { return r.revenue; })) || 1;
    chartEl.innerHTML = '<div class="chart-bars">' + lastRows.map(function (r) {
      return '<div class="chart-bars-row"><span class="chart-bars-label ltr">' + esc(r.period) + '</span>' +
        '<span class="chart-bars-track"><span class="chart-bars-fill" data-value="' + r.revenue + '"></span></span>' +
        '<span class="chart-bars-value">' + esc(UI.formatPrice(r.revenue)) + '</span></div>';
    }).join('') + '</div>';
    Array.prototype.forEach.call(chartEl.querySelectorAll('.chart-bars-fill'), function (el) {
      el.style.setProperty('--w', (Number(el.getAttribute('data-value')) / max * 100).toFixed(1) + '%');
    });

    body.removeAttribute('aria-busy');
    body.innerHTML = lastRows.map(function (r) {
      return '<tr><td class="ltr">' + esc(r.period) + '</td><td class="col-num">' + r.orders + '</td><td class="col-num">' + esc(UI.formatPrice(r.revenue)) + '</td></tr>';
    }).join('');
  }

  async function run() {
    errorBox.hidden = true;
    var from = form.elements.from.value;
    var to = form.elements.to.value;
    if (!from || !to) { errorBox.textContent = 'اختر تاريخ البداية والنهاية'; errorBox.hidden = false; return; }
    if (from > to) { errorBox.textContent = 'تاريخ البداية يجب أن يسبق تاريخ النهاية'; errorBox.hidden = false; return; }
    UI.setLoading(runBtn, true, 'جارٍ التحميل...');
    C.tableLoading(body, COLS, 4);
    try {
      var res = await Api.get('/admin/reports/sales', { params: { from: from, to: to, groupBy: form.elements.groupBy.value } });
      render(res.data);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      C.tableMessage(body, COLS, '');
    } finally {
      UI.setLoading(runBtn, false);
    }
  }

  function exportCsv() {
    if (!lastRows.length) return;
    var lines = ['الفترة,عدد الطلبات,الإيراد'].concat(lastRows.map(function (r) {
      return [r.period, r.orders, r.revenue].join(',');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sales-report-' + form.elements.from.value + '_' + form.elements.to.value + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  exportBtn.addEventListener('click', exportCsv);

  (async function init() {
    if (!(await C.start())) return;
    var today = new Date();
    var start = new Date(today.getTime() - 29 * 86400000);
    form.elements.to.value = C.ymd(today);
    form.elements.from.value = C.ymd(start);
    run();
  })();
})();
