(function () {
  var version = Date.now();

  function withVersion(path) {
    return path + (path.indexOf('?') === -1 ? '?' : '&') + 'v=' + version;
  }

  document.querySelectorAll('link[data-cache-bust="true"]').forEach(function (el) {
    var href = el.getAttribute('href');
    if (href) {
      el.setAttribute('href', withVersion(href));
    }
  });

  document.querySelectorAll('script[data-cache-bust="true"]').forEach(function (el) {
    var src = el.getAttribute('src');
    if (!src) {
      return;
    }

    var replacement = document.createElement('script');
    replacement.src = withVersion(src);
    replacement.defer = true;
    if (el.dataset.role) {
      replacement.dataset.role = el.dataset.role;
    }

    el.parentNode.replaceChild(replacement, el);
  });
})();
