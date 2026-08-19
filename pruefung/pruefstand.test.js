/* ORION PRÜFSTAND — Selbsttest (node pruefung/pruefstand.test.js)
 *
 * Regel aus dem Panel übernommen: für jede Schutzregel ein Test, der sie
 * AUSLÖST. Ein Prüfer, der nie anschlägt, ist von einem kaputten Prüfer
 * nicht zu unterscheiden. Deshalb hier beides: ein sauberer Bericht muss
 * durchgehen, und jeder eingebaute Fehler muss gefunden werden.
 */
'use strict';

var R = require('../js/rechnung.js');
var Parser = require('../js/parser.js');
var Pruefer = require('../js/pruefer.js');

var laeufe = 0, fehler = 0;
function ok(bedingung, name) {
  laeufe++;
  if (bedingung) return;
  fehler++;
  console.log('  FEHLT: ' + name);
}

/* ---------- Muster-Bericht im exakten kopierText-Format des Panels ---------- */
function fx(n, s) { return Number(n).toFixed(s); }

function berichtBauen(opt) {
  /* opt: p1, satz1, seite1, buch1 · q2, satz2, seite2, buch2 · Überschreibungen */
  var qe1 = opt.qe1Druck !== undefined ? null : R.qeSeite('preis', opt.seite1, opt.p1, opt.satz1).qe;
  var qe2 = R.qeSeite('quote', opt.seite2, opt.q2, opt.satz2).qe;
  var qe1Echt = R.qeSeite('preis', opt.seite1, opt.p1, opt.satz1).qe;
  var e = R.pruefe(qe1Echt, qe2, 100);
  var qe1Druck = opt.qe1Druck !== undefined ? opt.qe1Druck : fx(qe1Echt, 3);
  var g1 = R.gebuehrAnteil(opt.p1, opt.satz1);
  var renditeDruck = opt.renditeDruck !== undefined ? opt.renditeDruck
    : (e.rendite >= 0 ? '+' : '') + fx(e.rendite, 2);
  var z = [];
  z.push('ORION PANEL PRO — vollständiger Prüfbericht einer Zeile');
  z.push('Kopiert am 17.08. 21:40');
  z.push('----------------------------------------');
  z.push('SPIEL/FRAGE: ' + (opt.titel || 'FC Probe gegen SV Muster'));
  z.push('Bereich: Fußball (Tag: soccer)');
  z.push('Partie beim zweiten Buch: FC Probe v SV Muster');
  z.push('Zuordnung (wie sicher dieselbe Partie gemeint ist): ' + fx(opt.zuordnung === undefined ? 0.92 : opt.zuordnung, 2));
  z.push('----------------------------------------');
  z.push('SEITE 1 — ' + (opt.buch1 || 'Polymarket') + ': ' + opt.seite1 + ' · Anteilspreis ' + fx(opt.p1, 3));
  z.push('  Ausgang: FC Probe');
  z.push('  Gebühr: ' + fx(opt.satz1 * 100, 1) + ' % (dokumentierter Standardtarif, nicht am Konto gemessen)');
  z.push('  Effektivquote (nach Gebühr): ' + qe1Druck);
  z.push('  Formel: Gebührenanteil = Satz × Preis × (1 − Preis) = ' + fx(opt.satz1 * 100, 1) + ' % × ' +
    fx(opt.p1, 3) + ' × ' + fx(1 - opt.p1, 3) + ' = ' + fx(g1, 4) +
    ' → Effektivquote = (1 − ' + fx(g1, 4) + ') ÷ ' + fx(opt.p1, 3) + ' = ' + qe1Druck);
  z.push('  Kurs unverändert seit: ' + (opt.kursSeit1 || '4 min'));
  z.push('  Handelbare Menge (beste Preisstufe): ' + (opt.menge1 || '182.40 $'));
  z.push('  Link: https://polymarket.com/event/fc-probe-sv-muster/fc-probe-sv-muster-winner');
  z.push('SEITE 2 — ' + (opt.buch2 || 'Smarkets') + ': ' + opt.seite2 + ' · Quote ' + fx(opt.q2, 2));
  z.push('  Ausgang: SV Muster oder Unentschieden');
  z.push('  Gebühr: ' + fx(opt.satz2 * 100, 1) + ' % (dokumentierter Standardtarif, nicht am Konto gemessen)');
  z.push('  Effektivquote (nach Gebühr): ' + fx(qe2, 3));
  z.push('  Kurs unverändert seit: ' + (opt.kursSeit2 || '2 min'));
  z.push('  Handelbare Menge (beste Preisstufe): ' + (opt.menge2 || '96.10 $'));
  z.push('  Link: https://smarkets.com/event/44991234/sport/football/fc-probe-vs-sv-muster');
  z.push('----------------------------------------');
  z.push('DIE RECHNUNG (so kam das Ergebnis zustande):');
  z.push('  Kehrwertsumme = 1/' + qe1Druck + ' + 1/' + fx(qe2, 3) + ' = ' + fx(e.inv, 4));
  z.push('  Rendite = (1 / ' + fx(e.inv, 4) + ' - 1) x 100 = ' + renditeDruck + ' % — nach allen Gebühren');
  z.push('  Aufteilung bei 100 $ Einsatz: ' + fx(e.s1, 2) + ' $ auf ' + (opt.buch1 || 'Polymarket') +
    ', ' + fx(e.s2, 2) + ' $ auf ' + (opt.buch2 || 'Smarkets'));
  z.push('  Auszahlung bei BEIDEN Ausgängen: ' + fx(e.auszahlung, 2) + ' $');
  z.push('  Max. Einsatz (beide Seiten zusammen): ' + (opt.maxEinsatz || fx(240, 2) + ' $') +
    ' · tatsächlicher Gewinn: ' + (opt.gewinn || fx(240 * e.rendite / 100, 2) + ' $'));
  if (opt.buchSumme !== undefined) z.push('  Buchprobe Gegenbuch: ' + fx(opt.buchSumme, 4) +
    (opt.buchSumme < 1 ? ' — UNSTIMMIG, ein Kurs klebt vermutlich' : ' — stimmig'));
  z.push('  Währung: kein Wechselkurs verfügbar — Beträge in $');
  z.push('----------------------------------------');
  z.push('ZEITEN:');
  z.push('  Gefunden: 17.08. 21:12 (vor 28 min)');
  z.push('  Zuletzt bestätigt (beide Seiten so gesehen): 17.08. 21:39 (vor 1 min)');
  z.push('  Anpfiff: 18.08. 20:00 (laut Smarkets)');
  z.push('  Wette endet: 18.08. 20:00 — Achtung: das ist meist der Anpfiff, nicht das Spielende');
  z.push('----------------------------------------');
  z.push('ABSAGE-BILANZ (der dritte Ausgang): nicht voll belegt — die Regel des Marktes VOR dem Setzen lesen');
  z.push('Extern nachrechnen: https://beispiel-rechner.example — beide Effektivquoten als Quoten eintragen, Gebühr dort 0 (steckt schon drin).');
  z.push('Interne Nummer der Zeile: #217');
  return { text: z.join('\n'), e: e, qe2: qe2 };
}

/* ---------- 1) Reine Rechnung ---------- */
console.log('1) Rechenmodul');
ok(Math.abs(R.qeAnteil(0.48, 0.04) - (1 - 0.04 * 0.48 * 0.52) / 0.48) < 1e-12, 'qeAnteil neu');
ok(Math.abs(R.qeAnteilAlt(0.48, 0.04) - (1 - 0.04 * 0.48) / 0.48) < 1e-12, 'qeAnteilAlt (min-Formel)');
ok(Math.abs(R.qeBack(2.06, 0.02) - (1 + 1.06 * 0.98)) < 1e-12, 'qeBack');
ok(Math.abs(R.qeLay(1.20, 0.02) - (1 + 0.98 / 0.20)) < 1e-12, 'qeLay');
ok(R.qeAnteil(1.2, 0.04) === null, 'Preis über 1 abgelehnt');
ok(R.qeBack(0.9, 0.02) === null, 'Quote unter 1 abgelehnt');
var probe = R.pruefe(2.0625, 2.0388, 100);
ok(Math.abs(probe.s1 * probe.qe1 - probe.s2 * probe.qe2) < 1e-9, 'gleiche Auszahlung beider Ausgänge');
ok(Math.abs(probe.s1 + probe.s2 - 100) < 1e-9, 'Einsätze summieren auf 100');
ok(Math.abs(probe.auszahlung * probe.inv - 100) < 1e-9, 'Auszahlung × inv = Einsatz');

