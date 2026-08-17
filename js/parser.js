/* ORION PRÜFSTAND — Parser
 *
 * Zerlegt den kopierten Prüfbericht des Orion Panels (Knopf "Kopieren",
 * Format vom 17.08.2026) in seine Einzelteile. Der Parser ist bewusst
 * NACHSICHTIG: er sucht Zeilen an ihren Schlüsselwörtern, nicht an fester
 * Position, und meldet ehrlich, was er nicht gefunden hat, statt zu raten.
 *
 * Drei Zustände, nie zwei: ein Feld ist gefunden, fehlt, oder ist als
 * "unbekannt" gekennzeichnet — der Prüfer behandelt alle drei verschieden.
 */
(function (welt) {
  'use strict';

  /* Erste Zahl in einem Text, Komma oder Punkt als Dezimaltrenner. */
  function zahl(text) {
    if (text === null || text === undefined) return null;
    var m = String(text).match(/[-+]?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    var n = Number(m[0].replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  /* Alle Zahlen eines Textes, in Reihenfolge. */
  function zahlen(text) {
    var aus = [];
    var re = /[-+]?\d+(?:[.,]\d+)?/g, m;
    while ((m = re.exec(String(text))) !== null) {
      var n = Number(m[0].replace(',', '.'));
      if (isFinite(n)) aus.push(n);
    }
    return aus;
  }

  /* Geldangabe: "49.53 €" | "49.53 $" | "unbekannt …" -> { betrag, einheit } */
  function geld(text) {
    var t = String(text || '').trim();
    if (!t || /unbekannt/i.test(t)) return { betrag: null, einheit: null };
    var m = t.match(/([-+]?\d+(?:[.,]\d+)?)\s*([€$])/);
    if (!m) return { betrag: zahl(t), einheit: null };
    return { betrag: Number(m[1].replace(',', '.')), einheit: m[2] };
  }

  /* Dauer aus seit(): "42 s" | "13 min" | "1.5 h" | "2.0 Tage" -> Minuten. */
  function dauerMinuten(text) {
    var t = String(text || '').trim();
    var n = zahl(t);
    if (n === null) return null;
    if (/tag/i.test(t)) return n * 1440;
    if (/\bh\b/i.test(t)) return n * 60;
    if (/min/i.test(t)) return n;
    if (/\bs\b/i.test(t)) return n / 60;
    return null;
  }

  function buchNorm(name) {
    var n = String(name || '').toLowerCase();
    if (n.indexOf('polymarket') >= 0) return 'polymarket';
    if (n.indexOf('kalshi') >= 0) return 'kalshi';
    if (n.indexOf('smarkets') >= 0) return 'smarkets';
    if (n.indexOf('betfair') >= 0) return 'betfair';
    return null;
  }

  /* Wert hinter "Schlüssel:" — sucht die erste Zeile, die so beginnt.
   * Eine erklärende Klammer direkt nach dem Schlüssel ("Zuordnung (wie
   * sicher …): 0.87") gehört zum Schlüssel, nicht zum Wert. */
  function hinter(zeilen, schluessel) {
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i].trim();
      if (z.toLowerCase().indexOf(schluessel.toLowerCase()) === 0) {
        return z.slice(schluessel.length)
          .replace(/^\s*\([^)]*\)\s*/, '')
          .replace(/^:\s*/, '').trim();
      }
    }
    return null;
  }

  function parseSeite(block) {
    var kopf = block[0].trim();
    /* "SEITE 1 — Polymarket: JA · Anteilspreis 0.470" */
    var m = kopf.match(/^SEITE\s+(\d)\s+[—-]+\s+([^:]+):\s*(.*)$/);
    var s = {
      nr: m ? Number(m[1]) : null,
      buch: m ? m[2].trim() : null,
      buchNorm: m ? buchNorm(m[2]) : null,
      seiteText: null, art: null, wert: null,
      ausgang: null, gebuehr: null, gebuehrEcht: null,
      qe: null, formelText: null, formelZahlen: [],
      kursSeitText: null, kursSeitMinuten: null,
      mengeText: null, menge: null, mengeEinheit: null,
      link: null, fehlend: []
    };
    if (m) {
      var rest = m[3];
      var wm = rest.match(/(Anteilspreis|Quote)\s+([-+]?\d+(?:[.,]\d+)?)/i);
      if (wm) {
        s.art = /anteilspreis/i.test(wm[1]) ? 'preis' : 'quote';
        s.wert = Number(wm[2].replace(',', '.'));
        s.seiteText = rest.slice(0, wm.index).replace(/[·\s]+$/, '').trim() || null;
      } else {
        s.fehlend.push('Kurswert');
      }
    } else {
      s.fehlend.push('Seitenkopf');
    }
    var t;
    if ((t = hinter(block, 'Ausgang')) !== null) s.ausgang = t;
    if ((t = hinter(block, 'Gebühr')) !== null) {
      var g = zahl(t);
      s.gebuehr = g === null ? null : g / 100;
      s.gebuehrEcht = /vom Buch gemessen/i.test(t) ? true
        : (/Standardtarif|nicht am Konto/i.test(t) ? false : null);
    } else s.fehlend.push('Gebühr');
    if ((t = hinter(block, 'Effektivquote')) !== null) {
      s.qe = t.indexOf('?') >= 0 ? null : zahl(t);
    } else s.fehlend.push('Effektivquote');
    if ((t = hinter(block, 'Formel')) !== null) {
      s.formelText = t;
      s.formelZahlen = zahlen(t);
    }
    if ((t = hinter(block, 'Kurs unverändert seit')) !== null) {
      s.kursSeitText = t;
      s.kursSeitMinuten = /nicht hinterlegt|\?/.test(t) ? null : dauerMinuten(t);
    }
    if ((t = hinter(block, 'Handelbare Menge')) !== null) {
      s.mengeText = t;
      var gm = geld(t);
      s.menge = gm.betrag; s.mengeEinheit = gm.einheit;
    }
    if ((t = hinter(block, 'Link')) !== null) {
      s.link = /^fehlt$/i.test(t) ? null : t;
    } else s.fehlend.push('Link');
    return s;
  }

  function parse(text) {
    var roh = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var zeilenAlle = roh.split('\n');
    var aus = {
      erkannt: /ORION PANEL/i.test(roh) && /SEITE\s+1/i.test(roh),
      kopiertAm: null, titel: null, bereich: null, tag: null,
      partie2: null, zuordnung: null,
      seiten: [], rechnung: null, zeiten: {}, absage: null,
      nachpruefungPanel: null, nummer: null,
      fehlend: [], roh: roh
    };

    var t;
    if ((t = hinter(zeilenAlle, 'Kopiert am')) !== null) aus.kopiertAm = t;
    /* SPIEL/FRAGE — auch ohne Schrägstrich tolerieren. */
    for (var i = 0; i < zeilenAlle.length; i++) {
      var mZ = zeilenAlle[i].match(/^SPIEL.?FRAGE:\s*(.*)$/i);
      if (mZ) { aus.titel = mZ[1].trim(); break; }
    }
    if (aus.titel === null) aus.fehlend.push('Spiel/Frage');
    if ((t = hinter(zeilenAlle, 'Bereich')) !== null) {
      var mB = t.match(/^(.*?)(?:\s*\(Tag:\s*([^)]*)\))?$/);
      aus.bereich = mB ? mB[1].trim() : t;
      aus.tag = mB && mB[2] ? mB[2].trim() : null;
    }
    if ((t = hinter(zeilenAlle, 'Partie beim zweiten Buch')) !== null) aus.partie2 = t;
    if ((t = hinter(zeilenAlle, 'Zuordnung')) !== null) aus.zuordnung = zahl(t);

    /* Seitenblöcke: von "SEITE n" bis zur nächsten SEITE oder Trennlinie. */
    var starts = [];
    for (i = 0; i < zeilenAlle.length; i++) {
      if (/^SEITE\s+\d\s/.test(zeilenAlle[i].trim())) starts.push(i);
    }
    for (i = 0; i < starts.length; i++) {
      var von = starts[i];
      var bis = zeilenAlle.length;
      for (var j = von + 1; j < zeilenAlle.length; j++) {
        var zj = zeilenAlle[j].trim();
        if (/^SEITE\s+\d\s/.test(zj) || /^-{10,}$/.test(zj)) { bis = j; break; }
      }
      aus.seiten.push(parseSeite(zeilenAlle.slice(von, bis)));
    }
    if (aus.seiten.length < 2) aus.fehlend.push('zwei Seiten');

    /* DIE RECHNUNG */
    var r = {
      qe1: null, qe2: null, inv: null, rendite: null,
      einheitEinsatz: null, s1: null, s2: null,
      buch1: null, buch2: null, sEinheit: null,
      auszahlung: null, auszahlungEinheit: null,
      maxEinsatz: null, echterGewinn: null,
      besteRendite: null, buchSumme: null, buchSummeText: null,
      fxKurs: null, fxStand: null, waehrungText: null
    };
    if ((t = hinter(zeilenAlle, 'Kehrwertsumme')) !== null) {
      /* "= 1/2.101 + 1/2.079 = 0.9569" — qe kann auch '?' sein. */
      var km = t.match(/1\s*\/\s*([\d.,?]+)\s*\+\s*1\s*\/\s*([\d.,?]+)\s*=\s*([\d.,]+)/);
      if (km) {
        r.qe1 = km[1].indexOf('?') >= 0 ? null : zahl(km[1]);
        r.qe2 = km[2].indexOf('?') >= 0 ? null : zahl(km[2]);
        r.inv = zahl(km[3]);
      } else {
        var kz = zahlen(t);
        if (kz.length) r.inv = kz[kz.length - 1];
      }
    } else aus.fehlend.push('Kehrwertsumme');
    if ((t = hinter(zeilenAlle, 'Rendite =')) !== null || (t = hinter(zeilenAlle, 'Rendite')) !== null) {
      var rz = zahlen(t);
      if (rz.length) r.rendite = rz[rz.length - (/%/.test(t) ? 1 : 1)];
      /* letzte Zahl vor "%": das Prozent-Ergebnis steht am Ende der Zeile */
      var pm = t.match(/([-+]?\d+(?:[.,]\d+)?)\s*%/);
      if (pm) r.rendite = Number(pm[1].replace(',', '.'));
    } else aus.fehlend.push('Rendite');
    if ((t = hinter(zeilenAlle, 'Aufteilung bei')) !== null) {
      var em = t.match(/^([\d.,]+)\s*([€$])/);
      if (em) { r.einheitEinsatz = Number(em[1].replace(',', '.')); r.sEinheit = em[2]; }
      var am = t.match(/:\s*(.*)$/);
      if (am) {
        var teile = am[1].split(',');
        if (teile.length >= 2) {
          var g1 = geld(teile[0]), g2 = geld(teile[1]);
          r.s1 = g1.betrag; r.s2 = g2.betrag;
          var b1m = teile[0].match(/auf\s+(.+)$/); if (b1m) r.buch1 = b1m[1].trim();
          var b2m = teile[1].match(/auf\s+(.+)$/); if (b2m) r.buch2 = b2m[1].trim();
        }
      }
    } else aus.fehlend.push('Aufteilung');
    if ((t = hinter(zeilenAlle, 'Auszahlung bei')) !== null) {
      var ga = geld(t); r.auszahlung = ga.betrag; r.auszahlungEinheit = ga.einheit;
    } else aus.fehlend.push('Auszahlung');
    if ((t = hinter(zeilenAlle, 'Max. Einsatz')) !== null) {
      var teile2 = t.split('·');
      r.maxEinsatz = geld(teile2[0]).betrag;
      if (teile2.length > 1) r.echterGewinn = geld(teile2[1]).betrag;
    }
    if ((t = hinter(zeilenAlle, 'Beste je gesehene Rendite')) !== null) r.besteRendite = zahl(t);
    if ((t = hinter(zeilenAlle, 'Buchprobe Gegenbuch')) !== null) {
      r.buchSumme = zahl(t); r.buchSummeText = t;
    }
    if ((t = hinter(zeilenAlle, 'Währung')) !== null) {
      r.waehrungText = t;
      var fm = t.match(/EZB-Kurs\s+([\d.,]+)/i);
      if (fm) r.fxKurs = Number(fm[1].replace(',', '.'));
      var sm = t.match(/\(Stand\s+([^)]*)\)/i);
      if (sm) r.fxStand = sm[1];
    }
    aus.rechnung = r;

    /* ZEITEN + Rest — reine Wiedergabe. */
    aus.zeiten.gefunden = hinter(zeilenAlle, 'Gefunden');
    aus.zeiten.bestaetigt = hinter(zeilenAlle, 'Zuletzt bestätigt');
    aus.zeiten.anpfiff = hinter(zeilenAlle, 'Anpfiff');
    aus.zeiten.wetteEndet = hinter(zeilenAlle, 'Wette endet');
    aus.zeiten.beendet = hinter(zeilenAlle, 'Beendet');
    aus.absage = hinter(zeilenAlle, 'ABSAGE-BILANZ');
    aus.nachpruefungPanel = hinter(zeilenAlle, 'UNABHÄNGIGE NACHRECHNUNG');
    if ((t = hinter(zeilenAlle, 'Interne Nummer der Zeile')) !== null) {
      var nm = t.match(/#?\s*(\d+)/); if (nm) aus.nummer = nm[1];
    }
    return aus;
  }

  var api = { parse: parse, zahl: zahl, zahlen: zahlen, geld: geld, dauerMinuten: dauerMinuten, buchNorm: buchNorm };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).parser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
