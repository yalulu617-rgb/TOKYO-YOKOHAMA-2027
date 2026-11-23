/* Illustrate the original views without changing their travel data or form state. */
(() => {
  let main = document.getElementById('main');
  if (!main) return;

  function updateSearchResult() {
    const entries = main.querySelector('#timelineEntries');
    if (!entries) return;
    let notice = main.querySelector('.trip-search-empty');
    if (!notice) {
      notice = document.createElement('p');
      notice.className = 'info-bar illustrated-empty trip-search-empty';
      notice.setAttribute('role', 'status');
      notice.textContent = '找不到符合的行程，請更換關鍵字。';
      entries.after(notice);
    }
    notice.hidden = Boolean(entries.querySelector('[data-search]:not(.hidden)'));
  }

  function decorate() {
    const day = main.querySelector('.day-tab.active')?.dataset.setday;
    const summary = main.querySelector('.day-tabs + .card');
    if (day && summary) summary.dataset.travelDay = day;
    const gallery = main.querySelector('.gallery-art')?.closest('.section');
    if (day && gallery) gallery.dataset.travelDay = day;
    main.querySelectorAll('.info-bar').forEach(bar => {
      if (bar.textContent.includes('沒有收錄實景照片')) bar.classList.add('illustrated-empty');
    });
    const progress = main.querySelector('.progress-big');
    if (progress) {
      progress.classList.toggle('all-ready', progress.querySelector('.progress-fill')?.style.width === '100%');
    }
    updateSearchResult();
  }

  decorate();
  const viewObserver = new MutationObserver(decorate);
  viewObserver.observe(main, { childList: true });
  const original = document.getElementById('original');
  if (original) {
    new MutationObserver(() => {
      viewObserver.disconnect();
      main = document.getElementById('main');
      if (main) {
        viewObserver.observe(main, { childList: true });
        decorate();
      }
    }).observe(original, { childList: true });
  }
  document.addEventListener('input', event => {
    if (main && event.target.id === 'timelineFilter') requestAnimationFrame(updateSearchResult);
  });
})();