/* ---------- 2) Sauberer Bericht: parsen + Urteil "deckt sich" ---------- */
console.log('2) Sauberer Bericht');
var sauber = berichtBauen({ p1: 0.480, satz1: 0.04, seite1: 'JA', q2: 2.06, satz2: 0.02, seite2: 'Back' });
var b = Parser.parse(sauber.text);
ok(b.erkannt, 'Bericht erkannt');
ok(b.fehlend.length === 0, 'nichts fehlt (' + b.fehlend.join(', ') + ')');
ok(b.titel === 'FC Probe gegen SV Muster', 'Titel');
ok(b.bereich === 'Fußball' && b.tag === 'soccer', 'Bereich + Tag');
ok(Math.abs(b.zuordnung - 0.92) < 1e-9, 'Zuordnung');
ok(b.seiten.length === 2, 'zwei Seiten');
ok(b.seiten[0].buchNorm === 'polymarket' && b.seiten[0].art === 'preis', 'Seite 1 Buch/Art');
ok(Math.abs(b.seiten[0].wert - 0.480) < 1e-9, 'Seite 1 Preis');
ok(Math.abs(b.seiten[0].gebuehr - 0.04) < 1e-9, 'Seite 1 Gebühr');
ok(b.seiten[0].gebuehrEcht === false, 'Seite 1 Gebühr nicht gemessen');
ok(b.seiten[0].seiteText === 'JA', 'Seite 1 Seitentext');
ok(b.seiten[1].buchNorm === 'smarkets' && b.seiten[1].art === 'quote', 'Seite 2 Buch/Art');
ok(Math.abs(b.seiten[1].wert - 2.06) < 1e-9, 'Seite 2 Quote');
ok(b.seiten[0].link && b.seiten[0].link.indexOf('polymarket.com') > 0, 'Seite 1 Link');
ok(Math.abs(b.rechnung.inv - Number(fx(sauber.e.inv, 4))) < 1e-9, 'inv gelesen');
ok(Math.abs(b.rechnung.rendite - Number(fx(sauber.e.rendite, 2))) < 1e-9, 'Rendite gelesen');
ok(Math.abs(b.rechnung.s1 - Number(fx(sauber.e.s1, 2))) < 1e-9, 'S1 gelesen');
ok(b.rechnung.sEinheit === '$', 'Einheit $');
ok(b.rechnung.fxKurs === null, 'kein EZB-Kurs');
ok(b.nummer === '217', 'interne Nummer');
ok(b.absage && b.absage.indexOf('nicht voll belegt') === 0, 'Absage-Bilanz ohne Klammer-Vorspann');

var erg = Pruefer.pruefen(b);
ok(erg.urteil.stufe === 'ok', 'Urteil: deckt sich (ist: ' + erg.urteil.stufe + ')');
var abwSchritte = erg.schritte.filter(function (s) { return s.urteil === 'abweichung'; });
ok(abwSchritte.length === 0, 'keine Abweichungsschritte (' +
  abwSchritte.map(function (s) { return s.titel; }).join(' | ') + ')');

/* ---------- 3) Falsche Rendite MUSS anschlagen ---------- */
console.log('3) Eingebaute falsche Rendite');
var kaputt = berichtBauen({ p1: 0.480, satz1: 0.04, seite1: 'JA', q2: 2.06, satz2: 0.02, seite2: 'Back', renditeDruck: '+3.99' });
var ergK = Pruefer.pruefen(Parser.parse(kaputt.text));
ok(ergK.urteil.stufe === 'fehler', 'Urteil: Fehler');
ok(ergK.schritte.some(function (s) { return s.titel.indexOf('Rendite nach allen') === 0 && s.urteil === 'abweichung'; }),
  'Rendite-Schritt schlägt an');
ok(ergK.schritte.some(function (s) { return s.titel.indexOf('Querprobe: Rendite') === 0 && s.urteil === 'abweichung'; }),
  'Querprobe Rendite/inv schlägt an');

/* ---------- 4) Alte Gebührenformel MUSS erkannt werden ---------- */
console.log('4) Effektivquote nach ALTER Formel');
var qeAltDruck = fx(R.qeAnteilAlt(0.480, 0.04), 3);
var alt = berichtBauen({ p1: 0.480, satz1: 0.04, seite1: 'JA', q2: 2.06, satz2: 0.02, seite2: 'Back', qe1Druck: qeAltDruck });
var ergA = Pruefer.pruefen(Parser.parse(alt.text));
ok(ergA.urteil.stufe === 'fehler', 'Urteil: Fehler');
var altSchritt = ergA.schritte.filter(function (s) { return s.titel.indexOf('Seite 1') === 0 && s.urteil === 'abweichung'; })[0];
ok(!!altSchritt, 'Seite-1-Schritt schlägt an');
ok(altSchritt && altSchritt.kommentar.indexOf('ALTEN') >= 0, 'Kommentar nennt die alte Formel');
/* Die Formelzeile endet auf den (falschen) Druckwert — der Widerspruch
 * Formel-Arithmetik ./. Endwert wird hier nicht erzeugt, weil der Bau die
 * Formel mit dem Druckwert abschließt (wie das Panel). Dafür muss die
 * Kehrwertsumme, die das Panel aus den RICHTIGEN Server-Werten hat, als
 * "Abweichung schon bei den Effektivquoten" erklärt werden: */
var invSchritt = ergA.schritte.filter(function (s) { return s.titel === 'Kehrwertsumme'; })[0];
ok(invSchritt && invSchritt.urteil === 'ok', 'Kehrwertsumme selbst deckt sich (Server rechnete richtig)');
ok(invSchritt && invSchritt.kommentar.indexOf('Effektivquoten') >= 0, 'Kommentar erklärt, wo es bricht');

/* ---------- 5) Warnzeichen ---------- */
console.log('5) Warnzeichen');
var warn = berichtBauen({
  p1: 0.480, satz1: 0.04, seite1: 'JA', q2: 2.06, satz2: 0.02, seite2: 'Back',
  kursSeit1: '22 min', menge2: 'unbekannt — nicht null!', buchSumme: 0.9850, zuordnung: 0.66
});
var ergW = Pruefer.pruefen(Parser.parse(warn.text));
function hatWarnung(teil) { return ergW.warnungen.some(function (w) { return w.text.indexOf(teil) >= 0; }); }
ok(hatWarnung('seit 22 min'), 'Kursalter über 15 min');
ok(hatWarnung('unbekannt ist NICHT unbegrenzt') || hatWarnung('Menge unbekannt'), 'Menge unbekannt');
ok(hatWarnung('widerspricht sich'), 'Buchprobe unter 1');
ok(hatWarnung('Zuordnung'), 'wacklige Zuordnung');
ok(ergW.urteil.stufe === 'ok', 'Warnzeichen kippen das Rechen-Urteil nicht (ist: ' + ergW.urteil.stufe + ')');

/* ---------- 6) Hohe Rendite als Warnband ---------- */
console.log('6) Rendite-Erfahrungsband');
var hoch = berichtBauen({ p1: 0.440, satz1: 0.04, seite1: 'JA', q2: 2.16, satz2: 0.02, seite2: 'Back' });
var ergH = Pruefer.pruefen(Parser.parse(hoch.text));
ok(ergH.warnungen.some(function (w) { return w.text.indexOf('4,4') >= 0 || w.text.indexOf('über dem bisher') >= 0; }),
  'Rendite über dem gemessenen Band wird angesprochen (Rendite ' + fx(hoch.e.rendite, 2) + ' %)');

/* ---------- 7) Lay-Seite ---------- */
console.log('7) Lay-Seite');
var lay = berichtBauen({ p1: 0.700, satz1: 0.04, seite1: 'JA', q2: 1.45, satz2: 0.02, seite2: 'Lay' });
var bLay = Parser.parse(lay.text);
ok(bLay.seiten[1].seiteText === 'Lay', 'Lay erkannt');
var ergL = Pruefer.pruefen(bLay);
ok(ergL.urteil.stufe === 'ok', 'Lay-Rechnung deckt sich (ist: ' + ergL.urteil.stufe + ')');
var layQe = R.qeLay(1.45, 0.02);
ok(Math.abs(ergL.qe2 - layQe) < 1e-9, 'Lay-Effektivquote nach Lay-Formel');

/* ---------- 8) Euro-Fassung mit EZB-Kurs ---------- */
console.log('8) Euro-Beträge (umgerechnete Dollar)');
var kurs = 0.9123;
var euro = berichtBauen({ p1: 0.480, satz1: 0.04, seite1: 'JA', q2: 2.06, satz2: 0.02, seite2: 'Back' });
var euroText = euro.text
  .replace('Aufteilung bei 100 $ Einsatz: ' + fx(euro.e.s1, 2) + ' $ auf Polymarket, ' + fx(euro.e.s2, 2) + ' $ auf Smarkets',
    'Aufteilung bei 100 € Einsatz: ' + fx(euro.e.s1 * kurs, 2) + ' € auf Polymarket, ' + fx(euro.e.s2 * kurs, 2) + ' € auf Smarkets')
  .replace('Auszahlung bei BEIDEN Ausgängen: ' + fx(euro.e.auszahlung, 2) + ' $',
    'Auszahlung bei BEIDEN Ausgängen: ' + fx(euro.e.auszahlung * kurs, 2) + ' €')
  .replace('Währung: kein Wechselkurs verfügbar — Beträge in $',
    'Währung: Dollar-Beträge mit EZB-Kurs ' + fx(kurs, 4) + ' (Stand 17.08.) in Euro umgerechnet');
var bE = Parser.parse(euroText);
ok(Math.abs(bE.rechnung.fxKurs - kurs) < 1e-9, 'EZB-Kurs gelesen');
var ergE = Pruefer.pruefen(bE);
ok(ergE.urteil.stufe === 'ok', 'Euro-Fassung deckt sich (ist: ' + ergE.urteil.stufe + ')');
ok(ergE.warnungen.some(function (w) { return w.text.indexOf('100 DOLLAR') >= 0; }),
  'Hinweis auf die 100-€-Beschriftung (Beträge sind umgerechnete Dollar)');

