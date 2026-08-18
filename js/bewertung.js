/* ORION PROTECTION PANEL — Bewertung
 *
 * Zwei Fragen, die NICHT dasselbe sind — und deren Vermischung der
 * gefährlichste Fehler wäre:
 *
 *   1. STIMMT DIE RECHNUNG?   (macht das Panel Rechenfehler?)
 *   2. LOHNT ES SICH?         (bleibt nach allen Gebühren Geld übrig?)
 *
 * Eine Rechnung kann fehlerfrei sein und trotzdem keinen Cent Gewinn
 * bringen. Genau dieser Fall bekommt hier eine eigene Farbe, statt unter
 * einem grünen Haken zu verschwinden.
 *
 * Die Ampel:
 *   GRÜN    Rechnung stimmt UND es bleibt spürbar Gewinn (>= 1 %)
 *   ORANGE  knapp: Gewinn unter 1 %, oder Warnzeichen, oder Teile der
 *           Rechnung waren nicht prüfbar
 *   ROT     entweder ein Rechenfehler/falscher Link — ODER die Rechnung
 *           stimmt, aber es bleibt KEIN Gewinn übrig
 *
 * Die 1-%-Grenze ist keine Willkür: aus den Panel-Messungen vom 13.08.
 * lagen alle als richtig belegten Funde zwischen 2,07 und 3,27 %. Was
 * darunter liegt, wird von Rundung, einer kleinen Kursbewegung oder einem
 * abweichenden Gebührentarif regelmäßig aufgefressen.
 *
 * Reine Mathematik und Entscheidungslogik — kein DOM, im Node-Prüfstand
 * testbar.
 */
