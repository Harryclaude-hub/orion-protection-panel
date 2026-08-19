/* ORION PROTECTION PANEL, Abgleich Bericht gegen Anbieter
 *
 * Karams Frage vom 19.08.2026: "Du schaust bei vielen Sachen aus dem
 * Bericht und pruefst nicht selber nach." Genau richtig. Bis dahin kamen
 * ALLE Eingangswerte aus dem Bericht, und nur die Ableitungen wurden
 * selbst gerechnet. Wer die Gebuehr glaubt, die er pruefen soll, prueft
 * nichts.
 *
 * Dieses Modul stellt jede Angabe des Berichts der Angabe des Anbieters
 * gegenueber. Verglichen wird, was der Anbieter wirklich hergibt:
 *
 *   KURS          bester Briefkurs aus dem Orderbuch
 *   GEBUEHRENSATZ feeSchedule.rate, also der Satz des Anbieters selbst
 *   MENGE         Menge an der besten Preisstufe, in Geld
 *   MARKTSTATUS   offen oder geschlossen
 *
 * Drei Urteile wie ueberall: deckt sich, weicht ab, nicht pruefbar.
 * Was der Anbieter nicht hergibt, bleibt ausdruecklich ungeprueft. Es
 * wird nichts geraten und nichts stillschweigend uebernommen.
 */