/* ---------- 9) Panel-Selbstwiderspruch: Formelzeile ./. Endwert ---------- */
console.log('9) Formelzeile widerspricht dem Endwert');
var widerText = sauber.text.replace(
  'Effektivquote (nach Gebühr): ' + fx(sauber.e.qe1, 3),
  'Effektivquote (nach Gebühr): ' + fx(sauber.e.qe1 + 0.05, 3));
var ergWider = Pruefer.pruefen(Parser.parse(widerText));
ok(ergWider.warnungen.some(function (w) { return w.stufe === 'fehler' && w.text.indexOf('widerspricht sich selbst') >= 0; }),
  'Selbstwiderspruch wird gemeldet');
ok(ergWider.urteil.stufe === 'fehler', 'und kippt das Urteil');

/* ---------- 10) Link-Prüfung ---------- */
console.log('10) Link-Prüfung');
var Links = require('../js/linkpruefung.js');
var bSauber = Parser.parse(sauber.text);
var lErg = Links.pruefen(bSauber);
ok(lErg.length === 2, 'zwei Link-Urteile');
ok(lErg[0].urteil === 'passt', 'Polymarket-Link passt (ist: ' + lErg[0].urteil + ')');
ok(lErg[1].urteil === 'passt', 'Smarkets-Link passt (ist: ' + lErg[1].urteil + ')');

/* Falsche Partie im Link MUSS auffallen. */
var falschText = sauber.text.replace(
  'https://smarkets.com/event/44991234/sport/football/fc-probe-vs-sv-muster',
  'https://smarkets.com/event/44991234/sport/football/real-madrid-vs-barcelona');
var ergF = Pruefer.pruefen(Parser.parse(falschText));
var lF = ergF.links.filter(function (l) { return l.nr === 2; })[0];
ok(lF && lF.urteil === 'falsch', 'fremde Partie im Link wird erkannt (ist: ' + (lF && lF.urteil) + ')');
ok(ergF.urteil.stufe === 'fehler', 'falscher Link kippt das Gesamturteil');

/* Falsches Buch in der Adresse MUSS auffallen. */
var domText = sauber.text.replace(
  'https://polymarket.com/event/fc-probe-sv-muster/fc-probe-sv-muster-winner',
  'https://smarkets.com/event/1/sport/football/fc-probe-vs-sv-muster');
var ergD = Pruefer.pruefen(Parser.parse(domText));
var lD = ergD.links.filter(function (l) { return l.nr === 1; })[0];
ok(lD && lD.urteil === 'falsch' && lD.text.indexOf('gehört aber zu') > 0, 'Buch↔Adresse-Widerspruch erkannt');

/* Kalshi-Kennung und Orbit-Marktnummer: ehrlich "nicht prüfbar". */
var kalshiSeite = { nr: 2, buch: 'Kalshi', buchNorm: 'kalshi', link: 'https://kalshi.com/markets/kxmlbgame/mlb/KXMLBGAME-25AUG17DETMIN' };
var lK = Links.pruefeSeite(bSauber, kalshiSeite);
ok(lK.urteil === 'unpruefbar', 'Kalshi: von außen nicht prüfbar');
var orbitSeite = { nr: 2, buch: 'Betfair', buchNorm: 'betfair', link: 'https://www.orbitexch.com/customer/sport/1/market/1.234567890' };
var lO = Links.pruefeSeite(bSauber, orbitSeite);
ok(lO.urteil === 'unpruefbar' && lO.text.indexOf('1.234567890') > 0, 'Orbit: Marktnummer genannt, ehrlich nicht prüfbar');

/* Fehlender Link. */
var ohneSeite = { nr: 1, buch: 'Polymarket', buchNorm: 'polymarket', link: null };
ok(Links.pruefeSeite(bSauber, ohneSeite).urteil === 'falsch', 'fehlender Link ist ein Verstoß');

/* Sauberer Bericht bleibt nach der Link-Integration bei "deckt sich". */
var ergNochmal = Pruefer.pruefen(bSauber);
ok(ergNochmal.urteil.stufe === 'ok', 'sauberer Bericht weiterhin ok (ist: ' + ergNochmal.urteil.stufe + ')');
ok(ergNochmal.schritte.every(function (s) { return !!s.gruppe; }), 'jeder Schritt gehört zu einem Rechnungs-Block');

/* ---------- 11) Das Rechenblatt: jede Rechnung zeigt ihre Zahlen ---------- */
console.log('11) Rechenblatt-Inhalte');
var rechenSchritte = ergNochmal.schritte.filter(function (s) { return s.urteil !== 'unpruefbar'; });
ok(rechenSchritte.length >= 6, 'mindestens sechs prüfbare Rechnungen (sind: ' + rechenSchritte.length + ')');
ok(rechenSchritte.every(function (s) { return s.zeilen && s.zeilen.length >= 1; }), 'jede Rechnung hat Zeilen zum Mitlesen');
ok(rechenSchritte.every(function (s) { return !!s.formel; }), 'jede Rechnung nennt ihre Formel');
ok(rechenSchritte.every(function (s) { return !!s.warum; }), 'jede Rechnung erklärt, was sie bedeutet');
ok(rechenSchritte.every(function (s) { return !!s.taschenrechner; }), 'jede Rechnung hat eine Taschenrechner-Zeile');
ok(rechenSchritte.every(function (s) { return !!s.toleranzGrund; }), 'jede Rechnung begründet ihre erlaubte Rundung');
ok(rechenSchritte.every(function (s) { return typeof s.delta === 'number'; }),
  'jede Rechnung weist den Unterschied zum Panel aus — kein nacktes grünes Licht');

/* Die Zeilen müssen die ECHTEN Zwischenergebnisse tragen, nicht nur Worte:
 * Gebühr = 0,04 × 0,480 × 0,520 = 0,009984 und Endwert 2,063. */
var s1Schritt = rechenSchritte.filter(function (s) { return s.titel.indexOf('Seite 1') === 0; })[0];
var s1Text = s1Schritt.zeilen.join(' | ');
ok(s1Text.indexOf('0.009984') >= 0, 'Zwischenergebnis der Gebühr steht im Blatt');
ok(s1Text.indexOf('2.063') >= 0, 'gerundeter Endwert steht im Blatt');
ok(s1Schritt.taschenrechner.indexOf('0,480') >= 0, 'Taschenrechner-Zeile nutzt Komma-Schreibweise');

/* Unprüfbare Schritte dürfen NICHT so tun, als hätten sie gerechnet. */
var ohneMengeText = sauber.text.replace(/ {2}Max\. Einsatz[^\n]*\n/,
  '  Max. Einsatz (beide Seiten zusammen): unbekannt · tatsächlicher Gewinn: unbekannt\n');
var ohneMenge = Pruefer.pruefen(Parser.parse(ohneMengeText));
var mengeSchritt = ohneMenge.schritte.filter(function (s) { return s.titel.indexOf('Maximaler Einsatz') === 0; })[0];
ok(mengeSchritt && mengeSchritt.urteil === 'unpruefbar', 'fehlende Menge bleibt „nicht prüfbar"');
ok(mengeSchritt && !!mengeSchritt.warum, 'und sagt trotzdem, warum sie nicht prüfbar ist');

/* ---------- 12) Einsatzrechner ---------- */
console.log('12) Einsatzrechner');
var E = require('../js/einsatz.js');
var qeA = R.qeSeite('preis', 'JA', 0.480, 0.04).qe;   // 2.062533
var qeB = R.qeSeite('quote', 'Back', 2.06, 0.02).qe;  // 2.038800

/* Ohne Rundung muss der Einsatzrechner exakt die Panel-Aufteilung treffen. */
var fein = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 100, schritt: 0.01 });
ok(Math.abs(fein.ideal1 - 49.71) < 0.01, 'ideale Aufteilung Seite 1 (' + fein.ideal1.toFixed(2) + ')');
ok(Math.abs(fein.ideal1 + fein.ideal2 - 100) < 1e-9, 'ideale Aufteilung ergibt zusammen den Einsatz');
ok(Math.abs(fein.idealRendite - 2.53) < 0.01, 'ideale Rendite trifft die Panel-Zahl');
ok(Math.abs(fein.gewinn1 - fein.gewinn2) < 0.02, 'bei Cent-Rundung zahlen beide Ausgänge fast gleich');

/* MIT Rundung: die Ausgänge laufen auseinander, garantiert ist der schlechtere. */
var grob = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 100, schritt: 10 });
ok(grob.s1 % 10 === 0 && grob.s2 % 10 === 0, 'auf Zehner gerundet (' + grob.s1 + '/' + grob.s2 + ')');
ok(Math.abs(grob.gewinn1 - grob.gewinn2) > 0.02, 'nach grober Rundung sind die Ausgänge NICHT mehr gleich');
ok(Math.abs(grob.garantiert - Math.min(grob.gewinn1, grob.gewinn2)) < 1e-9, 'garantiert = der schlechtere Ausgang');
ok(grob.garantiert < grob.bester, 'der bessere Ausgang wird nicht als Garantie verkauft');
ok(grob.renditeEffektiv < grob.idealRendite, 'Rundung drückt die Rendite (' +
  grob.renditeEffektiv.toFixed(2) + ' statt ' + grob.idealRendite.toFixed(2) + ')');
ok(Math.abs(grob.rundungsverlust - (grob.idealRendite - grob.renditeEffektiv)) < 1e-9, 'Rundungsverlust korrekt beziffert');

