/* ORION PRÜFSTAND — Prüfer
 *
 * Nimmt den zerlegten Bericht und rechnet ALLES eigenständig nach, Schritt
 * für Schritt. Jeder Schritt trägt: Formel, eingesetzte Zahlen, eigenes
 * Ergebnis, den Wert des Panels und ein Urteil.
 *
 * Drei Urteile, nie zwei:
 *   ok          eigene Rechnung und Panel decken sich (innerhalb Toleranz)
 *   abweichung  sie decken sich NICHT — wahrscheinlich ein Rechenfehler
 *   unpruefbar  eine nötige Eingabe fehlt — es wird NICHT geraten
 *
 * Daneben WARNZEICHEN: Dinge, die rechnerisch stimmen können und trotzdem
 * gefährlich sind (alter Kurs, unstimmiges Buch, verdächtig hohe Rendite).
 * Die Erfahrungswerte dazu stammen aus den Panel-Messungen vom 13.08.2026:
 * alle als richtig geprüften Funde lagen zwischen 2,07 und 3,27 %, alle
 * falschen über 4,48 % — und 7 von 8 Fehlern kamen von einem alten Kurs.
 */
(function (welt) {
  'use strict';

  var R = (typeof module === 'object' && module.exports)
    ? require('./rechnung.js')
    : welt.PS.rechnung;

  /* Toleranzen: alle Panel-Werte sind GERUNDET gedruckt (Effektivquote 3,
   * Kehrwertsumme 4, Rendite/Beträge 2 Nachkommastellen). Die Toleranz
   * deckt die Rundung ab — mehr nicht. Was darüber liegt, weicht ab. */
  var TOL = { qe: 0.0015, inv: 0.0012, rendite: 0.06, betrag: 0.06, quer: 0.06 };

  function f(n, stellen) {
    return (n === null || n === undefined || !isFinite(n)) ? '?' : Number(n).toFixed(stellen);
  }

  function schritt(liste, s) { liste.push(s); return s; }

  function vergleich(liste, opt) {
    /* opt: titel, formel, rechnung, ist, soll, toleranz, stellen, kommentar */
    var s = {
      titel: opt.titel, formel: opt.formel || '', rechnung: opt.rechnung || '',
      ist: opt.ist, soll: opt.soll, stellen: opt.stellen === undefined ? 4 : opt.stellen,
      einheit: opt.einheit || '', kommentar: opt.kommentar || '', urteil: 'unpruefbar', delta: null
    };
    if (R.istZahl(opt.ist) && R.istZahl(opt.soll)) {
      s.delta = opt.ist - opt.soll;
      s.urteil = Math.abs(s.delta) <= opt.toleranz ? 'ok' : 'abweichung';
    } else if (R.istZahl(opt.ist)) {
      s.kommentar = (s.kommentar ? s.kommentar + ' — ' : '') +
        'Panel-Wert fehlt im Bericht; eigene Rechnung steht links.';
    }
    liste.push(s);
    return s;
  }

  function seitePruefen(liste, warnungen, seite, qePanelAusRechnung) {
    var name = 'Seite ' + seite.nr + ' (' + (seite.buch || '?') + ' · ' + (seite.seiteText || '?') + ')';
    var qeSoll = R.istZahl(seite.qe) ? seite.qe : qePanelAusRechnung;

    if (!R.istZahl(seite.wert) || !R.istZahl(seite.gebuehr)) {
      schritt(liste, {
        titel: name + ': Effektivquote', urteil: 'unpruefbar',
        kommentar: 'Kurs oder Gebühr fehlen im Bericht — ohne sie ist nichts nachrechenbar.'
      });
      return null;
    }

    var e = R.qeSeite(seite.art, seite.seiteText, seite.wert, seite.gebuehr);
    var formel, rechnung;
    if (seite.art === 'preis') {
      var g = R.gebuehrAnteil(seite.wert, seite.gebuehr);
      formel = 'Gebühr = Satz × p × (1 − p) → qE = (1 − Gebühr) ÷ p';
      rechnung = f(seite.gebuehr * 100, 1) + ' % × ' + f(seite.wert, 3) + ' × ' + f(1 - seite.wert, 3) +
        ' = ' + f(g, 4) + ' → (1 − ' + f(g, 4) + ') ÷ ' + f(seite.wert, 3) + ' = ' + f(e.qe, 3);
    } else if (e.form === 'lay') {
      formel = 'qE = 1 + (1 − Gebühr) ÷ (L − 1)';
      rechnung = '1 + ' + f(1 - seite.gebuehr, 2) + ' ÷ ' + f(seite.wert - 1, 2) + ' = ' + f(e.qe, 3);
    } else {
      formel = 'qE = 1 + (q − 1) × (1 − Gebühr)';
      rechnung = '1 + ' + f(seite.wert - 1, 2) + ' × ' + f(1 - seite.gebuehr, 2) + ' = ' + f(e.qe, 3);
    }

    var v = vergleich(liste, {
      titel: name + ': Effektivquote nach Gebühr',
      formel: formel, rechnung: rechnung,
      ist: e.qe, soll: qeSoll, toleranz: TOL.qe, stellen: 3
    });

    /* Passt der Panel-Wert stattdessen zur ALTEN Formel min(p,1−p)?
     * Dann ist das keine Zufalls-Abweichung, sondern die bekannte
     * Alt-Fassung der Gebührenrechnung — das wird ausdrücklich gesagt. */
    if (v.urteil === 'abweichung' && seite.art === 'preis' && R.istZahl(e.qeAlt) &&
        R.istZahl(qeSoll) && Math.abs(e.qeAlt - qeSoll) <= TOL.qe) {
      v.kommentar = 'Der Panel-Wert entspricht der ALTEN Gebührenformel Satz × min(p, 1−p). ' +
        'Die belegte Formel (Anbieterdoku, Panel-Übergabe 8f) ist Satz × p × (1−p). ' +
        'Richtig wäre ' + f(e.qe, 3) + ' statt ' + f(qeSoll, 3) + '.';
    }

    /* Widerspricht die Formelzeile des Panels ihrem eigenen Endwert? */
    if (seite.formelText && R.istZahl(seite.qe) && seite.formelZahlen.length) {
      var letzte = seite.formelZahlen[seite.formelZahlen.length - 1];
      if (R.istZahl(letzte) && Math.abs(letzte - seite.qe) > TOL.qe) {
        warnungen.push({
          stufe: 'fehler',
          text: name + ': Die Formel-Zeile des Panels endet auf ' + f(letzte, 3) +
            ', die angezeigte Effektivquote ist ' + f(seite.qe, 3) +
            ' — der Bericht widerspricht sich selbst. Eine der beiden Zahlen ist falsch.'
        });
      }
    }

    return e.qe;
  }

  function pruefen(bericht) {
    var liste = [];       // Rechenschritte mit Urteil
    var warnungen = [];   // { stufe: 'fehler'|'warnung'|'hinweis', text }
    var r = bericht.rechnung || {};
    var s1 = bericht.seiten[0] || null;
    var s2 = bericht.seiten[1] || null;

    /* ---- 1) Die beiden Effektivquoten, eigenständig gerechnet ---- */
    var qe1 = s1 ? seitePruefen(liste, warnungen, s1, r.qe1) : null;
    var qe2 = s2 ? seitePruefen(liste, warnungen, s2, r.qe2) : null;

    /* ---- 2) Kehrwertsumme, Rendite, Aufteilung, Auszahlung ---- */
    var eigen = (R.istZahl(qe1) && R.istZahl(qe2)) ? R.pruefe(qe1, qe2, 100) : null;

    /* Für die WEITEREN Schritte gilt: wenn die eigene qe von der Panel-qe
     * abweicht, würde jede Folgezeile mit abweichen. Deshalb wird die Kette
     * ZWEIMAL geprüft: einmal mit den eigenen qe (stimmt die ganze Rechnung
     * von Grund auf?) und einmal mit den Panel-qe (hat das Panel aus SEINEN
     * Zahlen richtig weitergerechnet?). So sieht man genau, WO es bricht. */
    var panelKette = (R.istZahl(r.qe1) && R.istZahl(r.qe2)) ? R.pruefe(r.qe1, r.qe2, 100) : null;

    vergleich(liste, {
      titel: 'Kehrwertsumme',
      formel: 'inv = 1/qE1 + 1/qE2',
      rechnung: eigen ? ('1/' + f(qe1, 3) + ' + 1/' + f(qe2, 3) + ' = ' + f(eigen.inv, 4)) : '',
      ist: eigen ? eigen.inv : null, soll: r.inv, toleranz: TOL.inv, stellen: 4,
      kommentar: (eigen && panelKette && Math.abs(eigen.inv - panelKette.inv) > TOL.inv)
        ? 'Aus den PANEL-Effektivquoten ergäbe sich ' + f(panelKette.inv, 4) +
          ' — die Abweichung entsteht schon bei den Effektivquoten, nicht erst hier.'
        : ''
    });

    vergleich(liste, {
      titel: 'Rendite nach allen Gebühren',
      formel: 'Rendite = (1/inv − 1) × 100',
      rechnung: eigen ? ('(1/' + f(eigen.inv, 4) + ' − 1) × 100 = ' + f(eigen.rendite, 2) + ' %') : '',
      ist: eigen ? eigen.rendite : null, soll: r.rendite, toleranz: TOL.rendite, stellen: 2, einheit: '%'
    });

    /* Aufteilung: Beträge können in € (umgerechnete Dollar) stehen.
     * Der WÄHRUNGSFREIE Kern ist das Verhältnis S1:S2 = qE2:qE1. */
    if (eigen && R.istZahl(r.s1) && R.istZahl(r.s2) && r.s2 > 0) {
      vergleich(liste, {
        titel: 'Aufteilung — Verhältnis der beiden Einsätze',
        formel: 'S1 ÷ S2 = qE2 ÷ qE1 (währungsunabhängig)',
        rechnung: f(eigen.s1, 2) + ' ÷ ' + f(eigen.s2, 2) + ' = ' + f(eigen.s1 / eigen.s2, 4),
        ist: eigen.s1 / eigen.s2, soll: r.s1 / r.s2, toleranz: 0.01, stellen: 4
      });
      var summe = r.s1 + r.s2;
      var sollSumme = R.istZahl(r.fxKurs) ? 100 * r.fxKurs : 100;
      var sv = vergleich(liste, {
        titel: 'Aufteilung — Summe der beiden Einsätze',
        formel: R.istZahl(r.fxKurs)
          ? 'S1 + S2 = 100 $ × EZB-Kurs (die Beträge sind umgerechnete Dollar)'
          : 'S1 + S2 = 100',
        rechnung: f(r.s1, 2) + ' + ' + f(r.s2, 2) + ' = ' + f(summe, 2),
        ist: summe, soll: sollSumme, toleranz: TOL.betrag, stellen: 2, einheit: r.sEinheit || ''
      });
      if (sv.urteil === 'ok' && R.istZahl(r.fxKurs) && Math.abs(sollSumme - 100) > TOL.betrag &&
          r.einheitEinsatz === 100 && r.sEinheit === '€') {
        warnungen.push({
          stufe: 'hinweis',
          text: 'Die Panel-Zeile sagt „bei 100 € Einsatz", die Summe der Beträge ist aber ' +
            f(summe, 2) + ' € — das sind 100 DOLLAR, mit EZB-Kurs ' + f(r.fxKurs, 4) +
            ' umgerechnet. Beschriftungs-Schwäche im Panel, KEIN Rechenfehler in der Aufteilung.'
        });
      }
    } else {
      schritt(liste, { titel: 'Aufteilung des Einsatzes', urteil: 'unpruefbar', kommentar: 'Einsätze oder Effektivquoten fehlen.' });
    }

    /* Auszahlung: 100/inv, ggf. mal EZB-Kurs. */
    if (eigen && R.istZahl(r.auszahlung)) {
      var fx = R.istZahl(r.fxKurs) ? r.fxKurs : 1;
      vergleich(liste, {
        titel: 'Auszahlung bei beiden Ausgängen',
        formel: 'Auszahlung = Einsatz ÷ inv' + (fx !== 1 ? ' × EZB-Kurs' : ''),
        rechnung: '100 ÷ ' + f(eigen.inv, 4) + (fx !== 1 ? ' × ' + f(fx, 4) : '') + ' = ' + f(eigen.auszahlung * fx, 2),
        ist: eigen.auszahlung * fx, soll: r.auszahlung, toleranz: TOL.betrag, stellen: 2, einheit: r.auszahlungEinheit || ''
      });
    } else {
      schritt(liste, { titel: 'Auszahlung', urteil: 'unpruefbar', kommentar: R.istZahl(r.auszahlung) ? 'Effektivquoten fehlen.' : 'Auszahlung fehlt im Bericht.' });
    }

    /* Max. Einsatz → tatsächlicher Gewinn (währungsfrei über die Rendite). */
    if (R.istZahl(r.maxEinsatz) && R.istZahl(r.echterGewinn) && R.istZahl(r.rendite)) {
      vergleich(liste, {
        titel: 'Tatsächlicher Gewinn beim maximalen Einsatz',
        formel: 'Gewinn = Max-Einsatz × Rendite ÷ 100',
        rechnung: f(r.maxEinsatz, 2) + ' × ' + f(r.rendite, 2) + ' % = ' + f(r.maxEinsatz * r.rendite / 100, 2),
        ist: r.maxEinsatz * r.rendite / 100, soll: r.echterGewinn,
        toleranz: Math.max(TOL.betrag, Math.abs(r.maxEinsatz) * 0.0006), stellen: 2
      });
    } else if (r.maxEinsatz === null) {
      schritt(liste, { titel: 'Maximaler Einsatz', urteil: 'unpruefbar', kommentar: 'Eine der beiden Seiten meldet keine Menge — „unbekannt" ist nicht „unbegrenzt".' });
    }

    /* ---- 3) Querproben — unabhängig von den Formeln oben ---- */
    if (eigen) {
      /* Mit den PANEL-Einsätzen, nicht den eigenen: die eigenen erfüllen die
       * Gleichung nach Bauart immer — geprüft werden soll die Aufteilung des
       * Panels. Die Währung kürzt sich heraus (beide Seiten gleich skaliert). */
      if (R.istZahl(r.s1) && R.istZahl(r.s2)) {
        var a1 = r.s1 * qe1, a2 = r.s2 * qe2;
        vergleich(liste, {
          titel: 'Querprobe: beide Ausgänge zahlen GLEICH aus',
          formel: 'S1 × qE1 = S2 × qE2 — sonst ist es keine Absicherung',
          rechnung: f(r.s1, 2) + ' × ' + f(qe1, 3) + ' = ' + f(a1, 2) + ' · ' +
                    f(r.s2, 2) + ' × ' + f(qe2, 3) + ' = ' + f(a2, 2),
          ist: a1, soll: a2, toleranz: TOL.quer, stellen: 2
        });
        if (R.istZahl(r.auszahlung)) {
          vergleich(liste, {
            titel: 'Querprobe: Einsatz 1 × qE1 trifft die Auszahlung',
            formel: 'S1 × qE1 = Auszahlung',
            rechnung: f(r.s1, 2) + ' × ' + f(qe1, 3) + ' = ' + f(a1, 2),
            ist: a1, soll: r.auszahlung, toleranz: TOL.quer, stellen: 2
          });
        }
      }
      if (R.istZahl(r.rendite) && R.istZahl(r.inv)) {
        vergleich(liste, {
          titel: 'Querprobe: Rendite passt zur Kehrwertsumme des Panels',
          formel: '(1/inv − 1) × 100, mit dem inv DES PANELS',
          rechnung: '(1/' + f(r.inv, 4) + ' − 1) × 100 = ' + f((1 / r.inv - 1) * 100, 2) + ' %',
          ist: (1 / r.inv - 1) * 100, soll: r.rendite, toleranz: TOL.rendite, stellen: 2, einheit: '%'
        });
      }
    }

    /* ---- 4) Warnzeichen (rechnerisch ok kann trotzdem gefährlich sein) ---- */
    [s1, s2].forEach(function (s) {
      if (!s) return;
      if (R.istZahl(s.kursSeitMinuten) && s.kursSeitMinuten > 15) {
        warnungen.push({
          stufe: 'warnung',
          text: 'Seite ' + s.nr + ' (' + s.buch + '): Der Kurs steht seit ' + s.kursSeitText +
            ' unverändert. Erfahrung vom 13.08.: 7 von 8 falschen Funden kamen von einem alten, ' +
            'klebenden Kurs. Vor dem Setzen die Zahl direkt beim Anbieter ansehen.'
        });
      }
      if (s.kursSeitMinuten === null && s.kursSeitText) {
        warnungen.push({ stufe: 'hinweis', text: 'Seite ' + s.nr + ' (' + s.buch + '): Kursalter nicht hinterlegt — nicht prüfbar.' });
      }
      if (s.gebuehrEcht === false) {
        warnungen.push({
          stufe: 'hinweis',
          text: 'Seite ' + s.nr + ' (' + s.buch + '): Gebührensatz ist der dokumentierte Standardtarif, ' +
            'NICHT am Konto gemessen. Ein anderer Tarif (z. B. Smarkets Select 3 %) würde die Rendite drücken.'
        });
      }
      if (s.menge === null && s.mengeText) {
        warnungen.push({ stufe: 'warnung', text: 'Seite ' + s.nr + ' (' + s.buch + '): Handelbare Menge unbekannt — unbekannt ist NICHT unbegrenzt.' });
      }
      if (!s.link) {
        warnungen.push({ stufe: 'warnung', text: 'Seite ' + s.nr + ' (' + s.buch + '): Link fehlt im Bericht — beide Links sind Pflicht.' });
      }
    });

    if (R.istZahl(r.buchSumme) && r.buchSumme < 1) {
      warnungen.push({
        stufe: 'warnung',
        text: 'Buchprobe Gegenbuch: ' + f(r.buchSumme, 4) + ' < 1 — das Gegenbuch widerspricht sich ' +
          'selbst, vermutlich klebt ein Kurs. Gemessen (13.08.): unstimmige Bücher erzeugten fünfmal ' +
          'so oft Scheinchancen über 2 %.'
      });
    }

    var massRendite = R.istZahl(r.rendite) ? r.rendite : (eigen ? eigen.rendite : null);
    if (R.istZahl(massRendite)) {
      if (massRendite > 4.4) {
        warnungen.push({
          stufe: 'warnung',
          text: 'Rendite ' + f(massRendite, 2) + ' % liegt über 4,4 %. Erfahrungswert der Prüfung vom ' +
            '13.08.: ALLE als falsch erwiesenen Funde lagen über 4,48 %, alle richtigen zwischen ' +
            '2,07 und 3,27 %. Solche Ausreißer waren bisher immer ein alter Kurs oder eine Fehlpaarung.'
        });
      } else if (massRendite > 3.3) {
        warnungen.push({
          stufe: 'hinweis',
          text: 'Rendite ' + f(massRendite, 2) + ' % liegt über dem bisher als richtig gemessenen Band ' +
            '(2,07–3,27 %). Kein Beweis für einen Fehler — aber genauer hinsehen.'
        });
      }
    }

    if (R.istZahl(bericht.zuordnung) && bericht.zuordnung < 0.8) {
      warnungen.push({
        stufe: 'warnung',
        text: 'Zuordnung ' + f(bericht.zuordnung, 2) + ' — die Sicherheit, dass beide Bücher DIESELBE ' +
          'Partie meinen, ist mäßig. Die häufigste Fehlerquelle war nie die Rechnung, sondern die ' +
          'Paarung. Beide Links öffnen und die Partie vergleichen.'
      });
    }

    if (bericht.absage && /KOSTET GELD/i.test(bericht.absage)) {
      warnungen.push({ stufe: 'warnung', text: 'Absage-Bilanz: Bei einer Absage passen die Rückzahlungsregeln der Bücher NICHT zusammen — der dritte Ausgang kostet Geld.' });
    } else if (bericht.absage && /nicht voll belegt|nicht berechenbar/i.test(bericht.absage)) {
      warnungen.push({ stufe: 'hinweis', text: 'Absage-Bilanz nicht voll belegt — die Regel des Marktes VOR dem Setzen lesen.' });
    }

    if (bericht.nachpruefungPanel && /WEICHT AB/i.test(bericht.nachpruefungPanel)) {
      warnungen.push({ stufe: 'fehler', text: 'Das Panel selbst meldet in seiner eigenen Nachrechnung eine Abweichung: ' + bericht.nachpruefungPanel });
    }

    /* Betfair-Seite: der Bericht rechnet mit dem Betfair-Satz des Marktes;
     * wer über Orbit setzt, zahlt pauschal 3 %. Zur Einordnung beide zeigen. */
    [s1, s2].forEach(function (s, i) {
      var andere = i === 0 ? s2 : s1;
      if (!s || s.buchNorm !== 'betfair' || !R.istZahl(s.gebuehr)) return;
      if (Math.abs(s.gebuehr - 0.03) < 0.0001) return;
      if (!andere) return;
      var eS = R.qeSeite(s.art, s.seiteText, s.wert, 0.03);
      var eA = R.qeSeite(andere.art, andere.seiteText, andere.wert, andere.gebuehr);
      if (R.istZahl(eS.qe) && R.istZahl(eA.qe)) {
        var mitOrbit = i === 0 ? R.pruefe(eS.qe, eA.qe, 100) : R.pruefe(eA.qe, eS.qe, 100);
        if (mitOrbit) {
          warnungen.push({
            stufe: 'hinweis',
            text: 'Betfair-Seite ist mit ' + f(s.gebuehr * 100, 1) + ' % gerechnet. Wer über ORBIT setzt, ' +
              'zahlt 3 % — damit wäre die Rendite ' + f(mitOrbit.rendite, 2) + ' %.'
          });
        }
      }
    });

    /* ---- 5) Gesamturteil ---- */
    var abw = 0, unpr = 0;
    liste.forEach(function (s) {
      if (s.urteil === 'abweichung') abw++;
      if (s.urteil === 'unpruefbar') unpr++;
    });
    warnungen.forEach(function (w) { if (w.stufe === 'fehler') abw++; });

    var urteil;
    if (abw > 0) {
      urteil = { stufe: 'fehler', text: 'WAHRSCHEINLICH RECHENFEHLER — ' + abw + ' Stelle(n) decken sich nicht. Die betroffenen Schritte sind markiert; dort von Hand nachrechnen und ausbessern.' };
    } else if (unpr > 0) {
      urteil = { stufe: 'teilweise', text: 'Rechnung deckt sich, soweit prüfbar — ' + unpr + ' Schritt(e) waren mangels Angaben nicht prüfbar.' };
    } else {
      urteil = { stufe: 'ok', text: 'Die Rechnung deckt sich vollständig mit der eigenen Nachrechnung.' };
    }

    return { schritte: liste, warnungen: warnungen, urteil: urteil, eigen: eigen, qe1: qe1, qe2: qe2 };
  }

  var api = { pruefen: pruefen, TOL: TOL };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).pruefer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
