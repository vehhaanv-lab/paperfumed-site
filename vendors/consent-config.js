/* Paperfumed consent: orestbida/cookieconsent v3 (MIT), self-hosted.
   Two categories: Necessary (choice record only) and Analytics (Vercel Web
   Analytics, off by default, script injected only after acceptance). */
(function () {
  /* Scripts gated behind the analytics category. To gate another script
     (e.g. Google Analytics later), add one entry here; nothing loads until
     the visitor allows the analytics category. */
  var GATED_SCRIPTS = [
    {
      id: 'pf-va',
      src: '/_vercel/insights/script.js',
      before: function () { window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; }
    }
  ];
  function loadAnalytics() {
    GATED_SCRIPTS.forEach(function (g) {
      if (document.getElementById(g.id)) return;
      if (g.before) g.before();
      var s = document.createElement('script');
      s.id = g.id;
      s.defer = true;
      s.src = g.src;
      document.head.appendChild(s);
    });
  }
  function syncAnalytics() {
    if (window.CookieConsent && CookieConsent.acceptedCategory('analytics')) loadAnalytics();
  }
  function boot() {
    if (!window.CookieConsent) return;
    CookieConsent.run({
      cookie: { name: 'pf_consent', expiresAfterDays: 182 },
      guiOptions: {
        consentModal: { layout: 'box', position: 'bottom right', equalWeightButtons: true, flipButtons: false },
        preferencesModal: { layout: 'box', equalWeightButtons: true }
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: { enabled: false }
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'Cookies: your call',
              description: 'The site works either way. Allow switches on an anonymous visit counter (Vercel Web Analytics): it sets no cookies, collects no personal data and cannot identify you. No thanks means nothing is counted. Your choice is kept in one small cookie on this device and expires after about 6 months.',
              acceptAllBtn: 'Allow',
              acceptNecessaryBtn: 'No thanks',
              showPreferencesBtn: 'Settings',
              footer: '<a href="/privacy">What we store</a>'
            },
            preferencesModal: {
              title: 'Cookie settings',
              acceptAllBtn: 'Allow',
              acceptNecessaryBtn: 'No thanks',
              savePreferencesBtn: 'Save choice',
              closeIconLabel: 'Close',
              sections: [
                { title: 'Your choice', description: 'The only optional thing here is anonymous visit counting. How everything else is handled is on the <a href="/privacy">privacy page</a>.' },
                { title: 'Necessary', linkedCategory: 'necessary', description: 'One small cookie on this device (pf_consent) that remembers the choice you made here, so we do not ask again. It expires after about 6 months. Nothing else.' },
                { title: 'Anonymous counting', linkedCategory: 'analytics', description: 'Vercel Web Analytics notes which pages are read, roughly where from and on what device. It sets no cookies, collects no personal data and cannot identify you. Off unless you allow it.' }
              ]
            }
          }
        }
      },
      onConsent: syncAnalytics,
      onChange: syncAnalytics
    });
  }
  if (window.CookieConsent) boot();
  else window.addEventListener('load', boot);
})();
