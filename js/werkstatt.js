/* ORION PROTECTION PANEL — Rechen-Werkstatt
 *
 * Karams Vorgabe (18.08.): ganz unten Felder, in denen man die Zahlen
 * SELBST ändern kann, und die dann mitrechnen — „falls doch was nicht
 * stimmt". Dazu ein Notizblock zum Mitschreiben.
 *
 * Die Werkstatt ist bewusst vom Prüfteil getrennt:
 *   - Oben wird der Bericht GEPRÜFT. Dort ändert niemand etwas.
 *   - Hier unten wird GERECHNET, mit beliebigen Zahlen. Was hier steht,
 *     verändert kein Urteil und keinen Verlaufseintrag.
 * So kann man gefahrlos ausprobieren, ohne die Prüfung zu verfälschen.
 *
 * Beim ersten Öffnen werden die Zahlen des Berichts übernommen; ein Knopf
 * holt sie jederzeit zurück. Gerechnet wird mit denselben Formeln wie
 * oben (rechnung.js + einsatz.js) — es gibt keine zweite Wahrheit.
 */
(function (welt) {
  'use strict';

  var P = welt.PS || {};

  function txt(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function f(n, k) {
    return (n === null || n === undefined || !isFinite(n)) ? '?' : Number(n).toFixed(k);
  }
  function el(id) { return document.getElementById(id); }
  function zahl(id) { var v = Number(el(id).value.replace(',', '.')); return isFinite(v) ? v : null; }

  var NOTIZ_ABLAGE = 'pruefstand_notiz';

  /* Rechnet, was gerade in den Feldern steht. Reine Anzeige — kein
   * Speichern, kein Urteil, keine Rückwirkung auf die Prüfung oben. */
  function rechne() {
    var R = P.rechnung, E = P.einsatz;
    var art1 = el('w-art1').value;          /* 'preis' | 'back' | 'lay' */
    var art2 = el('w-art2').value;
    var w1 = zahl('w-wert1'), g1 = zahl('w-geb1');
    var w2 = zahl('w-wert2'), g2 = zahl('w-geb2');
    var einsatz = zahl('w-einsatz');
    var schritt = Number(el('w-schritt').value) || 0.01;

    function qe(art, wert, gebProzent) {
      if (wert === null || gebProzent === null) return null;
      var g = gebProzent / 100;
      if (art === 'preis') return R.qeAnteil(wert, g);
      if (art === 'lay') return R.qeLay(wert, g);
      return R.qeBack(wert, g);
    }

    var qe1 = qe(art1, w1, g1), qe2 = qe(art2, w2, g2);
    var ziel = el('w-ergebnis');

    if (qe1 === null || qe2 === null) {
      ziel.innerHTML = '<div class="leise">Trage beide Kurse und beide Gebührensätze ein, Chef — ' +
        'Anteilspreis zwischen 0 und 1, Quote über 1.</div>';
      return;
    }

    var plan = E.rechne({ qe1: qe1, qe2: qe2, gesamt: einsatz || 100, schritt: schritt });
    var inv = 1 / qe1 + 1 / qe2;
    var marge = E.marge(inv);
    var puffer = E.puffer(qe1, qe2);

    function formelText(art, wert, gebProzent, ergebnis) {
      var g = gebProzent / 100;
      if (art === 'preis') {
        var geb = wert * (1 - wert) * g;
        return 'Gebühr = ' + f(g, 3) + ' × ' + f(wert, 3) + ' × ' + f(1 - wert, 3) + ' = ' + f(geb, 5) +
               '  →  (1 − ' + f(geb, 5) + ') ÷ ' + f(wert, 3) + ' = ' + f(ergebnis, 4);
      }
      if (art === 'lay') {
        return '1 + (1 − ' + f(g, 3) + ') ÷ (' + f(wert, 2) + ' − 1) = ' + f(ergebnis, 4);
      }
      return '1 + (' + f(wert, 2) + ' − 1) × (1 − ' + f(g, 3) + ') = ' + f(ergebnis, 4);
    }

    var gutFall = plan.garantiert > 0;
    ziel.innerHTML =
      '<div class="wzeile"><span class="wname">Effektivquote Seite 1</span>' +
        '<b class="mono">' + txt(f(qe1, 4)) + '</b>' +
        '<span class="leise klein mono">' + txt(formelText(art1, w1, g1, qe1)) + '</span></div>' +
      '<div class="wzeile"><span class="wname">Effektivquote Seite 2</span>' +
        '<b class="mono">' + txt(f(qe2, 4)) + '</b>' +
        '<span class="leise klein mono">' + txt(formelText(art2, w2, g2, qe2)) + '</span></div>' +
      '<div class="wzeile"><span class="wname">Kehrwertsumme</span>' +
        '<b class="mono ' + (inv < 1 ? 'gruen' : 'rot') + '">' + txt(f(inv, 4)) + '</b>' +
        '<span class="leise klein mono">1 ÷ ' + txt(f(qe1, 4)) + ' + 1 ÷ ' + txt(f(qe2, 4)) +
        (inv < 1 ? ' — unter 1, also Vorteil' : ' — nicht unter 1, kein Vorteil') + '</span></div>' +
      '<div class="wzeile"><span class="wname">Rendite ohne Rundung</span>' +
        '<b class="mono">' + (plan.idealRendite >= 0 ? '+' : '') + txt(f(plan.idealRendite, 2)) + ' %</b>' +
        '<span class="leise klein mono">(1 ÷ ' + txt(f(inv, 4)) + ' − 1) × 100</span></div>' +
      '<div class="wtrenn"></div>' +
      '<div class="wzeile"><span class="wname">Einsatz Seite 1</span><b class="mono">' + txt(f(plan.s1, 2)) + '</b>' +
        '<span class="leise klein mono">ideal ' + txt(f(plan.ideal1, 2)) + ', auf ' + txt(schritt >= 1 ? f(schritt, 0) : f(schritt, 2)) + ' gerundet</span></div>' +
      '<div class="wzeile"><span class="wname">Einsatz Seite 2</span><b class="mono">' + txt(f(plan.s2, 2)) + '</b>' +
        '<span class="leise klein mono">ideal ' + txt(f(plan.ideal2, 2)) + '</span></div>' +
      '<div class="wzeile"><span class="wname">Rückgabe je Ausgang</span>' +
        '<b class="mono">' + txt(f(plan.s1 * qe1, 2)) + ' / ' + txt(f(plan.s2 * qe2, 2)) + '</b>' +
        '<span class="leise klein mono">Einsatz × Effektivquote, für jeden Ausgang einzeln</span></div>' +
      '<div class="wzeile gross"><span class="wname">garantierter Gewinn</span>' +
        '<b class="mono ' + (gutFall ? 'gruen' : 'rot') + '">' + (plan.garantiert >= 0 ? '+' : '') + txt(f(plan.garantiert, 2)) + '</b>' +
        '<span class="leise klein mono">' + txt(f(plan.renditeEffektiv, 2)) + ' % vom eingesetzten Geld · ' +
        'der schlechtere der beiden Ausgänge</span></div>' +
      '<div class="wzeile"><span class="wname">Marge des Marktes</span><b class="mono">' + txt(f(marge, 2)) + ' %</b>' +
        (puffer ? '<span class="leise klein mono">Kurspuffer Seite 1: ' + txt(f(puffer.spielraumProzent, 2)) + ' %</span>' : '') +
      '</div>';
  }

  /* Zahlen aus dem geprüften Bericht in die Werkstatt holen. */
  function ausBericht(bericht) {
    if (!bericht || !bericht.seiten || bericht.seiten.length < 2) return false;
    var s1 = bericht.seiten[0], s2 = bericht.seiten[1];
    function art(s) {
      if (s.art === 'preis') return 'preis';
      return String(s.seiteText || '').toLowerCase() === 'lay' ? 'lay' : 'back';
    }
    el('w-art1').value = art(s1);
    el('w-art2').value = art(s2);
    if (isFinite(s1.wert)) el('w-wert1').value = s1.wert;
    if (isFinite(s2.wert)) el('w-wert2').value = s2.wert;
    if (isFinite(s1.gebuehr)) el('w-geb1').value = (s1.gebuehr * 100).toFixed(1);
    if (isFinite(s2.gebuehr)) el('w-geb2').value = (s2.gebuehr * 100).toFixed(1);
    rechne();
    return true;
  }

  function notizLaden() {
    try {
      var t = localStorage.getItem(NOTIZ_ABLAGE);
      if (t !== null) el('w-notiz').value = t;
    } catch (e) { /* gesperrter Speicher: dann eben ohne */ }
  }
  function notizSichern() {
    try { localStorage.setItem(NOTIZ_ABLAGE, el('w-notiz').value); } catch (e) { /* egal */ }
  }

  function verdrahten(holeBericht) {
    var felder = ['w-art1', 'w-wert1', 'w-geb1', 'w-art2', 'w-wert2', 'w-geb2', 'w-einsatz', 'w-schritt'];
    felder.forEach(function (id) {
      var e = el(id);
      if (!e) return;
      e.addEventListener('input', rechne);
      e.addEventListener('change', rechne);
    });
    var knopf = el('w-uebernehmen');
    if (knopf) {
      knopf.addEventListener('click', function () {
        var ok = ausBericht(holeBericht());
        knopf.textContent = ok ? 'Zahlen übernommen ✓' : 'kein geprüfter Bericht da';
        setTimeout(function () { knopf.textContent = 'Zahlen aus dem Bericht holen'; }, 1800);
      });
    }
    var notiz = el('w-notiz');
    if (notiz) {
      notizLaden();
      notiz.addEventListener('input', notizSichern);
    }
    rechne();
  }

  var api = { rechne: rechne, ausBericht: ausBericht, verdrahten: verdrahten };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).werkstatt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
