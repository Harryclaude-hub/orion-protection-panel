/* ORION PROTECTION PANEL, die Rechner
 *
 * Karams Auftrag vom 19.08.2026: die Rechner-Sammlung eines grossen
 * Surebet-Dienstes fachlich uebernehmen, damit man hier alles von Hand
 * nachrechnen kann. Dazu ein Waehrungsrechner, erreichbar ueber einen
 * Knopf oben rechts.
 *
 * WAS HIER DRIN IST und warum
 *
 *   Quotenformate    Dezimal, Bruch, amerikanisch, Wahrscheinlichkeit.
 *                    Die Buecher zeigen verschiedene Formate; wer sie
 *                    verwechselt, rechnet mit einer voellig anderen Zahl.
 *   Margefrei        Was waere die Quote OHNE den Aufschlag des Buches.
 *                    Zeigt, wie viel Marge im Kurs steckt.
 *   Erwartungswert   Lohnt sich eine EINZELNE Wette, wenn man die eigene
 *                    Wahrscheinlichkeit kennt.
 *   Kelly            Wie viel vom Kapital man dann setzen sollte, und
 *                    warum man besser die Haelfte davon nimmt.
 *   Dutching         Aufteilung auf DREI und mehr Ausgaenge, nicht nur
 *                    auf zwei (etwa Heim, Unentschieden, Auswaerts).
 *   Waehrung         Euro, Dollar, Pfund hin und her.
 *
 * WAS BEWUSST FEHLT
 *
 *   Kombiwetten, Systemwetten und Bonus-Umsatzrechner. Sie gehoeren zu
 *   Buchmachern, nicht zu Boersen, und Karams Regel ist eindeutig: nur
 *   Boersen. Ein Rechner, den man hier nie braucht, ist kein Gewinn,
 *   sondern eine Stolperstelle.
 *
 * Reine Mathematik, kein DOM, im Node-Pruefstand testbar.
 */
