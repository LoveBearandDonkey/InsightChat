/* visual-upgrade.html supplies only the independent presentation layer. */
(function () {
  if (window.parent === window) {
    const product = new URL('chat.html', location.href);
    product.search = location.search;
    product.searchParams.set('visual-upgrade', '1');
    location.replace(product.href);
    return;
  }
  window.parent.postMessage({
    type: 'msi:visual-upgrade-layer',
    markup: document.querySelector('.vu-stage').outerHTML,
  }, '*');
})();
