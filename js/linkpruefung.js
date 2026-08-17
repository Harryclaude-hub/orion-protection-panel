/* ORION PRÜFSTAND — Link-Prüfung
 *
 * Beantwortet je Seite: Führt der Link plausibel zu GENAU dieser Partie?
 * Zwei Stufen, beide ohne Netz (das Netz kommt erst in der Aktualität):
 *
 *   1. Buch ↔ Adresse: Ein Polymarket-Eintrag mit einem Smarkets-Link ist
 *      immer falsch, egal was drinsteht.
 *   2. Wortabgleich: Die Wörter des Link-Pfads gegen die Wörter von
 *      Spiel/Frage, Partie und Ausgang. Stoppwörter nach der Panel-Lehre
 *      (Fehlerklasse 11): reine Zahlen und will/does/did/would/shall
 *      belegen NICHTS — »200« traf »Bitcoin $200,000«, »will« verband
 *      einen Cricketspieler mit einer Wahlfrage.
 *
 * Drei Zustände, nie zwei: passt · passt NICHT · von außen nicht prüfbar.
 * Kalshi-Kennungen und Orbit-Marktnummern tragen keine Klartext-Wörter —
 * dort wird das GESAGT statt ein Urteil zu erfinden.
 */
(function (welt) {
  'use strict';

  var STOPP = {
    vs: 1, v: 1, gegen: 1, fc: 1, cf: 1, sc: 1, ac: 1, cd: 1, sv: 1, tsv: 1,
    the: 1, of: 1, and: 1, at: 1, in_: 1, 'in': 1, on: 1, to: 1, a: 1,
    will: 1, does: 1, did: 1, would: 1, shall: 1, be: 1, is: 1,
    event: 1, market: 1, sport: 1, football: 1, soccer: 1, over: 1, under: 1,
    winner: 1, win: 1, o: 1, u: 1, ou: 1, spread: 1, total: 1
  };

  /* Text -> aussagekräftige Wörter (klein, ohne Umlaute, ohne Zahlen). */
  function woerter(text) {
    var t = String(text || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    var teile = t.split(/[^a-z0-9]+/);
    var aus = [];
    for (var i = 0; i < teile.length; i++) {
      var w = teile[i];
      if (!w || w.length < 2) continue;
      if (/^\d+$/.test(w)) continue;            // reine Zahlen belegen nichts
      if (/^\d/.test(w)) continue;              // 25aug17 u. ä.
      if (STOPP[w]) continue;
      aus.push(w);
    }
    return aus;
  }

  /* Kommt das Wort (oder ein Wort, das es enthält) in der Liste vor?
   * "concepcion" soll "cdconcepcion" treffen und umgekehrt. */
  function enthalten(wort, liste) {
    for (var i = 0; i < liste.length; i++) {
      var b = liste[i];
      if (b === wort) return true;
      if (b.length >= 4 && wort.length >= 4 && (b.indexOf(wort) >= 0 || wort.indexOf(b) >= 0)) return true;
    }
    return false;
  }

  var DOMAENEN = {
    polymarket: ['polymarket.com'],
    kalshi: ['kalshi.com'],
    smarkets: ['smarkets.com'],
    betfair: ['orbitexch.com', 'betfair.com']
  };

  function domaene(link) {
    var m = String(link || '').match(/^https?:\/\/([^/]+)/i);
    return m ? m[1].toLowerCase() : null;
  }

  /* Der Teil des Links, der Wörter tragen kann. */
  function pfadWoerter(buchNorm, link) {
    var pfad = String(link || '').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
    if (buchNorm === 'polymarket') {
      /* /event/<event-slug>/<markt-slug> — beide Slugs tragen die Partie. */
      return woerter(pfad.replace(/^\/event\//, ' '));
    }
    if (buchNorm === 'smarkets') {
      /* /event/<nr>/sport/…/<partie-slug>/… — die Nummer fällt eh raus. */
      return woerter(pfad);
    }
    return woerter(pfad);
  }

  /* Prüft EINE Seite. Liefert { urteil: 'passt'|'falsch'|'unpruefbar',
   * text, treffer, geprueft } */
  function pruefeSeite(bericht, seite) {
    if (!seite) return null;
    if (!seite.link) {
      return { urteil: 'falsch', text: 'Kein Link im Bericht — beide Links sind Pflicht (Panel-Regel 8.3).' };
    }
    var d = domaene(seite.link);
    if (!d) return { urteil: 'falsch', text: 'Der Link ist keine gültige Adresse: ' + seite.link };

    /* Stufe 1: Buch ↔ Adresse. */
    var erwartet = DOMAENEN[seite.buchNorm];
    if (erwartet) {
      var passtDomaene = erwartet.some(function (e) { return d === e || d.slice(-(e.length + 1)) === '.' + e; });
      if (!passtDomaene) {
        return { urteil: 'falsch',
          text: 'Der Link zeigt auf ' + d + ', die Seite gehört aber zu ' + seite.buch +
            ' (erwartet: ' + erwartet.join(' oder ') + '). Falscher Link.' };
      }
    }

    /* Stufe 2: Wortabgleich — nur wo der Link Klartext trägt. */
    if (seite.buchNorm === 'kalshi') {
      return { urteil: 'unpruefbar',
        text: 'Adresse gehört zu Kalshi ✓. Die Kennung im Link trägt keine Klartext-Wörter — ' +
          'ob sie DIESE Partie meint, ist von außen nicht belegbar. Beim Öffnen den Titel vergleichen.' };
    }
    if (seite.buchNorm === 'betfair') {
      var mn = String(seite.link).match(/market\/(1\.\d+)/);
      return { urteil: 'unpruefbar',
        text: 'Adresse gehört zu Orbit/Betfair ✓' + (mn ? ', Marktnummer ' + mn[1] : '') +
          '. Die Nummer trägt keine Wörter — ob sie DIESE Partie meint, kann nur die Bridge oder ' +
          'das geöffnete Fenster zeigen.' };
    }

    var slug = pfadWoerter(seite.buchNorm, seite.link);
    var berichtWoerter = woerter([bericht.titel, bericht.partie2, seite.ausgang].join(' '));
    if (slug.length < 2) {
      return { urteil: 'unpruefbar', text: 'Adresse gehört zu ' + seite.buch + ' ✓, aber der Link trägt zu wenige Wörter für einen Abgleich.' };
    }
    if (!berichtWoerter.length) {
      return { urteil: 'unpruefbar', text: 'Der Bericht selbst trägt keine vergleichbaren Wörter (Titel fehlt?).' };
    }

    var treffer = 0;
    var fehlend = [];
    slug.forEach(function (w) {
      if (enthalten(w, berichtWoerter)) treffer++;
      else fehlend.push(w);
    });
    var anteil = treffer / slug.length;

    if (anteil >= 0.5 && treffer >= 2) {
      return { urteil: 'passt',
        text: 'Adresse gehört zu ' + seite.buch + ' ✓, und ' + treffer + ' von ' + slug.length +
          ' Link-Wörtern finden sich in Spiel/Partie wieder.' };
    }
    if (treffer === 0 && slug.length >= 3) {
      return { urteil: 'falsch',
        text: 'Adresse gehört zwar zu ' + seite.buch + ', aber KEIN Wort des Links (' + slug.join(', ') +
          ') kommt in Spiel/Partie vor — der Link führt sehr wahrscheinlich zu einer ANDEREN Partie.' };
    }
    return { urteil: 'unpruefbar',
      text: 'Adresse gehört zu ' + seite.buch + ' ✓, aber nur ' + treffer + ' von ' + slug.length +
        ' Link-Wörtern passen (offen: ' + fehlend.join(', ') + ') — beim Öffnen die Partie vergleichen.' };
  }

  function pruefen(bericht) {
    var aus = [];
    (bericht.seiten || []).forEach(function (s) {
      var e = pruefeSeite(bericht, s);
      if (e) { e.nr = s.nr; e.buch = s.buch; aus.push(e); }
    });
    return aus;
  }

  var api = { pruefen: pruefen, pruefeSeite: pruefeSeite, woerter: woerter };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).linkpruefung = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
