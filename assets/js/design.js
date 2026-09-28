// Separat designval: byt presentation utan att ladda om prognosen.
(() => {
  const key = 'vader.design.v1';
  const root = document.documentElement;
  let design = 'claude';
  try { if (localStorage.getItem(key) === 'astra') design = 'astra'; } catch { /* Lagring är valfri. */ }
  root.dataset.design = design;

  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-design-choice]');
    const apply = (choice) => {
      root.dataset.design = choice;
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.designChoice === choice)));
      document.dispatchEvent(new Event('designchange'));
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      const choice = button.dataset.designChoice;
      try { localStorage.setItem(key, choice); } catch { /* Fungerar även utan lagring. */ }
      apply(choice);
    }));
    apply(design);
  });
})();
