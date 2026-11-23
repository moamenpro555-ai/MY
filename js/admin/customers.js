(function () {
  'use strict';

  var C = window.AdminCommon;
  var esc = C.esc;
  var body = document.getElementById('table-body');
  var pager = document.getElementById('pager');
  var search = document.getElementById('search-input');
  var COLS = 9;
  var page = 1;
  var byId = {};

  function rowHTML(u) {
    var self = Auth.user && Auth.user.id === u.id;
    var disabled = self ? ' disabled title="لا يمكنك تعديل حسابك الخاص"' : '';
    return '<tr data-id="' + esc(u.id) + '">' +
      '<td class="fw-bold">' + esc(u.fullName) + '</td>' +
      '<td class="ltr">' + esc(u.email) + '</td>' +
      '<td class="ltr">' + esc(u.phone || '—') + '</td>' +
      '<td><span class="badge ' + (u.role === 'ADMIN' ? 'badge-primary' : 'badge-info') + '">' + (u.role === 'ADMIN' ? 'مدير' : 'عميل') + '</span></td>' +
      '<td class="col-num">' + u.ordersCount + '</td>' +
      '<td class="col-num">' + esc(UI.formatPrice(u.totalSpent)) + '</td>' +
      '<td>' + esc(UI.formatDate(u.createdAt)) + '</td>' +
      '<td><span class="badge ' + (u.isActive ? 'badge-success' : 'badge-danger') + '">' + (u.isActive ? 'نشط' : 'معطّل') + '</span></td>' +
      '<td class="col-actions"><div class="flex gap-1 flex-wrap">' +
        '<button type="button" class="btn btn-outline btn-sm" data-toggle-active="' + esc(u.id) + '"' + disabled + '>' + (u.isActive ? 'تعطيل' : 'تفعيل') + '</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-toggle-role="' + esc(u.id) + '"' + disabled + '>' + (u.role === 'ADMIN' ? 'إلغاء الإدارة' : 'ترقية لمدير') + '</button>' +
      '</div></td></tr>';
  }

  async function load(p) {
    page = p || 1;
    C.tableLoading(body, COLS, 6);
    try {
      var res = await Api.get('/admin/customers', { params: { page: page, limit: 15, q: search.value.trim() } });
      byId = {};
      res.data.forEach(function (u) { byId[u.id] = u; });
      if (!res.data.length) {
        C.tableEmpty(body, COLS, 'لا يوجد عملاء', 'لا توجد نتائج مطابقة.');
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

  async function patch(btn, id, payload, confirmOpts) {
    if (confirmOpts && !(await UI.confirm(confirmOpts))) return;
    UI.setLoading(btn, true);
    try {
      var res = await Api.patch('/admin/customers/' + encodeURIComponent(id), payload);
      UI.toast('تم تحديث بيانات العميل', 'success');
      // The PATCH response has no order stats: keep the ones already loaded.
      var merged = Object.assign({}, byId[id], res.data);
      byId[id] = merged;
      var row = body.querySelector('tr[data-id="' + id + '"]');
      if (row) {
        var tmp = document.createElement('tbody');
        tmp.innerHTML = rowHTML(merged);
        row.replaceWith(tmp.firstChild);
      }
    } catch (err) {
      UI.setLoading(btn, false);
      UI.handleError(err);
    }
  }

  body.addEventListener('click', function (e) {
    var a = e.target.closest('[data-toggle-active]');
    var r = e.target.closest('[data-toggle-role]');
    if (a) {
      var u = byId[a.getAttribute('data-toggle-active')];
      if (!u) return;
      patch(a, u.id, { isActive: !u.isActive }, u.isActive ? {
        title: 'تعطيل الحساب',
        message: 'سيتم تسجيل خروج ' + u.fullName + ' ولن يتمكن من الدخول. هل أنت متأكد؟',
        confirmText: 'تعطيل', cancelText: 'تراجع', danger: true
      } : null);
    } else if (r) {
      var v = byId[r.getAttribute('data-toggle-role')];
      if (!v) return;
      var toAdmin = v.role !== 'ADMIN';
      patch(r, v.id, { role: toAdmin ? 'ADMIN' : 'CUSTOMER' }, {
        title: toAdmin ? 'ترقية إلى مدير' : 'إلغاء صلاحيات الإدارة',
        message: toAdmin ? 'سيحصل ' + v.fullName + ' على صلاحيات كاملة للوحة التحكم.' : 'سيفقد ' + v.fullName + ' صلاحيات الإدارة.',
        confirmText: 'تأكيد', cancelText: 'تراجع', danger: !toAdmin
      });
    }
  });

  search.addEventListener('input', UI.debounce(function () { load(1); }, 350));

  (async function init() {
    if (!(await C.start())) return;
    load(1);
  })();
})();
