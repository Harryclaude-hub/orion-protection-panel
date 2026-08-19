/* ORION PROTECTION PANEL, Die Übersicht
 *
 * Karams Vorgabe (18.08.): Ganz oben, vor allen Einzelheiten, muss auf
 * einen Blick dastehen, was vor dem Setzen zählt:
 *
 *   1. Mache ich Gewinn, ja, knapp, oder nein?
 *   2. Stimmt die Rechnung des Berichts?
 *   3. Führen beide Links zur selben Partie?
 *   4. Sind die Kurse überhaupt noch aktuell?
 *
 * Darunter der Geldfluss in echtem Geld: Was lege ich auf welche Seite,
 * was kommt brutto zurück, was frisst die Gebühr, was bleibt netto, und
 * was ist am Ende sicher übrig. Alle Einzelrechnungen bleiben weiter
 * unten, diese Übersicht ersetzt sie nicht, sie ordnet sie.
 *
 * Zeichnet nur; gerechnet wird in bewertung.js und einsatz.js.
 */
(function (welt) {
  'use strict';

  /* Der lange Gedankenstrich wird hier abgefangen, auch wenn er aus
   * dem eingefuegten Bericht stammt: er ist Karams Kontrollsignal.
   * Ein Komma sagt dasselbe. */
  var langerStrich = new RegExp(String.fromCharCode(8212), "g");
  function txt(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(langerStrich, ',')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function f(n, stellen) {
    return (n === null || n === undefined || !isFinite(n)) ? '?' : Number(n).toFixed(stellen);
  }

  var BUCH_KLASSE = { polymarket: 'pm', kalshi: 'ka', smarkets: 'sm', betfair: 'bf' };

  /* Antwort auf Frage 3: Führen die Links zur Partie? */
  function linkAntwort(links) {
    var l = links || [];
    var schlecht = l.filter(function (x) { return x.urteil === 'falsch'; });
    var offen = l.filter(function (x) { return x.urteil === 'unpruefbar'; });
    if (schlecht.length) {
      return { text: 'NEIN, Seite ' + schlecht.map(function (x) { return x.nr; }).join(' und ') +
                     ' führt woanders hin', klasse: 'rot' };
    }
    if (!l.length) return { text: 'keine Links im Bericht', klasse: 'orange' };
    if (offen.length) {
      return { text: 'Adressen stimmen · ' + offen.length + ' Link von außen nicht prüfbar',
               klasse: 'orange' };
    }
    return { text: 'beide führen zur Partie', klasse: 'gruen' };
  }

  /* Antwort auf Frage 4: Sind die Kurse noch aktuell? */
  function aktualitaetAntwort(akt, seiten) {
    if (!akt) return { text: 'wird beim Anbieter nachgefragt …', klasse: 'orange' };
    var frisch = 0, bewegt = 0;
    (akt.seiten || []).forEach(function (s, i) {
      if (s.status !== 'ok') return;
      frisch++;
      var seite = seiten[i];
      if (!seite) return;
      var grenze = seite.art === 'preis' ? 0.0005 : 0.005;
      if (Math.abs(s.wert - seite.wert) >= grenze) bewegt++;
    });
    var vorbei = (akt.seiten || []).filter(function (s) { return s.status === 'vorbei'; }).length;
    if (vorbei) return { text: 'ein Markt ist beim Anbieter bereits geschlossen', klasse: 'rot' };
    if (!frisch) return { text: 'keine Seite von hier prüfbar, beim Anbieter selbst ansehen', klasse: 'orange' };
    if (bewegt) return { text: bewegt + ' von ' + frisch + ' geprüften Kursen hat sich BEWEGT', klasse: 'rot' };
    return { text: frisch + ' geprüfte(r) Kurs(e) unverändert', klasse: 'gruen' };
  }

  /* Die zwei getrennten Ampeln (Karam 19.08.). Sie stehen ganz oben,
   * nebeneinander, gleich gross: links die Rechnung, rechts der
   * Gewinn. Jede fuer sich rot, orange oder gruen. */
  function zweiAmpelnBlock(zwei) {
    if (!zwei) return '';
    function eine(titel, frage, a) {
      return '<div class="doppelampel ' + a.stufe + '">' +
        '<div class="dakopf">' + txt(titel) + '</div>' +
        '<div class="dafrage">' + txt(frage) + '</div>' +
        '<div class="dalampe"><span class="dapunkt"></span>' +
          '<b class="daurteil">' + txt(a.kurz) + '</b></div>' +
        '<div class="dasatz">' + txt(a.satz) + '</div>' +
      '</div>';
    }
    return '<div class="ampelpaar">' +
      eine('Prüfung 1', 'Stimmt die Rechnung, die du mir gegeben hast?', zwei.rechnung) +
      eine('Prüfung 2', 'Ist es profitabel?', zwei.gewinn) +
    '</div>';
  }
  function frageZeile(nr, text, antwort, klasse) {
    return '<div class="ufrage">' +
      '<span class="unr">' + nr + '</span>' +
      '<span class="utext">' + txt(text) + '</span>' +
      '<span class="uantwort ' + klasse + '">' + txt(antwort) + '</span>' +
      '</div>';
  }

  function geldZeile(s) {
    return '<tr>' +
      '<td><span class="chip ' + (BUCH_KLASSE[s.buchNorm] || 'xx') + '">' + txt(s.buch) + '</span> ' +
        '<span class="leise">' + txt(s.seiteText) + '</span></td>' +
      '<td class="zahl mono">' + txt(f(s.einsatz, 2)) + '</td>' +
      '<td class="zahl mono">' + txt(f(s.bruttoRueckgabe, 2)) + '</td>' +
      '<td class="zahl mono rot">−' + txt(f(s.gebuehrGeld, 2)) + '</td>' +
      '<td class="zahl mono"><b>' + txt(f(s.nettoRueckgabe, 2)) + '</b></td>' +
      '<td class="zahl mono ' + (s.gewinn > 0 ? 'gruen' : 'rot') + '">' +
        (s.gewinn >= 0 ? '+' : '') + txt(f(s.gewinn, 2)) + '</td>' +
      '</tr>';
  }

  /* opt: { bericht, ergebnis, plan, fluss, ampel, aktualitaet, einheit } */
  function baue(opt) {
    var b = opt.bericht, erg = opt.ergebnis, a = opt.ampel;
    var eh = opt.einheit ? ' ' + opt.einheit : '';

    var lk = linkAntwort(erg.links);
    var ak = aktualitaetAntwort(opt.aktualitaet, b.seiten || []);
    var rechnungKlasse = erg.urteil.stufe === 'ok' ? 'gruen'
      : (erg.urteil.stufe === 'fehler' ? 'rot' : 'orange');

    var fragen =
      frageZeile(1, 'Mache ich Gewinn?', a.gewinnfrage, a.stufe) +
      frageZeile(2, 'Stimmt die Rechnung?', a.rechnungfrage, rechnungKlasse) +
      frageZeile(3, 'Führen die Links zur Partie?', lk.text, lk.klasse) +
      frageZeile(4, 'Sind die Kurse noch aktuell?', ak.text, ak.klasse);

    /* Womit wurde gerechnet? Das gehoert sichtbar dazu, sonst weiss
     * niemand, ob die Prozentzahl auf gepruefte oder auf geglaubte
     * Zahlen gestuetzt ist. */
    var gm = opt.gerechnetMit || { kurs: 0, gebuehr: 0 };
    var grundlage;
    if (gm.kurs >= 2 && gm.gebuehr >= 2) {
      grundlage = '<div class="grundlage gepruef">Gerechnet mit <b>beiden Kursen und beiden Gebuehrensaetzen direkt vom Anbieter</b>. ' +
        'Der Bericht war hier nur der Ausgangspunkt.</div>';
    } else if (gm.kurs > 0 || gm.gebuehr > 0) {
      grundlage = '<div class="grundlage teils">Gerechnet mit ' + gm.kurs + ' von 2 Kursen und ' +
        gm.gebuehr + ' von 2 Gebuehrensaetzen direkt vom Anbieter, der Rest stammt aus dem Bericht.</div>';
    } else {
      grundlage = '<div class="grundlage ungepruef">Gerechnet <b>nur mit den Zahlen des Berichts</b>. ' +
        'Keine Seite war von hier aus abfragbar, also ist auch der Gewinn hier ungeprueft.</div>';
    }

    var geld;
    if (opt.fluss && opt.plan) {
      var fl = opt.fluss, plan = opt.plan;
      geld =
        '<div class="uabschnitt">Wenn du <b>' + txt(f(plan.gesamtWunsch, 2)) + txt(eh) + '</b> einsetzt' +
          (plan.schritt >= 1 ? ' <span class="leise">(auf ' + txt(f(plan.schritt, 0)) + ' gerundet)</span>' : '') +
          ':</div>' +
        '<div class="tabellenrahmen"><table class="geldtabelle">' +
          '<thead><tr><th>wohin</th><th class="zahl">Einsatz</th><th class="zahl">brutto zurück</th>' +
          '<th class="zahl">Gebühr</th><th class="zahl">netto zurück</th><th class="zahl">Gewinn</th></tr></thead>' +
          '<tbody>' + geldZeile(fl.seite1) + geldZeile(fl.seite2) + '</tbody>' +
        '</table></div>' +
        '<div class="ufazit ' + a.stufe + '">' +
          '<span class="ufeld"><span class="ufname">eingesetzt</span><b class="mono">' +
            txt(f(fl.gesamtEinsatz, 2)) + txt(eh) + '</b></span>' +
          '<span class="ufeld"><span class="ufname">davon Gebühren</span><b class="mono">' +
            txt(f(fl.gebuehrMin, 2)) + '–' + txt(f(fl.gebuehrMax, 2)) + txt(eh) + '</b></span>' +
          '<span class="ufeld"><span class="ufname">sicher zurück</span><b class="mono">' +
            txt(f(fl.schlechtesterAusgang.nettoRueckgabe, 2)) + txt(eh) + '</b></span>' +
          '<span class="ufeld gross"><span class="ufname">garantierter Gewinn</span><b class="mono">' +
            (fl.garantierterGewinn >= 0 ? '+' : '') + txt(f(fl.garantierterGewinn, 2)) + txt(eh) +
            ' <span class="leise">(' + txt(f(fl.garantierteRendite, 2)) + ' %)</span></b></span>' +
        '</div>' +
        '<div class="leise klein">Die Gebühr fällt bei dem Ausgang an, der eintritt, daher eine Spanne. ' +
          'Der garantierte Gewinn ist immer der <b>schlechtere</b> der beiden Ausgänge, nie der Mittelwert. ' +
          'Einsatz und Rundung einstellen: Abschnitt 6. Jeder Rechenschritt einzeln: Abschnitt 3.</div>';
    } else {
      geld = '<div class="leise">Ohne beide Effektivquoten lässt sich kein Geldfluss aufstellen, ' +
             'siehe die nicht prüfbaren Schritte weiter unten.</div>';
    }

    return zweiAmpelnBlock(opt.zweiAmpeln) + grundlage + '<div class="ampel ' + a.stufe + '">' +
        '<span class="ampellicht"></span>' +
        '<span class="ampeltext"><b class="ampelkopf">' + txt(a.kopf) + '</b>' +
        '<span class="ampelsatz">' + txt(a.satz) + '</span></span>' +
      '</div>' +
      '<div class="karte uebersichtkarte">' + fragen + geld + '</div>';
  }

  var api = { baue: baue, linkAntwort: linkAntwort, aktualitaetAntwort: aktualitaetAntwort };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).uebersicht = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