(function (welt) {
  'use strict';

  var R = (typeof module === 'object' && module.exports)
    ? require('./rechnung.js')
    : welt.PS.rechnung;

  var GRENZE_LOHNT = 1.0;   /* Prozent: darunter ist es "knapp" */

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }

  /* ---------- Der Geldfluss, in echtem Geld ----------
   * opt: seiten [{art, seiteText, wert, gebuehr, buch}], qe1, qe2,
   *      s1, s2 (die tatsächlich gesetzten Beträge)
   * Für JEDEN Ausgang: was kommt brutto zurück, was frisst die Gebühr,
   * was bleibt netto, was ist der Gewinn. */
  function form(seite) {
    if (!seite) return null;
    if (seite.art === 'preis') return 'anteil';
    return String(seite.seiteText || '').toLowerCase() === 'lay' ? 'lay' : 'back';
  }

  function seiteFluss(seite, qe, einsatz, gesamtEinsatz) {
    if (!seite || !istZahl(qe) || !istZahl(einsatz)) return null;
    var fm = form(seite);
    var ohne = R.quoteOhneGebuehr(fm, seite.wert);
    var brutto = istZahl(ohne) ? einsatz * ohne : null;
    var netto = einsatz * qe;
    var gebuehr = istZahl(brutto) ? brutto - netto : null;
    return {
      buch: seite.buch || '?',
      buchNorm: seite.buchNorm || null,
      seiteText: seite.seiteText || '',
      einsatz: einsatz,
      quoteRoh: seite.wert,
      quoteOhneGebuehr: ohne,
      quoteMitGebuehr: qe,
      gebuehrSatz: seite.gebuehr,
      bruttoRueckgabe: brutto,
      gebuehrGeld: gebuehr,
      nettoRueckgabe: netto,
      gewinn: netto - gesamtEinsatz
    };
  }

  function geldfluss(opt) {
    var s1 = opt.s1, s2 = opt.s2;
    if (!istZahl(s1) || !istZahl(s2)) return null;
    var gesamt = s1 + s2;
    var a = seiteFluss(opt.seite1, opt.qe1, s1, gesamt);
    var b = seiteFluss(opt.seite2, opt.qe2, s2, gesamt);
    if (!a || !b) return null;
    var schlechter = a.gewinn <= b.gewinn ? a : b;
    var besser = a.gewinn <= b.gewinn ? b : a;
    return {
      gesamtEinsatz: gesamt,
      seite1: a, seite2: b,
      schlechtesterAusgang: schlechter,
      besterAusgang: besser,
      garantierterGewinn: schlechter.gewinn,
      garantierteRendite: gesamt > 0 ? schlechter.gewinn / gesamt * 100 : null,
      /* Was in JEDEM Fall an die Bücher geht — die Gebühr des Ausgangs,
       * der eintritt. Da immer genau einer eintritt, liegt die Gebühr
       * zwischen diesen beiden Werten. */
      gebuehrMin: Math.min(a.gebuehrGeld, b.gebuehrGeld),
      gebuehrMax: Math.max(a.gebuehrGeld, b.gebuehrGeld)
    };
  }

  /* ---------- Die Ampel ----------
   * opt: rechnungStufe ('ok'|'teilweise'|'fehler'), harteBefunde (Zahl),
   *      warnungen (Zahl), rendite (effektiv, in Prozent),
   *      istArbitrage (bool) */
  function ampel(opt) {
    var gruende = [];
    var rechnungOk = opt.rechnungStufe === 'ok';
    var rechnungKaputt = opt.rechnungStufe === 'fehler';
    var r = opt.rendite;

    /* 1) Rechenfehler oder falscher Link schlagen alles. */
    if (rechnungKaputt) {
      return {
        stufe: 'rot',
        kopf: 'NICHT SETZEN — die Rechnung stimmt nicht',
        satz: 'In der Rechnung des Berichts steckt mindestens ein Fehler. Solange der nicht ' +
              'geklärt ist, sagt die Rendite gar nichts aus.',
        gewinnfrage: 'unklar, weil die Rechnung nicht stimmt',
        rechnungfrage: 'weicht ab'
      };
    }

    /* 2) Rechnung stimmt — jetzt die zweite, davon unabhängige Frage. */
    if (!istZahl(r)) {
      return {
        stufe: 'orange',
        kopf: 'UNKLAR — Gewinn nicht berechenbar',
        satz: 'Die Rechnung des Berichts ist in Ordnung, aber es fehlen Angaben, um den ' +
              'tatsächlichen Gewinn zu bestimmen.',
        gewinnfrage: 'nicht berechenbar',
        rechnungfrage: rechnungOk ? 'geprüft, deckt sich' : 'teilweise prüfbar'
      };
    }

    if (r <= 0) {
      return {
        stufe: 'rot',
        kopf: 'RECHNUNG RICHTIG — ABER KEIN GEWINN',
        satz: 'Der Bericht hat sauber gerechnet. Trotzdem bleibt nach allen Gebühren nichts ' +
              'übrig (' + r.toFixed(2) + ' %). Das ist keine Arbitrage, sondern eine Wette. ' +
              'Nicht setzen.',
        gewinnfrage: 'NEIN — ' + r.toFixed(2) + ' %',
        rechnungfrage: rechnungOk ? 'geprüft, deckt sich' : 'teilweise prüfbar'
      };
    }

    if (r < GRENZE_LOHNT) {
      gruende.push('Gewinn unter ' + GRENZE_LOHNT.toFixed(1) + ' % — Rundung, eine kleine ' +
                   'Kursbewegung oder ein anderer Gebührentarif fressen das leicht auf');
    }
    if (opt.warnungen > 0) {
      gruende.push(opt.warnungen + ' Warnzeichen (z. B. alter Kurs oder unbekannte Menge)');
    }
    if (!rechnungOk) {
      gruende.push('Teile der Rechnung waren mangels Angaben nicht prüfbar');
    }

    if (gruende.length) {
      return {
        stufe: 'orange',
        kopf: 'KNAPP — mit Vorsicht',
        satz: 'Es bleibt Gewinn übrig (' + r.toFixed(2) + ' %), aber die Lage ist dünn: ' +
              gruende.join(' · ') + '.',
        gewinnfrage: 'ja, knapp — ' + r.toFixed(2) + ' %',
        rechnungfrage: rechnungOk ? 'geprüft, deckt sich' : 'teilweise prüfbar',
        gruende: gruende
      };
    }

    return {
      stufe: 'gruen',
      kopf: 'LOHNT SICH — echte Arbitrage',
      satz: 'Die Rechnung deckt sich mit der eigenen Nachrechnung, und nach allen Gebühren ' +
            'bleiben ' + r.toFixed(2) + ' % sicherer Gewinn — unabhängig vom Ausgang.',
      gewinnfrage: 'JA — ' + r.toFixed(2) + ' %',
      rechnungfrage: 'geprüft, deckt sich'
    };
  }

  var api = {
    GRENZE_LOHNT: GRENZE_LOHNT,
    form: form,
    seiteFluss: seiteFluss,
    geldfluss: geldfluss,
    ampel: ampel
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).bewertung = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
