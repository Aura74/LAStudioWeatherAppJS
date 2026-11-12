// Designval och sparat ljust/mörkt tema. Körs synkront i <head>, före första
// renderingen, så att sidan aldrig blinkar till i fel design eller fel tema.
// Designbytet i sig sker utan att prognosen laddas om.
(() => {
  const key = 'vader.design.v1';
  const settingsKey = 'vader.settings.v2'; // samma nyckel som storage.js
  const choices = ['claude', 'astra', 'grok'];
  const root = document.documentElement;

  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || 'null');
    if (saved && (saved.theme === 'light' || saved.theme === 'dark')) root.dataset.theme = saved.theme;
  } catch { /* Utan sparat val följer temat systemet. */ }

  const fromQuery = () => {
    try { return new URLSearchParams(location.search).get('design'); }
    catch { return null; }
  };
  const fromStore = () => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  };

  const asked = fromQuery();
  const saved = fromStore();
  const design = choices.includes(asked) ? asked : (choices.includes(saved) ? saved : 'claude');
  root.dataset.design = design;

  if (design === 'grok') {
    const meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', '#10141c');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-design-choice]');
    const apply = (choice) => {
      root.dataset.design = choice;
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.designChoice === choice)));
      document.dispatchEvent(new Event('designchange'));
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      const choice = button.dataset.designChoice;
      if (!choices.includes(choice)) return;
      try { localStorage.setItem(key, choice); } catch { /* Fungerar även utan lagring. */ }
      try {
        const url = new URL(location.href);
        if (url.searchParams.has('design')) {
          url.searchParams.delete('design');
          history.replaceState(null, '', url);
        }
      } catch { /* Adressen får vara orörd. */ }
      apply(choice);
    }));
    apply(design);
  });
})();
