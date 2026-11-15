// The viewer and its host are served from the same site.
const reportHeight = () => {
  const main = document.querySelector('main.presentation');
  if (main) parent.postMessage({ presentationHeight: Math.ceil(main.getBoundingClientRect().bottom + 16) }, location.origin);
};
window.addEventListener('load', () => {
  new ResizeObserver(reportHeight).observe(document.querySelector('main.presentation'));
  reportHeight();
});
const reportLocation = () => parent.postMessage({ presentationLocation: location.search + location.hash }, location.origin);
window.addEventListener('load', reportLocation);
window.addEventListener('hashchange', reportLocation);
