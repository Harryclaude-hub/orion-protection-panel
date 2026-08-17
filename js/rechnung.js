/* ORION PRÜFSTAND — Rechnung (eigenständige Zweitfassung)
 *
 * Dieses Modul ist ABSICHTLICH eine unabhängige zweite Umsetzung der
 * Orion-Panel-Rechenwege. Es teilt keinen Code mit dem Panel und liest
 * keine Panel-Daten — genau dadurch taugt es als Kontrolle: rechnen zwei
 * getrennte Fassungen dasselbe, ist die Rechnung belastbar; rechnen sie
 * verschieden, ist etwas faul.
 *
 * Die Formeln (Stand der Panel-Übergabe, Abschnitt 2 + 8f):
 *   Preis-Buch (Polymarket, Kalshi), Taker:
 *     Gebühr je Anteil = Satz · p · (1 − p)         [belegt: docs.polymarket.com/Fees
 *                                                     bzw. Kalshi-Gebührenordnung 7/2026]
 *     qE = (1 − Gebühr) / p
 *   Börse Back:  qE = 1 + (q − 1) · (1 − Satz)
 *   Börse Lay:   qE = 1 + (1 − Satz) / (L − 1)
 *   Kehrwertsumme  inv = 1/qE1 + 1/qE2 ;  Arbitrage wenn inv < 1
 *   Aufteilung     S1 = S · (1/qE1)/inv ;  S2 = S − S1
 *   Auszahlung     S/inv (bei BEIDEN Ausgängen gleich)
 *   Rendite        (1/inv − 1) · 100 %
 *
 * Dazu die ALTE Polymarket-Formel Satz · min(p, 1−p) — nur zum ERKENNEN:
 * zeigt ein Bericht eine Effektivquote, die zur alten Formel passt, sagt
 * der Prüfstand das ausdrücklich, statt nur "weicht ab" zu melden.
 */
(function (welt) {
  'use strict';

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }

  /* Gebühr je Anteil, aktuelle belegte Formel. satz als Bruch (0.05). */
  function gebuehrAnteil(preis, satz) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    if (!istZahl(satz) || satz < 0 || satz >= 1) return null;
    return satz * preis * (1 - preis);
  }

  /* Die ALTE Formel (bis 11.8.2026 im Panel): Satz · min(p, 1−p). */
  function gebuehrAnteilAlt(preis, satz) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    if (!istZahl(satz) || satz < 0 || satz >= 1) return null;
    return satz * Math.min(preis, 1 - preis);
  }

  function qeAnteil(preis, satz) {
    var g = gebuehrAnteil(preis, satz);
    if (g === null) return null;
    var qe = (1 - g) / preis;
    return qe > 0 ? qe : null;
  }

  function qeAnteilAlt(preis, satz) {
    var g = gebuehrAnteilAlt(preis, satz);
    if (g === null) return null;
    var qe = (1 - g) / preis;
    return qe > 0 ? qe : null;
  }

  function qeBack(quote, satz) {
    if (!istZahl(quote) || quote <= 1) return null;
    if (!istZahl(satz) || satz < 0 || satz >= 1) return null;
    return 1 + (quote - 1) * (1 - satz);
  }

  function qeLay(layQuote, satz) {
    if (!istZahl(layQuote) || layQuote <= 1) return null;
    if (!istZahl(satz) || satz < 0 || satz >= 1) return null;
    return 1 + (1 - satz) / (layQuote - 1);
  }

  /* Eine Seite des Berichts in eine Effektivquote übersetzen.
   * art: 'preis' | 'quote' ; seiteText entscheidet Back/Lay.
   * Liefert { qe, qeAlt, form } — qeAlt nur bei Preis-Büchern. */
  function qeSeite(art, seiteText, wert, satz) {
    if (art === 'preis') {
      return { qe: qeAnteil(wert, satz), qeAlt: qeAnteilAlt(wert, satz), form: 'anteil' };
    }
    var lay = String(seiteText || '').toLowerCase() === 'lay';
    return {
      qe: lay ? qeLay(wert, satz) : qeBack(wert, satz),
      qeAlt: null,
      form: lay ? 'lay' : 'back'
    };
  }

  /* Kern: zwei Effektivquoten gegeneinander, Einsatz S (Standard 100). */
  function pruefe(qe1, qe2, einsatz) {
    if (!istZahl(qe1) || qe1 <= 1) return null;
    if (!istZahl(qe2) || qe2 <= 1) return null;
    var inv = 1 / qe1 + 1 / qe2;
    var S = istZahl(einsatz) && einsatz > 0 ? einsatz : 100;
    var s1 = S * (1 / qe1) / inv;
    return {
      qe1: qe1, qe2: qe2, inv: inv, istArbitrage: inv < 1,
      einsatz: S, s1: s1, s2: S - s1,
      auszahlung: S / inv, gewinn: S / inv - S,
      rendite: (1 / inv - 1) * 100
    };
  }

  /* Gebühr in GELD: Einsatz · (Quote ohne Gebühr − Quote mit Gebühr).
   * Formen wie im Panel: anteil/kontrakt 1/p · back q · lay L/(L−1). */
  function quoteOhneGebuehr(form, roh) {
    if (!istZahl(roh)) return null;
    if (form === 'anteil' || form === 'kontrakt') {
      return (roh > 0 && roh < 1) ? 1 / roh : null;
    }
    if (form === 'back') return roh > 1 ? roh : null;
    if (form === 'lay') return roh > 1 ? roh / (roh - 1) : null;
    return null;
  }

  function gebuehrBetrag(form, einsatz, roh, qe) {
    if (!istZahl(einsatz) || einsatz <= 0) return null;
    if (!istZahl(qe) || qe <= 1) return null;
    var ohne = quoteOhneGebuehr(form, roh);
    if (ohne === null) return null;
    var d = ohne - qe;
    if (d < -1e-9) return null;
    return einsatz * (d < 0 ? 0 : d);
  }

  var api = {
    istZahl: istZahl,
    gebuehrAnteil: gebuehrAnteil,
    gebuehrAnteilAlt: gebuehrAnteilAlt,
    qeAnteil: qeAnteil,
    qeAnteilAlt: qeAnteilAlt,
    qeBack: qeBack,
    qeLay: qeLay,
    qeSeite: qeSeite,
    pruefe: pruefe,
    quoteOhneGebuehr: quoteOhneGebuehr,
    gebuehrBetrag: gebuehrBetrag
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).rechnung = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
