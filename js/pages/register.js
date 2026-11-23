(function () {
  'use strict';

  var form = document.getElementById('register-form');
  var alertBox = document.getElementById('form-alert');
  var submitBtn = document.getElementById('submit-btn');
  var passEl = document.getElementById('password');
  var strength = document.getElementById('strength');
  var strengthText = document.getElementById('strength-text');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^\+?\d{10,15}$/;
  var HINT = '٨ أحرف على الأقل، وتحتوي على حرف ورقم.';
  var LEVELS = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'];

  function val(id) { return document.getElementById(id).value; }

  function fillIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
      el.innerHTML = UI.icon(el.getAttribute('data-icon'));
    });
  }

  function showAlert(msg) { alertBox.textContent = msg; alertBox.hidden = false; }
  function hideAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

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
    } catch (e) { /* keep link */ }
  }

  function fillGovernorates() {
    var sel = document.getElementById('governorate');
    (UI.GOVERNORATES || []).forEach(function (g) {
      var o = document.createElement('option');
      o.value = g;
      o.textContent = g;
      sel.appendChild(o);
    });
  }

  function updateStrength() {
    var p = passEl.value;
    var score = 0;
    if (p) {
      if (p.length >= 8) score++;
      if (/[A-Za-z؀-ۿ]/.test(p) && /\d/.test(p)) score++;
      if (p.length >= 12) score++;
      if (/[^A-Za-z0-9\u0600-\u06FF]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) score++;
      score = Math.max(1, Math.min(4, score));
    }
    strength.setAttribute('data-level', String(score));
    strength.style.setProperty('--s', String(score));
    strengthText.textContent = score ? 'قوة كلمة المرور: ' + LEVELS[score] : HINT;
  }

  function validate() {
    var e = [];
    function add(f, m) { e.push({ field: f, message: m }); }
    var name = val('fullName').trim();
    if (name.length < 2) add('fullName', 'الاسم يجب ألا يقل عن حرفين');
    var email = val('email').trim();
    if (!email) add('email', 'البريد الإلكتروني مطلوب');
    else if (!EMAIL_RE.test(email)) add('email', 'صيغة البريد الإلكتروني غير صحيحة');
    var phone = val('phone').replace(/[\s-]/g, '');
    if (!phone) add('phone', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(phone)) add('phone', 'رقم الهاتف غير صحيح (10 إلى 15 رقماً)');
    var pw = val('password');
    if (pw.length < 8) add('password', 'كلمة المرور يجب ألا تقل عن 8 أحرف');
    else if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) add('password', 'كلمة المرور يجب أن تحتوي على حرف ورقم');
    if (!val('confirmPassword')) add('confirmPassword', 'تأكيد كلمة المرور مطلوب');
    else if (val('confirmPassword') !== pw) add('confirmPassword', 'كلمتا المرور غير متطابقتين');
    if (!val('governorate')) add('governorate', 'اختر المحافظة');
    if (!val('city').trim()) add('city', 'المدينة مطلوبة');
    if (!val('addressLine').trim()) add('addressLine', 'العنوان بالتفصيل مطلوب');
    return e;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    hideAlert();
    UI.clearFieldErrors(form);
    var errors = validate();
    if (errors.length) { UI.showFieldErrors(form, errors); return; }
    var payload = {
      fullName: val('fullName').trim(),
      email: val('email').trim(),
      phone: val('phone').replace(/[\s-]/g, ''),
      password: val('password'),
      confirmPassword: val('confirmPassword'),
      governorate: val('governorate'),
      city: val('city').trim(),
      addressLine: val('addressLine').trim()
    };
    UI.setLoading(submitBtn, true, 'جارٍ إنشاء الحساب...');
    try {
      await Auth.register(payload);
      window.location.href = Auth.nextUrl();
    } catch (err) {
      UI.setLoading(submitBtn, false);
      var mapped = Array.isArray(err.errors) && err.errors.length;
      UI.handleError(err, form);
      if (!mapped) showAlert(err.message || 'تعذر إنشاء الحساب');
    }
  }

  async function init() {
    await window.appReady;
    if (Auth.isLoggedIn()) { window.location.replace(Auth.nextUrl()); return; }
    fillIcons();
    fillGovernorates();
    bindPasswordToggles();
    var next = UI.getParam('next');
    if (next) document.getElementById('login-link').href = 'login.html?next=' + encodeURIComponent(next);
    setupGoogle();
    passEl.addEventListener('input', updateStrength);
    form.addEventListener('submit', onSubmit);
  }
  init();
})();
