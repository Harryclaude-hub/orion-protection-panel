/* ORION PRÜFSTAND — Oberfläche
 *
 * Zeichnet Eingabe, Aufteilung, Rechenweg, Warnzeichen, Aktualität und
 * Verlauf. Rechnet selbst NICHTS — alle Zahlen kommen aus pruefer.js /
 * aktualitaet.js. Alles Eingefügte wird vor dem Zeichnen entschärft.
 */
(function (welt) {
  'use strict';

  var P = welt.PS;

  function txt(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function f(n, stellen) {
    return (n === null || n === undefined || !isFinite(n)) ? '?' : Number(n).toFixed(stellen);
  }

  function el(id) { return document.getElementById(id); }

  var URTEIL_TEXT = { ok: 'deckt sich', abweichung: 'WEICHT AB', unpruefbar: 'nicht prüfbar', hinweis: 'Hinweis' };
  var BUCH_KLASSE = { polymarket: 'pm', kalshi: 'ka', smarkets: 'sm', betfair: 'bf' };

  var zustand = { bericht: null, ergebnis: null };

  /* ---------- Aufteilung ---------- */
  function seiteKarte(s) {
    if (!s) return '<div class="karte seite">Seite fehlt im Bericht.</div>';
    var chip = BUCH_KLASSE[s.buchNorm] || 'xx';
    var zeilen = [];
    function z(name, wert, klasse) {
      zeilen.push('<div class="feld"><span class="feldname">' + txt(name) + '</span>' +
        '<span class="feldwert ' + (klasse || '') + '">' + wert + '</span></div>');
    }
    z(s.art === 'preis' ? 'Anteilspreis' : 'Quote', '<b class="mono">' + txt(f(s.wert, s.art === 'preis' ? 3 : 2)) + '</b>');
    z('Seite', txt(s.seiteText || '?'));
    if (s.ausgang) z('Ausgang', txt(s.ausgang));
    z('Gebühr', s.gebuehr === null ? '<span class="rot">fehlt</span>'
      : '<span class="mono">' + txt(f(s.gebuehr * 100, 1)) + ' %</span> ' +
        (s.gebuehrEcht === true ? '<span class="leise">(vom Buch gemessen)</span>'
          : '<span class="leise">(Standardtarif, nicht gemessen)</span>'));
    z('Effektivquote laut Panel', s.qe === null ? '<span class="leise">nicht angegeben</span>' : '<b class="mono">' + txt(f(s.qe, 3)) + '</b>');
    z('Kurs unverändert seit', s.kursSeitText ? txt(s.kursSeitText) : '<span class="leise">nicht hinterlegt</span>',
      (s.kursSeitMinuten !== null && s.kursSeitMinuten > 15) ? 'orange' : '');
    z('Handelbare Menge', s.mengeText ? txt(s.mengeText) : '<span class="leise">nicht angegeben</span>',
      s.menge === null ? 'orange' : '');
    var link = s.link
      ? '<a class="knopf klein" target="_blank" rel="noopener" href="' + txt(s.link) + '">' + txt(s.buch || 'Buch') + ' öffnen</a>'
      : '<span class="rot">Link fehlt</span>';
    return '<div class="karte seite rand-' + chip + '">' +
      '<div class="seitekopf"><span class="chip ' + chip + '">' + txt(s.buch || '?') + '</span>' +
      '<span class="leise">Seite ' + txt(s.nr || '?') + '</span></div>' +
      zeilen.join('') +
      '<div class="feld">' + link + '</div>' +
      '</div>';
  }

  function aufteilungZeichnen(b) {
    var r = b.rechnung || {};
    var kopf = [];
    function k(name, wert) {
      kopf.push('<div class="feld"><span class="feldname">' + txt(name) + '</span><span class="feldwert">' + wert + '</span></div>');
    }
    k('Spiel / Frage', '<b>' + txt(b.titel || '?') + '</b>');
    if (b.bereich) k('Bereich', txt(b.bereich) + (b.tag ? ' <span class="leise">(Tag: ' + txt(b.tag) + ')</span>' : ''));
    if (b.partie2) k('Partie beim zweiten Buch', txt(b.partie2));
    if (b.zuordnung !== null) k('Zuordnung', '<span class="mono ' + (b.zuordnung < 0.8 ? 'orange' : '') + '">' + txt(f(b.zuordnung, 2)) + '</span> <span class="leise">(wie sicher dieselbe Partie gemeint ist)</span>');
    if (b.kopiertAm) k('Kopiert am', txt(b.kopiertAm));
    if (b.nummer) k('Interne Nummer', '#' + txt(b.nummer));

    var zeiten = [];
    ['gefunden', 'bestaetigt', 'anpfiff', 'wetteEndet', 'beendet'].forEach(function (n) {
      var namen = { gefunden: 'Gefunden', bestaetigt: 'Zuletzt bestätigt', anpfiff: 'Anpfiff', wetteEndet: 'Wette endet', beendet: 'Beendet' };
      if (b.zeiten[n]) zeiten.push('<div class="feld"><span class="feldname">' + namen[n] + '</span><span class="feldwert">' + txt(b.zeiten[n]) + '</span></div>');
    });

    var panel = [];
    function p(name, wert) {
      panel.push('<div class="feld"><span class="feldname">' + txt(name) + '</span><span class="feldwert mono">' + wert + '</span></div>');
    }
    if (r.inv !== null) p('Kehrwertsumme', txt(f(r.inv, 4)));
    if (r.rendite !== null) p('Rendite', '<b>' + (r.rendite >= 0 ? '+' : '') + txt(f(r.rendite, 2)) + ' %</b>');
    if (r.s1 !== null) p('Aufteilung', txt(f(r.s1, 2)) + (r.sEinheit ? ' ' + txt(r.sEinheit) : '') + ' / ' + txt(f(r.s2, 2)) + (r.sEinheit ? ' ' + txt(r.sEinheit) : ''));
    if (r.auszahlung !== null) p('Auszahlung (beide Ausgänge)', txt(f(r.auszahlung, 2)) + (r.auszahlungEinheit ? ' ' + txt(r.auszahlungEinheit) : ''));
    if (r.maxEinsatz !== null) p('Max. Einsatz', txt(f(r.maxEinsatz, 2)));
    if (r.echterGewinn !== null) p('Tatsächlicher Gewinn', txt(f(r.echterGewinn, 2)));
    if (r.besteRendite !== null) p('Beste je gesehene Rendite', txt(f(r.besteRendite, 2)) + ' %');
    if (r.buchSumme !== null) p('Buchprobe Gegenbuch', txt(f(r.buchSumme, 4)) + (r.buchSumme < 1 ? ' <span class="orange">unstimmig</span>' : ' <span class="gruen">stimmig</span>'));
    if (b.absage) panel.push('<div class="feld"><span class="feldname">Absage-Bilanz</span><span class="feldwert">' + txt(b.absage) + '</span></div>');

    el('aufteilung').innerHTML =
      '<div class="karte">' + kopf.join('') + (zeiten.length ? '<div class="trenn"></div>' + zeiten.join('') : '') + '</div>' +
      '<div class="seiten">' + seiteKarte(b.seiten[0]) + seiteKarte(b.seiten[1]) + '</div>' +
      '<div class="karte"><div class="kartentitel">Was das Panel behauptet</div>' + panel.join('') + '</div>';
  }

  /* ---------- Rechenweg (in getrennten Rechnungs-Blöcken) ---------- */
  function rechenwegZeichnen(erg) {
    var letzteGruppe = null;
    var zeilen = erg.schritte.map(function (s) {
      var kopf = '';
      if (s.gruppe && s.gruppe !== letzteGruppe) {
        letzteGruppe = s.gruppe;
        kopf = '<div class="gruppentitel">' + txt(s.gruppe) + '</div>';
      }
      return kopf + schrittHtml(s);
    });
    el('rechenweg').innerHTML = zeilen.join('');
  }

  function schrittHtml(s) {
      var u = s.urteil || 'unpruefbar';
      var wert = '';
      if (s.ist !== undefined && s.ist !== null && isFinite(s.ist)) {
        wert = '<span class="mono">eigene Rechnung: <b>' + txt(f(s.ist, s.stellen)) + (s.einheit ? ' ' + txt(s.einheit) : '') + '</b></span>';
        if (s.soll !== undefined && s.soll !== null && isFinite(s.soll)) {
          wert += ' <span class="mono leise">· Panel: ' + txt(f(s.soll, s.stellen)) + (s.einheit ? ' ' + txt(s.einheit) : '') + '</span>';
          if (u === 'abweichung') {
            wert += ' <span class="mono rot">· Unterschied ' + txt(f(s.delta, s.stellen)) + '</span>';
          }
        }
      }
      return '<div class="schritt ' + u + '">' +
        '<div class="schrittkopf"><span class="marke ' + u + '">' + txt(URTEIL_TEXT[u] || u) + '</span>' +
        '<b>' + txt(s.titel) + '</b></div>' +
        (s.formel ? '<div class="leise mono klein">' + txt(s.formel) + '</div>' : '') +
        (s.rechnung ? '<div class="mono klein">' + txt(s.rechnung) + '</div>' : '') +
        (wert ? '<div>' + wert + '</div>' : '') +
        (s.kommentar ? '<div class="kommentar">' + txt(s.kommentar) + '</div>' : '') +
        '</div>';
  }

  /* ---------- Link-Prüfung ---------- */
  function linksZeichnen(erg) {
    if (!erg.links || !erg.links.length) {
      el('linkpruefung').innerHTML = '<div class="leise">Keine Links im Bericht.</div>';
      return;
    }
    el('linkpruefung').innerHTML = erg.links.map(function (l) {
      var klasse = l.urteil === 'passt' ? 'gruen' : (l.urteil === 'falsch' ? 'rot' : 'orange');
      var marke = l.urteil === 'passt' ? 'passt' : (l.urteil === 'falsch' ? 'FALSCHER LINK' : 'von außen nicht prüfbar');
      return '<div class="warnung ' + klasse + '"><b>Seite ' + txt(l.nr) + ' (' + txt(l.buch || '?') + ') — ' +
        txt(marke) + ':</b> ' + txt(l.text) + '</div>';
    }).join('');
  }

  function warnungenZeichnen(erg) {
    if (!erg.warnungen.length) {
      el('warnungen').innerHTML = '<div class="leise">Keine Warnzeichen.</div>';
      return;
    }
    el('warnungen').innerHTML = erg.warnungen.map(function (w) {
      return '<div class="warnung ' + txt(w.stufe) + '">' + txt(w.text) + '</div>';
    }).join('');
  }

  function urteilZeichnen(erg, b) {
    var u = erg.urteil;
    var klasse = u.stufe === 'ok' ? 'gruen' : (u.stufe === 'fehler' ? 'rot' : 'orange');
    var warnAnzahl = erg.warnungen.filter(function (w) { return w.stufe !== 'hinweis'; }).length;
    el('urteil').innerHTML =
      '<div class="urteil ' + klasse + '">' +
      '<div class="urteiltitel">' + txt(u.stufe === 'ok' ? 'RECHNUNG GEPRÜFT — DECKT SICH' :
        u.stufe === 'fehler' ? 'RECHNUNG GEPRÜFT — ABWEICHUNG' : 'RECHNUNG GEPRÜFT — TEILWEISE') + '</div>' +
      '<div>' + txt(u.text) + '</div>' +
      (warnAnzahl ? '<div class="leise">Dazu ' + warnAnzahl + ' Warnzeichen — siehe unten.</div>' : '') +
      '</div>';
  }

  /* ---------- Aktualität ---------- */
  function aktualitaetZeichnen(a, b) {
    var teile = [];
    a.seiten.forEach(function (s, i) {
      var seite = b.seiten[i];
      var name = seite ? (seite.buch + ' (Seite ' + seite.nr + ')') : ('Seite ' + (i + 1));
      var klasse = s.status === 'ok' ? 'gruen' : (s.status === 'vorbei' ? 'rot' : 'orange');
      var inhalt;
      if (s.status === 'ok') {
        var alt = seite.wert, neu = s.wert;
        var gleich = Math.abs(neu - alt) < (seite.art === 'preis' ? 0.0005 : 0.005);
        inhalt = 'Aktueller Wert: <b class="mono">' + txt(f(neu, seite.art === 'preis' ? 3 : 2)) + '</b>' +
          ' <span class="leise">(Bericht: ' + txt(f(alt, seite.art === 'preis' ? 3 : 2)) + ')</span> — ' +
          (gleich ? '<span class="gruen">unverändert</span>' : '<span class="orange">hat sich bewegt</span>') +
          (s.quelle ? '<div class="leise klein">Quelle: ' + txt(s.quelle) + '</div>' : '');
        if (s.frage) {
          /* Der Anbieter nennt die Frage des Marktes, den der Link öffnet —
           * der direkteste Beleg, ob der Link zur Partie führt. */
          inhalt += '<div class="klein">Der Link öffnet: „' + txt(s.frage) + '"' +
            (b.titel ? ' <span class="leise">(Bericht: „' + txt(b.titel) + '")</span>' : '') + '</div>';
        }
      } else {
        inhalt = txt(s.text || '');
      }
      teile.push('<div class="warnung ' + klasse + '"><b>' + txt(name) + ':</b> ' + inhalt + '</div>');
    });

    if (a.neu) {
      var n = a.neu;
      teile.push(
        '<div class="karte"><div class="kartentitel">Der Eintrag mit den AKTUELLEN Zahlen</div>' +
        '<div class="mono klein leise">Seite 1: ' + txt(f(n.wert1, 4)) + (n.frisch1 ? ' (frisch)' : ' (aus dem Bericht — nicht prüfbar)') +
        ' · Seite 2: ' + txt(f(n.wert2, 4)) + (n.frisch2 ? ' (frisch)' : ' (aus dem Bericht — nicht prüfbar)') + '</div>' +
        '<div class="feld"><span class="feldname">Kehrwertsumme jetzt</span><span class="feldwert mono">' + txt(f(n.inv, 4)) + '</span></div>' +
        '<div class="feld"><span class="feldname">Rendite jetzt</span><span class="feldwert mono"><b>' + (n.rendite >= 0 ? '+' : '') + txt(f(n.rendite, 2)) + ' %</b></span></div>' +
        '<div class="feld"><span class="feldname">Aufteilung bei 100</span><span class="feldwert mono">' + txt(f(n.s1, 2)) + ' / ' + txt(f(n.s2, 2)) + '</span></div>' +
        '<div class="feld"><span class="feldname">Urteil</span><span class="feldwert">' +
        (n.istArbitrage ? '<span class="gruen">Chance besteht mit den aktuellen Zahlen weiter</span>'
          : '<span class="rot">Mit den aktuellen Zahlen KEINE Arbitrage mehr</span>') +
        ((n.frisch1 && n.frisch2) ? '' : ' <span class="leise">(eine Seite war nicht prüfbar — halbes Urteil)</span>') +
        '</span></div></div>');
    } else {
      teile.push('<div class="leise">Keine Seite war frisch prüfbar — es bleibt beim Bericht. Links öffnen und von Hand vergleichen.</div>');
    }
    el('aktualitaet-ergebnis').innerHTML = teile.join('');
  }

  /* ---------- Verlauf ---------- */
  function verlaufZeichnen() {
    var V = P.verlauf;
    var status = el('konto-status');
    if (V.angemeldet()) {
      status.innerHTML = 'Angemeldet als <b>' + txt(V.eigeneMail() || '?') + '</b> — Prüfungen landen im Konto, auf jedem Gerät abrufbar.';
      el('konto-formular').style.display = 'none';
      el('abmelden').style.display = '';
    } else {
      status.innerHTML = 'Nicht angemeldet — Prüfungen bleiben nur auf DIESEM Gerät. Mit E-Mail und Passwort anmelden, dann sind sie überall abrufbar.';
      el('konto-formular').style.display = '';
      el('abmelden').style.display = 'none';
    }
    V.laden().then(function (d) {
      if (!d.zeilen.length) {
        el('verlauf-liste').innerHTML = '<div class="leise">Noch keine gespeicherten Prüfungen' + (d.wo === 'lokal' ? ' auf diesem Gerät' : '') + '.</div>';
        return;
      }
      el('verlauf-liste').innerHTML = d.zeilen.map(function (z) {
        var klasse = z.urteil === 'ok' ? 'gruen' : (z.urteil === 'fehler' ? 'rot' : 'orange');
        var wann = z.erstellt ? new Date(z.erstellt) : null;
        var wannText = wann && !isNaN(wann) ? (('0' + wann.getDate()).slice(-2) + '.' + ('0' + (wann.getMonth() + 1)).slice(-2) + '. ' + ('0' + wann.getHours()).slice(-2) + ':' + ('0' + wann.getMinutes()).slice(-2)) : '';
        return '<div class="verlaufzeile" data-id="' + txt(z.id) + '">' +
          '<span class="punkt ' + klasse + '"></span>' +
          '<span class="verlauftitel">' + txt(z.titel || 'ohne Titel') + '</span>' +
          (typeof z.rendite === 'number' ? '<span class="mono leise">' + (z.rendite >= 0 ? '+' : '') + txt(f(z.rendite, 2)) + ' %</span>' : '') +
          '<span class="leise klein">' + txt(wannText) + '</span>' +
          '<button type="button" class="knopf klein verlauf-laden" data-id="' + txt(z.id) + '">öffnen</button>' +
          '<button type="button" class="knopf klein rotrand verlauf-weg" data-id="' + txt(z.id) + '">löschen</button>' +
          '</div>';
      }).join('');
      el('verlauf-liste').dataset.wo = d.wo;
      zustand.verlaufZeilen = d.zeilen;
    }).catch(function (fehler) {
      el('verlauf-liste').innerHTML = '<div class="warnung orange">Verlauf nicht ladbar: ' + txt(fehler.message) + '</div>';
    });
  }

  /* ---------- Ablauf ---------- */
  function pruefen() {
    var text = el('eingabe').value;
    if (!text.trim()) { el('eingabe-hinweis').textContent = 'Erst den kopierten Bericht einfügen.'; return; }
    var b = P.parser.parse(text);
    if (!b.erkannt) {
      el('eingabe-hinweis').textContent = 'Das sieht nicht nach einem Orion-Prüfbericht aus (Kopf oder „SEITE 1" fehlen). Geprüft wird trotzdem, was erkennbar ist.';
    } else if (b.fehlend.length) {
      el('eingabe-hinweis').textContent = 'Erkannt, aber ohne: ' + b.fehlend.join(', ') + '.';
    } else {
      el('eingabe-hinweis').textContent = 'Bericht erkannt und vollständig zerlegt.';
    }
    var erg = P.pruefer.pruefen(b);
    zustand.bericht = b; zustand.ergebnis = erg;

    el('ergebnis').style.display = '';
    urteilZeichnen(erg, b);
    aufteilungZeichnen(b);
    rechenwegZeichnen(erg);
    linksZeichnen(erg);
    warnungenZeichnen(erg);
    el('aktualitaet-ergebnis').innerHTML = '<div class="leise">Noch nicht abgerufen. Der Abruf passiert nur auf Klick, einmalig.</div>';

    P.verlauf.speichern(b, erg).then(function (wo) {
      el('speicher-hinweis').textContent = wo.wo === 'konto' ? 'Im Konto gespeichert.'
        : wo.wo === 'lokal' ? 'Auf diesem Gerät gespeichert (ohne Anmeldung nur hier sichtbar).'
        : 'Speichern ging nicht (Browser-Speicher gesperrt).';
      verlaufZeichnen();
    }).catch(function (fehler) {
      el('speicher-hinweis').textContent = 'Speichern fehlgeschlagen: ' + fehler.message;
    });
  }

  function verdrahten() {
    el('pruefen').addEventListener('click', pruefen);
    el('leeren').addEventListener('click', function () {
      el('eingabe').value = ''; el('eingabe-hinweis').textContent = ''; el('ergebnis').style.display = 'none';
    });
    el('eingabe').addEventListener('paste', function () {
      /* Nach dem Einfügen direkt prüfen — ein Handgriff statt zwei. */
      setTimeout(pruefen, 60);
    });

    el('aktualitaet-knopf').addEventListener('click', function () {
      if (!zustand.bericht) return;
      var kn = el('aktualitaet-knopf');
      kn.textContent = 'frage die Anbieter …';
      P.aktualitaet.pruefeBericht(zustand.bericht).then(function (a) {
        kn.textContent = 'Jetzt beim Anbieter nachsehen';
        aktualitaetZeichnen(a, zustand.bericht);
      }).catch(function (fehler) {
        kn.textContent = 'Jetzt beim Anbieter nachsehen';
        el('aktualitaet-ergebnis').innerHTML = '<div class="warnung orange">Abruf fehlgeschlagen: ' + txt(fehler.message) + '</div>';
      });
    });

    el('anmelden').addEventListener('click', function () {
      var mail = el('konto-mail').value.trim(), pw = el('konto-passwort').value;
      if (!mail || !pw) { el('konto-hinweis').textContent = 'E-Mail und Passwort eintragen.'; return; }
      el('konto-hinweis').textContent = 'melde an …';
      P.verlauf.anmelden(mail, pw).then(function (r) {
        el('konto-hinweis').textContent = r.ok ? '' : r.grund;
        verlaufZeichnen();
      });
    });
    el('konto-anlegen').addEventListener('click', function () {
      var mail = el('konto-mail').value.trim(), pw = el('konto-passwort').value;
      if (!mail || !pw) { el('konto-hinweis').textContent = 'E-Mail und Passwort eintragen.'; return; }
      if (pw.length < 8) { el('konto-hinweis').textContent = 'Passwort: mindestens 8 Zeichen.'; return; }
      el('konto-hinweis').textContent = 'lege Konto an …';
      P.verlauf.kontoAnlegen(mail, pw).then(function (r) {
        el('konto-hinweis').textContent = r.ok ? (r.hinweis || '') : r.grund;
        verlaufZeichnen();
      });
    });
    el('abmelden').addEventListener('click', function () {
      P.verlauf.abmelden(); el('konto-hinweis').textContent = ''; verlaufZeichnen();
    });

    /* Verlauf: EIN Zuhörer am Dokument (die Liste wird neu gezeichnet;
     * Einzel-Zuhörer wären nach dem nächsten Zeichnen weg — Panel-Lehre). */
    document.addEventListener('click', function (ev) {
      var laden = ev.target.closest ? ev.target.closest('.verlauf-laden') : null;
      if (laden) {
        var id = laden.getAttribute('data-id');
        var zeile = (zustand.verlaufZeilen || []).filter(function (z) { return String(z.id) === String(id); })[0];
        if (zeile && zeile.bericht) {
          el('eingabe').value = zeile.bericht;
          pruefen();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      var weg = ev.target.closest ? ev.target.closest('.verlauf-weg') : null;
      if (weg) {
        /* Zweistufig statt disabled: erster Klick fragt, zweiter löscht. */
        if (weg.dataset.sicher !== 'ja') {
          weg.dataset.sicher = 'ja'; weg.textContent = 'wirklich löschen?';
          setTimeout(function () { weg.dataset.sicher = ''; weg.textContent = 'löschen'; }, 2500);
          return;
        }
        P.verlauf.loeschen(weg.getAttribute('data-id')).then(verlaufZeichnen);
      }
    });

    verlaufZeichnen();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
})(typeof globalThis !== 'undefined' ? globalThis : this);