/* Der wichtige Warnfall: Rundung frisst die ganze Marge auf. */
var duenn = E.rechne({ qe1: 2.02, qe2: 2.02, gesamt: 30, schritt: 10 });
ok(duenn.nochArbitrage === false || duenn.garantiert <= 0,
  'bei zu grober Rundung meldet er ehrlich: kein sicherer Gewinn mehr (' + duenn.garantiert.toFixed(2) + ')');

/* Ein Einsatz von 0 darf nie entstehen — das wäre eine offene Wette. */
var winzig = E.rechne({ qe1: 1.10, qe2: 12.0, gesamt: 10, schritt: 10 });
ok(winzig.s1 > 0 && winzig.s2 > 0, 'keine Seite bleibt bei 0 stehen');

/* Höchsteinsatz aus dem Bericht wird verglichen. */
var ueber = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 500, schritt: 1, maxEinsatz: 240 });
ok(ueber.ueberMax === true, 'Einsatz über dem Höchstbetrag des Berichts wird erkannt');
var drunter = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 100, schritt: 1, maxEinsatz: 240 });
ok(drunter.ueberMax === false, 'Einsatz innerhalb des Höchstbetrags meldet keinen Alarm');
var ohneMax = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 100, schritt: 1 });
ok(ohneMax.ueberMax === null, 'ohne Höchstbetrag wird NICHT geraten (null, nicht false)');

/* Kennzahlen. */
ok(Math.abs(E.marge(0.9753) - 2.47) < 0.01, 'Marge des Marktes = (1 − inv) × 100');
ok(Math.abs(E.wahrscheinlichkeit(2.0) - 50) < 1e-9, 'implizite Wahrscheinlichkeit');
var pf = E.puffer(qeA, qeB);
ok(pf && pf.spielraumProzent > 0 && pf.spielraumProzent < 10, 'Kurspuffer plausibel (' + pf.spielraumProzent.toFixed(2) + ' %)');
var kippt = E.puffer(1.90, 2.038800);
ok(kippt && kippt.spielraumProzent === 0, 'ohne Vorteil ist der Puffer 0, nicht negativ');

/* Gegenprobe der Kernbehauptung: Auszahlung minus Gesamteinsatz = Gewinn. */
ok(Math.abs((grob.s1 * qeA - grob.eingesetzt) - grob.gewinn1) < 1e-9, 'Gewinn 1 = Auszahlung 1 − alles Eingesetzte');
ok(Math.abs((grob.s2 * qeB - grob.eingesetzt) - grob.gewinn2) < 1e-9, 'Gewinn 2 = Auszahlung 2 − alles Eingesetzte');

/* ---------- 13) Ampel und Geldfluss ---------- */
console.log('13) Ampel: stimmt die Rechnung UND lohnt es sich?');
var B = require('../js/bewertung.js');

/* DER wichtigste Fall (Karams Vorgabe): Rechnung fehlerfrei, aber kein Plus. */
var keinPlus = B.ampel({ rechnungStufe: 'ok', harteBefunde: 0, warnungen: 0, rendite: -0.42 });
ok(keinPlus.stufe === 'rot', 'kein Gewinn ist ROT, auch wenn die Rechnung stimmt');
ok(keinPlus.kopf.indexOf('RECHNUNG RICHTIG') >= 0, 'der Kopf sagt ausdrücklich: Rechnung richtig');
ok(keinPlus.kopf.indexOf('KEIN GEWINN') >= 0, 'und trotzdem: kein Gewinn');
ok(keinPlus.rechnungfrage.indexOf('deckt sich') >= 0, 'Frage 2 bleibt korrekt positiv beantwortet');
ok(keinPlus.gewinnfrage.indexOf('NEIN') >= 0, 'Frage 1 wird klar mit NEIN beantwortet');

/* Genau null ist auch kein Gewinn. */
ok(B.ampel({ rechnungStufe: 'ok', harteBefunde: 0, warnungen: 0, rendite: 0 }).stufe === 'rot',
  'exakt 0 % ist kein Gewinn');

/* Rechenfehler schlägt alles — auch bei traumhafter Rendite. */
var kaputtAmpel = B.ampel({ rechnungStufe: 'fehler', harteBefunde: 1, warnungen: 0, rendite: 8.0 });
ok(kaputtAmpel.stufe === 'rot', 'Rechenfehler ist ROT, egal wie hoch die Rendite aussieht');
ok(kaputtAmpel.gewinnfrage.indexOf('unklar') >= 0, 'bei kaputter Rechnung ist der Gewinn unklar, nicht bejaht');

/* Knapp = orange. */
var knapp = B.ampel({ rechnungStufe: 'ok', harteBefunde: 0, warnungen: 0, rendite: 0.6 });
ok(knapp.stufe === 'orange', '0,6 % ist knapp (orange)');
var mitWarnung = B.ampel({ rechnungStufe: 'ok', harteBefunde: 0, warnungen: 2, rendite: 2.5 });
ok(mitWarnung.stufe === 'orange', 'Warnzeichen drücken auf orange, auch bei 2,5 %');
var teilweise = B.ampel({ rechnungStufe: 'teilweise', harteBefunde: 0, warnungen: 0, rendite: 2.5 });
ok(teilweise.stufe === 'orange', 'nicht voll prüfbare Rechnung ist höchstens orange');

/* Grün nur, wenn wirklich alles passt. */
var gut = B.ampel({ rechnungStufe: 'ok', harteBefunde: 0, warnungen: 0, rendite: 2.53 });
ok(gut.stufe === 'gruen', 'saubere Rechnung + 2,53 % = grün');
ok(gut.gewinnfrage.indexOf('JA') >= 0, 'Frage 1: JA');

/* Ohne berechenbare Rendite wird NICHT geraten. */
ok(B.ampel({ rechnungStufe: 'ok', harteBefunde: 0, warnungen: 0, rendite: null }).stufe === 'orange',
  'ohne Renditezahl: orange, nicht grün');

/* Geldfluss: Gebühren in echtem Geld. */
var bGeld = Parser.parse(sauber.text);
var ergGeld = Pruefer.pruefen(bGeld);
var planGeld = E.rechne({ qe1: ergGeld.qe1, qe2: ergGeld.qe2, gesamt: 100, schritt: 0.01 });
var fluss = B.geldfluss({ seite1: bGeld.seiten[0], seite2: bGeld.seiten[1],
  qe1: ergGeld.qe1, qe2: ergGeld.qe2, s1: planGeld.s1, s2: planGeld.s2 });
ok(!!fluss, 'Geldfluss wird aufgestellt');
ok(Math.abs(fluss.gesamtEinsatz - 100) < 0.02, 'Gesamteinsatz stimmt');
/* Polymarket: 0,480 Anteilspreis, 4 % Gebühr. Brutto = Einsatz/0,480. */
ok(Math.abs(fluss.seite1.bruttoRueckgabe - planGeld.s1 / 0.480) < 0.01, 'brutto Seite 1 = Einsatz ÷ Preis');
ok(fluss.seite1.gebuehrGeld > 0, 'Gebühr Seite 1 ist positiv (' + fluss.seite1.gebuehrGeld.toFixed(2) + ')');
ok(Math.abs(fluss.seite1.bruttoRueckgabe - fluss.seite1.gebuehrGeld - fluss.seite1.nettoRueckgabe) < 1e-9,
  'brutto − Gebühr = netto (Seite 1)');
/* Smarkets Back 2,06 bei 2 %: brutto = Einsatz × 2,06. */
ok(Math.abs(fluss.seite2.bruttoRueckgabe - planGeld.s2 * 2.06) < 0.01, 'brutto Seite 2 = Einsatz × Quote');
ok(Math.abs(fluss.seite2.bruttoRueckgabe - fluss.seite2.gebuehrGeld - fluss.seite2.nettoRueckgabe) < 1e-9,
  'brutto − Gebühr = netto (Seite 2)');
ok(Math.abs(fluss.garantierterGewinn - Math.min(fluss.seite1.gewinn, fluss.seite2.gewinn)) < 1e-9,
  'garantiert = schlechterer Ausgang');
ok(Math.abs(fluss.garantierteRendite - 2.53) < 0.05, 'garantierte Rendite trifft die Panel-Zahl');
ok(fluss.gebuehrMin <= fluss.gebuehrMax, 'Gebührenspanne ist richtig herum');

/* Die Antworten auf Frage 3 und 4. */
var U = require('../js/uebersicht.js');
ok(U.linkAntwort(ergGeld.links).klasse === 'gruen', 'beide Links passen → grün');
ok(U.linkAntwort([{ nr: 2, urteil: 'falsch' }]).klasse === 'rot', 'falscher Link → rot');
ok(U.linkAntwort([{ nr: 1, urteil: 'unpruefbar' }]).klasse === 'orange', 'nicht prüfbarer Link → orange');
ok(U.aktualitaetAntwort(null, []).klasse === 'orange', 'noch kein Abruf → orange');
var seitenProbe = [{ art: 'preis', wert: 0.48 }, { art: 'quote', wert: 2.06 }];
ok(U.aktualitaetAntwort({ seiten: [{ status: 'ok', wert: 0.48 }, { status: 'unpruefbar' }] }, seitenProbe).klasse === 'gruen',
  'Kurs unverändert → grün');
