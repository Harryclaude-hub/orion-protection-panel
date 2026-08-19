/* ORION PROTECTION PANEL, Waehrungen
 *
 * Karams Anliegen vom 19.08.2026: die vier Buecher fuehren NICHT dieselbe
 * Waehrung. Ein Betrag in Dollar und einer in Pfund sehen auf dem Schirm
 * gleich aus und sind es nicht. Wer die verwechselt, setzt auf einer
 * Seite zu viel und auf der anderen zu wenig, und aus der Absicherung
 * wird eine offene Wette.
 *
 * WAS WELCHES BUCH FUEHRT (belegt, Stand 19.08.2026)
 *
 *   Polymarket  USD   handelt in USDC, einem Dollar-Wertzeichen
 *   Kalshi      USD   rechnet in Cent
 *   Smarkets    GBP   britische Pfund
 *   Betfair     je nach Konto, meist GBP oder EUR. Nicht von aussen
 *               bestimmbar, deshalb einstellbar statt geraten.
 *
 * DER ENTSCHEIDENDE UNTERSCHIED
 *
 *   Quoten, Preise, Kehrwertsumme und Rendite sind VERHAELTNISSE. Sie
 *   haben keine Waehrung und aendern sich durch keinen Wechselkurs.
 *   Nur BETRAEGE haben eine Waehrung: Einsatz, handelbare Menge,
 *   Auszahlung, Gewinn.
 *
 *   Deshalb wird hier NUR mit Betraegen umgerechnet und nie mit Quoten.
 *   Genau diese Trennung verhindert die Verwechslung.
 *
 * DIE AUFTEILUNG
 *
 *   Die Aufteilung muss in EINER Waehrung gerechnet werden, sonst stimmt
 *   das Verhaeltnis nicht. Gerechnet wird darum in der Leitwaehrung
 *   (Euro), und erst zum Schluss bekommt jede Seite ihren Betrag in der
 *   Waehrung ihres Kontos. Beide Zahlen stehen nebeneinander, jede mit
 *   ihrem Zeichen.
 */
