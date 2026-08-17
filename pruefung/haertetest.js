/* ORION PROTECTION PANEL — Härtetest (node pruefung/haertetest.js)
 *
 * Die ehrliche Frage: Fängt der Prüfstand wirklich Fehler, oder verteilt er
 * nur grüne Haken? Antwort nicht durch Behauptung, sondern durch Messung.
 *
 * Der Test nimmt EINEN sauberen Bericht und verfälscht ihn gezielt — so,
 * wie ein echter Fehler im Panel aussähe. Gemessen wird beides:
 *
 *   TREFFER      Wie viele Verfälschungen werden erkannt?
 *   FEHLALARME   Wie oft schlägt er bei einem KORREKTEN Bericht an?
 *
 * Ein Prüfer, der alles rot färbt, ist genauso wertlos wie einer, der
 * alles grün färbt. Beide Zahlen müssen stimmen.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var Parser = require('../js/parser.js');
var Pruefer = require('../js/pruefer.js');

var ORIGINAL = fs.readFileSync(path.join(__dirname, 'muster-bericht.txt'), 'utf8');

function pruefe(text) {
  var erg = Pruefer.pruefen(Parser.parse(text));
  var betroffen = erg.schritte
    .filter(function (s) { return s.urteil === 'abweichung'; })
    .map(function (s) { return s.titel; });
  erg.warnungen.forEach(function (w) {
    if (w.stufe === 'fehler') betroffen.push('Harter Befund: ' + w.text.slice(0, 60) + '…');
  });
  return { stufe: erg.urteil.stufe, betroffen: betroffen };
}

function ersetze(alt, neu) {
  if (ORIGINAL.indexOf(alt) < 0) throw new Error('Muster-Text nicht gefunden: ' + alt);
  return ORIGINAL.replace(alt, neu);
}

/* ---------- 1) Die Kontrolle: der UNVERFÄLSCHTE Bericht ---------- */
console.log('KONTROLLE — der unverfälschte Bericht');
var kontrolle = pruefe(ORIGINAL);
var fehlalarm = kontrolle.stufe === 'fehler';
console.log('  Urteil: ' + kontrolle.stufe + (fehlalarm ? '  ← FEHLALARM!' : '  (richtig: kein Fehler gemeldet)'));
if (fehlalarm) console.log('  angeschlagen bei: ' + kontrolle.betroffen.join(' | '));

/* ---------- 2) Rundung, die ERLAUBT ist — darf nicht anschlagen ---------- */
console.log('\nRUNDUNGSPROBE — Werte an der letzten Stelle, wie sie beim Drucken entstehen');
var rundungen = [
  { name: 'Rendite 2.53 → 2.54 (eine Stelle Rundung)', text: ersetze('= +2.53 %', '= +2.54 %') },
  { name: 'Kehrwertsumme 0.9753 → 0.9754', text: ersetze('= 0.9753', '= 0.9754') }
];
var falscheAlarme = 0;
rundungen.forEach(function (r) {
  var e = pruefe(r.text);
  var alarm = e.stufe === 'fehler';
  if (alarm) falscheAlarme++;
  console.log('  ' + (alarm ? 'FEHLALARM' : 'ruhig    ') + ' · ' + r.name);
});

/* ---------- 3) Die Verfälschungen ---------- */
console.log('\nVERFÄLSCHUNGEN — jede muss erkannt werden');

