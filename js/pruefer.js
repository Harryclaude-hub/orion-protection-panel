/* ORION PROTECTION PANEL, Prüfer
 *
 * Nimmt den zerlegten Bericht und rechnet ALLES eigenständig nach, und
 * zwar SO, dass ein Mensch jede Zeile selbst nachvollziehen kann. Karams
 * Vorgabe (17.08. abends): kein nacktes grünes Licht. Jeder Schritt trägt:
 *
 *   warum         , was dieser Schritt bedeutet und wozu es ihn gibt
 *   zeilen        , die Rechnung Zeile für Zeile, mit Zwischenergebnissen
 *   taschenrechner, was man wörtlich eintippt, um es selbst nachzurechnen
 *   Vergleich     , eigenes Ergebnis, Panel-Wert, Unterschied und die
 *                    ERLAUBTE Rundung samt Begründung. Grün gibt es nur
 *                    zusammen mit den Zahlen, die es beweisen.
 *
 * Drei Urteile, nie zwei:
 *   ok          eigene Rechnung und Panel decken sich (innerhalb der Rundung)
 *   abweichung  sie decken sich NICHT, wahrscheinlich ein Rechenfehler
 *   unpruefbar  eine nötige Eingabe fehlt, es wird NICHT geraten
 *
 * Daneben WARNZEICHEN: Dinge, die rechnerisch stimmen können und trotzdem
 * gefährlich sind. Die Erfahrungswerte stammen aus den Panel-Messungen vom
 * 13.08.2026: alle als richtig geprüften Funde lagen zwischen 2,07 und
 * 3,27 %, alle falschen über 4,48 %, und 7 von 8 Fehlern kamen von einem
 * alten Kurs.
 */
