/**
 * admin/common.js — small helpers shared by the admin pages (no shared files are modified).
 * Load after layout.js and before the page script.
 */
(function () {
  'use strict';

  var NAV_ICONS = { dashboard: 'home', products: 'package', orders: 'truck', customers: 'user', categories: 'tag', coupons: 'star', reports: 'refresh' };

  function initNav() {
    var links = document.querySelectorAll('.admin-nav a[data-nav]');
    Array.prototype.forEach.call(links, function (a) {
      if (a.querySelector('.icon')) return;
      a.insertAdjacentHTML('afterbegin', UI.icon(NAV_ICONS[a.getAttribute('data-nav')] || 'box'));
    });
    var closers = document.querySelectorAll('.modal-close');
    Array.prototype.forEach.call(closers, function (b) { if (!b.innerHTML.trim()) b.innerHTML = UI.icon('close'); });
  }

  /** Waits for the app, guards admin access, builds nav. Resolves true when the page may continue. */
  async function start() {
    await window.appReady;
    if (!Auth.requireAdmin()) return false;
    initNav();
    return true;
  }

  function esc(v) { return UI.escapeHtml(v == null ? '' : v); }

  function tableLoading(tbody, cols, rows) {
    var html = '';
    for (var i = 0; i < (rows || 5); i++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) html += '<td><div class="skeleton skeleton-line"></div></td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
    tbody.setAttribute('aria-busy', 'true');
  }

  function tableMessage(tbody, cols, html) {
    tbody.removeAttribute('aria-busy');
    tbody.innerHTML = '<tr><td colspan="' + cols + '" class="admin-table-message">' + html + '</td></tr>';
  }

  function tableEmpty(tbody, cols, title, text) {
    tableMessage(tbody, cols, UI.emptyState({ icon: 'box', title: title, text: text }));
  }

  function tableError(tbody, cols, err, retryId) {
    tableMessage(tbody, cols, '<div class="alert alert-danger">' + esc(err && err.message ? err.message : 'حدث خطأ غير متوقع') + '</div>' +
      (retryId ? '<button type="button" class="btn btn-outline btn-sm" id="' + retryId + '">إعادة المحاولة</button>' : ''));
  }

  function num(v) {
    if (v === '' || v == null) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /** ISO string -> value for <input type="datetime-local"> in local time. */
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /** datetime-local value -> ISO string (or null). */
  function fromLocalInput(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  window.AdminCommon = {
    start: start, esc: esc, num: num, ymd: ymd,
    tableLoading: tableLoading, tableMessage: tableMessage, tableEmpty: tableEmpty, tableError: tableError,
    toLocalInput: toLocalInput, fromLocalInput: fromLocalInput
  };
})();
