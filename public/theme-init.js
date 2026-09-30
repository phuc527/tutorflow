// Runs before React: paint the cached theme immediately so dark-mode users never see a white flash.
// Kept as a file (not inline) because the Content-Security-Policy only allows scripts from 'self'.
// Mirrors THEME_STORAGE_KEY / resolveTheme in src/features/theme/theme.js.
;(function () {
  var preference = 'system'
  try {
    preference = localStorage.getItem('tutorflow-theme') || 'system'
  } catch {
    /* storage blocked: fall back to the system setting */
  }
  var dark = preference === 'dark' || (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
})()
