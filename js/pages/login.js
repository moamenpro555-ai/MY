(function () {
  'use strict';

  var form = document.getElementById('login-form');
  var alertBox = document.getElementById('form-alert');
  var submitBtn = document.getElementById('submit-btn');
  var emailEl = document.getElementById('email');
  var passEl = document.getElementById('password');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fillIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
      el.innerHTML = UI.icon(el.getAttribute('data-icon'));
    });
  }

  function showAlert(msg) {
    alertBox.textContent = msg;
    alertBox.hidden = false;
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = '';
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

  async function setupGoogle() {
    var link = document.getElementById('google-btn');
    link.href = Auth.googleLoginUrl();
    try {
      var res = await Api.get('/auth/config');
      if (res.data && res.data.googleEnabled === false) {
        link.hidden = true;
        document.querySelector('.google-or').hidden = true;
        document.getElementById('google-note').hidden = false;
      }
    } catch (e) { /* keep the link; server answers 503 if unavailable */ }
  }

  function validate() {
    var errors = [];
    var email = emailEl.value.trim();
    if (!email) errors.push({ field: 'email', message: 'البريد الإلكتروني مطلوب' });
    else if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'صيغة البريد الإلكتروني غير صحيحة' });
    if (!passEl.value) errors.push({ field: 'password', message: 'كلمة المرور مطلوبة' });
    return errors;
  }

  async function onSubmit(e) {
    e.preventDefault();
    hideAlert();
    UI.clearFieldErrors(form);
    var errors = validate();
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    UI.setLoading(submitBtn, true, 'جارٍ تسجيل الدخول...');
    try {
      await Auth.login({ email: emailEl.value.trim(), password: passEl.value });
      window.location.href = Auth.nextUrl();
    } catch (err) {
      UI.setLoading(submitBtn, false);
      var mapped = Array.isArray(err.errors) && err.errors.length;
      UI.handleError(err, form);
      if (!mapped) showAlert(err.message || 'تعذر تسجيل الدخول');
    }
  }

  async function init() {
    await window.appReady;
    if (Auth.isLoggedIn()) { window.location.replace(Auth.nextUrl()); return; }
    fillIcons();
    bindPasswordToggles();
    if (UI.getParam('error') === 'google') {
      showAlert('تعذر تسجيل الدخول عبر Google. حاول مرة أخرى أو استخدم بريدك الإلكتروني.');
    }
    var next = UI.getParam('next');
    if (next) {
      var reg = document.getElementById('register-link');
      reg.href = 'register.html?next=' + encodeURIComponent(next);
    }
    setupGoogle();
    form.addEventListener('submit', onSubmit);
  }
  init();
})();
