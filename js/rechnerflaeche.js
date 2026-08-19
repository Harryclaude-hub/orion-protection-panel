/* ORION PROTECTION PANEL, Oberflaeche der Rechner
 *
 * Karams Auftrag 19.08.2026: ein Waehrungsrechner ueber einen Knopf oben
 * rechts, und die Rechner-Sammlung zum Nachrechnen von Hand.
 *
 * Alles hier ist reine Anzeige. Gerechnet wird in rechner.js und
 * waehrung.js. Nichts davon beruehrt die Pruefung eines Berichts: die
 * Rechner sind Werkzeug, kein Urteil.
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
  function zahl(id) {
    var e = el(id); if (!e) return null;
    var v = Number(String(e.value).replace(',', '.'));
    return isFinite(v) ? v : null;
  }

  /* ---------- Der Waehrungsrechner oben rechts ---------- */
  function waehrungRechnerZeichnen() {
    var W = P.waehrung, R = P.rechner;
    var betrag = zahl('wr-betrag');
    var von = el('wr-von').value, nach = el('wr-nach').value;
    var ziel = el('wr-ergebnis');
    if (betrag === null) {
      ziel.innerHTML = '<span class="leise">Betrag eintragen.</span>';
      return;
    }
    var e = R.waehrungRechnen(betrag, von, nach, W);
    if (!e) {
      ziel.innerHTML = '<span class="orange">Kein Wechselkurs geladen. ' +
        'Der Kurs kommt von der EZB und wird beim Oeffnen der Seite geholt.</span>';
      return;
    }
    /* Immer BEIDE Richtungen zeigen, damit man nicht umdenken muss. */
    var rueck = R.waehrungRechnen(betrag, nach, von, W);
    ziel.innerHTML =
      '<div class="wrzeile"><b class="wrgross mono">' + txt(W.geld(betrag, von)) + '</b>' +
      '<span class="wrpfeil">=</span>' +
      '<b class="wrgross mono signalfarbe">' + txt(e.text) + '</b></div>' +
      '<div class="leise klein mono">' + txt(e.kursText) +
        (e.stand ? ' (EZB-Referenz, Stand ' + txt(e.stand) + ')' : '') + '</div>' +
      (rueck ? '<div class="leise klein mono">umgekehrt: ' + txt(W.geld(betrag, nach)) +
        ' = ' + txt(rueck.text) + '</div>' : '');
  }

  function waehrungRechnerVerdrahten() {
    ['wr-betrag', 'wr-von', 'wr-nach'].forEach(function (id) {
      var e = el(id);
      if (!e) return;
      e.addEventListener('input', waehrungRechnerZeichnen);
      e.addEventListener('change', waehrungRechnerZeichnen);
    });
    var tausch = el('wr-tausch');
    if (tausch) {
      tausch.addEventListener('click', function () {
        var v = el('wr-von').value;
        el('wr-von').value = el('wr-nach').value;
        el('wr-nach').value = v;
        waehrungRechnerZeichnen();
      });
    }
    var knopf = el('wr-knopf'), kasten = el('wr-kasten');
    if (knopf && kasten) {
      knopf.addEventListener('click', function () {
        var auf = kasten.style.display !== 'none';
        kasten.style.display = auf ? 'none' : '';
        knopf.setAttribute('aria-expanded', auf ? 'false' : 'true');
        if (!auf) waehrungRechnerZeichnen();
      });
    }
  }

  /* ---------- Die Rechner-Sammlung ---------- */
  function quotenZeichnen() {
    var R = P.rechner;
    var art = el('q-art').value;
    var a = zahl('q-wert1'), b = zahl('q-wert2');
    var e = null;
    if (art === 'dezimal') e = R.ausDezimal(a);
    else if (art === 'anteil') e = R.ausAnteilspreis(a);
    else if (art === 'amerikanisch') e = R.ausAmerikanisch(a);
    else if (art === 'prozent') e = R.ausWahrscheinlichkeit(a);
    else if (art === 'bruch') e = R.ausBruch(a, b);

    el('q-zweites').style.display = art === 'bruch' ? '' : 'none';
    var ziel = el('q-ergebnis');
    if (!e) {
      ziel.innerHTML = '<span class="leise">Gueltigen Wert eintragen. ' +
        'Dezimalquote ueber 1, Anteilspreis zwischen 0 und 1, Prozent zwischen 0 und 100.</span>';
      return;
    }
    ziel.innerHTML =
      zeile('Dezimalquote', f(e.dezimal, 3), 'die Form, mit der hier gerechnet wird') +
      zeile('Anteilspreis', f(1 / e.dezimal, 3), 'so zeigen es Polymarket und Kalshi') +
      zeile('Wahrscheinlichkeit', f(e.wahrscheinlichkeit, 2) + ' %', 'was die Quote unterstellt') +
      zeile('amerikanisch', (e.amerikanisch > 0 ? '+' : '') + e.amerikanisch, 'US-Schreibweise') +
      zeile('Bruch', e.bruch ? e.bruch.text : '?', 'britische Schreibweise');
  }

  function zeile(name, wert, hinweis) {
    return '<div class="wzeile"><span class="wname">' + txt(name) + '</span>' +
      '<b class="mono">' + txt(wert) + '</b>' +
      '<span class="leise klein">' + txt(hinweis || '') + '</span></div>';
  }

  function margeZeichnen() {
    var R = P.rechner;
    var qs = [zahl('m-q1'), zahl('m-q2'), zahl('m-q3')].filter(function (x) { return x !== null; });
    var e = R.marge(qs);
    var ziel = el('m-ergebnis');
    if (!e) { ziel.innerHTML = '<span class="leise">Mindestens zwei Quoten ueber 1 eintragen.</span>'; return; }
    ziel.innerHTML =
      zeile('Kehrwertsumme', f(e.kehrwertsumme, 4),
        e.istArbitrage ? 'unter 1, das ist ein Vorteil fuer dich' : 'ueber 1, der Aufschlag des Buches') +
      zeile(e.istArbitrage ? 'Vorteil' : 'Marge', f(Math.abs(e.margeProzent), 2) + ' %',
        e.istArbitrage ? 'so viel liegt zu deinen Gunsten im Markt' : 'so viel behaelt das Buch ein') +
      zeile('faire Quoten', e.fair.map(function (x) { return f(x, 3); }).join('  ·  '),
        'so staenden sie ohne Aufschlag');
  }

  function wertZeichnen() {
    var R = P.rechner;
    var q = zahl('v-quote'), p = zahl('v-prozent'), s = zahl('v-einsatz'), kap = zahl('v-kapital');
    var e = R.erwartungswert(q, p, s);
    var k = R.kelly(q, p, kap);
    var ziel = el('v-ergebnis');
    if (!e) { ziel.innerHTML = '<span class="leise">Quote ueber 1 und Wahrscheinlichkeit zwischen 0 und 100 eintragen.</span>'; return; }
    ziel.innerHTML =
      zeile('Erwartungswert', (e.wertProzent >= 0 ? '+' : '') + f(e.wertProzent, 2) + ' %',
        e.lohntSich ? 'je Euro Einsatz, auf lange Sicht' : 'negativ, auf Dauer ein Verlustgeschaeft') +
      zeile('erwarteter Gewinn', (e.erwarteterGewinn >= 0 ? '+' : '') + f(e.erwarteterGewinn, 2),
        'bei ' + f(e.einsatz, 2) + ' Einsatz') +
      zeile('noetige Mindestquote', f(e.mindestQuote, 3),
        'ab dieser Quote lohnt es sich bei deiner Einschaetzung') +
      (k ? zeile('Kelly-Anteil', f(k.anteilProzent, 2) + ' %',
        k.einsatz === null ? 'Kapital eintragen fuer den Betrag' : 'das waeren ' + f(k.einsatz, 2)) +
        zeile('halbes Kelly', f(k.halbesKellyProzent, 2) + ' %',
          (k.einsatzHalb === null ? '' : f(k.einsatzHalb, 2) + ', ') +
          'sicherer, weil die eigene Wahrscheinlichkeit selten genau stimmt') : '');
  }

  function dutchingZeichnen() {
    var R = P.rechner;
    var qs = [zahl('d-q1'), zahl('d-q2'), zahl('d-q3'), zahl('d-q4')].filter(function (x) { return x !== null; });
    var s = zahl('d-einsatz');
    var e = R.dutching(qs, s);
    var ziel = el('d-ergebnis');
    if (!e) { ziel.innerHTML = '<span class="leise">Mindestens zwei Quoten ueber 1 eintragen.</span>'; return; }
    var teile = e.einsaetze.map(function (x, i) {
      return zeile('Einsatz auf Quote ' + f(e.quoten[i], 2), f(x, 2), 'zahlt ' + f(x * e.quoten[i], 2) + ' zurueck');
    }).join('');
    ziel.innerHTML = teile +
      zeile('Auszahlung', f(e.auszahlung, 2), 'bei JEDEM der Ausgaenge gleich') +
      zeile('Ergebnis', (e.gewinn >= 0 ? '+' : '') + f(e.gewinn, 2) + '  (' + f(e.renditeProzent, 2) + ' %)',
        e.sicher ? 'sicherer Gewinn, die Kehrwertsumme liegt unter 1'
                 : 'sicherer VERLUST, die Kehrwertsumme liegt ueber 1');
  }

  function verdrahten() {
    waehrungRechnerVerdrahten();
    var gruppen = [
      { felder: ['q-art', 'q-wert1', 'q-wert2'], f: quotenZeichnen },
      { felder: ['m-q1', 'm-q2', 'm-q3'], f: margeZeichnen },
      { felder: ['v-quote', 'v-prozent', 'v-einsatz', 'v-kapital'], f: wertZeichnen },
      { felder: ['d-q1', 'd-q2', 'd-q3', 'd-q4', 'd-einsatz'], f: dutchingZeichnen }
    ];
    gruppen.forEach(function (g) {
      g.felder.forEach(function (id) {
        var e = el(id);
        if (!e) return;
        e.addEventListener('input', g.f);
        e.addEventListener('change', g.f);
      });
      if (el(g.felder[0])) g.f();
    });
  }

  var api = { verdrahten: verdrahten, waehrungRechnerZeichnen: waehrungRechnerZeichnen };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).rechnerflaeche = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