ok(U.aktualitaetAntwort({ seiten: [{ status: 'ok', wert: 0.44 }, { status: 'unpruefbar' }] }, seitenProbe).klasse === 'rot',
  'Kurs hat sich bewegt → rot');
ok(U.aktualitaetAntwort({ seiten: [{ status: 'vorbei' }, { status: 'unpruefbar' }] }, seitenProbe).klasse === 'rot',
  'Markt geschlossen → rot');

/* ---------- 14) Paarungsprüfung: dasselbe Spiel? ---------- */
console.log('14) Paarung: Alter, Zeit, Liga');
var PA = require('../js/paarung.js');

/* Die Kennungen — der Fund des Auftraggebers. */
ok(PA.kennung('Boca Juniors U21') === 'u21', 'U21 erkannt');
ok(PA.kennung('Pachuca U-20') === 'u20', 'U-20 mit Bindestrich erkannt');
ok(PA.kennung('Samsunspor Under 19') === 'u19', '„Under 19" erkannt');
ok(PA.kennung('Boca Juniors') === '', 'erste Elf trägt keine Kennung');
ok(PA.kennung('Boca Juniors Women') === 'w', 'Frauenmannschaft erkannt');
ok(PA.kennung('Godoy Cruz (Res)') === 'res', 'Reserve in Klammern erkannt');
ok(PA.kennung('Real Madrid Castilla B') === 'res', 'B-Mannschaft als Endung erkannt');
/* Und die Gegenprobe: Vereinsnamen mit Ziffern/Wörtern DÜRFEN nicht anschlagen. */
ok(PA.kennung('Schalke 04') === '', 'Schalke 04 ist keine Reserve');
ok(PA.kennung('Bayer 04 Leverkusen') === '', 'Bayer 04 ist keine Reserve');
ok(PA.kennung('1899 Hoffenheim') === '', 'Jahreszahl im Namen schlägt nicht an');

ok(PA.kennungGleich('Pachuca', 'Pachuca U21') === false, 'erste Elf gegen U21 = NICHT gleich');
ok(PA.kennungGleich('Pachuca U21', 'Pachuca U-21') === true, 'zwei Schreibweisen derselben Klasse');

/* Zeitsperre. */
ok(PA.zeitAbstand('2026-08-18T20:00:00Z', '2026-08-18T20:00:00Z') === 0, 'gleiche Zeit = 0 Minuten');
ok(Math.abs(PA.zeitAbstand('2026-08-18T20:00:00Z', '2026-08-18T21:30:00Z') - 90) < 0.01, '90 Minuten Abstand');
ok(PA.zeitAbstand('2026-08-18T20:00:00Z', null) === null, 'fehlende Zeit gibt null, nicht 0');
ok(PA.zeitUrteil(0).urteil === 'passt', 'derselbe Anpfiff passt');
ok(PA.zeitUrteil(90).urteil === 'passt', '90 Minuten liegen in der Toleranz');
ok(PA.zeitUrteil(270).urteil === 'falsch', '270 Minuten (Samsunspor-Fall) fällt auf');
ok(PA.zeitUrteil(705).urteil === 'falsch', '705 Minuten (Pachuca-Fall) fällt auf');
ok(PA.zeitUrteil(null).urteil === 'unbekannt', 'ohne zweite Zeit: unbekannt, nicht passt');

/* Liga. */
ok(PA.ligaVerdacht('Argentinian Primera Division Reserves') === 'Reserve-/Nachwuchsliga',
  'Reserveliga erkannt (der live belegte Fall)');
ok(PA.ligaVerdacht('UEFA Youth League') === 'Reserve-/Nachwuchsliga', 'Youth League erkannt');
ok(PA.ligaVerdacht('FA Women s Super League') === 'Frauenliga', 'Frauenliga erkannt');
ok(PA.ligaVerdacht('U19 Bundesliga') === 'Jugendliga', 'U19-Liga erkannt');
ok(PA.ligaVerdacht('English Premier League') === null, 'normale Liga schlägt nicht an');

/* Die Gesamtprüfung. */
var gleich = PA.pruefe({
  seite1: { titel: 'FC Probe gegen SV Muster', zeit: '2026-08-18T20:00:00Z', liga: 'Premier League' },
  seite2: { titel: 'FC Probe v SV Muster', zeit: '2026-08-18T20:00:00Z', liga: 'Premier League' }
});
ok(gleich.stufe === 'passt', 'identische Partie: passt (ist: ' + gleich.stufe + ')');

var u21Fall = PA.pruefe({
  seite1: { titel: 'Pachuca gegen Club America', zeit: '2026-08-18T20:00:00Z' },
  seite2: { titel: 'Pachuca U21 v Club America U21', zeit: '2026-08-18T20:00:00Z' }
});
ok(u21Fall.stufe === 'falsch', 'erste Elf gegen U21 wird als FALSCH erkannt');
ok(u21Fall.befunde[0].urteil === 'falsch', 'der Kennungsbefund schlägt an');

var rueckspiel = PA.pruefe({
  seite1: { titel: 'Boca Juniors gegen River Plate', zeit: '2026-08-18T20:00:00Z' },
  seite2: { titel: 'Boca Juniors v River Plate', zeit: '2026-08-19T08:45:00Z' }
});
ok(rueckspiel.stufe === 'falsch', 'Rückspiel (gleiche Namen, anderer Termin) wird erkannt');
ok(rueckspiel.befunde[1].urteil === 'falsch', 'die Zeitsperre ist es, die anschlägt');

var nurEineZeit = PA.pruefe({
  seite1: { titel: 'FC Probe gegen SV Muster', zeit: '2026-08-18T20:00:00Z' },
  seite2: { titel: 'FC Probe v SV Muster' }
});
ok(nurEineZeit.stufe === 'unbekannt', 'fehlende zweite Zeit: unbekannt statt falsch');
ok(nurEineZeit.anzahlFalsch === 0, 'und ausdrücklich KEIN Fehlbefund');

var ligaFall = PA.pruefe({
  seite1: { titel: 'Godoy Cruz gegen Talleres', liga: 'Argentinian Primera Division', zeit: '2026-08-18T20:00:00Z' },
  seite2: { titel: 'Godoy Cruz v Talleres', liga: 'Argentinian Primera Division Reserves', zeit: '2026-08-18T20:00:00Z' }
});
ok(ligaFall.stufe === 'falsch', 'Reserveliga auf nur einer Seite wird erkannt');


/* ---------- 15) Rechen-Werkstatt (reine Rechnung, ohne DOM) ---------- */
console.log('15) Werkstatt-Rechnung');
/* Die Werkstatt nutzt dieselben Bausteine; hier wird geprüft, dass
   freie Zahlen zu denselben Ergebnissen führen wie der Prüfteil. */
var wQe1 = R.qeAnteil(0.48, 0.04), wQe2 = R.qeBack(2.06, 0.02);
var wPlan = E.rechne({ qe1: wQe1, qe2: wQe2, gesamt: 250, schritt: 5 });
ok(wPlan.s1 % 5 === 0 && wPlan.s2 % 5 === 0, 'Werkstatt-Rundung auf Fünfer');
ok(Math.abs(wPlan.garantiert - Math.min(wPlan.s1 * wQe1 - wPlan.eingesetzt, wPlan.s2 * wQe2 - wPlan.eingesetzt)) < 1e-9,
  'Werkstatt: garantiert = schlechterer Ausgang');
var wLay = R.qeLay(1.45, 0.02);
ok(wLay > 1 && Math.abs(wLay - (1 + 0.98 / 0.45)) < 1e-9, 'Werkstatt kann auch Lay');

/* ---------- 16) Fehlpaarung bekommt eine EIGENE Begründung ---------- */
console.log('16) Fehlpaarung in der Ampel');
/* Am 18.08. beim Einbau gefunden: Eine Fehlpaarung wurde als
   „Rechenfehler" gemeldet — dabei stimmte die Rechnung nachweislich.
   Falsche Begründung ist fast so schlimm wie kein Alarm, deshalb hier
   ein eigener Test je Fall. */
var fehlpaarung = B.ampel({ rechnungStufe: 'ok', paarungStufe: 'falsch', harteBefunde: 0, warnungen: 0, rendite: 2.53 });
ok(fehlpaarung.stufe === 'rot', 'Fehlpaarung ist ROT');
ok(fehlpaarung.kopf.indexOf('ZWEI VERSCHIEDENE SPIELE') >= 0, 'der Kopf nennt den WAHREN Grund');
ok(fehlpaarung.kopf.indexOf('Rechnung stimmt nicht') < 0, 'und behauptet NICHT, die Rechnung sei falsch');
ok(fehlpaarung.rechnungfrage.indexOf('deckt sich') >= 0, 'Frage 2 bleibt korrekt: die Rechnung deckt sich');
ok(fehlpaarung.gewinnfrage.indexOf('keine Absicherung') >= 0, 'Frage 1: keine Absicherung');

/* Rechenfehler behält seine eigene, andere Begründung. */
var rechenfehler = B.ampel({ rechnungStufe: 'fehler', paarungStufe: 'passt', harteBefunde: 1, warnungen: 0, rendite: 2.53 });
ok(rechenfehler.kopf.indexOf('Rechnung stimmt nicht') >= 0, 'Rechenfehler wird weiterhin als solcher benannt');
ok(rechenfehler.kopf !== fehlpaarung.kopf, 'zwei verschiedene Fehler, zwei verschiedene Texte');

