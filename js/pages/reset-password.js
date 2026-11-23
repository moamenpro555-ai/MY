(function () {
  'use strict';

  var form = document.getElementById('reset-form');
  var alertBox = document.getElementById('form-alert');
  var submitBtn = document.getElementById('submit-btn');
  var missing = document.getElementById('missing-token');
  var successBox = document.getElementById('success-box');
  var token = '';

  function val(id) { return document.getElementById(id).value; }

  function fillIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
      el.innerHTML = UI.icon(el.getAttribute('data-icon'));
    });
  }

  function bindPasswordToggles() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-toggle-password]'), function (btn) {
      var input = document.getElementById(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'إخفاء' : 'إظهار';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      });
    });
  }

  function validate() {
    var e = [];
    var pw = val('password');
    if (pw.length < 8) e.push({ field: 'password', message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
    else if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) e.push({ field: 'password', message: 'كلمة المرور يجب أن تحتوي على حرف ورقم' });
    if (!val('confirmPassword')) e.push({ field: 'confirmPassword', message: 'تأكيد كلمة المرور مطلوب' });
    else if (val('confirmPassword') !== pw) e.push({ field: 'confirmPassword', message: 'كلمتا المرور غير متطابقتين' });
    return e;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    alertBox.hidden = true;
    UI.clearFieldErrors(form);
    var errors = validate();
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    UI.setLoading(submitBtn, true, 'جارٍ الحفظ...');
    try {
      await Api.post('/auth/reset-password', {
        token: token,
        password: val('password'),
        confirmPassword: val('confirmPassword')
      });
      form.hidden = true;
      successBox.hidden = false;
    } catch (err) {
      UI.setLoading(submitBtn, false);
      UI.handleError(err, form);
      if (!(Array.isArray(err.errors) && err.errors.length)) {
        alertBox.textContent = err.message || 'حدث خطأ غير متوقع';
        alertBox.hidden = false;
      }
    }
  }

  async function init() {
    await window.appReady;
    fillIcons();
    token = (UI.getParam('token') || '').trim();
    if (!token) {
      form.hidden = true;
      missing.hidden = false;
      return;
    }
    bindPasswordToggles();
    form.addEventListener('submit', onSubmit);
  }
  init();
})();
