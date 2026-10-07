// Separat designval: byt presentation utan att ladda om prognosen.
(() => {
  const key = 'vader.design.v1';
  const choices = ['claude', 'astra', 'grok'];
  const root = document.documentElement;

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