var faelle = [
  {
    name: 'Rendite geschönt: 2.53 % → 3.10 %',
    was: 'Der klassische Fall: das Ergebnis sieht besser aus, als die Kurse hergeben.',
    text: ersetze('= +2.53 %', '= +3.10 %')
  },
  {
    name: 'Rendite nur knapp geschönt: 2.53 % → 2.62 %',
    was: 'Neun Hundertstel — die Grenzprobe, ob die Toleranz nicht zu großzügig ist.',
    text: ersetze('= +2.53 %', '= +2.62 %')
  },
  {
    name: 'Kehrwertsumme gefälscht: 0.9753 → 0.9600',
    was: 'Der Zwischenwert, aus dem die Rendite entsteht.',
    text: ersetze('= 0.9753', '= 0.9600')
  },
  {
    name: 'Effektivquote Seite 1 zu hoch: 2.063 → 2.113',
    was: 'Eine Seite wird besser gerechnet, als ihre Gebühr zulässt.',
    text: ORIGINAL.split('Effektivquote (nach Gebühr): 2.063').join('Effektivquote (nach Gebühr): 2.113')
  },
  {
    name: 'Gebühr heimlich gesenkt: 4.0 % → 1.0 %, Quote unverändert',
    was: 'Die Gebühr im Bericht passt nicht mehr zur ausgewiesenen Effektivquote.',
    text: ersetze('Gebühr: 4.0 %', 'Gebühr: 1.0 %')
  },
  {
    name: 'Kurs manipuliert: Anteilspreis 0.480 → 0.440, Rest unverändert',
    was: 'Der Kurs wird nachträglich schöngerechnet, die Folgezahlen bleiben stehen.',
    text: ersetze('JA · Anteilspreis 0.480', 'JA · Anteilspreis 0.440')
  },
  {
    name: 'Quote manipuliert: Smarkets 2.06 → 2.20',
    was: 'Dasselbe auf der Gegenseite.',
    text: ersetze('Back · Quote 2.06', 'Back · Quote 2.20')
  },
  {
    name: 'Aufteilung 50/50 statt nach Effektivquote',
    was: 'Der häufigste Denkfehler überhaupt — dann zahlen die Ausgänge NICHT gleich aus.',
    text: ersetze('49.71 $ auf Polymarket, 50.29 $ auf Smarkets', '50.00 $ auf Polymarket, 50.00 $ auf Smarkets')
  },
  {
    name: 'Auszahlung zu hoch: 102.53 → 105.00',
    was: 'Das Versprechen stimmt nicht mehr mit Einsatz und Kehrwertsumme überein.',
    text: ersetze('Auszahlung bei BEIDEN Ausgängen: 102.53 $', 'Auszahlung bei BEIDEN Ausgängen: 105.00 $')
  },
  {
    name: 'Gewinn beim Max-Einsatz falsch: 6.07 → 9.50',
    was: 'Die Geldzahl, auf die man am Ende schaut.',
    text: ersetze('tatsächlicher Gewinn: 6.07 $', 'tatsächlicher Gewinn: 9.50 $')
  },
  {
    name: 'Link führt zu einer fremden Partie',
    was: 'Die gefährlichste Klasse: die Rechnung stimmt, aber es sind zwei verschiedene Spiele.',
    text: ersetze('football/fc-probe-vs-sv-muster', 'football/real-madrid-vs-barcelona')
  },
  {
    name: 'Link zeigt auf das falsche Buch',
    was: 'Polymarket-Seite mit Smarkets-Adresse.',
    text: ersetze('https://polymarket.com/event/fc-probe-sv-muster/fc-probe-sv-muster-winner',
                  'https://smarkets.com/event/1/sport/football/fc-probe-vs-sv-muster')
  },
  {
    name: 'Effektivquote nach der ALTEN Gebührenformel min(p, 1−p)',
    was: 'Genau der Fehler, der heute im Panel steckt — muss benannt, nicht nur gemeldet werden.',
    text: ORIGINAL.split('Effektivquote (nach Gebühr): 2.063').join('Effektivquote (nach Gebühr): 2.043')
  }
];

var treffer = 0;
faelle.forEach(function (fall, i) {
  var e = pruefe(fall.text);
  var erkannt = e.stufe === 'fehler';
  if (erkannt) treffer++;
  console.log('  ' + (erkannt ? 'ERKANNT     ' : 'DURCHGERUTSCHT') + ' · ' + fall.name);
  if (erkannt) {
    console.log('      gefunden bei: ' + e.betroffen.slice(0, 3).join(' | '));
  } else {
    console.log('      → ' + fall.was);
  }
});

/* ---------- 4) Die GRENZEN — ehrlich gemessen, nicht behauptet ----------
 * Diese Fälle bewertet der Test NICHT als Fehlschlag. Sie zeigen, was ein
 * Prüfer, der nur einen Text vor sich hat, prinzipiell nicht wissen kann.
 * Ein Programm, das seine eigenen Grenzen verschweigt, ist gefährlicher
 * als eines, das sie nennt. */
console.log('\nGRENZEN — was aus dem Bericht allein NICHT beweisbar ist');

