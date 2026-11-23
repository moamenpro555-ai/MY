(function () {
  'use strict';

  var MAX_QTY = 20;
  var area = document.getElementById('product-area');
  var crumbs = document.getElementById('breadcrumbs');
  var reviewsSection = document.getElementById('reviews-section');
  var summaryBox = document.getElementById('reviews-summary');
  var formWrap = document.getElementById('review-form-wrap');
  var reviewsList = document.getElementById('reviews-list');
  var reviewsPager = document.getElementById('reviews-pager');
  var similarSection = document.getElementById('similar-section');
  var similarGrid = document.getElementById('similar-grid');

  var product = null;
  var sel = { size: '', color: '', qty: 1 };
  var reviewPage = 1;
  var ratingValue = 0;

  var esc = UI.escapeHtml;

  function errorState(title, text, retry) {
    return UI.emptyState({
      icon: 'box', title: title, text: text,
      actionHtml: (retry ? '<button type="button" class="btn btn-outline" data-pd-retry>إعادة المحاولة</button> ' : '') +
        '<a class="btn btn-primary" href="products.html">تصفح المنتجات</a>'
    });
  }

  /* ---------- breadcrumbs ---------- */
  function renderCrumbs(p) {
    var html = '<li><a href="../index.html">الرئيسية</a></li><li><a href="products.html">المنتجات</a></li>';
    if (p.category && p.category.slug) {
      html += '<li><a href="products.html?category=' + encodeURIComponent(p.category.slug) + '">' + esc(p.category.name) + '</a></li>';
    }
    html += '<li aria-current="page">' + esc(p.name) + '</li>';
    crumbs.innerHTML = html;
  }

  /* ---------- product render ---------- */
  function optionList(p, key) {
    var o = p.options;
    return o && Array.isArray(o[key]) ? o[key].filter(function (v) { return v !== null && v !== '' && v !== undefined; }) : [];
  }

  function maxQty(p) {
    return Math.max(1, Math.min(Number(p.stock) || 0, MAX_QTY));
  }

  function optionHTML(label, key, values) {
    if (!values.length) return '';
    return '<div class="pd-option" data-option-group="' + key + '"><span class="pd-option-label" id="opt-' + key + '-label">' + esc(label) +
      ' <span class="pd-option-chosen" data-chosen="' + key + '">(اختر)</span></span>' +
      '<div class="pd-option-list" role="group" aria-labelledby="opt-' + key + '-label">' +
      values.map(function (v) {
        return '<button type="button" class="option-btn" data-opt="' + key + '" data-value="' + esc(v) + '" aria-pressed="false">' + esc(v) + '</button>';
      }).join('') + '</div></div>';
  }

  function render(p) {
    var inStock = p.inStock !== false && Number(p.stock) > 0;
    var low = inStock && Number(p.stock) <= 5;
    var eff = p.effectivePrice != null ? p.effectivePrice : (p.salePrice != null ? p.salePrice : p.price);
    var hasDiscount = p.price != null && Number(eff) < Number(p.price);
    var images = (p.images || []).filter(function (i) { return i && UI.safeUrl(i.url); });
    if (!images.length && UI.safeUrl(p.image)) images = [{ url: p.image, altText: p.name }];
    images.sort(function (a, b) { return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0); });
    var sizes = optionList(p, 'sizes');
    var colors = optionList(p, 'colors');
    var isFav = Layout.isFav(p.id);

    var h = '<div class="pd-layout">';
    // gallery
    h += '<div class="pd-gallery"><div class="pd-main-img" id="pd-main">';
    if (images.length) h += '<img id="pd-main-img" src="' + esc(UI.safeUrl(images[0].url)) + '" alt="' + esc(images[0].altText || p.name) + '" decoding="async">';
    else h += UI.icon('package');
    if (hasDiscount && p.discountPercent) h += '<span class="badge badge-discount">-' + esc(UI.formatNumber(p.discountPercent)) + '%</span>';
    h += '</div>';
    if (images.length > 1) {
      h += '<div class="pd-thumbs" role="group" aria-label="صور المنتج">';
      images.forEach(function (im, i) {
        h += '<button type="button" class="pd-thumb' + (i === 0 ? ' is-active' : '') + '" data-thumb="' + i + '" aria-label="عرض الصورة ' + esc(UI.formatNumber(i + 1)) + '" aria-pressed="' + (i === 0) + '">' +
          '<img src="' + esc(UI.safeUrl(im.url)) + '" alt="" loading="lazy"></button>';
      });
      h += '</div>';
    }
    h += '</div>';

    // info
    h += '<div class="pd-info">';
    if (p.category && p.category.name) h += '<span class="pd-cat">' + esc(p.category.name) + '</span>';
    h += '<h1 class="pd-title">' + esc(p.name) + '</h1>';
    h += '<div class="pd-rating" id="pd-rating">' + ratingHTML(p.ratingAvg, p.ratingCount) + '</div>';
    h += '<div class="pd-price"><span class="price-current">' + esc(UI.formatPrice(eff)) + '</span>';
    if (hasDiscount) {
      h += '<del class="price-old">' + esc(UI.formatPrice(p.price)) + '</del>';
      h += '<span class="pd-save">وفّر ' + esc(UI.formatPrice(Number(p.price) - Number(eff))) + (p.discountPercent ? ' (' + esc(UI.formatNumber(p.discountPercent)) + '%)' : '') + '</span>';
    }
    h += '</div>';
    h += '<div><span class="pd-stock ' + (!inStock ? 'is-out' : low ? 'is-low' : 'is-in') + '">' +
      (!inStock ? 'غير متوفر' : low ? 'كمية محدودة (متبقي ' + esc(UI.formatNumber(p.stock)) + ')' : 'متوفر') + '</span></div>';
    h += optionHTML('المقاس', 'size', sizes) + optionHTML('اللون', 'color', colors);

    h += '<div class="pd-buy">';
    if (inStock) {
      var max = maxQty(p);
      h += '<div class="flex items-center gap-2"><label class="pd-qty-label" for="pd-qty">الكمية</label>' +
        '<div class="quantity-control"><button type="button" id="qty-minus" aria-label="إنقاص الكمية">' + UI.icon('minus') + '</button>' +
        '<input type="number" id="pd-qty" value="1" min="1" max="' + max + '" inputmode="numeric">' +
        '<button type="button" id="qty-plus" aria-label="زيادة الكمية">' + UI.icon('plus') + '</button></div></div>';
    }
    h += '<button type="button" class="btn btn-primary btn-lg" id="pd-add" data-action="add-to-cart" data-id="' + esc(p.id) + '" data-qty="1"' + (inStock ? '' : ' disabled') + '>' +
      UI.icon('cart') + '<span>' + (inStock ? 'أضف إلى السلة' : 'غير متوفر') + '</span></button>';
    h += '<button type="button" class="btn btn-outline btn-lg btn-icon' + (isFav ? ' is-fav is-active' : '') + '" data-action="toggle-fav" data-id="' + esc(p.id) + '" aria-pressed="' + isFav +
      '" aria-label="' + (isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة') + '">' + UI.icon(isFav ? 'heart-fill' : 'heart') + '</button>';
    h += '</div>';

    h += '<div class="pd-perks"><div class="pd-perk">' + UI.icon('truck') + '<span>شحن لكل المحافظات</span></div>' +
      '<div class="pd-perk">' + UI.icon('shield') + '<span>الدفع عند الاستلام</span></div>' +
      '<div class="pd-perk">' + UI.icon('refresh') + '<span>سياسة استرجاع واضحة</span></div></div>';

    if (p.description) h += '<div class="pd-desc"><h2>وصف المنتج</h2><p>' + esc(p.description) + '</p></div>';
    h += '</div></div>';

    area.innerHTML = h;
    area._images = images;
  }

  function ratingHTML(avg, count) {
    var c = Number(count) || 0;
    if (!c) return UI.stars(0) + '<span>لا توجد تقييمات بعد</span>';
    return UI.stars(avg) + '<strong>' + esc(UI.formatNumber(Math.round(Number(avg) * 10) / 10)) + '</strong>' +
      '<a href="#reviews-section">(' + esc(UI.formatNumber(c)) + ' تقييم)</a>';
  }

  /* ---------- interactions ---------- */
  function addBtn() { return document.getElementById('pd-add'); }

  function syncAttrs() {
    var b = addBtn();
    if (!b) return;
    b.dataset.qty = String(sel.qty);
    if (sel.size) b.dataset.size = sel.size; else delete b.dataset.size;
    if (sel.color) b.dataset.color = sel.color; else delete b.dataset.color;
  }

  function setQty(n) {
    var input = document.getElementById('pd-qty');
    if (!input || !product) return;
    var max = maxQty(product);
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 1) n = 1;
    if (n > max) { n = max; if (Number(product.stock) > MAX_QTY || Number(product.stock) === max) UI.toast('أقصى كمية متاحة للطلب هي ' + UI.formatNumber(max), 'info'); }
    sel.qty = n;
    input.value = String(n);
    document.getElementById('qty-minus').disabled = n <= 1;
    document.getElementById('qty-plus').disabled = n >= max;
    syncAttrs();
  }

  function missingSelection() {
    if (!product) return '';
    if (optionList(product, 'sizes').length && !sel.size) return 'من فضلك اختر المقاس أولاً';
    if (optionList(product, 'colors').length && !sel.color) return 'من فضلك اختر اللون أولاً';
    return '';
  }

  function onAreaClick(e) {
    var t = e.target;
    var thumb = t.closest('[data-thumb]');
    if (thumb) {
      var im = area._images[Number(thumb.dataset.thumb)];
      var main = document.getElementById('pd-main-img');
      if (im && main) { main.src = UI.safeUrl(im.url); main.alt = im.altText || product.name; }
      Array.prototype.forEach.call(area.querySelectorAll('[data-thumb]'), function (b) {
        var on = b === thumb;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      return;
    }
    var opt = t.closest('[data-opt]');
    if (opt) {
      var key = opt.dataset.opt;
      var same = sel[key] === opt.dataset.value;
      sel[key] = same ? '' : opt.dataset.value;
      Array.prototype.forEach.call(area.querySelectorAll('[data-opt="' + key + '"]'), function (b) {
        var on = !!sel[key] && b.dataset.value === sel[key];
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var chosen = area.querySelector('[data-chosen="' + key + '"]');
      if (chosen) chosen.textContent = sel[key] ? '(' + sel[key] + ')' : '(اختر)';
      syncAttrs();
      return;
    }
    if (t.closest('#qty-minus')) { setQty(sel.qty - 1); return; }
    if (t.closest('#qty-plus')) { setQty(sel.qty + 1); return; }
    if (t.closest('[data-pd-retry]')) { load(); }
  }

  function bindAddGuard() {
    var b = addBtn();
    if (!b) return;
    // capturing listener: runs before layout.js' delegated handler on document
    b.addEventListener('click', function (e) {
      var msg = missingSelection();
      if (msg) {
        e.preventDefault();
        e.stopImmediatePropagation();
        UI.toast(msg, 'error');
        var grp = area.querySelector('.pd-option:not(:has(.is-active))');
        if (grp) { var first = grp.querySelector('.option-btn'); if (first) first.focus(); }
        return;
      }
      syncAttrs();
    }, true);
    var input = document.getElementById('pd-qty');
    if (input) {
      input.addEventListener('change', function () { setQty(input.value); });
      setQty(1);
    }
  }

  /* ---------- load product ---------- */
  async function load() {
    var id = UI.getParam('id');
    if (!id) {
      crumbs.lastElementChild.textContent = 'منتج غير موجود';
      area.innerHTML = errorState('المنتج غير موجود', 'الرابط غير صحيح أو ناقص.');
      return;
    }
    area.innerHTML = '<div class="pd-layout" aria-hidden="true"><div class="skeleton pd-skeleton-img"></div><div class="pd-skeleton-info"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-btn"></div></div></div>';
    try {
      var res = await Api.get('/products/' + encodeURIComponent(id));
      product = res.data;
      sel = { size: '', color: '', qty: 1 };
      document.title = product.name + ' | سوق بلس';
      renderCrumbs(product);
      render(product);
      bindAddGuard();
      renderSimilar(product.similar || []);
      reviewsSection.hidden = false;
      reviewPage = 1;
      renderReviewForm();
      loadReviews(1);
    } catch (err) {
      product = null;
      reviewsSection.hidden = true;
      similarSection.hidden = true;
      if (err && err.status === 404) {
        crumbs.lastElementChild.textContent = 'منتج غير موجود';
        area.innerHTML = errorState('المنتج غير موجود', 'ربما تم حذفه أو تغيّر رابطه.');
      } else {
        area.innerHTML = errorState('تعذر تحميل المنتج', (err && err.message) || 'حدث خطأ غير متوقع.', true);
      }
    }
  }

  function renderSimilar(list) {
    if (!list.length) { similarSection.hidden = true; return; }
    similarSection.hidden = false;
    similarGrid.innerHTML = list.map(function (p) { return UI.productCardHTML(p, { favIds: Layout.favIds }); }).join('');
  }

  /* ---------- reviews ---------- */
  function renderSummary(avg, count) {
    var c = Number(count) || 0;
    if (!c) {
      summaryBox.innerHTML = '<p class="text-muted mb-0">لا توجد تقييمات لهذا المنتج بعد. كن أول من يقيّمه!</p>';
      return;
    }
    var a = Math.round(Number(avg) * 10) / 10;
    summaryBox.innerHTML = '<div class="pd-rating-big"><span class="pd-rating-num">' + esc(UI.formatNumber(a)) + '</span><div>' +
      UI.stars(avg) + '<div class="text-muted text-sm">من ' + esc(UI.formatNumber(c)) + ' تقييم</div></div></div>';
  }

  function updateProductRating(avg, count) {
    if (!product) return;
    product.ratingAvg = avg;
    product.ratingCount = count;
    var box = document.getElementById('pd-rating');
    if (box) box.innerHTML = ratingHTML(avg, count);
    renderSummary(avg, count);
  }

  function reviewHTML(r) {
    var name = (r.user && r.user.fullName) || 'عميل';
    var avatar = r.user && UI.safeUrl(r.user.avatarUrl);
    var av = avatar
      ? '<img class="avatar" src="' + esc(avatar) + '" alt="" loading="lazy">'
      : '<span class="avatar" aria-hidden="true">' + esc(name.trim().charAt(0)) + '</span>';
    return '<article class="pd-review' + (r.isMine ? ' is-mine' : '') + '"><div class="pd-review-head">' + av +
      '<div class="pd-review-user"><div class="pd-review-name"><span>' + esc(name) + '</span>' + (r.isMine ? '<span class="badge badge-primary">تقييمك</span>' : '') + '</div>' +
      '<div class="pd-review-date">' + esc(UI.formatDate(r.createdAt)) + '</div></div>' + UI.stars(r.rating) +
      (r.isMine ? '<button type="button" class="btn btn-ghost btn-sm text-danger" data-del-review="' + esc(r.id) + '" aria-label="حذف تقييمك">' + UI.icon('trash') + '<span>حذف</span></button>' : '') +
      '</div>' + (r.comment ? '<p class="pd-review-comment">' + esc(r.comment) + '</p>' : '') + '</article>';
  }

  async function loadReviews(page) {
    if (!product) return;
    reviewPage = page;
    reviewsList.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short"></div>';
    try {
      var res = await Api.get('/reviews/product/' + encodeURIComponent(product.id), { params: { page: page } });
      var list = res.data || [];
      var meta = res.meta || {};
      if (meta.ratingAvg != null && meta.ratingCount != null) updateProductRating(meta.ratingAvg, meta.ratingCount);
      else renderSummary(product.ratingAvg, product.ratingCount);
      var mine = null;
      list.forEach(function (r) { if (r.isMine) mine = r; });
      if (mine && page === 1) { ratingValue = mine.rating; renderReviewForm(mine); }
      if (!list.length) {
        reviewsList.innerHTML = UI.emptyState({ icon: 'star', title: 'لا توجد تقييمات بعد', text: 'شارك رأيك ليساعد المتسوقين الآخرين.' });
      } else {
        reviewsList.innerHTML = list.map(reviewHTML).join('');
      }
      UI.renderPagination(reviewsPager, meta, function (p) {
        loadReviews(p);
        reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      renderSummary(product.ratingAvg, product.ratingCount);
      reviewsList.innerHTML = '<div class="alert alert-danger" role="alert">' + esc(err.message || 'تعذر تحميل التقييمات') +
        ' <button type="button" class="btn btn-sm btn-outline" data-reviews-retry>إعادة المحاولة</button></div>';
    }
  }

  function renderReviewForm(mine) {
    if (!Auth.isLoggedIn()) {
      var next = 'pages/product-details.html' + window.location.search;
      formWrap.innerHTML = '<h3 class="pd-review-form-title">قيّم هذا المنتج</h3><p class="text-muted text-sm">سجّل الدخول لتتمكن من إضافة تقييمك.</p>' +
        '<a class="btn btn-primary btn-block" href="login.html?next=' + encodeURIComponent(next) + '">تسجيل الدخول</a>';
      return;
    }
    // keep typed state if form is already present and no saved review is given
    if (!mine && formWrap.querySelector('#review-form')) return;
    ratingValue = mine ? mine.rating : 0;
    var h = '<h3 class="pd-review-form-title">' + (mine ? 'تعديل تقييمك' : 'قيّم هذا المنتج') + '</h3>' +
      '<form id="review-form" novalidate><fieldset class="star-picker"><legend>تقييمك <span class="required-mark">*</span></legend><div class="star-picker-row">';
    for (var i = 1; i <= 5; i++) {
      h += '<input type="radio" name="rating" id="rate-' + i + '" value="' + i + '"' + (mine && mine.rating === i ? ' checked' : '') + '>' +
        '<label for="rate-' + i + '" data-star="' + i + '"><span class="sr-only">' + i + ' من 5</span>' + UI.icon('star') + '</label>';
    }
    h += '</div><div class="field-error" id="rating-error" aria-live="polite"></div></fieldset>' +
      '<div class="form-group"><label class="form-label" for="review-comment">تعليقك (اختياري)</label>' +
      '<textarea class="form-control" id="review-comment" name="comment" rows="4" maxlength="1000" placeholder="اكتب رأيك في المنتج"></textarea>' +
      '<div class="field-error"></div></div>' +
      '<button type="submit" class="btn btn-primary btn-block" id="review-submit">' + (mine ? 'تحديث التقييم' : 'إرسال التقييم') + '</button></form>';
    formWrap.innerHTML = h;
    var ta = document.getElementById('review-comment');
    if (mine && mine.comment) ta.value = mine.comment;
    paintStars();
  }

  function paintStars() {
    Array.prototype.forEach.call(formWrap.querySelectorAll('[data-star]'), function (l) {
      l.classList.toggle('is-on', Number(l.dataset.star) <= ratingValue);
    });
  }

  async function onReviewSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var err = document.getElementById('rating-error');
    UI.clearFieldErrors(form);
    err.textContent = '';
    if (!ratingValue) { err.textContent = 'اختر عدد النجوم'; return; }
    var btn = document.getElementById('review-submit');
    UI.setLoading(btn, true, 'جارٍ الإرسال...');
    try {
      await Api.post('/reviews', { productId: product.id, rating: ratingValue, comment: document.getElementById('review-comment').value.trim() || undefined });
      UI.toast('تم حفظ تقييمك، شكراً لك', 'success');
      await loadReviews(1);
      try { var fresh = await Api.get('/products/' + encodeURIComponent(product.id)); updateProductRating(fresh.data.ratingAvg, fresh.data.ratingCount); } catch (e2) { /* summary already updated from reviews meta */ }
    } catch (ex) {
      UI.handleError(ex, form);
    } finally {
      UI.setLoading(btn, false);
    }
  }

  async function deleteReview(id, btn) {
    var ok = await UI.confirm({ title: 'حذف التقييم', message: 'هل تريد حذف تقييمك لهذا المنتج؟', confirmText: 'حذف', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    UI.setLoading(btn, true);
    try {
      await Api.del('/reviews/' + encodeURIComponent(id));
      UI.toast('تم حذف التقييم', 'success');
      formWrap.innerHTML = '';
      ratingValue = 0;
      renderReviewForm();
      await loadReviews(1);
    } catch (ex) {
      UI.setLoading(btn, false);
      UI.handleError(ex);
    }
  }

  function bindReviews() {
    formWrap.addEventListener('change', function (e) {
      if (e.target.name === 'rating') {
        ratingValue = Number(e.target.value);
        document.getElementById('rating-error').textContent = '';
        paintStars();
      }
    });
    formWrap.addEventListener('submit', function (e) { if (e.target.id === 'review-form') onReviewSubmit(e); });
    reviewsList.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del-review]');
      if (d) { deleteReview(d.dataset.delReview, d); return; }
      if (e.target.closest('[data-reviews-retry]')) loadReviews(reviewPage);
    });
  }

  async function init() {
    await window.appReady;
    area.addEventListener('click', onAreaClick);
    bindReviews();
    Auth.onChange(function () { if (product) { formWrap.innerHTML = ''; renderReviewForm(); loadReviews(reviewPage); } });
    load();
  }

  init();
})();