(function (welt) {
  'use strict';

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }

  /* ---------- 1) Quotenformate ----------
   * Dieselbe Wette, vier Schreibweisen. Beispiel Dezimalquote 2,50:
   *   Bruch            3/2
   *   amerikanisch     +150
   *   Wahrscheinlichkeit 40 Prozent
   * Ein Buch, das +150 zeigt, meint dasselbe wie eines mit 2,50. */
  function ausDezimal(d) {
    if (!istZahl(d) || d <= 1) return null;
    return {
      dezimal: d,
      wahrscheinlichkeit: 100 / d,
      amerikanisch: d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)),
      bruch: alsBruch(d - 1)
    };
  }

  /* Dezimalbruch als moeglichst einfacher Bruch, wie die Buecher ihn
   * schreiben. Naeherung ueber Kettenbrueche, Nenner bis 1000. */
  function alsBruch(x) {
    if (!istZahl(x) || x <= 0) return null;
    var besterZ = 1, besterN = 1, bestAbw = Infinity;
    for (var n = 1; n <= 1000; n++) {
      var z = Math.round(x * n);
      if (z < 1) continue;
      var abw = Math.abs(x - z / n);
      if (abw < bestAbw - 1e-12) { bestAbw = abw; besterZ = z; besterN = n; }
      if (bestAbw < 1e-9) break;
    }
    var t = ggt(besterZ, besterN);
    return { zaehler: besterZ / t, nenner: besterN / t, text: (besterZ / t) + '/' + (besterN / t) };
  }
  function ggt(a, b) { while (b) { var h = a % b; a = b; b = h; } return a; }

  function ausAmerikanisch(a) {
    if (!istZahl(a) || a === 0) return null;
    var d = a > 0 ? (a / 100) + 1 : (100 / Math.abs(a)) + 1;
    return ausDezimal(d);
  }
  function ausBruch(zaehler, nenner) {
    if (!istZahl(zaehler) || !istZahl(nenner) || nenner === 0) return null;
    return ausDezimal(zaehler / nenner + 1);
  }
  function ausWahrscheinlichkeit(prozent) {
    if (!istZahl(prozent) || prozent <= 0 || prozent >= 100) return null;
    return ausDezimal(100 / prozent);
  }
  /* Anteilspreis (Polymarket, Kalshi) ist nichts anderes als eine
   * Wahrscheinlichkeit: 0,48 heisst 48 Prozent, Quote 2,083. */
  function ausAnteilspreis(p) {
    if (!istZahl(p) || p <= 0 || p >= 1) return null;
    return ausDezimal(1 / p);
  }

  /* ---------- 2) Marge und margefreie Quoten ----------
   * Die Summe der Kehrwerte sagt, wie viel das Buch aufschlaegt. Liegt
   * sie ueber 1, ist der Ueberschuss die Marge. Die margefreie Quote
   * ist die, die ohne diesen Aufschlag daestuende.
   *
   * ACHTUNG, der Unterschied zur Arbitrage: hier werden Quoten EINES
   * Buches verglichen. Liegt die Summe UNTER 1, ist es kein Fehler,
   * sondern genau die Arbitrage, um die es im Panel geht. */
  function marge(quoten) {
    var qs = (quoten || []).filter(function (q) { return istZahl(q) && q > 1; });
    if (qs.length < 2) return null;
    var summe = qs.reduce(function (s, q) { return s + 1 / q; }, 0);
    return {
      quoten: qs,
      kehrwertsumme: summe,
      margeProzent: (summe - 1) * 100,
      /* Proportionale Methode: jede Quote wird um denselben Faktor
       * gestreckt, bis die Summe der Kehrwerte genau 1 ergibt. */
      fair: qs.map(function (q) { return q * summe; }),
      istArbitrage: summe < 1
    };
  }

  /* ---------- 3) Erwartungswert einer EINZELNEN Wette ----------
   * Nur sinnvoll, wenn man eine eigene Einschaetzung der
   * Wahrscheinlichkeit hat. Ohne die ist es Raten mit Formel. */
  function erwartungswert(quote, wahrscheinlichkeitProzent, einsatz) {
    if (!istZahl(quote) || quote <= 1) return null;
    var p = wahrscheinlichkeitProzent / 100;
    if (!istZahl(p) || p <= 0 || p >= 1) return null;
    var s = istZahl(einsatz) && einsatz > 0 ? einsatz : 100;
    var wert = p * quote - 1;              /* je Euro Einsatz */
    return {
      quote: quote, wahrscheinlichkeit: p, einsatz: s,
      wertJeEuro: wert,
      wertProzent: wert * 100,
      erwarteterGewinn: wert * s,
      lohntSich: wert > 0,
      /* Die Quote, ab der es sich lohnt. */
      mindestQuote: 1 / p
    };
  }

  /* ---------- 4) Kelly ----------
   * Der Anteil des Kapitals, der langfristig am schnellsten waechst.
   * f = (q * p - 1) / (q - 1)
   *
   * Warum die Haelfte davon: Kelly setzt voraus, dass die eigene
   * Wahrscheinlichkeit STIMMT. Liegt man daneben, uebersetzt man
   * dramatisch. Halbes Kelly kostet wenig Wachstum und halbiert den
   * Ausschlag nach unten. Das ist keine Vorsicht, das ist Rechnung. */
  function kelly(quote, wahrscheinlichkeitProzent, kapital) {
    if (!istZahl(quote) || quote <= 1) return null;
    var p = wahrscheinlichkeitProzent / 100;
    if (!istZahl(p) || p <= 0 || p >= 1) return null;
    var anteil = (quote * p - 1) / (quote - 1);
    var k = istZahl(kapital) && kapital > 0 ? kapital : null;
    return {
      anteil: anteil,
      anteilProzent: anteil * 100,
      halbesKelly: anteil / 2,
      halbesKellyProzent: anteil * 50,
      einsatz: k === null ? null : Math.max(0, anteil) * k,
      einsatzHalb: k === null ? null : Math.max(0, anteil) * k / 2,
      lohntSich: anteil > 0
    };
  }

  /* ---------- 5) Dutching ----------
   * Aufteilung auf beliebig viele Ausgaenge, sodass jeder dasselbe
   * auszahlt. Bei zwei Ausgaengen ist das genau die Arbitrage-Rechnung,
   * bei drei (Heim, Unentschieden, Auswaerts) braucht man sie ebenso. */
  function dutching(quoten, einsatz) {
    var qs = (quoten || []).filter(function (q) { return istZahl(q) && q > 1; });
    if (qs.length < 2) return null;
    var S = istZahl(einsatz) && einsatz > 0 ? einsatz : 100;
    var summe = qs.reduce(function (s, q) { return s + 1 / q; }, 0);
    var einsaetze = qs.map(function (q) { return S * (1 / q) / summe; });
    var auszahlung = S / summe;
    return {
      quoten: qs, einsatz: S,
      einsaetze: einsaetze,
      auszahlung: auszahlung,
      gewinn: auszahlung - S,
      renditeProzent: (1 / summe - 1) * 100,
      kehrwertsumme: summe,
      sicher: summe < 1
    };
  }

  /* ---------- 6) Waehrungsrechner ----------
   * Karams ausdruecklicher Wunsch: hin und her, mit dem aktuellen Kurs.
   * Rechnet ueber waehrung.js, damit es nur EINE Kursquelle gibt. */
  function waehrungRechnen(betrag, von, nach, W) {
    var wm = W || (welt.PS && welt.PS.waehrung);
    if (!wm) return null;
    var wert = wm.rechne(betrag, von, nach);
    if (wert === null) return null;
    var k = wm.kurseJetzt();
    /* Der Kurs als Satz: 1 von = x nach */
    var einer = wm.rechne(1, von, nach);
    return {
      betrag: betrag, von: von, nach: nach,
      ergebnis: wert,
      text: wm.geld(wert, nach),
      kurs: einer,
      kursText: einer === null ? null : '1 ' + von + ' = ' + einer.toFixed(4) + ' ' + nach,
      stand: k ? k.stand : null
    };
  }

  var api = {
    ausDezimal: ausDezimal, ausAmerikanisch: ausAmerikanisch, ausBruch: ausBruch,
    ausWahrscheinlichkeit: ausWahrscheinlichkeit, ausAnteilspreis: ausAnteilspreis,
    alsBruch: alsBruch,
    marge: marge, erwartungswert: erwartungswert, kelly: kelly, dutching: dutching,
    waehrungRechnen: waehrungRechnen
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).rechner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
