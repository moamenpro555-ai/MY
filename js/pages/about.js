(function () {
  'use strict';

  // Decorative icons for the value cards (inline SVG from the shared icon set).
  [['ic-shield', 'shield'], ['ic-truck', 'truck'], ['ic-tag', 'tag']].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el) el.innerHTML = UI.icon(pair[1]);
  });
})();
