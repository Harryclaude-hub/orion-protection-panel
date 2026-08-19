/* ORION PROTECTION PANEL, Herkunft und Paarung
 *
 * Karams Vorgabe (18.08.): eine Komplettanzeige ÜBER der Übersicht, in
 * der jede Angabe zeigt, WOHER sie stammt, mit Link zur Quelle, damit
 * man jeden Wert selbst nachsehen kann.
 *
 * Drei Herkünfte, immer unterscheidbar:
 *   BERICHT   steht so im eingefügten Text des Panels
 *   ANBIETER  direkt beim Buch nachgefragt (mit Link auf die Abfrage)
 *   GERECHNET vom Prüfstand selbst aus den beiden anderen erzeugt
 *
 * Dazu der tiefe Paarungsvergleich Seite gegen Seite: dieselbe Partie?
 * dieselbe Anpfiffzeit? dieselbe Liga? dieselbe Altersklasse? Denn eine
 * fehlerfreie Rechnung auf zwei verschiedenen Spielen ist keine
 * Absicherung, sondern eine offene Wette.
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

  function zeitText(iso) {
    var t = Date.parse(String(iso || ''));
    if (!isFinite(t)) return String(iso || 'nicht genannt');
    var d = new Date(t);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '. ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }

  var QUELLE_NAME = {
    bericht: 'aus dem Bericht',
    anbieter: 'beim Anbieter nachgefragt',
    gerechnet: 'selbst gerechnet',
    fehlt: 'nicht vorhanden'
  };

  /* Eine Zeile der Herkunftstabelle. */
  function zeile(was, wert, quelle, link, anmerkung) {
    return '<tr>' +
      '<td class="hkwas">' + txt(was) + '</td>' +
      '<td class="hkwert mono">' + txt(wert) + '</td>' +
      '<td><span class="hkquelle ' + quelle + '">' + txt(QUELLE_NAME[quelle] || quelle) + '</span>' +
        (link ? ' <a class="hklink" href="' + txt(link) + '" target="_blank" rel="noopener">ansehen ↗</a>' : '') +
        (anmerkung ? '<div class="leise klein">' + txt(anmerkung) + '</div>' : '') +
      '</td></tr>';
  }

  /* Die Paarungsbefunde als Gegenüberstellung. */
  function paarungBlock(paarung, namen) {
    if (!paarung) return '';
    var kopf = {
      passt: { klasse: 'gruen', text: 'Beide Seiten meinen dieselbe Partie, soweit prüfbar.' },
      unbekannt: { klasse: 'orange', text: 'Teilweise nicht prüfbar, offene Punkte unten. Vor dem Setzen beide Links öffnen und vergleichen.' },
      falsch: { klasse: 'rot', text: 'ACHTUNG: mindestens ein Merkmal passt NICHT zusammen. Sehr wahrscheinlich zwei verschiedene Spiele.' }
    }[paarung.stufe] || { klasse: 'orange', text: '' };

    var zeilen = paarung.befunde.map(function (b) {
      var marke = b.urteil === 'passt' ? 'passt' : (b.urteil === 'falsch' ? 'PASST NICHT' : 'nicht prüfbar');
      return '<tr class="pz-' + b.urteil + '">' +
        '<td class="hkwas">' + txt(b.art) + '</td>' +
        '<td class="mono klein">' + txt(b.wert1 || 'nicht genannt') + '</td>' +
        '<td class="mono klein">' + txt(b.wert2 || 'nicht genannt') + '</td>' +
        '<td><span class="marke ' + (b.urteil === 'passt' ? 'ok' : (b.urteil === 'falsch' ? 'abweichung' : 'unpruefbar')) + '">' +
          txt(marke) + '</span><div class="leise klein">' + txt(b.text) + '</div></td>' +
        '</tr>';
    }).join('');

    return '<div class="uabschnitt">Meinen beide Bücher wirklich dasselbe Spiel?</div>' +
      '<div class="warnung ' + kopf.klasse + '">' + txt(kopf.text) + '</div>' +
      '<div class="tabellenrahmen"><table class="hktabelle">' +
        '<thead><tr><th>Merkmal</th><th>' + txt(namen[0] || 'Seite 1') + '</th><th>' +
          txt(namen[1] || 'Seite 2') + '</th><th>Urteil</th></tr></thead>' +
        '<tbody>' + zeilen + '</tbody></table></div>';
  }

  /* opt: { bericht, ergebnis, aktualitaet, paarung } */
  function baue(opt) {
    var b = opt.bericht, akt = opt.aktualitaet;
    var s1 = (b.seiten && b.seiten[0]) || {}, s2 = (b.seiten && b.seiten[1]) || {};
    var a1 = akt && akt.seiten ? akt.seiten[0] : null;
    var a2 = akt && akt.seiten ? akt.seiten[1] : null;
    var namen = [s1.buch || 'Seite 1', s2.buch || 'Seite 2'];

    var zeilen = [];

    /* Was das Spiel überhaupt ist. */
    zeilen.push(zeile('Spiel / Frage laut Panel', b.titel || 'nicht genannt', 'bericht', null));
    if (a1 && a1.frage) {
      zeilen.push(zeile('Marktfrage bei ' + namen[0], a1.frage, 'anbieter', a1.quellLink || s1.link,
        'So heißt der Markt, den der Link von Seite 1 wirklich öffnet.'));
    }
    if (a1 && a1.ereignis && a1.ereignis !== a1.frage) {
      zeilen.push(zeile('Ereignis bei ' + namen[0], a1.ereignis, 'anbieter', s1.link, null));
    }
    if (b.partie2) zeilen.push(zeile('Partie laut Panel bei ' + namen[1], b.partie2, 'bericht', null));
    if (a2 && a2.frage) {
      zeilen.push(zeile('Marktfrage bei ' + namen[1], a2.frage, 'anbieter', a2.quellLink || s2.link, null));
    }

    /* Zeiten. */
    zeilen.push(zeile('Anpfiff laut Panel', b.zeiten && b.zeiten.anpfiff ? b.zeiten.anpfiff : ',',
      b.zeiten && b.zeiten.anpfiff ? 'bericht' : 'fehlt', null));
    if (a1 && a1.anpfiff) {
      zeilen.push(zeile('Anpfiff laut ' + namen[0], zeitText(a1.anpfiff), 'anbieter', a1.quellLink || s1.link,
        'Direkt vom Anbieter, der schärfste Beleg dafür, welches Spiel gemeint ist.'));
    }
    if (a2 && a2.anpfiff) {
      zeilen.push(zeile('Anpfiff laut ' + namen[1], zeitText(a2.anpfiff), 'anbieter', a2.quellLink || s2.link, null));
    }
    if (a1 && a1.serie) zeilen.push(zeile('Serie / Liga bei ' + namen[0], a1.serie, 'anbieter', s1.link, null));
    if (a1 && a1.marktArt) zeilen.push(zeile('Marktart bei ' + namen[0], a1.marktArt, 'anbieter', s1.link, null));

    /* Die Zahlen, mit denen gerechnet wird. */
    var art1 = s1.art === 'preis' ? 'Anteilspreis' : 'Quote';
    var art2 = s2.art === 'preis' ? 'Anteilspreis' : 'Quote';
    zeilen.push(zeile(art1 + ' ' + namen[0] + ' (' + (s1.seiteText || '?') + ')',
      s1.wert !== undefined && s1.wert !== null ? String(s1.wert) : ',', 'bericht', s1.link));
    if (a1 && a1.status === 'ok') {
      var b1 = Math.abs(a1.wert - s1.wert) >= (s1.art === 'preis' ? 0.0005 : 0.005);
      zeilen.push(zeile('… jetzt beim Anbieter', String(a1.wert), 'anbieter', a1.quellLink || s1.link,
        b1 ? 'WEICHT AB vom Bericht, mit dieser Zahl neu rechnen.' : 'unverändert gegenüber dem Bericht.'));
    }
    zeilen.push(zeile(art2 + ' ' + namen[1] + ' (' + (s2.seiteText || '?') + ')',
      s2.wert !== undefined && s2.wert !== null ? String(s2.wert) : ',', 'bericht', s2.link));
    if (a2 && a2.status === 'ok') {
      var b2 = Math.abs(a2.wert - s2.wert) >= (s2.art === 'preis' ? 0.0005 : 0.005);
      zeilen.push(zeile('… jetzt beim Anbieter', String(a2.wert), 'anbieter', a2.quellLink || s2.link,
        b2 ? 'WEICHT AB vom Bericht, mit dieser Zahl neu rechnen.' : 'unverändert gegenüber dem Bericht.'));
    }

    /* Gebühren und die daraus gerechneten Größen. */
    zeilen.push(zeile('Gebührensatz ' + namen[0],
      s1.gebuehr !== null && s1.gebuehr !== undefined ? (s1.gebuehr * 100).toFixed(1) + ' %' : ',',
      'bericht', null, s1.gebuehrEcht === false ? 'Standardtarif, NICHT am Konto gemessen.' : null));
    zeilen.push(zeile('Gebührensatz ' + namen[1],
      s2.gebuehr !== null && s2.gebuehr !== undefined ? (s2.gebuehr * 100).toFixed(1) + ' %' : ',',
      'bericht', null, s2.gebuehrEcht === false ? 'Standardtarif, NICHT am Konto gemessen.' : null));
    if (opt.ergebnis && isFinite(opt.ergebnis.qe1)) {
      zeilen.push(zeile('Effektivquote ' + namen[0], opt.ergebnis.qe1.toFixed(4), 'gerechnet', null,
        'Aus Kurs und Gebühr, Rechenweg in Abschnitt 3.'));
    }
    if (opt.ergebnis && isFinite(opt.ergebnis.qe2)) {
      zeilen.push(zeile('Effektivquote ' + namen[1], opt.ergebnis.qe2.toFixed(4), 'gerechnet', null, null));
    }

    var nichtGeprueft = [];
    if (!a1 || a1.status !== 'ok') nichtGeprueft.push(namen[0]);
    if (!a2 || a2.status !== 'ok') nichtGeprueft.push(namen[1]);

    return '<div class="karte herkunftkarte">' +
      '<div class="kartentitel">Woher jede Zahl stammt</div>' +
      '<div class="tabellenrahmen"><table class="hktabelle">' +
        '<thead><tr><th>Angabe</th><th>Wert</th><th>Herkunft</th></tr></thead>' +
        '<tbody>' + zeilen.join('') + '</tbody></table></div>' +
      (nichtGeprueft.length
        ? '<div class="warnung orange">Von hier aus nicht direkt prüfbar: <b>' + txt(nichtGeprueft.join(' und ')) +
          '</b>. Diese Seite bitte im geöffneten Fenster selbst vergleichen, Adresse, Partie, Anpfiff und Kurs.</div>'
        : '') +
      paarungBlock(opt.paarung, namen) +
      '</div>';
  }

  var api = { baue: baue, zeitText: zeitText };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).herkunft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
