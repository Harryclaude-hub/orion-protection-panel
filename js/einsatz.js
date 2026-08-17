/* ORION PROTECTION PANEL — Einsatzrechner
 *
 * Der Bericht des Panels rechnet immer mit 100 als Grundeinsatz. Wer
 * wirklich setzt, hat aber einen anderen Betrag, muss auf brauchbare
 * Beträge runden und stößt an die Mengen der Bücher. Genau da entstehen
 * die Unterschiede zwischen "2,53 % auf dem Papier" und dem, was am Ende
 * im Konto liegt.
 *
 * Fachlich übernommen sind die Arbeitsschritte, die jeder professionelle
 * Surebet-Rechner kennt (BetBurger und Vergleichbare) — die Rechnung ist
 * hier eigenständig umgesetzt:
 *
 *   1. Aufteilung auf gleiche Auszahlung        (ungerundet, das Ideal)
 *   2. RUNDUNG auf brauchbare Beträge           (1 / 5 / 10 …)
 *   3. Auszahlung und Gewinn JE AUSGANG         (nach Rundung ungleich!)
 *   4. Garantiert ist der SCHLECHTERE Ausgang   (nie der Mittelwert)
 *   5. Effektive Rendite nach Rundung + Verlust gegenüber dem Ideal
 *   6. Marge/Überrundung des Marktes in Prozent
 *   7. Implizite Wahrscheinlichkeiten je Seite
 *   8. Kurspuffer: wie weit darf sich Seite 1 bewegen, bis es kippt
 *
 * Der wichtigste Punkt, den viele Rechner unterschlagen: Nach der Rundung
 * ist der Gewinn NICHT mehr in beiden Ausgängen gleich. Wer dann den
 * höheren nennt, verspricht Geld, das nur bei einem von zwei Ausgängen
 * kommt. Hier zählt immer der schlechtere.
 *
 * Kein DOM, kein fetch — reine Mathematik, im Node-Prüfstand testbar.
 */
(function (welt) {
  'use strict';

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }

  /* Auf einen Schritt runden (0 oder 1 = auf ganze Beträge, 0.01 = Cent). */
  function aufSchritt(betrag, schritt) {
    if (!istZahl(betrag)) return null;
    if (!istZahl(schritt) || schritt <= 0) return betrag;
    return Math.round(betrag / schritt) * schritt;
  }

  /* Kernrechnung.
   * opt: qe1, qe2, gesamt, schritt (Rundung), maxEinsatz (aus dem Bericht)
   * Alles in derselben Währung wie `gesamt`. */
  function rechne(opt) {
    var qe1 = opt.qe1, qe2 = opt.qe2;
    if (!istZahl(qe1) || qe1 <= 1 || !istZahl(qe2) || qe2 <= 1) return null;
    var gesamt = istZahl(opt.gesamt) && opt.gesamt > 0 ? opt.gesamt : 100;
    var schritt = istZahl(opt.schritt) && opt.schritt > 0 ? opt.schritt : 0.01;

    var inv = 1 / qe1 + 1 / qe2;

    /* 1) Das Ideal: exakte Aufteilung auf gleiche Auszahlung. */
    var ideal1 = gesamt * (1 / qe1) / inv;
    var ideal2 = gesamt - ideal1;
    var idealRendite = (1 / inv - 1) * 100;

    /* 2) Gerundet — so wird wirklich gesetzt. */
    var s1 = aufSchritt(ideal1, schritt);
    var s2 = aufSchritt(ideal2, schritt);
    /* Ein Einsatz von 0 wäre keine Absicherung, sondern eine offene Wette. */
    if (s1 <= 0) s1 = schritt;
    if (s2 <= 0) s2 = schritt;
    var eingesetzt = s1 + s2;

    /* 3) Was kommt bei welchem Ausgang zurück? */
    var auszahlung1 = s1 * qe1;
    var auszahlung2 = s2 * qe2;
    var gewinn1 = auszahlung1 - eingesetzt;
    var gewinn2 = auszahlung2 - eingesetzt;

    /* 4) Garantiert ist der schlechtere Ausgang. */
    var garantiert = Math.min(gewinn1, gewinn2);
    var bester = Math.max(gewinn1, gewinn2);

    /* 5) Was die Rundung gekostet hat. */
    var renditeEffektiv = eingesetzt > 0 ? garantiert / eingesetzt * 100 : null;
    var rundungsverlust = istZahl(renditeEffektiv) ? idealRendite - renditeEffektiv : null;

    /* 6) Reicht die Marge nach der Rundung überhaupt noch? */
    var nochArbitrage = garantiert > 0;

    /* 7) Passt der Einsatz zu dem, was die Bücher aufnehmen? */
    var ueberMax = (istZahl(opt.maxEinsatz) && opt.maxEinsatz > 0)
      ? eingesetzt > opt.maxEinsatz : null;

    return {
      qe1: qe1, qe2: qe2, inv: inv,
      gesamtWunsch: gesamt, schritt: schritt,
      ideal1: ideal1, ideal2: ideal2, idealRendite: idealRendite,
      s1: s1, s2: s2, eingesetzt: eingesetzt,
      auszahlung1: auszahlung1, auszahlung2: auszahlung2,
      gewinn1: gewinn1, gewinn2: gewinn2,
      garantiert: garantiert, bester: bester,
      unterschiedDerAusgaenge: Math.abs(gewinn1 - gewinn2),
      renditeEffektiv: renditeEffektiv,
      rundungsverlust: rundungsverlust,
      nochArbitrage: nochArbitrage,
      maxEinsatz: istZahl(opt.maxEinsatz) ? opt.maxEinsatz : null,
      ueberMax: ueberMax
    };
  }

  /* Marge des Marktes: wie viele Prozent unter 100 liegt die Kehrwertsumme?
   * Das ist die Kennzahl, die Scanner als „Überrundung" oder „Arb %" zeigen. */
  function marge(inv) {
    if (!istZahl(inv) || inv <= 0) return null;
    return (1 - inv) * 100;
  }

  /* Implizite Wahrscheinlichkeit einer Effektivquote, in Prozent.
   * Zwei Seiten zusammen unter 100 % = Arbitrage. */
  function wahrscheinlichkeit(qe) {
    if (!istZahl(qe) || qe <= 0) return null;
    return 100 / qe;
  }

  /* Kurspuffer auf Seite 1: Wie weit darf sich ihre Effektivquote
   * verschlechtern, bis die Kehrwertsumme 1 erreicht und der Vorteil weg
   * ist? Sagt, ob eine Chance belastbar oder auf Kante genäht ist.
   * Ergebnis: { qeGrenze, spielraumProzent } */
  function puffer(qe1, qe2) {
    if (!istZahl(qe1) || qe1 <= 1 || !istZahl(qe2) || qe2 <= 1) return null;
    var rest = 1 - 1 / qe2;              // so viel Kehrwert darf Seite 1 haben
    if (!(rest > 0)) return null;
    var qeGrenze = 1 / rest;             // ... also mindestens diese Quote
    if (!(qe1 > qeGrenze)) return { qeGrenze: qeGrenze, spielraumProzent: 0 };
    return {
      qeGrenze: qeGrenze,
      spielraumProzent: (qe1 - qeGrenze) / qe1 * 100
    };
  }

  var api = {
    aufSchritt: aufSchritt,
    rechne: rechne,
    marge: marge,
    wahrscheinlichkeit: wahrscheinlichkeit,
    puffer: puffer
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).einsatz = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
