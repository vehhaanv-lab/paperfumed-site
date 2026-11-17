/* Paperfumed consent: orestbida/cookieconsent v3 (MIT), self-hosted.
   Two categories: Necessary (choice record only) and Analytics (Vercel Web
   Analytics + Google Analytics 4, off by default, scripts injected only
   after acceptance). */
(function () {
  /* Scripts gated behind the analytics category. To gate another script
     (e.g. Google Analytics later), add one entry here; nothing loads until
     the visitor allows the analytics category. */
  var GATED_SCRIPTS = [
    {
      id: 'pf-va',
      src: '/_vercel/insights/script.js',
      before: function () { window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; }
    },
    {
      id: 'pf-si',
      src: '/_vercel/speed-insights/script.js',
      before: function () { window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); }; }
    },
    {
      id: 'pf-ga4',
      src: 'https://www.googletagmanager.com/gtag/js?id=G-508VDFQCDW',
      before: function () {
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', 'G-508VDFQCDW', { allow_google_signals: false, allow_ad_personalization_signals: false });
      }
    }
  ];

  /* Marketing events: fired only after the visitor allows analytics, because
     window.gtag exists only then. Everything queues on dataLayer until
     gtag.js processes it. */
  function fire(name, params) { if (window.gtag) window.gtag('event', name, params); }
  function wireEvents() {
    if (window.__pfEventsWired) return;
    window.__pfEventsWired = true;
    /* signup: landing on /thanks means the contact form completed */
    if (location.pathname === '/thanks' || location.pathname === '/thanks.html') {
      fire('generate_lead', { method: 'contact_form' });
    }
    /* CTA clicks: anything pointing at the contact section, mailto, or the mobile sticky bar */
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href === '#contact' || href === '/#contact' || href.indexOf('mailto:') === 0 || a.closest('.pf-sticky')) {
        fire('cta_click', {
          cta_text: (a.textContent || '').trim().slice(0, 60),
          cta_href: href.slice(0, 90),
          page_path: location.pathname
        });
      }
    }, { passive: true });
    /* section views: one event per main section per page view, labelled by id or heading */
    try {
      var seen = {};
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          var h = el.querySelector('h1,h2,.kicker,.eyebrow');
          var label = el.id || ((h && h.textContent) || '').trim().slice(0, 50) || 'section';
          if (seen[label]) return;
          seen[label] = 1;
          fire('section_view', { section: label, page_path: location.pathname });
          so.unobserve(el);
        });
      }, { threshold: 0.35 });
      document.querySelectorAll('main section').forEach(function (s) { so.observe(s); });
    } catch (e) {}
  }
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
    wireEvents();
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
              description: 'The site works either way. Allow switches on three anonymous-friendly measurers: Vercel Web Analytics and Speed Insights (anonymous, no cookies, cannot identify you) and Google Analytics 4 (sets its own cookies, reports which pages are read, which buttons are tapped and which sections come into view, roughly where from and on what device). No thanks means nothing is counted. Your choice is kept in one small cookie on this device and expires after about 6 months.',
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
                { title: 'Visit counting', linkedCategory: 'analytics', description: 'Three measurers run only if you allow them. Vercel Web Analytics and Speed Insights are anonymous: they set no cookies and cannot identify you; Speed Insights only measures how fast the page loads and responds. Google Analytics 4 sets its own cookies (_ga, kept about 2 years) and tells us which pages are read, how far visitors scroll, which outbound links are clicked, which contact and follow buttons are tapped, which page sections come into view, and when a form submission completes (via the thank-you page), and on what device, from roughly where. If you arrived through a tagged link (for example from LinkedIn or Instagram), the tag is recorded so we know which channel brought you. Google processes that data for us. Off unless you allow it.' }
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
