/**
 * config.js — global frontend configuration.
 * Must be loaded FIRST (before api.js).
 *
 * ############################################################################
 * #  OWNER: replace PRODUCTION_API_BASE_URL below with your real backend URL  #
 * #  after deploying the backend (e.g. on Render). It must end with "/api"    #
 * #  and have NO trailing slash. Example:                                     #
 * #      'https://my-store-backend.onrender.com/api'                          #
 * #  Until you do, every request on the live site will fail.                  #
 * ############################################################################
 */
(function () {
  'use strict';

  var PRODUCTION_API_BASE_URL = 'https://my-api-6nmg.onrender.com/api';
  var LOCAL_API_BASE_URL = 'http://localhost:5000/api';

  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';

  window.APP_CONFIG = {
    STORE_NAME: 'سوق بلس',
    API_BASE_URL: isLocal ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL,
    CURRENCY: 'ج.م',
    FREE_SHIPPING_THRESHOLD: 1000,
    /** true when the owner has not replaced the production placeholder yet (read by api.js). */
    API_IS_PLACEHOLDER: !isLocal && PRODUCTION_API_BASE_URL.indexOf('YOUR-BACKEND') !== -1
  };
})();