(function (welt) {
  'use strict';

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }

  /* Welches Buch fuehrt welche Waehrung. */
  var BUCH_WAEHRUNG = {
    polymarket: { code: 'USD', sicher: true,  grund: 'handelt in USDC, einem Dollar-Wertzeichen' },
    kalshi:     { code: 'USD', sicher: true,  grund: 'rechnet in US-Cent' },
    smarkets:   { code: 'GBP', sicher: true,  grund: 'britische Boerse, Konten in Pfund' },
    betfair:    { code: null,  sicher: false, grund: 'haengt am Konto, meist GBP oder EUR, von aussen nicht bestimmbar' }
  };

  var ZEICHEN = { EUR: '€', USD: '$', GBP: '£' };

  function waehrungVon(buchNorm, vorgabeBetfair) {
    var w = BUCH_WAEHRUNG[buchNorm];
    if (!w) return { code: null, sicher: false, grund: 'unbekanntes Buch' };
    if (w.code) return w;
    /* Betfair: was der Nutzer eingestellt hat, sonst offen lassen. */
    if (vorgabeBetfair) {
      return { code: vorgabeBetfair, sicher: false, grund: 'von dir eingestellt, nicht gemessen' };
    }
    return w;
  }

  function zeichen(code) { return ZEICHEN[code] || (code ? code + ' ' : ''); }

  /* Ein Betrag mit Waehrung, immer sichtbar beschriftet. Ohne Code wird
   * ausdruecklich gesagt, dass die Waehrung offen ist, statt eine zu
   * unterstellen. */
  function geld(betrag, code, stellen) {
    if (!istZahl(betrag)) return 'unbekannt';
    var s = istZahl(stellen) ? stellen : 2;
    if (!code) return betrag.toFixed(s) + ' (Waehrung offen)';
    return betrag.toFixed(s) + ' ' + zeichen(code);
  }

  /* ---------- Kurse ----------
   * Quelle: frankfurter.dev, das sind die EZB-Referenzkurse, dieselbe
   * Quelle, die auch das Panel benutzt. Ohne Kurs wird NICHT gerechnet:
   * lieber "nicht umrechenbar" als eine erfundene Zahl. */
  var KURS_QUELLE = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,GBP';
  var kurse = null;   /* { EUR:1, USD:x, GBP:y, stand: '2026-08-19' } */

  function kurseHolen() {
    if (kurse) return Promise.resolve(kurse);
    return fetch(KURS_QUELLE)
      .then(function (a) { if (!a.ok) throw new Error('HTTP ' + a.status); return a.json(); })
      .then(function (d) {
        if (!d || !d.rates || !istZahl(d.rates.USD)) throw new Error('Antwort ohne Kurse');
        kurse = { EUR: 1, USD: d.rates.USD, GBP: d.rates.GBP, stand: d.date, quelle: KURS_QUELLE };
        return kurse;
      })
      .catch(function (f) {
        kurse = null;
        throw f;
      });
  }

  function kurseJetzt() { return kurse; }

  /* Betrag von einer Waehrung in eine andere. Fehlt ein Kurs, kommt
   * null zurueck, niemals eine geschaetzte Zahl. */
  function rechne(betrag, von, nach) {
    if (!istZahl(betrag) || !von || !nach) return null;
    if (von === nach) return betrag;
    if (!kurse || !istZahl(kurse[von]) || !istZahl(kurse[nach])) return null;
    /* kurse[x] sagt: 1 EUR = kurse[x] Einheiten von x. */
    var inEuro = betrag / kurse[von];
    return inEuro * kurse[nach];
  }

  /* ---------- Die Lage einer Prueflings ----------
   * Liefert je Seite die Waehrung und sagt, ob gemischt wird. */
  function lage(seiten, vorgabeBetfair) {
    var s = seiten || [];
    var je = s.map(function (x) {
      var w = waehrungVon(x && x.buchNorm, vorgabeBetfair);
      return { buch: x && x.buch, buchNorm: x && x.buchNorm, code: w.code, sicher: w.sicher, grund: w.grund };
    });
    var codes = je.map(function (x) { return x.code; }).filter(Boolean);
    var verschieden = codes.length >= 2 && codes[0] !== codes[1];
    var offen = je.some(function (x) { return !x.code; });
    return {
      seiten: je,
      gemischt: verschieden,
      offen: offen,
      /* Der Bericht selbst nennt eine Anzeigewaehrung; sie gilt fuer die
       * Betraege IM Bericht, nicht fuer die Konten. */
      text: verschieden
        ? 'Die beiden Seiten fuehren VERSCHIEDENE Waehrungen (' + codes.join(' und ') + '). ' +
          'Die Aufteilung wird in Euro gerechnet, und jede Seite bekommt ihren Betrag zusaetzlich ' +
          'in der Waehrung ihres Kontos. Quoten und Rendite sind davon nicht betroffen, sie sind ' +
          'Verhaeltnisse ohne Waehrung.'
        : (offen
          ? 'Bei mindestens einer Seite ist die Kontowaehrung nicht bestimmbar. Sie wird nicht geraten.'
          : 'Beide Seiten fuehren dieselbe Waehrung (' + (codes[0] || 'unbekannt') + '). Keine Verwechslungsgefahr.')
    };
  }

  /* Ein Einsatzbetrag in allen drei Sichten: Leitwaehrung, Kontowaehrung
   * der Seite, und die Berichtswaehrung. Genau das, was man beim Setzen
   * nebeneinander braucht. */
  function einsatzSichten(betragLeit, leitCode, kontoCode) {
    var inKonto = rechne(betragLeit, leitCode, kontoCode);
    return {
      leit: { betrag: betragLeit, code: leitCode, text: geld(betragLeit, leitCode) },
      konto: {
        betrag: inKonto, code: kontoCode,
        text: inKonto === null
          ? (kontoCode ? 'nicht umrechenbar, kein Kurs' : 'Kontowaehrung nicht bestimmt')
          : geld(inKonto, kontoCode)
      },
      gleich: leitCode === kontoCode
    };
  }

  var api = {
    BUCH_WAEHRUNG: BUCH_WAEHRUNG,
    waehrungVon: waehrungVon,
    zeichen: zeichen,
    geld: geld,
    kurseHolen: kurseHolen,
    kurseJetzt: kurseJetzt,
    kurseSetzen: function (k) { kurse = k; },   /* nur fuer die Selbsttests */
    rechne: rechne,
    lage: lage,
    einsatzSichten: einsatzSichten
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).waehrung = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