/* Beides zusammen: die Paarung wird zuerst genannt, weil sie schwerer wiegt. */
var beides = B.ampel({ rechnungStufe: 'fehler', paarungStufe: 'falsch', harteBefunde: 1, warnungen: 0, rendite: 2.53 });
ok(beides.stufe === 'rot' && beides.kopf.indexOf('ZWEI VERSCHIEDENE') >= 0, 'bei beidem führt die Fehlpaarung');

/* Offene Paarung drückt auf orange, sperrt aber nicht. */
var offenePaarung = B.ampel({ rechnungStufe: 'ok', paarungStufe: 'unbekannt', harteBefunde: 0, warnungen: 0, rendite: 2.53 });
ok(offenePaarung.stufe === 'orange', 'nicht vergleichbare Paarung: orange, nicht rot');
ok(offenePaarung.satz.indexOf('beide Links öffnen') >= 0, 'und sagt, was zu tun ist');

/* Saubere Paarung lässt Grün zu. */
ok(B.ampel({ rechnungStufe: 'ok', paarungStufe: 'passt', harteBefunde: 0, warnungen: 0, rendite: 2.53 }).stufe === 'gruen',
  'geprüfte Paarung + saubere Rechnung + Gewinn = grün');

/* Und die Kette vom Bericht bis zur Ampel, wie sie in der Anzeige läuft. */
var u21Bericht = sauber.text.replace('Partie beim zweiten Buch: FC Probe v SV Muster',
                                     'Partie beim zweiten Buch: FC Probe U21 v SV Muster U21');
var bU21 = Parser.parse(u21Bericht);
var ergU21 = Pruefer.pruefen(bU21);
var paarU21 = PA.pruefe({
  seite1: { titel: bU21.titel, ausgang: bU21.seiten[0].ausgang, link: bU21.seiten[0].link },
  seite2: { titel: bU21.partie2, ausgang: bU21.seiten[1].ausgang, link: bU21.seiten[1].link }
});
ok(ergU21.urteil.stufe === 'ok', 'die RECHNUNG des U21-Berichts ist fehlerfrei');
ok(paarU21.stufe === 'falsch', 'die PAARUNG desselben Berichts ist falsch');
var ampelU21 = B.ampel({ rechnungStufe: ergU21.urteil.stufe, paarungStufe: paarU21.stufe,
  harteBefunde: 0, warnungen: 0, rendite: 2.53 });
ok(ampelU21.stufe === 'rot', 'die Ampel steht trotz sauberer Rechnung auf ROT');

/* ---------- 17) Abgleich: Bericht gegen Anbieter ---------- */
console.log('17) Abgleich Bericht gegen Anbieter');
var AB = require('../js/abgleich.js');
var bAb = Parser.parse(sauber.text);

/* Der Anbieter bestaetigt alles: keine Abweichung. */
var liveGleich = { seiten: [
  { status: 'ok', wert: 0.480, gebuehrSatz: 0.04, gebuehrNurTaker: true, mengeGeld: 182.40, mindestGroesse: 5 },
  { status: 'unpruefbar', text: 'Smarkets blockt den Browser.' }
] };
var aGleich = AB.pruefe(bAb, liveGleich);
ok(aGleich.anzahlAbweichungen === 0, 'keine Abweichung, wenn der Anbieter alles bestaetigt');
ok(aGleich.stufe === 'teilweise', 'Seite 2 unpruefbar, also nur teilweise abgeglichen');
ok(aGleich.gebuehrFalsch === false, 'Gebuehr in Ordnung');

/* DER wichtigste Fall: das Panel nennt eine falsche Gebuehr. */
var liveGebuehr = { seiten: [
  { status: 'ok', wert: 0.480, gebuehrSatz: 0.07, mengeGeld: 182.40 },
  { status: 'unpruefbar', text: 'blockt' }
] };
var aGeb = AB.pruefe(bAb, liveGebuehr);
ok(aGeb.gebuehrFalsch === true, 'falscher Gebuehrensatz wird erkannt');
var bGeb = aGeb.befunde.filter(function (x) { return x.art === 'Gebuehrensatz'; })[0];
ok(bGeb.urteil === 'weicht ab', 'und als Abweichung geführt');
ok(bGeb.text.indexOf('HOEHER') >= 0, 'sagt, dass die echte Gebuehr hoeher ist');
ok(bGeb.bericht === 0.04 && bGeb.anbieter === 0.07, 'beide Werte stehen nebeneinander');

/* Kurs hat sich bewegt. */
var liveKurs = { seiten: [
  { status: 'ok', wert: 0.495, gebuehrSatz: 0.04, mengeGeld: 182.40 },
  { status: 'unpruefbar', text: 'blockt' }
] };
var aKurs = AB.pruefe(bAb, liveKurs);
var bKurs = aKurs.befunde.filter(function (x) { return x.art === 'Kurs'; })[0];
ok(bKurs.urteil === 'weicht ab', 'bewegter Kurs wird erkannt');
ok(bKurs.text.indexOf('SCHLECHTER') >= 0, 'teurerer Anteilspreis ist schlechter fuer den Kaeufer');

/* Eine Bewegung innerhalb der Drucktoleranz ist KEINE Abweichung. */
var liveWinzig = { seiten: [
  { status: 'ok', wert: 0.4802, gebuehrSatz: 0.04, mengeGeld: 182.40 },
  { status: 'unpruefbar', text: 'blockt' }
] };
ok(AB.pruefe(bAb, liveWinzig).anzahlAbweichungen === 0, 'Rundung an der letzten Stelle schlaegt nicht an');

/* Menge deutlich kleiner. */
var liveMenge = { seiten: [
  { status: 'ok', wert: 0.480, gebuehrSatz: 0.04, mengeGeld: 40.00 },
  { status: 'unpruefbar', text: 'blockt' }
] };
var bMenge = AB.pruefe(bAb, liveMenge).befunde.filter(function (x) { return x.art === 'Handelbare Menge'; })[0];
ok(bMenge.urteil === 'weicht ab', 'stark veraenderte Menge wird erkannt');
ok(bMenge.text.indexOf('WENIGER') >= 0, 'und sagt, dass weniger hineinpasst');

/* Nicht abfragbare Seite: unpruefbar, niemals stillschweigend uebernommen. */
var nurOffen = AB.pruefe(bAb, { seiten: [{ status: 'unpruefbar', text: 'geht nicht' }, { status: 'unpruefbar', text: 'geht nicht' }] });
ok(nurOffen.anzahlAbweichungen === 0 && nurOffen.stufe === 'teilweise', 'nichts abfragbar: teilweise, keine Falschmeldung');
ok(nurOffen.befunde.every(function (x) { return x.urteil === 'unpruefbar'; }), 'alle Befunde ehrlich als unpruefbar');

/* echteWerte: was gilt fuer die Neuberechnung? */
var echt = AB.echteWerte(bAb, liveGebuehr);
ok(Math.abs(echt[0].gebuehr - 0.07) < 1e-9, 'fuer die Rechnung gilt der Satz DES ANBIETERS');
ok(echt[0].gebuehrFrisch === true, 'und ist als frisch gekennzeichnet');
ok(Math.abs(echt[1].gebuehr - 0.02) < 1e-9, 'wo der Anbieter schweigt, gilt der Bericht');
ok(echt[1].gebuehrFrisch === false, 'und das steht auch so dran');

/* Die Wirkung auf die Rendite: 4 Prozent gegen 7 Prozent Gebuehr. */
var qeBericht = R.qeAnteil(0.480, 0.04), qeEcht = R.qeAnteil(0.480, 0.07);
var qeGegen = R.qeBack(2.06, 0.02);
var rBericht = R.pruefe(qeBericht, qeGegen, 100).rendite;
var rEcht = R.pruefe(qeEcht, qeGegen, 100).rendite;
ok(rEcht < rBericht, 'die echte Gebuehr druckt die Rendite (' + rBericht.toFixed(2) + ' auf ' + rEcht.toFixed(2) + ')');

/* ---------- 18) Zwei getrennte Ampeln ---------- */
console.log('18) Zwei getrennte Ampeln');
/* Karams Anordnung vom 19.08.: eine Lampe fuer die Rechnung, eine
   fuer den Gewinn. Der Sinn ist, dass sie sich NICHT gegenseitig
   faerben. Genau das wird hier Fall fuer Fall geprueft. */

/* Alles sauber: beide gruen. */
var zA = B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'passt', warnungen: 0, rendite: 2.53 });
ok(zA.rechnung.stufe === 'gruen', 'saubere Rechnung: Lampe 1 gruen');
ok(zA.gewinn.stufe === 'gruen', 'guter Gewinn: Lampe 2 gruen');

/* Rechnung stimmt, aber Verlust: Lampe 1 bleibt GRUEN, Lampe 2 wird rot. */
var zB = B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'passt', warnungen: 0, rendite: -0.42 });
ok(zB.rechnung.stufe === 'gruen', 'Verlust faerbt die Rechnungs-Lampe NICHT rot');
ok(zB.gewinn.stufe === 'rot', 'aber die Gewinn-Lampe schon');
ok(zB.rechnung.kurz === 'RECHNUNG STIMMT', 'und sagt weiterhin: Rechnung stimmt');

