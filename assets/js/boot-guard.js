// Startvakt. Finns till för ett enda fall: att app.js aldrig kommer igång.
// Då ska sidan säga vad som är fel i stället för att visa laddningsskelettet
// för alltid. Vanligaste orsaken är att index.html öppnats direkt som fil –
// de flesta webbläsare vägrar då ladda ES-moduler.
//
// Skriptet är med flit ett vanligt skript (ingen modul) i försiktig JavaScript,
// så att det fungerar även där resten av appen inte gör det.
(function () {
  'use strict';

  var STARTUP_TIMEOUT_MS = 10000;
  var root = document.documentElement;
  var reported = false;

  // app.js sätter data-app="started" på <html> när init() har gått igenom.
  function started() {
    return root.getAttribute('data-app') === 'started';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function fail(title, text, canReload) {
    if (reported || started()) return;
    reported = true;

    document.body.setAttribute('data-state', 'error');
    var hero = document.getElementById('hero');
    if (hero) hero.setAttribute('aria-busy', 'false');

    setText('hero-place', title);
    setText('hero-sub', text);
    setText('hero-icon', '');
    setText('hero-temp', '');
    setText('hero-unit', '');
    setText('hero-desc', '');
    setText('hero-range', '');
    setText('updated', '');

    var actions = document.getElementById('hero-range');
    if (canReload && actions) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'link-btn';
      button.textContent = 'Ladda om sidan';
      button.addEventListener('click', function () { location.reload(); });
      actions.appendChild(button);
    }
  }

  function failToLoad() {
    // Öppnad som fil: Chrome och Safari vägrar då ladda moduler (Firefox tillåter det).
    if (location.protocol === 'file:') {
      fail(
        'Appen behöver en webbserver',
        'Sidan öppnades direkt som en fil, och då blockerar webbläsaren appens kod så att vädret inte kan hämtas. ' +
          'Starta den via en lokal webbserver i stället: klicka på "Go Live" längst ner i VS Code (Live Server), ' +
          'eller kör "python3 -m http.server 8000" i projektmappen och öppna http://localhost:8000.',
        false
      );
      return;
    }
    fail(
      'Appen kunde inte laddas',
      'Någon av appens filer gick inte att hämta. Kontrollera anslutningen och ladda om sidan.',
      true
    );
  }

  // Startmodulen (eller något den importerar) gick inte att hämta.
  var entry = document.querySelector('script[type="module"]');
  if (entry) entry.addEventListener('error', failToLoad);

  // Koden laddades men kraschade innan appen hann starta, t.ex. i en för gammal webbläsare.
  window.addEventListener('error', function (event) {
    if (!event.filename || event.filename.indexOf('/assets/js/') === -1) return;
    fail(
      'Appen kunde inte starta',
      'Något gick fel när appen skulle starta. Prova att ladda om sidan. Hjälper inte det kan webbläsaren vara för gammal.',
      true
    );
  });

  // Sista utvägen: ingenting hände alls.
  setTimeout(failToLoad, STARTUP_TIMEOUT_MS);
})();
