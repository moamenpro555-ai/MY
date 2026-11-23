/**
 * api.js — thin fetch wrapper for the REST API.
 * Requires: config.js
 *
 * Api.get(path, {params})   -> Promise<{data, meta, message}>
 * Api.post(path, body)      Api.put(path, body)   Api.patch(path, body)
 * Api.del(path, body?)      Api.setCsrf(token)    Api.ApiError
 *
 * Failures reject with Api.ApiError {message (Arabic), status, errors:[{field,message}]}.
 * A 401 on any path other than /auth/* dispatches window event 'auth:expired'.
 */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var BASE = (CFG.API_BASE_URL || '').replace(/\/+$/, '');
  var TIMEOUT_MS = 15000;
  var csrfToken = null;

  if (CFG.API_IS_PLACEHOLDER) {
    console.error(
      '%c[CONFIG ERROR] API_BASE_URL still points to the placeholder (' + BASE + ').\n' +
      'Edit js/config.js and set PRODUCTION_API_BASE_URL to your deployed backend URL.',
      'color:#fff;background:#c0392b;font-size:14px;font-weight:bold;padding:4px 8px'
    );
  }

  class ApiError extends Error {
    /**
     * @param {string} message Arabic message
     * @param {number} status HTTP status (0 = network/timeout)
     * @param {Array<{field:string,message:string}>} [errors]
     */
    constructor(message, status, errors) {
      super(message);
      this.name = 'ApiError';
      this.status = status || 0;
      this.errors = Array.isArray(errors) ? errors : [];
    }
  }

  function buildUrl(path, params) {
    var p = String(path || '');
    if (p.charAt(0) !== '/') p = '/' + p;
    var url = BASE + p;
    if (params && typeof params === 'object') {
      var qs = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null || v === '') return;
        qs.append(k, String(v));
      });
      var s = qs.toString();
      if (s) url += (url.indexOf('?') === -1 ? '?' : '&') + s;
    }
    return url;
  }

  function isAuthPath(path) {
    return /^\/?auth(\/|\?|$)/.test(String(path || ''));
  }

  async function request(method, path, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; controller.abort(); }, TIMEOUT_MS);

    var headers = { Accept: 'application/json' };
    var init = { method: method, credentials: 'include', headers: headers, signal: controller.signal };

    if (opts.body !== undefined && opts.body !== null && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

    var res;
    try {
      res = await fetch(buildUrl(path, opts.params), init);
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) throw new ApiError('انتهت مهلة الاتصال بالخادم، حاول مرة أخرى', 0);
      throw new ApiError('تعذر الاتصال بالخادم، تحقق من الإنترنت', 0);
    }
    clearTimeout(timer);

    if (res.status === 204) return { data: null, meta: undefined, message: undefined };

    var payload = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) {
      try { payload = await res.json(); } catch (e) { payload = null; }
    }

    if (!res.ok || (payload && payload.success === false)) {
      if (res.status === 401 && !isAuthPath(path)) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      var msg = (payload && payload.message) ||
        (res.status === 401 ? 'يجب تسجيل الدخول أولاً' :
         res.status === 403 ? 'ليست لديك صلاحية لهذا الإجراء' :
         res.status === 404 ? 'المطلوب غير موجود' :
         res.status === 429 ? 'محاولات كثيرة، حاول لاحقاً' :
         res.status >= 500 ? 'حدث خطأ في الخادم، حاول لاحقاً' : 'حدث خطأ غير متوقع');
      throw new ApiError(msg, res.status, payload && payload.errors);
    }

    if (!payload) {
      // Successful but not JSON (e.g. HTML error page from a proxy)
      throw new ApiError('استجابة غير صالحة من الخادم', res.status);
    }
    return { data: payload.data, meta: payload.meta, message: payload.message };
  }

  window.Api = {
    ApiError: ApiError,
    get: function (path, opts) { return request('GET', path, { params: opts && opts.params }); },
    post: function (path, body) { return request('POST', path, { body: body === undefined ? {} : body }); },
    put: function (path, body) { return request('PUT', path, { body: body === undefined ? {} : body }); },
    patch: function (path, body) { return request('PATCH', path, { body: body === undefined ? {} : body }); },
    del: function (path, body) { return request('DELETE', path, { body: body }); },
    setCsrf: function (token) { csrfToken = token || null; },
    baseUrl: BASE
  };
})();