/* Rechenfehler bei hoher Rendite: Lampe 1 rot, Lampe 2 bleibt gruen. */
var zC = B.zweiAmpeln({ rechnungStufe: 'fehler', paarungStufe: 'passt', warnungen: 0, rendite: 8.0 });
ok(zC.rechnung.stufe === 'rot', 'Rechenfehler: Lampe 1 rot');
ok(zC.gewinn.stufe === 'gruen', 'der Rechenfehler faerbt die Gewinn-Lampe NICHT');
ok(zC.gewinn.satz.indexOf('eigenen Nachrechnung') >= 0,
  'dafuer steht dabei, dass die Zahl aus der EIGENEN Rechnung kommt');

/* Fehlpaarung: Rechnung gruen, Gewinn rot mit eigenem Grund. */
var zD = B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'falsch', warnungen: 0, rendite: 2.53 });
ok(zD.rechnung.stufe === 'gruen', 'Fehlpaarung faerbt die Rechnungs-Lampe nicht');
ok(zD.gewinn.stufe === 'rot', 'aber die Gewinn-Lampe wird rot');
ok(zD.gewinn.satz.indexOf('nicht dieselbe Partie') >= 0, 'mit dem richtigen Grund');

/* Zwischenstufen. */
ok(B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'passt', warnungen: 0, rendite: 0.6 }).gewinn.stufe === 'orange',
  'unter 1 Prozent: Gewinn-Lampe orange');
ok(B.zweiAmpeln({ rechnungStufe: 'teilweise', paarungStufe: 'passt', warnungen: 0, rendite: 2.5 }).rechnung.stufe === 'orange',
  'teilweise pruefbar: Rechnungs-Lampe orange');
ok(B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'passt', warnungen: 2, rendite: 2.5 }).gewinn.stufe === 'orange',
  'Warnzeichen: Gewinn-Lampe orange');
ok(B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'passt', warnungen: 0, rendite: null }).gewinn.stufe === 'orange',
  'ohne Renditezahl: Gewinn-Lampe orange, nicht gruen');

/* Beide Lampen tragen immer Kurztext und Begruendung. */
[zA, zB, zC, zD].forEach(function (z, i) {
  ok(!!z.rechnung.kurz && !!z.rechnung.satz, 'Fall ' + (i + 1) + ': Lampe 1 hat Text und Begruendung');
  ok(!!z.gewinn.kurz && !!z.gewinn.satz, 'Fall ' + (i + 1) + ': Lampe 2 hat Text und Begruendung');
});

/* Die Unabhaengigkeit als Grundsatz: bei gleicher Rendite darf die
   Rechnungs-Lampe variieren, ohne die Gewinn-Lampe mitzunehmen. */
var gleich1 = B.zweiAmpeln({ rechnungStufe: 'ok', paarungStufe: 'passt', warnungen: 0, rendite: 2.53 });
var gleich2 = B.zweiAmpeln({ rechnungStufe: 'fehler', paarungStufe: 'passt', warnungen: 0, rendite: 2.53 });
ok(gleich1.gewinn.stufe === gleich2.gewinn.stufe,
  'gleiche Rendite ergibt dieselbe Gewinn-Lampe, egal wie die Rechnung steht');
ok(gleich1.rechnung.stufe !== gleich2.rechnung.stufe,
  'waehrend die Rechnungs-Lampe sehr wohl unterscheidet');

/* ---------- 19) Waehrungen ---------- */
console.log('19) Waehrungen: Dollar, Pfund und Euro nicht verwechseln');
var W = require('../js/waehrung.js');
/* Feste Kurse fuer den Test, damit er ohne Netz laeuft.
   Gemessen am 19.08.2026: 1 EUR = 1,1605 USD = 0,85608 GBP. */
W.kurseSetzen({ EUR: 1, USD: 1.1605, GBP: 0.85608, stand: '2026-08-19' });

/* Welches Buch fuehrt was. */
ok(W.waehrungVon('polymarket').code === 'USD', 'Polymarket fuehrt Dollar');
ok(W.waehrungVon('kalshi').code === 'USD', 'Kalshi fuehrt Dollar');
ok(W.waehrungVon('smarkets').code === 'GBP', 'Smarkets fuehrt PFUND, nicht Dollar');
ok(W.waehrungVon('betfair').code === null, 'Betfair wird NICHT geraten');
ok(W.waehrungVon('betfair').sicher === false, 'und ist als unsicher gekennzeichnet');
ok(W.waehrungVon('betfair', 'EUR').code === 'EUR', 'eingestellte Betfair-Waehrung wird uebernommen');
ok(W.waehrungVon('betfair', 'EUR').sicher === false, 'bleibt aber als eingestellt und nicht gemessen markiert');
ok(W.waehrungVon('polymarket').sicher === true, 'Polymarket dagegen ist belegt');

/* Umrechnen. */
ok(Math.abs(W.rechne(100, 'EUR', 'USD') - 116.05) < 0.01, '100 Euro sind 116,05 Dollar');
ok(Math.abs(W.rechne(100, 'EUR', 'GBP') - 85.608) < 0.01, '100 Euro sind 85,61 Pfund');
ok(Math.abs(W.rechne(116.05, 'USD', 'EUR') - 100) < 0.01, 'und zurueck');
ok(W.rechne(100, 'EUR', 'EUR') === 100, 'gleiche Waehrung bleibt unveraendert');
/* Die Gegenprobe, die den ganzen Sinn ausmacht: */
var hundertDollar = W.rechne(100, 'USD', 'EUR');
var hundertPfund = W.rechne(100, 'GBP', 'EUR');
ok(Math.abs(hundertDollar - 86.17) < 0.05, '100 Dollar sind rund 86 Euro');
ok(Math.abs(hundertPfund - 116.81) < 0.05, '100 Pfund sind rund 117 Euro');
ok(hundertPfund > hundertDollar * 1.3, 'zwischen 100 Dollar und 100 Pfund liegen ueber 30 Prozent');

/* Ohne Kurs wird NICHT geschaetzt. */
W.kurseSetzen(null);
ok(W.rechne(100, 'EUR', 'USD') === null, 'ohne Kurs kommt null, keine geratene Zahl');
W.kurseSetzen({ EUR: 1, USD: 1.1605, GBP: 0.85608, stand: '2026-08-19' });

/* Betraege tragen immer ihr Zeichen. */
ok(W.geld(49.71, 'EUR').indexOf('€') > 0, 'Euro-Betrag traegt das Eurozeichen');
ok(W.geld(49.71, 'USD').indexOf('$') > 0, 'Dollar-Betrag traegt das Dollarzeichen');
ok(W.geld(49.71, 'GBP').indexOf('£') > 0, 'Pfund-Betrag traegt das Pfundzeichen');
ok(W.geld(49.71, null).indexOf('Waehrung offen') > 0, 'ohne Waehrung wird das gesagt, nicht unterstellt');
ok(W.geld(null, 'EUR') === 'unbekannt', 'ohne Betrag: unbekannt');

/* Die Lage einer Pruefung: gemischt oder nicht. */
var gemischt = W.lage([{ buch: 'Polymarket', buchNorm: 'polymarket' }, { buch: 'Smarkets', buchNorm: 'smarkets' }]);
ok(gemischt.gemischt === true, 'Polymarket gegen Smarkets ist USD gegen GBP, also gemischt');
ok(gemischt.text.indexOf('VERSCHIEDENE') > 0, 'und wird deutlich benannt');
var gleich = W.lage([{ buch: 'Polymarket', buchNorm: 'polymarket' }, { buch: 'Kalshi', buchNorm: 'kalshi' }]);
ok(gleich.gemischt === false, 'Polymarket gegen Kalshi ist zweimal USD');
ok(gleich.text.indexOf('Keine Verwechslungsgefahr') > 0, 'und wird als unkritisch gemeldet');
var offen = W.lage([{ buch: 'Polymarket', buchNorm: 'polymarket' }, { buch: 'Betfair', buchNorm: 'betfair' }]);
ok(offen.offen === true, 'mit Betfair ohne Einstellung bleibt eine Seite offen');

/* Die Einsatz-Sichten: derselbe Einsatz in zwei Waehrungen. */
var sichtPM = W.einsatzSichten(49.71, 'EUR', 'USD');
ok(sichtPM.leit.text.indexOf('€') > 0, 'Leitbetrag in Euro');
ok(Math.abs(sichtPM.konto.betrag - 57.69) < 0.05, '49,71 Euro sind 57,69 Dollar auf dem Polymarket-Konto');
ok(sichtPM.konto.text.indexOf('$') > 0, 'und der Kontobetrag traegt das Dollarzeichen');
ok(sichtPM.gleich === false, 'die beiden Waehrungen sind als verschieden erkannt');
var sichtGleich = W.einsatzSichten(49.71, 'EUR', 'EUR');
ok(sichtGleich.gleich === true, 'bei gleicher Waehrung wird das vermerkt');
var sichtOffen = W.einsatzSichten(49.71, 'EUR', null);
ok(sichtOffen.konto.betrag === null, 'ohne Kontowaehrung kein Kontobetrag');
ok(sichtOffen.konto.text.indexOf('nicht bestimmt') >= 0, 'sondern eine ehrliche Auskunft');

/* Der eigentliche Schutz: das Verhaeltnis der Einsaetze darf sich durch
   das Umrechnen NICHT aendern, sonst waere die Absicherung kaputt. */
