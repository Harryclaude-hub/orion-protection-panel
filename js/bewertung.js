/* ORION PROTECTION PANEL, Bewertung
 *
 * Zwei Fragen, die NICHT dasselbe sind, und deren Vermischung der
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
 *   ROT     entweder ein Rechenfehler/falscher Link, ODER die Rechnung
 *           stimmt, aber es bleibt KEIN Gewinn übrig
 *
 * Die 1-%-Grenze ist keine Willkür: aus den Panel-Messungen vom 13.08.
 * lagen alle als richtig belegten Funde zwischen 2,07 und 3,27 %. Was
 * darunter liegt, wird von Rundung, einer kleinen Kursbewegung oder einem
 * abweichenden Gebührentarif regelmäßig aufgefressen.
 *
 * Reine Mathematik und Entscheidungslogik, kein DOM, im Node-Prüfstand
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
      /* Was in JEDEM Fall an die Bücher geht, die Gebühr des Ausgangs,
       * der eintritt. Da immer genau einer eintritt, liegt die Gebühr
       * zwischen diesen beiden Werten. */
      gebuehrMin: Math.min(a.gebuehrGeld, b.gebuehrGeld),
      gebuehrMax: Math.max(a.gebuehrGeld, b.gebuehrGeld)
    };
  }

  /* ---------- Die Ampel ----------
   * opt: rechnungStufe ('ok'|'teilweise'|'fehler'), harteBefunde (Zahl),
   *      warnungen (Zahl), rendite (effektiv, in Prozent),
   *      paarungStufe ('passt'|'unbekannt'|'falsch') */
  function ampel(opt) {
    var gruende = [];
    var rechnungOk = opt.rechnungStufe === 'ok';
    var rechnungKaputt = opt.rechnungStufe === 'fehler';
    var r = opt.rendite;
    var rechnungAntwort = rechnungOk ? 'geprüft, deckt sich'
      : (rechnungKaputt ? 'weicht ab' : 'teilweise prüfbar');

    /* 0) Die Paarung zuerst, und mit EIGENER Begründung. Eine falsche
     *    Paarung macht die Rechnung nicht falsch; sie macht die ganze
     *    Absicherung wertlos, weil zwei verschiedene Spiele gewettet
     *    werden. Das muss dastehen, nicht „Rechenfehler". */
    if (opt.paarungStufe === 'falsch') {
      return {
        stufe: 'rot',
        kopf: 'NICHT SETZEN, ZWEI VERSCHIEDENE SPIELE',
        satz: 'Die Rechnung ist in Ordnung, aber die beiden Bücher meinen nicht dieselbe Partie ' +
              '(unterschiedliche Altersklasse, Anpfiffzeit oder Liga). Dann ist es keine ' +
              'Absicherung, sondern zwei offene Wetten. Die Einzelheiten stehen in der ' +
              'Herkunftstabelle darüber.',
        gewinnfrage: 'NEIN, es ist keine Absicherung',
        rechnungfrage: rechnungAntwort
      };
    }

    /* 1) Rechenfehler oder falscher Link schlagen alles. */
    if (rechnungKaputt) {
      return {
        stufe: 'rot',
        kopf: 'NICHT SETZEN, die Rechnung stimmt nicht',
        satz: 'In der Rechnung des Berichts steckt mindestens ein Fehler. Solange der nicht ' +
              'geklärt ist, sagt die Rendite gar nichts aus.',
        gewinnfrage: 'unklar, weil die Rechnung nicht stimmt',
        rechnungfrage: 'weicht ab'
      };
    }

    /* 2) Rechnung stimmt, jetzt die zweite, davon unabhängige Frage. */
    if (!istZahl(r)) {
      return {
        stufe: 'orange',
        kopf: 'UNKLAR, Gewinn nicht berechenbar',
        satz: 'Die Rechnung des Berichts ist in Ordnung, aber es fehlen Angaben, um den ' +
              'tatsächlichen Gewinn zu bestimmen.',
        gewinnfrage: 'nicht berechenbar',
        rechnungfrage: rechnungOk ? 'geprüft, deckt sich' : 'teilweise prüfbar'
      };
    }

    if (r <= 0) {
      return {
        stufe: 'rot',
        kopf: 'RECHNUNG RICHTIG, ABER KEIN GEWINN',
        satz: 'Der Bericht hat sauber gerechnet. Trotzdem bleibt nach allen Gebühren nichts ' +
              'übrig (' + r.toFixed(2) + ' %). Das ist keine Arbitrage, sondern eine Wette. ' +
              'Nicht setzen.',
        gewinnfrage: 'NEIN, ' + r.toFixed(2) + ' %',
        rechnungfrage: rechnungOk ? 'geprüft, deckt sich' : 'teilweise prüfbar'
      };
    }

    if (r < GRENZE_LOHNT) {
      gruende.push('Gewinn unter ' + GRENZE_LOHNT.toFixed(1) + ' %, Rundung, eine kleine ' +
                   'Kursbewegung oder ein anderer Gebührentarif fressen das leicht auf');
    }
    if (opt.warnungen > 0) {
      gruende.push(opt.warnungen + ' Warnzeichen (z. B. alter Kurs oder unbekannte Menge)');
    }
    if (!rechnungOk) {
      gruende.push('Teile der Rechnung waren mangels Angaben nicht prüfbar');
    }
    if (opt.paarungStufe === 'unbekannt') {
      gruende.push('nicht alle Merkmale der Partie waren vergleichbar, vor dem Setzen ' +
                   'beide Links öffnen und Partie, Anpfiff und Liga selbst vergleichen');
    }

    if (gruende.length) {
      return {
        stufe: 'orange',
        kopf: 'KNAPP, mit Vorsicht',
        satz: 'Es bleibt Gewinn übrig (' + r.toFixed(2) + ' %), aber die Lage ist dünn: ' +
              gruende.join(' · ') + '.',
        gewinnfrage: 'ja, knapp, ' + r.toFixed(2) + ' %',
        rechnungfrage: rechnungOk ? 'geprüft, deckt sich' : 'teilweise prüfbar',
        gruende: gruende
      };
    }

    return {
      stufe: 'gruen',
      kopf: 'LOHNT SICH, echte Arbitrage',
      satz: 'Die Rechnung deckt sich mit der eigenen Nachrechnung, und nach allen Gebühren ' +
            'bleiben ' + r.toFixed(2) + ' % sicherer Gewinn, unabhängig vom Ausgang.',
      gewinnfrage: 'JA, ' + r.toFixed(2) + ' %',
      rechnungfrage: 'geprüft, deckt sich'
    };
  }


  /* ---------- ZWEI GETRENNTE AMPELN (Karam 19.08.) ----------
   * Karams Anordnung: nicht eine gemischte Anzeige, sondern zwei, die
   * je fuer sich rot oder gruen sind:
   *
   *   AMPEL 1  Stimmt die Rechnung, die ich dir gegeben habe?
   *   AMPEL 2  Ist es profitabel?
   *
   * Der Grund, warum das getrennt gehoert: die beiden haben nichts
   * miteinander zu tun. Ein Bericht kann fehlerfrei gerechnet sein und
   * trotzdem Verlust bringen. Und eine Rendite von 3 Prozent ist
   * wertlos, wenn die Rechnung dahinter nicht stimmt. Wer beides in
   * eine Lampe presst, verliert genau die Auskunft, auf die es
   * ankommt. */
  function zweiAmpeln(opt) {
    var r = opt.rendite;

    /* ---- AMPEL 1: die Rechnung des Berichts ---- */
    var rech;
    if (opt.rechnungStufe === "fehler") {
      rech = {
        stufe: "rot", kurz: "RECHNUNG FALSCH",
        satz: "Mindestens eine Stelle der Rechnung deckt sich nicht mit der eigenen " +
              "Nachrechnung. Die roten Bloecke im Rechenweg zeigen, welche."
      };
    } else if (opt.rechnungStufe === "teilweise") {
      rech = {
        stufe: "orange", kurz: "TEILWEISE PRUEFBAR",
        satz: "Was nachgerechnet werden konnte, deckt sich. Fuer den Rest fehlten " +
              "Angaben im Bericht. Es wurde nichts geraten."
      };
    } else {
      rech = {
        stufe: "gruen", kurz: "RECHNUNG STIMMT",
        satz: "Jede Zahl des Berichts wurde eigenstaendig nachgerechnet und deckt sich, " +
              "innerhalb der Rundung, mit der die Werte gedruckt sind."
      };
    }

    /* ---- AMPEL 2: lohnt es sich wirklich? ---- */
    var gew;
    if (opt.paarungStufe === "falsch") {
      gew = {
        stufe: "rot", kurz: "KEIN GEWINN",
        satz: "Die beiden Buecher meinen nicht dieselbe Partie. Dann ist es keine " +
              "Absicherung, sondern zwei offene Wetten, egal was die Rechnung sagt."
      };
    } else if (!istZahl(r)) {
      gew = {
        stufe: "orange", kurz: "NICHT BERECHENBAR",
        satz: "Es fehlen Angaben, um den tatsaechlichen Gewinn zu bestimmen."
      };
    } else if (r <= 0) {
      gew = {
        stufe: "rot", kurz: "KEIN GEWINN",
        satz: "Nach allen Gebuehren bleibt nichts uebrig (" + r.toFixed(2) + " Prozent). " +
              "Nicht setzen."
      };
    } else if (r < GRENZE_LOHNT) {
      gew = {
        stufe: "orange", kurz: "KNAPP PROFITABEL",
        satz: "Es bleiben " + r.toFixed(2) + " Prozent, also weniger als ein Prozent. " +
              "Rundung, eine kleine Kursbewegung oder ein anderer Gebuehrentarif fressen das leicht auf."
      };
    } else if (opt.warnungen > 0) {
      gew = {
        stufe: "orange", kurz: "PROFITABEL, ABER",
        satz: "Es bleiben " + r.toFixed(2) + " Prozent sicherer Gewinn, aber es stehen " +
              opt.warnungen + " Warnzeichen dagegen (etwa ein alter Kurs oder eine unbekannte Menge)."
      };
    } else {
      gew = {
        stufe: "gruen", kurz: "PROFITABEL",
        satz: "Nach allen Gebuehren bleiben " + r.toFixed(2) + " Prozent sicherer Gewinn, " +
              "unabhaengig davon, wie das Spiel ausgeht."
      };
    }

    /* Steht die Rechnung des Berichts auf Rot, muss bei der Gewinnzahl
     * dabeistehen, woher SIE kommt: aus der eigenen Nachrechnung, nicht
     * aus dem Bericht. Sonst liest es sich wie ein Guetesiegel fuer eine
     * falsche Rechnung. */
    if (opt.rechnungStufe === "fehler" && istZahl(r)) {
      gew.satz += " Diese Zahl stammt aus der eigenen Nachrechnung, nicht aus dem " +
        "Bericht: dessen Rechnung ist ja gerade als fehlerhaft erkannt.";
    }

    return { rechnung: rech, gewinn: gew };
  }

  var api = {
    GRENZE_LOHNT: GRENZE_LOHNT,
    form: form,
    seiteFluss: seiteFluss,
    geldfluss: geldfluss,
    ampel: ampel,
    zweiAmpeln: zweiAmpeln
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).bewertung = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