var grenzen = [
  {
    name: 'Halbzeit-Markt gegen Ganzspiel-Markt gepaart',
    text: ersetze('SPIEL/FRAGE: FC Probe gegen SV Muster',
                  'SPIEL/FRAGE: FC Probe gegen SV Muster: 1st Half Over/Under 0.5'),
    erklaerung: 'Die Rechnung stimmt, aber es sind zwei verschiedene Fragen. Am 13.08. war ' +
      'genau das eine der beiden Fehlerklassen. Der Bericht nennt beim Gegenbuch nur die PARTIE, ' +
      'nicht den Markt — deshalb ist es aus dem Text nicht entscheidbar.'
  },
  {
    /* Ein Kurs, der so nie am Markt stand — aber DURCHGEHEND mitgerechnet:
     * Preis, Formel-Zeile, Effektivquote, Kehrwertsumme, Rendite, Einsätze
     * und Auszahlung passen alle zueinander. Zahlen unten selbst gerechnet:
     * Gebühr = 0,04 × 0,470 × 0,530 = 0,009964 → qE = 0,990036 ÷ 0,470
     * = 2,10646 → inv = 1/2,10646 + 1/2,03880 = 0,96526 → +3,60 % */
    name: 'Kurs frei erfunden, aber DURCHGEHEND stimmig mitgerechnet',
    text: ersetze('JA · Anteilspreis 0.480', 'JA · Anteilspreis 0.470')
      .replace('Formel: Gebührenanteil = Satz × Preis × (1 − Preis) = 4.0 % × 0.480 × 0.520 = 0.0100 → Effektivquote = (1 − 0.0100) ÷ 0.480 = 2.063',
               'Formel: Gebührenanteil = Satz × Preis × (1 − Preis) = 4.0 % × 0.470 × 0.530 = 0.0100 → Effektivquote = (1 − 0.0100) ÷ 0.470 = 2.106')
      .replace('Effektivquote (nach Gebühr): 2.063', 'Effektivquote (nach Gebühr): 2.106')
      .replace('Kehrwertsumme = 1/2.063 + 1/2.039 = 0.9753', 'Kehrwertsumme = 1/2.106 + 1/2.039 = 0.9653')
      .replace('Rendite = (1 / 0.9753 - 1) x 100 = +2.53 %', 'Rendite = (1 / 0.9653 - 1) x 100 = +3.60 %')
      .replace('49.71 $ auf Polymarket, 50.29 $ auf Smarkets', '49.18 $ auf Polymarket, 50.82 $ auf Smarkets')
      .replace('Auszahlung bei BEIDEN Ausgängen: 102.53 $', 'Auszahlung bei BEIDEN Ausgängen: 103.60 $')
      .replace('tatsächlicher Gewinn: 6.07 $', 'tatsächlicher Gewinn: 8.64 $'),
    erklaerung: 'Ein in sich vollständig schlüssiger Bericht kann durch reines Nachrechnen nicht ' +
      'widerlegt werden — dafür gibt es den Aktualitäts-Abruf beim Anbieter (Punkt 6) und die ' +
      'Warnzeichen: hier schlägt immerhin das Rendite-Band an (3,60 % über dem gemessenen 2,07–3,27 %).'
  }
];

grenzen.forEach(function (g) {
  var e = pruefe(g.text);
  console.log('  ' + (e.stufe === 'fehler' ? 'wird erkannt   ' : 'NICHT erkennbar') + ' · ' + g.name);
  console.log('      ' + g.erklaerung);
});

/* ---------- Bilanz ---------- */
console.log('\n' + '='.repeat(60));
console.log('TREFFER:     ' + treffer + ' von ' + faelle.length + ' Verfälschungen erkannt');
console.log('FEHLALARME:  ' + (fehlalarm ? 1 : 0) + ' beim korrekten Bericht · ' +
            falscheAlarme + ' von ' + rundungen.length + ' bei erlaubter Rundung');
console.log('='.repeat(60));

if (treffer < faelle.length || fehlalarm || falscheAlarme > 0) {
  console.log('NICHT BESTANDEN — siehe oben.');
  process.exit(1);
}
console.log('BESTANDEN: alle Verfälschungen gefunden, kein Fehlalarm.');
