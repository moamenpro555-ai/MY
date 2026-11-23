(function () {
  'use strict';

  var C = window.AdminCommon;
  var esc = C.esc;
  var body = document.getElementById('table-body');
  var modal = document.getElementById('category-modal');
  var form = document.getElementById('category-form');
  var title = document.getElementById('category-modal-title');
  var saveBtn = document.getElementById('save-btn');
  var parentSelect = document.getElementById('f-parentId');
  var COLS = 7;
  var cats = [];
  var editingId = null;

  function nameOf(id) {
    var c = cats.find(function (x) { return x.id === id; });
    return c ? c.name : '—';
  }

  function rowHTML(c) {
    return '<tr>' +
      '<td class="fw-bold">' + esc(c.name) + '</td>' +
      '<td class="ltr">' + esc(c.slug) + '</td>' +
      '<td>' + (c.parentId ? esc(nameOf(c.parentId)) : '—') + '</td>' +
      '<td class="col-num">' + c.productCount + '</td>' +
      '<td class="col-num">' + c.sortOrder + '</td>' +
      '<td><span class="badge ' + (c.isActive ? 'badge-success' : 'badge-warning') + '">' + (c.isActive ? 'نشط' : 'مخفي') + '</span></td>' +
      '<td class="col-actions"><div class="flex gap-1">' +
        '<button type="button" class="btn btn-outline btn-sm" data-edit="' + esc(c.id) + '">تعديل</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete="' + esc(c.id) + '">حذف</button></div></td></tr>';
  }

  async function load() {
    C.tableLoading(body, COLS, 5);
    try {
      var res = await Api.get('/admin/categories');
      cats = res.data;
      if (!cats.length) {
        C.tableEmpty(body, COLS, 'لا توجد أقسام', 'أضف أول قسم للمتجر.');
        return;
      }
      body.removeAttribute('aria-busy');
      body.innerHTML = cats.map(rowHTML).join('');
    } catch (err) {
      C.tableError(body, COLS, err, 'retry');
      var retry = document.getElementById('retry');
      if (retry) retry.addEventListener('click', load);
    }
  }

  function fillParents(excludeId) {
    parentSelect.innerHTML = '<option value="">بدون</option>' + cats
      .filter(function (c) { return c.id !== excludeId; })
      .map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
  }

  function openForm(cat) {
    editingId = cat ? cat.id : null;
    UI.clearFieldErrors(form);
    form.reset();
    fillParents(editingId);
    title.textContent = cat ? 'تعديل القسم' : 'إضافة قسم';
    form.elements.name.value = cat ? cat.name : '';
    form.elements.slug.value = cat ? cat.slug : '';
    form.elements.parentId.value = cat && cat.parentId ? cat.parentId : '';
    form.elements.description.value = cat && cat.description ? cat.description : '';
    form.elements.imageUrl.value = cat && cat.imageUrl ? cat.imageUrl : '';
    form.elements.sortOrder.value = cat ? cat.sortOrder : 0;
    form.elements.isActive.checked = cat ? cat.isActive : true;
    UI.openModal(modal);
  }

  document.getElementById('add-btn').addEventListener('click', function () { openForm(null); });

  body.addEventListener('click', async function (e) {
    var edit = e.target.closest('[data-edit]');
    var del = e.target.closest('[data-delete]');
    if (edit) {
      openForm(cats.find(function (c) { return c.id === edit.getAttribute('data-edit'); }));
    } else if (del) {
      var cat = cats.find(function (c) { return c.id === del.getAttribute('data-delete'); });
      if (!cat) return;
      var ok = await UI.confirm({ title: 'حذف القسم', message: 'هل تريد حذف القسم «' + cat.name + '»؟', confirmText: 'حذف', cancelText: 'تراجع', danger: true });
      if (!ok) return;
      UI.setLoading(del, true);
      try {
        await Api.del('/admin/categories/' + encodeURIComponent(cat.id));
        UI.toast('تم حذف القسم', 'success');
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
      name: f.name.value.trim(),
      description: f.description.value.trim() || null,
      imageUrl: f.imageUrl.value.trim() || null,
      parentId: f.parentId.value || null,
      sortOrder: Number(f.sortOrder.value) || 0,
      isActive: f.isActive.checked
    };
    if (f.slug.value.trim()) payload.slug = f.slug.value.trim();
    if (payload.name.length < 2) {
      UI.showFieldErrors(form, [{ field: 'name', message: 'اسم القسم قصير جداً' }]);
      return;
    }
    UI.setLoading(saveBtn, true, 'جارٍ الحفظ...');
    try {
      if (editingId) await Api.patch('/admin/categories/' + encodeURIComponent(editingId), payload);
      else await Api.post('/admin/categories', payload);
      UI.toast('تم حفظ القسم', 'success');
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