var qeA = R.qeAnteil(0.48, 0.04), qeB = R.qeBack(2.06, 0.02);
var planEUR = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 100, schritt: 0.01 });
var s1USD = W.rechne(planEUR.s1, 'EUR', 'USD');
var s2GBP = W.rechne(planEUR.s2, 'EUR', 'GBP');
/* Zurueckgerechnet muessen beide wieder dasselbe Verhaeltnis ergeben. */
var zurueck1 = W.rechne(s1USD, 'USD', 'EUR');
var zurueck2 = W.rechne(s2GBP, 'GBP', 'EUR');
ok(Math.abs(zurueck1 / zurueck2 - planEUR.s1 / planEUR.s2) < 1e-9,
  'das Verhaeltnis der Einsaetze ueberlebt das Umrechnen unveraendert');
ok(Math.abs(zurueck1 + zurueck2 - 100) < 0.01, 'und die Summe bleibt der Einsatz');

/* Und die Kernaussage: Quoten haben KEINE Waehrung. */
ok(R.qeAnteil(0.48, 0.04) === qeA, 'die Effektivquote aendert sich durch keinen Wechselkurs');

/* ---------- 20) Die Rechner-Sammlung ---------- */
console.log('20) Die Rechner');
var RE = require('../js/rechner.js');

/* Quotenformate: dieselbe Wette, vier Schreibweisen. */
var d25 = RE.ausDezimal(2.50);
ok(Math.abs(d25.wahrscheinlichkeit - 40) < 1e-9, 'Quote 2,50 heisst 40 Prozent');
ok(d25.amerikanisch === 150, 'und amerikanisch +150');
ok(d25.bruch.text === '3/2', 'und als Bruch 3/2');
var d15 = RE.ausDezimal(1.50);
ok(d15.amerikanisch === -200, 'Quote 1,50 ist amerikanisch -200 (unter 2 wird negativ)');
ok(RE.ausAmerikanisch(-200).dezimal - 1.50 < 1e-9, 'und wieder zurueck ergibt 1,50');
ok(Math.abs(RE.ausAmerikanisch(150).dezimal - 2.50) < 1e-9, '+150 ergibt 2,50');
ok(Math.abs(RE.ausBruch(3, 2).dezimal - 2.50) < 1e-9, '3/2 ergibt 2,50');
ok(Math.abs(RE.ausWahrscheinlichkeit(40).dezimal - 2.50) < 1e-9, '40 Prozent ergibt 2,50');
/* Der Anteilspreis der Prognosemaerkte ist nichts anderes. */
ok(Math.abs(RE.ausAnteilspreis(0.40).dezimal - 2.50) < 1e-9, 'Anteilspreis 0,40 ist Quote 2,50');
ok(Math.abs(RE.ausAnteilspreis(0.48).wahrscheinlichkeit - 48) < 1e-9, 'Anteilspreis 0,48 sind 48 Prozent');
/* Unfug wird abgewiesen, nicht verbogen. */
ok(RE.ausDezimal(0.9) === null, 'Dezimalquote unter 1 wird abgewiesen');
ok(RE.ausAnteilspreis(1.5) === null, 'Anteilspreis ueber 1 wird abgewiesen');
ok(RE.ausWahrscheinlichkeit(0) === null, 'null Prozent wird abgewiesen');

/* Marge und faire Quoten. */
var m = RE.marge([1.90, 1.90]);
ok(Math.abs(m.kehrwertsumme - 1.0526315) < 1e-5, 'zweimal 1,90 ergibt Kehrwertsumme 1,0526');
ok(Math.abs(m.margeProzent - 5.263) < 0.01, 'das sind 5,26 Prozent Marge');
ok(Math.abs(m.fair[0] - 2.0) < 1e-6, 'fair waeren zweimal 2,00');
ok(m.istArbitrage === false, 'und es ist KEINE Arbitrage');
/* Gegenprobe: liegt die Summe unter 1, ist es genau das, was das Panel sucht. */
var mArb = RE.marge([2.10, 2.10]);
ok(mArb.istArbitrage === true, 'zweimal 2,10 IST Arbitrage');
ok(mArb.margeProzent < 0, 'und die Marge ist negativ, also zu unseren Gunsten');
ok(RE.marge([1.90]) === null, 'eine einzelne Quote ergibt keine Marge');

/* Erwartungswert. */
var ew = RE.erwartungswert(2.50, 45, 100);
ok(Math.abs(ew.wertProzent - 12.5) < 1e-9, 'Quote 2,50 bei 45 Prozent: plus 12,5 Prozent Erwartungswert');
ok(Math.abs(ew.erwarteterGewinn - 12.5) < 1e-9, 'auf 100 Einsatz also 12,50');
ok(ew.lohntSich === true, 'und lohnt sich');
ok(Math.abs(ew.mindestQuote - 2.2222) < 0.001, 'ab Quote 2,222 waere es gerade lohnend');
var ewSchlecht = RE.erwartungswert(1.80, 45, 100);
ok(ewSchlecht.lohntSich === false, 'Quote 1,80 bei 45 Prozent lohnt sich NICHT');
ok(ewSchlecht.wertProzent < 0, 'der Erwartungswert ist negativ');

/* Kelly. */
var kel = RE.kelly(2.50, 45, 1000);
ok(Math.abs(kel.anteilProzent - 8.3333) < 0.001, 'Kelly ergibt 8,33 Prozent des Kapitals');
ok(Math.abs(kel.einsatz - 83.333) < 0.01, 'bei 1000 Kapital also 83,33');
ok(Math.abs(kel.einsatzHalb - kel.einsatz / 2) < 1e-9, 'halbes Kelly ist genau die Haelfte');
ok(kel.halbesKellyProzent < kel.anteilProzent, 'und liegt niedriger, das ist der Sinn');
var kelSchlecht = RE.kelly(1.80, 45, 1000);
ok(kelSchlecht.lohntSich === false, 'ohne Vorteil rechnet Kelly keinen Einsatz aus');
ok(kelSchlecht.anteil < 0, 'der Anteil ist negativ, also Finger weg');

/* Dutching auf drei Ausgaenge. */
var du = RE.dutching([2.50, 3.20, 3.60], 100);
ok(du.einsaetze.length === 3, 'drei Einsaetze fuer drei Ausgaenge');
ok(Math.abs(du.einsaetze.reduce(function (a, b) { return a + b; }, 0) - 100) < 1e-9,
  'die Einsaetze ergeben zusammen genau den Einsatz');
/* Der Kern: JEDER Ausgang zahlt dasselbe. */
du.einsaetze.forEach(function (s, i) {
  ok(Math.abs(s * du.quoten[i] - du.auszahlung) < 1e-9,
    'Ausgang ' + (i + 1) + ' zahlt dieselbe Summe aus');
});
ok(du.sicher === true, 'bei Kehrwertsumme unter 1 ist es ein sicherer Gewinn');
var duVerlust = RE.dutching([2.00, 2.00, 2.00], 100);
ok(duVerlust.sicher === false, 'dreimal 2,00 ist ein sicherer VERLUST');
ok(duVerlust.gewinn < 0, 'und der Betrag ist negativ');

/* Der Waehrungsrechner nutzt dieselbe Kursquelle wie alles andere. */
W.kurseSetzen({ EUR: 1, USD: 1.1605, GBP: 0.85608, stand: '2026-08-19' });
var wr = RE.waehrungRechnen(100, 'EUR', 'USD', W);
ok(Math.abs(wr.ergebnis - 116.05) < 0.01, '100 Euro sind 116,05 Dollar');
ok(wr.text.indexOf('$') > 0, 'das Ergebnis traegt das Dollarzeichen');
ok(wr.kursText.indexOf('1 EUR') === 0, 'der Kurs steht als Satz dabei');
var wrRueck = RE.waehrungRechnen(116.05, 'USD', 'EUR', W);
ok(Math.abs(wrRueck.ergebnis - 100) < 0.01, 'und zurueck ergibt wieder 100 Euro');
W.kurseSetzen(null);
ok(RE.waehrungRechnen(100, 'EUR', 'USD', W) === null, 'ohne Kurs kein Ergebnis, keine geratene Zahl');
W.kurseSetzen({ EUR: 1, USD: 1.1605, GBP: 0.85608, stand: '2026-08-19' });

/* Und die Bruecke zur eigentlichen Pruefung: Dutching auf ZWEI Ausgaenge
   muss dasselbe ergeben wie der Einsatzrechner des Prueflings. */
var duZwei = RE.dutching([qeA, qeB], 100);
var planZwei = E.rechne({ qe1: qeA, qe2: qeB, gesamt: 100, schritt: 0.01 });
ok(Math.abs(duZwei.einsaetze[0] - planZwei.ideal1) < 0.01,
  'Dutching auf zwei Ausgaenge deckt sich mit dem Einsatzrechner');
ok(Math.abs(duZwei.renditeProzent - planZwei.idealRendite) < 0.01,
  'und ergibt dieselbe Rendite, zwei Wege zum selben Ergebnis');

/* ---------- Ergebnis ---------- */
console.log('----------------------------------------');
if (fehler === 0) {
  console.log('ALLE ' + laeufe + ' PRÜFUNGEN BESTANDEN.');
} else {
  console.log(fehler + ' von ' + laeufe + ' Prüfungen FEHLGESCHLAGEN.');
  process.exit(1);
}