(function (welt) {
  'use strict';

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }

  /* Wie genau muss es stimmen? Kurse bewegen sich, Gebuehrensaetze nicht.
   * Deshalb zwei sehr verschiedene Massstaebe. */
  var TOL_PREIS = 0.0005;      /* Anteilspreis, 3 Nachkommastellen gedruckt */
  var TOL_QUOTE = 0.005;       /* Dezimalquote, 2 Nachkommastellen */
  var TOL_SATZ = 0.0001;       /* Gebuehrensatz: muss praktisch exakt sein */
  var TOL_MENGE_ANTEIL = 0.15; /* Mengen schwanken staerker: 15 Prozent */

  function befund(art, urteil, text, wertBericht, wertAnbieter) {
    return {
      art: art, urteil: urteil, text: text,
      bericht: wertBericht === null || wertBericht === undefined ? null : wertBericht,
      anbieter: wertAnbieter === null || wertAnbieter === undefined ? null : wertAnbieter
    };
  }

  /* Eine Seite abgleichen.
   * seite: aus dem Bericht (art, wert, gebuehr, menge, buch)
   * live:  vom Anbieter (status, wert, gebuehrSatz, mengeGeld, ...) */
  function seite(seiteBericht, live) {
    var aus = [];
    var s = seiteBericht || {};
    var name = s.buch || 'Seite';

    if (!live || live.status !== 'ok') {
      aus.push(befund('Kurs', 'unpruefbar',
        (live && live.text) ? live.text : 'Diese Seite ist von hier aus nicht abfragbar.',
        s.wert, null));
      return aus;
    }

    /* 1) Kurs */
    var tol = s.art === 'preis' ? TOL_PREIS : TOL_QUOTE;
    if (!istZahl(s.wert) || !istZahl(live.wert)) {
      aus.push(befund('Kurs', 'unpruefbar', 'Ein Wert fehlt.', s.wert, live.wert));
    } else {
      var d = live.wert - s.wert;
      if (Math.abs(d) <= tol) {
        aus.push(befund('Kurs', 'deckt sich',
          'Der Kurs steht beim Anbieter unveraendert bei ' + live.wert + '.', s.wert, live.wert));
      } else {
        var richtung = d > 0 ? 'gestiegen' : 'gefallen';
        /* Fuer den Kaeufer eines Anteils ist ein hoeherer Preis schlechter,
         * bei einer Back-Quote ist eine niedrigere Quote schlechter. */
        var schlechter = s.art === 'preis' ? (d > 0) : (d < 0);
        aus.push(befund('Kurs', 'weicht ab',
          'Der Kurs ist seit dem Bericht ' + richtung + ': ' + s.wert + ' im Bericht, ' +
          live.wert + ' jetzt beim Anbieter. Das ist ' +
          (schlechter ? 'SCHLECHTER als gerechnet, die Rendite faellt.'
                      : 'besser als gerechnet.') +
          ' Der Prueffall unten rechnet mit den aktuellen Zahlen neu.',
          s.wert, live.wert));
      }
    }

    /* 2) Gebuehrensatz. Der wichtigste Punkt: er geht in jede Rechnung
     *    ein und wurde bisher ungeprueft aus dem Bericht uebernommen. */
    if (!istZahl(live.gebuehrSatz)) {
      aus.push(befund('Gebuehrensatz', 'unpruefbar',
        'Der Anbieter nennt in dieser Abfrage keinen Satz.', s.gebuehr, null));
    } else if (!istZahl(s.gebuehr)) {
      aus.push(befund('Gebuehrensatz', 'unpruefbar',
        'Der Bericht nennt keinen Satz, der Anbieter sagt ' + (live.gebuehrSatz * 100).toFixed(2) + ' Prozent.',
        null, live.gebuehrSatz));
    } else if (Math.abs(live.gebuehrSatz - s.gebuehr) <= TOL_SATZ) {
      aus.push(befund('Gebuehrensatz', 'deckt sich',
        'Der Anbieter bestaetigt ' + (live.gebuehrSatz * 100).toFixed(1) + ' Prozent' +
        (live.gebuehrNurTaker ? ' (nur fuer Taker, und wer zum Briefkurs kauft, ist Taker).' : '.'),
        s.gebuehr, live.gebuehrSatz));
    } else {
      var hoeher = live.gebuehrSatz > s.gebuehr;
      aus.push(befund('Gebuehrensatz', 'weicht ab',
        'FALSCHER GEBUEHRENSATZ im Bericht: dort ' + (s.gebuehr * 100).toFixed(1) +
        ' Prozent, beim Anbieter ' + (live.gebuehrSatz * 100).toFixed(1) + ' Prozent. ' +
        (hoeher ? 'Die echte Gebuehr ist HOEHER, die Rendite des Berichts ist zu gut gerechnet.'
                : 'Die echte Gebuehr ist niedriger.') +
        ' Dieser Satz geht in jede Zeile der Rechnung ein.',
        s.gebuehr, live.gebuehrSatz));
    }

    /* 3) Handelbare Menge an der besten Stufe. */
    if (!istZahl(live.mengeGeld)) {
      aus.push(befund('Handelbare Menge', 'unpruefbar',
        'Das Orderbuch nennt keine Menge zur besten Stufe.', s.menge, null));
    } else if (!istZahl(s.menge)) {
      aus.push(befund('Handelbare Menge', 'unpruefbar',
        'Der Bericht nennt keine Menge. Beim Anbieter liegen gerade ' +
        live.mengeGeld.toFixed(2) + ' an der besten Stufe.', null, live.mengeGeld));
    } else {
      var verhaeltnis = s.menge > 0 ? Math.abs(live.mengeGeld - s.menge) / s.menge : 1;
      if (verhaeltnis <= TOL_MENGE_ANTEIL) {
        aus.push(befund('Handelbare Menge', 'deckt sich',
          'Beim Anbieter liegen ' + live.mengeGeld.toFixed(2) + ', im Bericht ' + s.menge.toFixed(2) + '.',
          s.menge, live.mengeGeld));
      } else {
        var weniger = live.mengeGeld < s.menge;
        aus.push(befund('Handelbare Menge', 'weicht ab',
          'Die Menge hat sich deutlich veraendert: ' + s.menge.toFixed(2) + ' im Bericht, ' +
          live.mengeGeld.toFixed(2) + ' jetzt. ' +
          (weniger ? 'Es passt WENIGER Geld hinein als gerechnet.'
                   : 'Es passt mehr hinein als gerechnet.'),
          s.menge, live.mengeGeld));
      }
    }

    /* 4) Mindestgroesse: nicht vergleichbar, aber wichtig fuer den Einsatz. */
    if (istZahl(live.mindestGroesse) && live.mindestGroesse > 0) {
      aus.push(befund('Mindestbestellung', 'deckt sich',
        'Der Anbieter verlangt mindestens ' + live.mindestGroesse + ' Anteile je Auftrag. ' +
        'Kleinere Einsaetze nimmt er nicht an.', null, live.mindestGroesse));
    }

    aus.forEach(function (x) { x.buch = name; });
    return aus;
  }

  /* Beide Seiten. Liefert Befunde plus eine Zusammenfassung. */
  function pruefe(bericht, aktualitaet) {
    var seiten = (bericht && bericht.seiten) || [];
    var live = (aktualitaet && aktualitaet.seiten) || [];
    var alle = [];
    for (var i = 0; i < seiten.length; i++) {
      seite(seiten[i], live[i]).forEach(function (b) {
        b.nr = seiten[i].nr;
        alle.push(b);
      });
    }
    var abweichungen = alle.filter(function (b) { return b.urteil === 'weicht ab'; });
    var gebuehrFalsch = abweichungen.filter(function (b) { return b.art === 'Gebuehrensatz'; }).length > 0;
    return {
      befunde: alle,
      abweichungen: abweichungen,
      anzahlAbweichungen: abweichungen.length,
      gebuehrFalsch: gebuehrFalsch,
      stufe: abweichungen.length ? 'weicht ab'
        : (alle.some(function (b) { return b.urteil === 'unpruefbar'; }) ? 'teilweise' : 'deckt sich')
    };
  }

  /* Die Werte, mit denen NEU gerechnet werden sollte: alles vom Anbieter,
   * wo er etwas sagt, sonst der Bericht. So entsteht die zweite Rechnung
   * mit den echten Zahlen. */
  function echteWerte(bericht, aktualitaet) {
    var seiten = (bericht && bericht.seiten) || [];
    var live = (aktualitaet && aktualitaet.seiten) || [];
    return seiten.map(function (s, i) {
      var l = live[i];
      var frisch = l && l.status === 'ok';
      return {
        art: s.art,
        seiteText: s.seiteText,
        wert: (frisch && istZahl(l.wert)) ? l.wert : s.wert,
        wertFrisch: !!(frisch && istZahl(l.wert)),
        gebuehr: (frisch && istZahl(l.gebuehrSatz)) ? l.gebuehrSatz : s.gebuehr,
        gebuehrFrisch: !!(frisch && istZahl(l.gebuehrSatz)),
        menge: (frisch && istZahl(l.mengeGeld)) ? l.mengeGeld : s.menge,
        mengeFrisch: !!(frisch && istZahl(l.mengeGeld)),
        buch: s.buch, buchNorm: s.buchNorm, nr: s.nr
      };
    });
  }

  var api = {
    seite: seite, pruefe: pruefe, echteWerte: echteWerte,
    TOL_PREIS: TOL_PREIS, TOL_QUOTE: TOL_QUOTE, TOL_SATZ: TOL_SATZ, TOL_MENGE_ANTEIL: TOL_MENGE_ANTEIL
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).abgleich = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
