// Backend URL (no slash at the end)
const API_URL = "https://savewise-backend-318c.onrender.com";

// Makes the site installable as an app (runs on every page)
(function () {
  function add(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    document.head.appendChild(el);
  }
  add('link', { rel: 'manifest', href: 'manifest.json' });
  add('link', { rel: 'apple-touch-icon', href: 'apple-touch-icon.png' });
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'SaveWise' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
