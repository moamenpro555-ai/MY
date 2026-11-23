(function () {
  'use strict';

  var form = document.getElementById('forgot-form');
  var alertBox = document.getElementById('form-alert');
  var submitBtn = document.getElementById('submit-btn');
  var emailEl = document.getElementById('email');
  var successBox = document.getElementById('success-box');
  var successMsg = document.getElementById('success-msg');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fillIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
      el.innerHTML = UI.icon(el.getAttribute('data-icon'));
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    alertBox.hidden = true;
    UI.clearFieldErrors(form);
    var email = emailEl.value.trim();
    if (!email) { UI.showFieldErrors(form, [{ field: 'email', message: 'البريد الإلكتروني مطلوب' }]); return; }
    if (!EMAIL_RE.test(email)) { UI.showFieldErrors(form, [{ field: 'email', message: 'صيغة البريد الإلكتروني غير صحيحة' }]); return; }
    UI.setLoading(submitBtn, true, 'جارٍ الإرسال...');
    try {
      var res = await Api.post('/auth/forgot-password', { email: email });
      successMsg.textContent = (res && res.message) || 'إذا كان البريد مسجلاً لدينا فسيصلك رابط إعادة تعيين كلمة المرور.';
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
    form.addEventListener('submit', onSubmit);
  }
  init();
})();