(function (welt) {
  'use strict';

  var R = (typeof module === 'object' && module.exports)
    ? require('./rechnung.js')
    : welt.PS.rechnung;
  var L = (typeof module === 'object' && module.exports)
    ? require('./linkpruefung.js')
    : welt.PS.linkpruefung;

  /* Toleranzen: alle Panel-Werte sind GERUNDET gedruckt (Effektivquote 3,
   * Kehrwertsumme 4, Rendite/Beträge 2 Nachkommastellen). Die Toleranz
   * deckt genau diese Druck-Rundung ab, mehr nicht. */
  var TOL = { qe: 0.0015, inv: 0.0012, rendite: 0.06, betrag: 0.06, quer: 0.06 };
  var GRUND = {
    qe: 'das Panel druckt die Effektivquote mit 3 Nachkommastellen',
    inv: 'das Panel druckt die Kehrwertsumme mit 4 Nachkommastellen',
    rendite: 'Rendite ist mit 2 Nachkommastellen gedruckt, und die Kehrwertsumme darunter mit 4',
    betrag: 'Geldbeträge sind mit 2 Nachkommastellen gedruckt',
    quer: 'beide Beträge sind mit 2 Nachkommastellen gedruckt'
  };

  function f(n, stellen) {
    return (n === null || n === undefined || !isFinite(n)) ? '?' : Number(n).toFixed(stellen);
  }
  /* Für die Taschenrechner-Zeile: Komma statt Punkt, wie auf dem Gerät. */
  function tr(n, stellen) { return f(n, stellen).replace('.', ','); }

  function schritt(liste, s) { liste.push(s); return s; }

  /* Ein Vergleichsschritt. opt: titel, warum, formel, zeilen[],
   * taschenrechner, ist, soll, toleranz, toleranzGrund, stellen, einheit,
   * kommentar. */
  function vergleich(liste, opt) {
    var s = {
      titel: opt.titel,
      warum: opt.warum || '',
      formel: opt.formel || '',
      zeilen: opt.zeilen || [],
      taschenrechner: opt.taschenrechner || '',
      ist: opt.ist, soll: opt.soll,
      stellen: opt.stellen === undefined ? 4 : opt.stellen,
      einheit: opt.einheit || '',
      toleranz: opt.toleranz,
      toleranzGrund: opt.toleranzGrund || '',
      kommentar: opt.kommentar || '',
      urteil: 'unpruefbar', delta: null
    };
    if (R.istZahl(opt.ist) && R.istZahl(opt.soll)) {
      s.delta = opt.ist - opt.soll;
      s.urteil = Math.abs(s.delta) <= opt.toleranz ? 'ok' : 'abweichung';
    } else if (R.istZahl(opt.ist)) {
      s.kommentar = (s.kommentar ? s.kommentar + ', ' : '') +
        'Der Panel-Wert fehlt im Bericht; links steht die eigene Rechnung.';
    }
    liste.push(s);
    return s;
  }

  /* ---------- Eine Seite: Effektivquote, Zeile für Zeile ---------- */
  function seitePruefen(liste, warnungen, seite, qePanelAusRechnung) {
    var name = 'Seite ' + seite.nr + ' (' + (seite.buch || '?') + ' · ' + (seite.seiteText || '?') + ')';
    var qeSoll = R.istZahl(seite.qe) ? seite.qe : qePanelAusRechnung;

    if (!R.istZahl(seite.wert) || !R.istZahl(seite.gebuehr)) {
      schritt(liste, {
        titel: name + ': Effektivquote', urteil: 'unpruefbar',
        warum: 'Ohne Kurs und Gebührensatz lässt sich hier nichts nachrechnen, und geraten wird nicht.',
        kommentar: 'Kurs oder Gebühr fehlen im Bericht.'
      });
      return null;
    }

    var e = R.qeSeite(seite.art, seite.seiteText, seite.wert, seite.gebuehr);
    var warum, formel, zeilen, rechner;
    var g = seite.gebuehr, w = seite.wert;

    if (seite.art === 'preis') {
      var geb = R.gebuehrAnteil(w, g);
      warum = 'Die Effektivquote sagt: Was bringt 1 eingesetzter Euro bei diesem Buch NACH Gebühr zurück, ' +
        'wenn der Ausgang eintrifft? Ein Anteil kostet den Preis ' + f(w, 3) + ' und zahlt bei Erfolg genau 1. ' +
        'Die Gebühr fällt je Anteil an und hängt vom Preis ab (belegte Formel des Anbieters).';
      formel = 'Gebühr je Anteil = Satz × p × (1 − p)   ·   Effektivquote = (1 − Gebühr) ÷ p';
      zeilen = [
        'Schritt A, die Gebühr je Anteil:',
        '  Satz × p × (1 − p) = ' + f(g, 3) + ' × ' + f(w, 3) + ' × ' + f(1 - w, 3) + ' = ' + f(geb, 6),
        'Schritt B, was nach der Gebühr von 1 übrig bleibt:',
        '  1 − ' + f(geb, 6) + ' = ' + f(1 - geb, 6),
        'Schritt C, geteilt durch den Preis (so viel bekommt 1 Euro):',
        '  ' + f(1 - geb, 6) + ' ÷ ' + f(w, 3) + ' = ' + f(e.qe, 6),
        'Gerundet auf 3 Stellen, wie das Panel druckt: ' + f(e.qe, 3)
      ];
      rechner = 'Tippe: ' + tr(g, 3) + ' × ' + tr(w, 3) + ' × ' + tr(1 - w, 3) + ' =   (das ist die Gebühr) · ' +
        'dann: 1 − Gebühr =   · dann: ÷ ' + tr(w, 3) + ' =';
    } else if (e.form === 'lay') {
      warum = 'Dagegenhalten (Lay): Du bist die Gegenseite. Du kassierst den fremden Einsatz, haftest aber ' +
        'mit (L − 1) je Euro, wenn der Ausgang doch eintritt. Deine Effektivquote je Euro HAFTUNG ist darum ' +
        '1 + (1 − Gebühr) ÷ (L − 1), die Kommission frisst nur am Gewinnanteil.';
      formel = 'Effektivquote = 1 + (1 − Gebühr) ÷ (L − 1)';
      zeilen = [
        'Schritt A, der Haftungs-Faktor:',
        '  L − 1 = ' + f(w, 2) + ' − 1 = ' + f(w - 1, 4),
        'Schritt B, was vom Gewinn nach der Kommission bleibt:',
        '  1 − ' + f(g, 3) + ' = ' + f(1 - g, 4),
        'Schritt C, zusammensetzen:',
        '  1 + ' + f(1 - g, 4) + ' ÷ ' + f(w - 1, 4) + ' = ' + f(e.qe, 6),
        'Gerundet auf 3 Stellen: ' + f(e.qe, 3)
      ];
      rechner = 'Tippe: ' + tr(1 - g, 3) + ' ÷ ' + tr(w - 1, 2) + ' =   · dann: + 1 =';
    } else {
      warum = 'Back an der Börse: Quote ' + f(w, 2) + ' heißt, 1 Euro Einsatz zahlt bei Erfolg ' + f(w, 2) +
        ' zurück, davon ist ' + f(w - 1, 2) + ' Gewinn, und NUR auf den Gewinn nimmt die Börse ihre Kommission.';
      formel = 'Effektivquote = 1 + (q − 1) × (1 − Gebühr)';
      zeilen = [
        'Schritt A, der Gewinnanteil der Quote:',
        '  q − 1 = ' + f(w, 2) + ' − 1 = ' + f(w - 1, 4),
        'Schritt B, was davon nach der Kommission bleibt:',
        '  ' + f(w - 1, 4) + ' × (1 − ' + f(g, 3) + ') = ' + f(w - 1, 4) + ' × ' + f(1 - g, 4) + ' = ' + f((w - 1) * (1 - g), 6),
        'Schritt C, Einsatz kommt zurück, also plus 1:',
        '  1 + ' + f((w - 1) * (1 - g), 6) + ' = ' + f(e.qe, 6),
        'Gerundet auf 3 Stellen: ' + f(e.qe, 3)
      ];
      rechner = 'Tippe: ' + tr(w - 1, 2) + ' × ' + tr(1 - g, 3) + ' =   · dann: + 1 =';
    }

    var v = vergleich(liste, {
      titel: name + ': Effektivquote nach Gebühr',
      warum: warum, formel: formel, zeilen: zeilen, taschenrechner: rechner,
      ist: e.qe, soll: qeSoll, toleranz: TOL.qe, toleranzGrund: GRUND.qe, stellen: 3
    });

    /* Passt der Panel-Wert stattdessen zur ALTEN Formel min(p,1−p)? */
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
            ', der Bericht widerspricht sich selbst. Eine der beiden Zahlen ist falsch.'
        });
      }
    }

    return e.qe;
  }

  function pruefen(bericht) {
    var liste = [];
    var warnungen = [];
    var r = bericht.rechnung || {};
    var s1 = bericht.seiten[0] || null;
    var s2 = bericht.seiten[1] || null;

    /* ---- 1) Die beiden Effektivquoten ---- */
    var qe1 = s1 ? seitePruefen(liste, warnungen, s1, r.qe1) : null;
    var qe2 = s2 ? seitePruefen(liste, warnungen, s2, r.qe2) : null;

    var eigen = (R.istZahl(qe1) && R.istZahl(qe2)) ? R.pruefe(qe1, qe2, 100) : null;
    var panelKette = (R.istZahl(r.qe1) && R.istZahl(r.qe2)) ? R.pruefe(r.qe1, r.qe2, 100) : null;

    /* ---- 2) Kehrwertsumme ---- */
    vergleich(liste, {
      titel: 'Kehrwertsumme',
      warum: '1 ÷ Effektivquote ist der PREIS eines sicheren Euros bei diesem Buch: Wer 1 ÷ qE einsetzt, ' +
        'bekommt bei Erfolg genau 1 zurück. Kauft man BEIDE Ausgänge, kostet der sichere Euro die Summe ' +
        'beider Kehrwerte. Liegt sie unter 1,0000, zahlt man weniger als einen Euro für einen sicheren Euro, ' +
        'das ist die ganze Arbitrage.',
      formel: 'inv = 1/qE1 + 1/qE2   ·   Arbitrage, wenn inv < 1',
      zeilen: eigen ? [
        'Schritt A, der sichere Euro bei Seite 1:',
        '  1 ÷ ' + f(qe1, 6) + ' = ' + f(1 / qe1, 6),
        'Schritt B, der sichere Euro bei Seite 2:',
        '  1 ÷ ' + f(qe2, 6) + ' = ' + f(1 / qe2, 6),
        'Schritt C, beide zusammen:',
        '  ' + f(1 / qe1, 6) + ' + ' + f(1 / qe2, 6) + ' = ' + f(eigen.inv, 6),
        'Gerundet auf 4 Stellen: ' + f(eigen.inv, 4) +
          (eigen.inv < 1 ? ', unter 1, also Arbitrage' : ', NICHT unter 1, also keine Arbitrage')
      ] : [],
      taschenrechner: eigen ? ('Tippe: 1 ÷ ' + tr(qe1, 3) + ' =   (merken) · 1 ÷ ' + tr(qe2, 3) + ' =   · beide Ergebnisse addieren') : '',
      ist: eigen ? eigen.inv : null, soll: r.inv, toleranz: TOL.inv, toleranzGrund: GRUND.inv, stellen: 4,
      kommentar: (eigen && panelKette && Math.abs(eigen.inv - panelKette.inv) > TOL.inv)
        ? 'Aus den PANEL-Effektivquoten ergäbe sich ' + f(panelKette.inv, 4) +
          ', die Abweichung entsteht schon bei den Effektivquoten, nicht erst hier.'
        : ''
    });

    /* ---- 3) Rendite ---- */
    vergleich(liste, {
      titel: 'Rendite nach allen Gebühren',
      warum: 'Wenn der sichere Euro nur inv kostet, macht jeder eingesetzte Euro 1 ÷ inv daraus. ' +
        'Der Überschuss über 1, in Prozent, ist die Rendite, sie gilt für JEDEN Ausgang gleich, ' +
        'denn genau dafür wird der Einsatz gleich unten aufgeteilt.',
      formel: 'Rendite = (1 ÷ inv − 1) × 100',
      zeilen: eigen ? [
        'Schritt A, was aus 1 Euro wird:',
        '  1 ÷ ' + f(eigen.inv, 6) + ' = ' + f(1 / eigen.inv, 6),
        'Schritt B, der Überschuss:',
        '  ' + f(1 / eigen.inv, 6) + ' − 1 = ' + f(1 / eigen.inv - 1, 6),
        'Schritt C, in Prozent:',
        '  ' + f(1 / eigen.inv - 1, 6) + ' × 100 = ' + f(eigen.rendite, 4) + ' %',
        'Gerundet auf 2 Stellen: ' + f(eigen.rendite, 2) + ' %'
      ] : [],
      taschenrechner: eigen ? ('Tippe: 1 ÷ ' + tr(eigen.inv, 4) + ' =   · dann: − 1 =   · dann: × 100 =') : '',
      ist: eigen ? eigen.rendite : null, soll: r.rendite,
      toleranz: TOL.rendite, toleranzGrund: GRUND.rendite, stellen: 2, einheit: '%'
    });

    /* ---- 4) Aufteilung ---- */
    if (eigen && R.istZahl(r.s1) && R.istZahl(r.s2) && r.s2 > 0) {
      vergleich(liste, {
        titel: 'Aufteilung, Verhältnis der beiden Einsätze',
        warum: 'Der Einsatz wird NICHT halbiert, sondern so geteilt, dass beide Ausgänge dasselbe auszahlen. ' +
          'Die Seite mit der NIEDRIGEREN Effektivquote braucht mehr Geld. Deshalb muss S1 ÷ S2 exakt ' +
          'qE2 ÷ qE1 sein, das ist währungsunabhängig und damit die sauberste Probe der Aufteilung.',
        formel: 'S1 ÷ S2 = qE2 ÷ qE1',
        zeilen: [
          'Schritt A, das Verhältnis der Panel-Einsätze:',
          '  ' + f(r.s1, 2) + ' ÷ ' + f(r.s2, 2) + ' = ' + f(r.s1 / r.s2, 6),
          'Schritt B, das Soll-Verhältnis aus den Effektivquoten:',
          '  ' + f(qe2, 6) + ' ÷ ' + f(qe1, 6) + ' = ' + f(qe2 / qe1, 6),
          'Beide Verhältnisse müssen gleich sein.'
        ],
        taschenrechner: 'Tippe: ' + tr(r.s1, 2) + ' ÷ ' + tr(r.s2, 2) + ' =   · und zum Vergleich: ' + tr(qe2, 3) + ' ÷ ' + tr(qe1, 3) + ' =',
        ist: qe2 / qe1, soll: r.s1 / r.s2,
        toleranz: 0.01, toleranzGrund: 'die Einsätze sind mit 2 Nachkommastellen gedruckt', stellen: 4
      });
      var summe = r.s1 + r.s2;
      var sollSumme = R.istZahl(r.fxKurs) ? 100 * r.fxKurs : 100;
      var sv = vergleich(liste, {
        titel: 'Aufteilung, Summe der beiden Einsätze',
        warum: R.istZahl(r.fxKurs)
          ? 'Das Panel rechnet mit 100 DOLLAR Grundeinsatz und zeigt die Beträge in Euro (EZB-Kurs des ' +
            'Berichts). Die Summe der beiden Euro-Beträge muss darum 100 × Kurs ergeben.'
          : 'Der Grundeinsatz ist 100, die beiden Teile müssen ihn exakt wieder ergeben, sonst ist ' +
            'unterwegs Geld verschwunden oder erfunden worden.',
        formel: R.istZahl(r.fxKurs) ? 'S1 + S2 = 100 × EZB-Kurs' : 'S1 + S2 = 100',
        zeilen: [
          '  ' + f(r.s1, 2) + ' + ' + f(r.s2, 2) + ' = ' + f(summe, 2),
          R.istZahl(r.fxKurs)
            ? '  Soll: 100 × ' + f(r.fxKurs, 4) + ' = ' + f(sollSumme, 2)
            : '  Soll: 100'
        ],
        taschenrechner: 'Tippe: ' + tr(r.s1, 2) + ' + ' + tr(r.s2, 2) + ' =',
        ist: summe, soll: sollSumme,
        toleranz: TOL.betrag, toleranzGrund: GRUND.betrag, stellen: 2, einheit: r.sEinheit || ''
      });
      if (sv.urteil === 'ok' && R.istZahl(r.fxKurs) && Math.abs(sollSumme - 100) > TOL.betrag &&
          r.einheitEinsatz === 100 && r.sEinheit === '€') {
        warnungen.push({
          stufe: 'hinweis',
          text: 'Die Panel-Zeile sagt „bei 100 € Einsatz", die Summe der Beträge ist aber ' +
            f(summe, 2) + ' €, das sind 100 DOLLAR, mit EZB-Kurs ' + f(r.fxKurs, 4) +
            ' umgerechnet. Beschriftungs-Schwäche im Panel, KEIN Rechenfehler in der Aufteilung.'
        });
      }
    } else {
      schritt(liste, {
        titel: 'Aufteilung des Einsatzes', urteil: 'unpruefbar',
        warum: 'Die Aufteilung ist nur prüfbar, wenn beide Einsätze und beide Effektivquoten da sind.',
        kommentar: 'Einsätze oder Effektivquoten fehlen.'
      });
    }

    /* ---- 5) Auszahlung ---- */
    if (eigen && R.istZahl(r.auszahlung)) {
      var fx = R.istZahl(r.fxKurs) ? r.fxKurs : 1;
      vergleich(liste, {
        titel: 'Auszahlung bei beiden Ausgängen',
        warum: 'Die versprochene Auszahlung, egal wie das Spiel ausgeht. Sie ist Einsatz ÷ Kehrwertsumme' +
          (fx !== 1 ? ', hier zusätzlich mit dem EZB-Kurs des Berichts in Euro umgerechnet.' : '.'),
        formel: 'Auszahlung = Einsatz ÷ inv' + (fx !== 1 ? ' × EZB-Kurs' : ''),
        zeilen: [
          '  100 ÷ ' + f(eigen.inv, 6) + ' = ' + f(100 / eigen.inv, 4),
          fx !== 1 ? '  × ' + f(fx, 4) + ' = ' + f(eigen.auszahlung * fx, 4) : null,
          '  Gerundet: ' + f(eigen.auszahlung * fx, 2) + (r.auszahlungEinheit ? ' ' + r.auszahlungEinheit : '')
        ].filter(function (z) { return z !== null; }),
        taschenrechner: 'Tippe: 100 ÷ ' + tr(eigen.inv, 4) + ' =' + (fx !== 1 ? '   · dann: × ' + tr(fx, 4) + ' =' : ''),
        ist: eigen.auszahlung * fx, soll: r.auszahlung,
        toleranz: TOL.betrag, toleranzGrund: GRUND.betrag, stellen: 2, einheit: r.auszahlungEinheit || ''
      });
    } else {
      schritt(liste, {
        titel: 'Auszahlung', urteil: 'unpruefbar',
        warum: 'Auszahlung = Einsatz ÷ Kehrwertsumme, ohne beide Zahlen nicht prüfbar.',
        kommentar: R.istZahl(r.auszahlung) ? 'Effektivquoten fehlen.' : 'Auszahlung fehlt im Bericht.'
      });
    }

    /* ---- 6) Max-Einsatz → Gewinn ---- */
    if (R.istZahl(r.maxEinsatz) && R.istZahl(r.echterGewinn) && R.istZahl(r.rendite)) {
      vergleich(liste, {
        titel: 'Tatsächlicher Gewinn beim maximalen Einsatz',
        warum: 'Eine Rendite ohne Menge ist nur eine Zahl: Der maximale Einsatz ist, was die dünnere der ' +
          'beiden Seiten wirklich aufnimmt. Der echte Gewinn in Geld ist dieser Einsatz mal der Rendite.',
        formel: 'Gewinn = Max-Einsatz × Rendite ÷ 100',
        zeilen: [
          '  ' + f(r.maxEinsatz, 2) + ' × ' + f(r.rendite, 2) + ' ÷ 100 = ' + f(r.maxEinsatz * r.rendite / 100, 4),
          '  Gerundet: ' + f(r.maxEinsatz * r.rendite / 100, 2)
        ],
        taschenrechner: 'Tippe: ' + tr(r.maxEinsatz, 2) + ' × ' + tr(r.rendite / 100, 4) + ' =',
        ist: r.maxEinsatz * r.rendite / 100, soll: r.echterGewinn,
        toleranz: Math.max(TOL.betrag, Math.abs(r.maxEinsatz) * 0.0006),
        toleranzGrund: 'die Rendite ist nur mit 2 Nachkommastellen gedruckt; bei großem Einsatz wächst die erlaubte Rundung mit',
        stellen: 2
      });
    } else if (r.maxEinsatz === null) {
      schritt(liste, {
        titel: 'Maximaler Einsatz', urteil: 'unpruefbar',
        warum: 'Eine der beiden Seiten meldet keine handelbare Menge, „unbekannt" ist nicht „unbegrenzt", also wird hier nichts gerechnet.',
        kommentar: 'Menge einer Seite unbekannt.'
      });
    }

    /* ---- 7) Querproben, formelunabhängig ---- */
    if (eigen) {
      if (R.istZahl(r.s1) && R.istZahl(r.s2)) {
        var a1 = r.s1 * qe1, a2 = r.s2 * qe2;
        vergleich(liste, {
          titel: 'Querprobe: beide Ausgänge zahlen GLEICH aus',
          warum: 'Die Kernidee der Absicherung, von der anderen Seite geprüft: Einsatz mal Effektivquote ist ' +
            'die Auszahlung des jeweiligen Ausgangs. Sind die beiden nicht gleich, ist es keine Absicherung, ' +
            'sondern zwei Wetten. Diese Probe nutzt die PANEL-Einsätze, sie prüft also wirklich das Panel, ' +
            'nicht sich selbst.',
          formel: 'S1 × qE1 = S2 × qE2',
          zeilen: [
            'Ausgang 1 tritt ein:  ' + f(r.s1, 2) + ' × ' + f(qe1, 6) + ' = ' + f(a1, 4),
            'Ausgang 2 tritt ein:  ' + f(r.s2, 2) + ' × ' + f(qe2, 6) + ' = ' + f(a2, 4)
          ],
          taschenrechner: 'Tippe: ' + tr(r.s1, 2) + ' × ' + tr(qe1, 3) + ' =   · und: ' + tr(r.s2, 2) + ' × ' + tr(qe2, 3) + ' =',
          ist: a1, soll: a2, toleranz: TOL.quer, toleranzGrund: GRUND.quer, stellen: 2
        });
        if (R.istZahl(r.auszahlung)) {
          vergleich(liste, {
            titel: 'Querprobe: Einsatz 1 × qE1 trifft die Auszahlung',
            warum: 'Dritter unabhängiger Weg zur selben Zahl: Der erste Einsatz mal seiner Effektivquote muss ' +
              'genau die versprochene Auszahlung ergeben. Drei Wege, ein Ergebnis, erst dann ist die Zahl belastbar.',
            formel: 'S1 × qE1 = Auszahlung',
            zeilen: ['  ' + f(r.s1, 2) + ' × ' + f(qe1, 6) + ' = ' + f(a1, 4) + '   (Panel-Auszahlung: ' + f(r.auszahlung, 2) + ')'],
            taschenrechner: 'Tippe: ' + tr(r.s1, 2) + ' × ' + tr(qe1, 3) + ' =',
            ist: a1, soll: r.auszahlung, toleranz: TOL.quer, toleranzGrund: GRUND.quer, stellen: 2
          });
        }
      }
      if (R.istZahl(r.rendite) && R.istZahl(r.inv)) {
        vergleich(liste, {
          titel: 'Querprobe: Rendite passt zur Kehrwertsumme des Panels',
          warum: 'Hier wird NUR mit den Zahlen des Panels gerechnet: Passt seine eigene Rendite zu seiner ' +
            'eigenen Kehrwertsumme? Wenn nicht, widerspricht sich der Bericht in sich, ganz gleich, ' +
            'welche Kurse stimmen.',
          formel: '(1 ÷ inv − 1) × 100, mit dem inv DES PANELS',
          zeilen: [
            '  1 ÷ ' + f(r.inv, 4) + ' = ' + f(1 / r.inv, 6),
            '  (' + f(1 / r.inv, 6) + ' − 1) × 100 = ' + f((1 / r.inv - 1) * 100, 4) + ' %',
            '  Panel-Rendite: ' + f(r.rendite, 2) + ' %'
          ],
          taschenrechner: 'Tippe: 1 ÷ ' + tr(r.inv, 4) + ' =   · dann: − 1 =   · dann: × 100 =',
          ist: (1 / r.inv - 1) * 100, soll: r.rendite,
          toleranz: TOL.rendite, toleranzGrund: GRUND.rendite, stellen: 2, einheit: '%'
        });
      }
    }

    /* ---- 8) Warnzeichen ---- */
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
        warnungen.push({ stufe: 'hinweis', text: 'Seite ' + s.nr + ' (' + s.buch + '): Kursalter nicht hinterlegt, nicht prüfbar.' });
      }
      if (s.gebuehrEcht === false) {
        warnungen.push({
          stufe: 'hinweis',
          text: 'Seite ' + s.nr + ' (' + s.buch + '): Gebührensatz ist der dokumentierte Standardtarif, ' +
            'NICHT am Konto gemessen. Ein anderer Tarif (z. B. Smarkets Select 3 %) würde die Rendite drücken.'
        });
      }
      if (s.menge === null && s.mengeText) {
        warnungen.push({ stufe: 'warnung', text: 'Seite ' + s.nr + ' (' + s.buch + '): Handelbare Menge unbekannt, unbekannt ist NICHT unbegrenzt.' });
      }
    });

    /* Link-Prüfung: ein falscher Link wiegt wie ein Rechenfehler. */
    var links = L ? L.pruefen(bericht) : [];
    links.forEach(function (l) {
      if (l.urteil === 'falsch') {
        warnungen.push({ stufe: 'fehler', text: 'Link Seite ' + l.nr + ' (' + (l.buch || '?') + '): ' + l.text });
      }
    });

    if (R.istZahl(r.buchSumme) && r.buchSumme < 1) {
      warnungen.push({
        stufe: 'warnung',
        text: 'Buchprobe Gegenbuch: ' + f(r.buchSumme, 4) + ' < 1, das Gegenbuch widerspricht sich ' +
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
            '(2,07–3,27 %). Kein Beweis für einen Fehler, aber genauer hinsehen.'
        });
      }
    }

    if (R.istZahl(bericht.zuordnung) && bericht.zuordnung < 0.8) {
      warnungen.push({
        stufe: 'warnung',
        text: 'Zuordnung ' + f(bericht.zuordnung, 2) + ', die Sicherheit, dass beide Bücher DIESELBE ' +
          'Partie meinen, ist mäßig. Die häufigste Fehlerquelle war nie die Rechnung, sondern die ' +
          'Paarung. Beide Links öffnen und die Partie vergleichen.'
      });
    }

    if (bericht.absage && /KOSTET GELD/i.test(bericht.absage)) {
      warnungen.push({ stufe: 'warnung', text: 'Absage-Bilanz: Bei einer Absage passen die Rückzahlungsregeln der Bücher NICHT zusammen, der dritte Ausgang kostet Geld.' });
    } else if (bericht.absage && /nicht voll belegt|nicht berechenbar/i.test(bericht.absage)) {
      warnungen.push({ stufe: 'hinweis', text: 'Absage-Bilanz nicht voll belegt, die Regel des Marktes VOR dem Setzen lesen.' });
    }

    if (bericht.nachpruefungPanel && /WEICHT AB/i.test(bericht.nachpruefungPanel)) {
      warnungen.push({ stufe: 'fehler', text: 'Das Panel selbst meldet in seiner eigenen Nachrechnung eine Abweichung: ' + bericht.nachpruefungPanel });
    }

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
              'zahlt 3 %, damit wäre die Rendite ' + f(mitOrbit.rendite, 2) + ' %.'
          });
        }
      }
    });

    /* ---- 9) Gesamturteil ---- */
    var abw = 0, unpr = 0, boese = 0;
    liste.forEach(function (s) {
      if (s.urteil === 'abweichung') abw++;
      if (s.urteil === 'unpruefbar') unpr++;
    });
    warnungen.forEach(function (w) { if (w.stufe === 'fehler') boese++; });

    var urteil;
    if (abw > 0 || boese > 0) {
      var teile = [];
      if (abw > 0) teile.push(abw + ' Rechenstelle(n) decken sich nicht, dort von Hand nachrechnen und ausbessern');
      if (boese > 0) teile.push(boese + ' harte(r) Befund(e) daneben (falscher Link oder Selbstwiderspruch des Berichts)');
      urteil = { stufe: 'fehler', text: 'WAHRSCHEINLICH FEHLER: ' + teile.join(' · ') + '. Die betroffenen Stellen sind rot markiert.' };
    } else if (unpr > 0) {
      urteil = { stufe: 'teilweise', text: 'Rechnung deckt sich, soweit prüfbar, ' + unpr + ' Schritt(e) waren mangels Angaben nicht prüfbar.' };
    } else {
      urteil = { stufe: 'ok', text: 'Die Rechnung deckt sich vollständig mit der eigenen Nachrechnung, jeder Schritt unten zeigt die Zahlen, die das belegen.' };
    }

    /* Die Rechnungen TRENNEN: jeder Schritt gehört zu genau einem Block. */
    liste.forEach(function (s) {
      if (s.titel.indexOf('Seite 1') === 0) s.gruppe = 'Rechnung Seite 1';
      else if (s.titel.indexOf('Seite 2') === 0) s.gruppe = 'Rechnung Seite 2';
      else if (s.titel.indexOf('Querprobe') === 0) s.gruppe = 'Querproben (formelunabhängig)';
      else s.gruppe = 'Die Verknüpfung, beide Seiten zusammen';
    });

    return { schritte: liste, warnungen: warnungen, urteil: urteil, eigen: eigen, qe1: qe1, qe2: qe2, links: links };
  }

  var api = { pruefen: pruefen, TOL: TOL };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).pruefer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
