/**
 * auth.js — session/auth state (cookie session + CSRF token).
 * Requires: config.js, api.js, ui.js
 *
 * Auth.init() -> Promise<user|null>     Auth.user (getter)     Auth.isLoggedIn()   Auth.isAdmin()
 * Auth.login({email,password}) / register(payload) -> Promise<user>
 * Auth.logout() -> Promise<void> (then redirects to index.html)
 * Auth.requireLogin() -> boolean        Auth.requireAdmin() -> boolean
 * Auth.onChange(cb) -> unsubscribe fn   Auth.refresh() -> Promise<user|null>
 * Auth.nextUrl() -> string              Auth.googleLoginUrl() -> string
 */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var currentUser = null;
  var csrf = null;
  var initPromise = null;
  var listeners = [];
  var expiredHandled = false;

  function root() {
    return (document.body && document.body.dataset.root) || '';
  }

  function notify() {
    listeners.slice().forEach(function (cb) {
      try { cb(currentUser); } catch (e) { if (window.console) console.error(e); }
    });
  }

  function setSession(data) {
    currentUser = (data && data.user) || null;
    csrf = data && data.csrfToken ? data.csrfToken : null;
    if (window.Api) window.Api.setCsrf(csrf);
  }

  function clearSession() {
    currentUser = null;
    csrf = null;
    if (window.Api) window.Api.setCsrf(null);
  }

  /** Current page path + query relative to the site root, e.g. "pages/cart.html?x=1". */
  function currentRelativePath() {
    var depth = (root().match(/\.\.\//g) || []).length;
    var segs = window.location.pathname.split('/').filter(function (s) { return s !== ''; });
    var rel = segs.slice(Math.max(0, segs.length - (depth + 1))).join('/');
    if (!rel) rel = 'index.html';
    return rel + (window.location.search || '');
  }

  function loginUrlWithNext() {
    return root() + 'pages/login.html?next=' + encodeURIComponent(currentRelativePath());
  }

  /** Returns a normalized safe relative path or '' if the candidate is not a same-site relative path. */
  function sanitizeNext(raw) {
    if (typeof raw !== 'string') return '';
    var p = raw.trim();
    if (!p || p.length > 500) return '';
    if (/[\\\u0000-\u001f\u007f]/.test(p)) return '';
    if (p.charAt(0) === '/') return '';
    var firstSlash = p.indexOf('/');
    var head = firstSlash === -1 ? p : p.slice(0, firstSlash);
    if (head.indexOf(':') !== -1) return '';
    // '..' must never climb above the site root
    var pathOnly = p.split(/[?#]/)[0];
    var depth = 0;
    var parts = pathOnly.split('/');
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      if (s === '' || s === '.') continue;
      if (s === '..') { depth--; if (depth < 0) return ''; } else { depth++; }
    }
    return p;
  }

  function redirect(url) {
    window.location.replace(url);
  }

  var Auth = {
    init: function () {
      if (initPromise) return initPromise;
      initPromise = window.Api.get('/auth/me').then(function (res) {
        setSession(res.data);
        return currentUser;
      }).catch(function () {
        clearSession();
        return null;
      });
      return initPromise;
    },

    get user() { return currentUser; },
    get csrfToken() { return csrf; },
    isLoggedIn: function () { return !!currentUser; },
    isAdmin: function () { return !!currentUser && currentUser.role === 'ADMIN'; },

    login: function (creds) {
      return window.Api.post('/auth/login', {
        email: creds && creds.email,
        password: creds && creds.password
      }).then(function (res) {
        setSession(res.data);
        expiredHandled = false;
        notify();
        return currentUser;
      });
    },

    register: function (payload) {
      return window.Api.post('/auth/register', payload).then(function (res) {
        setSession(res.data);
        expiredHandled = false;
        notify();
        return currentUser;
      });
    },

    logout: function () {
      return window.Api.post('/auth/logout').catch(function () { /* ignore: leave anyway */ }).then(function () {
        clearSession();
        notify();
        redirect(root() + 'index.html');
      });
    },

    /** If logged out redirects to the login page (with ?next=) and returns false. Usage: if (!Auth.requireLogin()) return; */
    requireLogin: function () {
      if (currentUser) return true;
      redirect(loginUrlWithNext());
      return false;
    },

    /** Requires an ADMIN. Logged out -> login redirect; non-admin -> toast + redirect home. Returns boolean. */
    requireAdmin: function () {
      if (!currentUser) { redirect(loginUrlWithNext()); return false; }
      if (currentUser.role !== 'ADMIN') {
        if (window.UI) window.UI.toast('ليست لديك صلاحية للوصول إلى هذه الصفحة', 'error');
        setTimeout(function () { redirect(root() + 'index.html'); }, 1200);
        return false;
      }
      return true;
    },

    onChange: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      return function () {
        var i = listeners.indexOf(cb);
        if (i !== -1) listeners.splice(i, 1);
      };
    },

    /** Re-fetches /auth/me (e.g. after editing the profile) and notifies listeners. */
    refresh: function () {
      return window.Api.get('/auth/me').then(function (res) {
        setSession(res.data);
      }).catch(function (err) {
        if (err && err.status === 401) clearSession();
      }).then(function () {
        notify();
        return currentUser;
      });
    },

    /** Validated `next` query param as an absolute-from-root target, default `{root}index.html`. */
    nextUrl: function () {
      var raw = null;
      try { raw = new URLSearchParams(window.location.search).get('next'); } catch (e) { raw = null; }
      var safe = sanitizeNext(raw);
      return root() + (safe || 'index.html');
    },

    googleLoginUrl: function () {
      return String(CFG.API_BASE_URL || '').replace(/\/+$/, '') + '/auth/google';
    }
  };

  window.addEventListener('auth:expired', function () {
    if (expiredHandled) return;
    var onAuthPage = /\/(login|register|forgot-password|reset-password)\.html$/.test(window.location.pathname);
    var wasLoggedIn = !!currentUser;
    clearSession();
    if (wasLoggedIn) notify();
    if (onAuthPage) return;
    expiredHandled = true;
    if (window.UI) window.UI.toast('انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى', 'error');
    setTimeout(function () { redirect(loginUrlWithNext()); }, 1200);
  });

  window.Auth = Auth;
})();
