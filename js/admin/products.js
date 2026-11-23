(function () {
  'use strict';
  var C = window.AdminCommon;
  var COLS = 7;
  var LIMIT = 10;
  var STATUS = { ACTIVE: ['نشط', 'badge-success'], DRAFT: ['مسودة', 'badge-warning'], ARCHIVED: ['مؤرشف', 'badge-muted'] };

  var body = document.getElementById('table-body');
  var pager = document.getElementById('pager');
  var searchInput = document.getElementById('search-input');
  var statusFilter = document.getElementById('status-filter');
  var categoryFilter = document.getElementById('category-filter');
  var addBtn = document.getElementById('add-btn');
  var modal = document.getElementById('product-modal');
  var modalTitle = document.getElementById('product-modal-title');
  var form = document.getElementById('product-form');
  var saveBtn = document.getElementById('save-btn');
  var catSelect = document.getElementById('f-categoryId');
  var imagesList = document.getElementById('images-list');
  var imageUrlInput = document.getElementById('image-url-input');
  var addImageUrlBtn = document.getElementById('add-image-url');
  var fileInput = document.getElementById('image-file');
  var uploadStatus = document.getElementById('upload-status');
  var imagesError = form.querySelector('[data-images-error]');

  var page = 1;
  var reqId = 0;
  var editingId = null;
  var images = [];
  var rowsById = {};

  /* ---------- list ---------- */
  async function load(p) {
    page = p || 1;
    var my = ++reqId;
    C.tableLoading(body, COLS, 6);
    try {
      var res = await Api.get('/admin/products', { params: { page: page, limit: LIMIT, q: searchInput.value.trim(), status: statusFilter.value, category: categoryFilter.value } });
      if (my !== reqId) return;
      var list = res.data || [];
      rowsById = {};
      if (!list.length) {
        C.tableEmpty(body, COLS, 'لا توجد منتجات', 'جرّب تغيير البحث أو أضف منتجاً جديداً.');
      } else {
        body.removeAttribute('aria-busy');
        body.innerHTML = list.map(rowHtml).join('');
      }
      UI.renderPagination(pager, res.meta, load);
    } catch (err) {
      if (my !== reqId) return;
      C.tableError(body, COLS, err, 'retry-btn');
      var r = document.getElementById('retry-btn');
      if (r) r.addEventListener('click', function () { load(page); });
      pager.innerHTML = '';
    }
  }

  function rowHtml(p) {
    rowsById[p.id] = p;
    var img = UI.safeUrl(p.image);
    var st = STATUS[p.status] || [p.status, 'badge-info'];
    var hasSale = p.salePrice != null && Number(p.salePrice) < Number(p.price);
    var low = Number(p.stock) <= 5;
    return '<tr data-id="' + C.esc(p.id) + '">' +
      '<td><div class="cell-product">' + (img ? '<img class="table-img" src="' + C.esc(img) + '" alt="" loading="lazy">' : '<span class="table-img"></span>') +
      '<span class="name">' + C.esc(p.name) + '</span></div></td>' +
      '<td>' + C.esc(p.category ? p.category.name : '—') + '</td>' +
      '<td class="col-num price-cell">' + (hasSale ? C.esc(UI.formatPrice(p.salePrice)) + '<del>' + C.esc(UI.formatPrice(p.price)) + '</del>' : C.esc(UI.formatPrice(p.price))) + '</td>' +
      '<td class="col-num">' + C.esc(UI.formatNumber(p.stock)) + (low ? ' <span class="badge badge-low-stock">مخزون منخفض</span>' : '') + '</td>' +
      '<td><span class="badge ' + st[1] + '">' + C.esc(st[0]) + '</span></td>' +
      '<td>' + (p.isFeatured ? '<span class="badge badge-primary">مميز</span>' : '<span class="text-muted">—</span>') + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" data-action="edit" data-id="' + C.esc(p.id) + '" aria-label="تعديل ' + C.esc(p.name) + '">تعديل</button>' +
      '<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="' + C.esc(p.id) + '" aria-label="حذف ' + C.esc(p.name) + '">حذف</button>' +
      '</div></td></tr>';
  }

  /* ---------- categories ---------- */
  async function loadCategories() {
    try {
      var res = await Api.get('/admin/categories');
      var cats = res.data || [];
      var opts = cats.map(function (c) { return '<option value="' + C.esc(c.id) + '">' + C.esc(c.name) + '</option>'; }).join('');
      categoryFilter.innerHTML = '<option value="">كل الأقسام</option>' + cats.map(function (c) { return '<option value="' + C.esc(c.slug) + '">' + C.esc(c.name) + '</option>'; }).join('');
      catSelect.innerHTML = '<option value="">اختر القسم</option>' + opts;
    } catch (err) { UI.handleError(err); }
  }

  /* ---------- images manager ---------- */
  function ensurePrimary() {
    if (!images.length) return;
    var found = -1;
    images.forEach(function (im, i) { if (im.isPrimary && found === -1) found = i; else im.isPrimary = false; });
    if (found === -1) images[0].isPrimary = true;
  }

  function renderImages() {
    ensurePrimary();
    if (!images.length) { imagesList.innerHTML = '<p class="images-empty">لا توجد صور بعد. أضف رابطاً أو ارفع ملفاً.</p>'; return; }
    imagesList.innerHTML = images.map(function (im, i) {
      var src = UI.safeUrl(im.url);
      return '<div class="image-card"><div class="image-preview' + (im.isPrimary ? ' is-primary' : '') + '">' +
        (src ? '<img src="' + C.esc(src) + '" alt="' + C.esc(im.altText || 'صورة المنتج ' + (i + 1)) + '">' : '') +
        '<button type="button" class="btn btn-danger btn-sm btn-icon" data-img="remove" data-i="' + i + '" aria-label="حذف الصورة">' + UI.icon('x') + '</button></div>' +
        '<div class="image-card-controls">' +
        '<label class="image-primary-label"><input type="radio" name="primaryImage" value="' + i + '" data-img="primary" data-i="' + i + '"' + (im.isPrimary ? ' checked' : '') + '> رئيسية</label>' +
        '<span><button type="button" class="btn btn-ghost btn-sm" data-img="up" data-i="' + i + '" aria-label="تقديم"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-img="down" data-i="' + i + '" aria-label="تأخير"' + (i === images.length - 1 ? ' disabled' : '') + '>&darr;</button></span>' +
        '</div></div>';
    }).join('');
  }

  imagesList.addEventListener('click', function (e) {
    var el = e.target.closest('[data-img]');
    if (!el) return;
    var act = el.getAttribute('data-img');
    var i = Number(el.getAttribute('data-i'));
    if (act === 'remove') { images.splice(i, 1); }
    else if (act === 'up' && i > 0) { images.splice(i - 1, 0, images.splice(i, 1)[0]); }
    else if (act === 'down' && i < images.length - 1) { images.splice(i + 1, 0, images.splice(i, 1)[0]); }
    else if (act === 'primary') { images.forEach(function (im, k) { im.isPrimary = k === i; }); }
    else return;
    renderImages();
  });

  function addImage(url) {
    images.push({ url: url, altText: '', isPrimary: false });
    imagesError.textContent = '';
    renderImages();
  }

  addImageUrlBtn.addEventListener('click', function () {
    var v = imageUrlInput.value.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) { imagesError.textContent = 'أدخل رابطاً صحيحاً يبدأ بـ https://'; return; }
    addImage(v);
    imageUrlInput.value = '';
  });
  imageUrlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addImageUrlBtn.click(); }
  });

  fileInput.addEventListener('change', async function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { UI.toast('حجم الصورة يتجاوز 5MB', 'error'); fileInput.value = ''; return; }
    var fd = new FormData();
    fd.append('image', file);
    uploadStatus.textContent = 'جارٍ رفع الصورة…';
    try {
      var resp = await fetch(Api.baseUrl + '/admin/upload', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': Auth.csrfToken || '' }, body: fd });
      var json = null;
      try { json = await resp.json(); } catch (e) { json = null; }
      if (!resp.ok || !json || !json.success) {
        var msg = (json && json.message) || (resp.status === 501 ? 'رفع الصور غير مفعّل حالياً، استخدم رابط الصورة.' : 'تعذر رفع الصورة');
        UI.toast(msg, 'error');
        uploadStatus.textContent = msg;
      } else {
        addImage(json.data.url);
        uploadStatus.textContent = 'تم رفع الصورة';
      }
    } catch (err) {
      UI.toast('تعذر الاتصال بالخادم', 'error');
      uploadStatus.textContent = 'تعذر الاتصال بالخادم';
    } finally {
      fileInput.value = '';
    }
  });

  /* ---------- modal ---------- */
  function resetForm() {
    form.reset();
    UI.clearFieldErrors(form);
    imagesError.textContent = '';
    uploadStatus.textContent = 'JPEG / PNG / WebP حتى 5MB';
    imageUrlInput.value = '';
    images = [];
    renderImages();
  }

  function openCreate() {
    editingId = null;
    resetForm();
    modalTitle.textContent = 'إضافة منتج';
    form.elements.status.value = 'ACTIVE';
    UI.openModal(modal);
  }

  async function openEdit(id, btn) {
    UI.setLoading(btn, true);
    try {
      var res = await Api.get('/admin/products/' + encodeURIComponent(id));
      var p = res.data;
      editingId = id;
      resetForm();
      modalTitle.textContent = 'تعديل المنتج';
      form.elements.name.value = p.name || '';
      form.elements.description.value = p.description || '';
      form.elements.categoryId.value = p.categoryId || (p.category && p.category.id) || '';
      form.elements.price.value = p.price != null ? p.price : '';
      form.elements.salePrice.value = p.salePrice != null ? p.salePrice : '';
      form.elements.stock.value = p.stock != null ? p.stock : '';
      form.elements.status.value = p.status || 'ACTIVE';
      form.elements.isFeatured.checked = !!p.isFeatured;
      var o = p.options || {};
      form.elements.sizes.value = (o.sizes || []).join(', ');
      form.elements.colors.value = (o.colors || []).join(', ');
      images = (p.images || []).map(function (im) { return { url: im.url, altText: im.altText || '', isPrimary: !!im.isPrimary }; });
      renderImages();
      UI.openModal(modal);
    } catch (err) {
      UI.handleError(err);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  function splitList(v) {
    return String(v || '').split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function buildPayload() {
    var f = form.elements;
    var errors = [];
    var price = C.num(f.price.value);
    var sale = C.num(f.salePrice.value);
    var stock = C.num(f.stock.value);
    if (!f.name.value.trim()) errors.push({ field: 'name', message: 'اسم المنتج مطلوب' });
    if (!f.description.value.trim()) errors.push({ field: 'description', message: 'الوصف مطلوب' });
    if (!f.categoryId.value) errors.push({ field: 'categoryId', message: 'اختر القسم' });
    if (price == null || price < 0) errors.push({ field: 'price', message: 'أدخل سعراً صحيحاً' });
    if (sale != null && (price == null || sale >= price)) errors.push({ field: 'salePrice', message: 'سعر الخصم يجب أن يكون أقل من السعر' });
    if (stock == null || stock < 0 || Math.floor(stock) !== stock) errors.push({ field: 'stock', message: 'أدخل كمية صحيحة' });
    if (errors.length) { UI.showFieldErrors(form, errors); return null; }
    var sizes = splitList(f.sizes.value);
    var colors = splitList(f.colors.value);
    var options = null;
    if (sizes.length || colors.length) {
      options = {};
      if (sizes.length) options.sizes = sizes;
      if (colors.length) options.colors = colors;
    }
    ensurePrimary();
    return {
      name: f.name.value.trim(),
      description: f.description.value.trim(),
      categoryId: f.categoryId.value,
      price: price,
      salePrice: sale,
      stock: stock,
      status: f.status.value,
      isFeatured: f.isFeatured.checked,
      options: options,
      images: images.map(function (im) {
        var o = { url: im.url, isPrimary: !!im.isPrimary };
        if (im.altText) o.altText = im.altText;
        return o;
      })
    };
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    UI.clearFieldErrors(form);
    imagesError.textContent = '';
    var payload = buildPayload();
    if (!payload) return;
    UI.setLoading(saveBtn, true, 'جارٍ الحفظ…');
    try {
      var res = editingId ? await Api.patch('/admin/products/' + encodeURIComponent(editingId), payload) : await Api.post('/admin/products', payload);
      UI.toast(res.message || (editingId ? 'تم تحديث المنتج' : 'تمت إضافة المنتج'), 'success');
      UI.closeModal(modal);
      load(editingId ? page : 1);
    } catch (err) {
      UI.handleError(err, form);
    } finally {
      UI.setLoading(saveBtn, false);
    }
  });

  /* ---------- table actions ---------- */
  body.addEventListener('click', async function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-action') === 'edit') { openEdit(id, btn); return; }
    var p = rowsById[id];
    var ok = await UI.confirm({ title: 'حذف المنتج', message: 'هل تريد حذف "' + (p ? p.name : 'هذا المنتج') + '"؟ إن كانت له طلبات سابقة فسيتم أرشفته بدلاً من حذفه.', confirmText: 'حذف', cancelText: 'تراجع', danger: true });
    if (!ok) return;
    UI.setLoading(btn, true);
    try {
      var res = await Api.del('/admin/products/' + encodeURIComponent(id));
      UI.toast((res && res.message) || 'تم حذف المنتج', 'success');
      load(page);
    } catch (err) {
      UI.handleError(err);
      UI.setLoading(btn, false);
    }
  });

  addBtn.addEventListener('click', openCreate);
  searchInput.addEventListener('input', UI.debounce(function () { load(1); }, 350));
  statusFilter.addEventListener('change', function () { load(1); });
  categoryFilter.addEventListener('change', function () { load(1); });

  (async function init() {
    if (!(await C.start())) return;
    renderImages();
    await loadCategories();
    load(1);
  })();
})();
