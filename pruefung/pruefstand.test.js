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

/* ---------- Ergebnis ---------- */
console.log('----------------------------------------');
if (fehler === 0) {
  console.log('ALLE ' + laeufe + ' PRÜFUNGEN BESTANDEN.');
} else {
  console.log(fehler + ' von ' + laeufe + ' Prüfungen FEHLGESCHLAGEN.');
  process.exit(1);
}
