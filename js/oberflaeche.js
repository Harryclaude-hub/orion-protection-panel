/* ORION PROTECTION PANEL — Oberfläche
 *
 * Zeichnet Eingabe, Aufteilung, Rechenweg, Links, Warnzeichen, den
 * Einsatzrechner, die Aktualität und den Verlauf. Rechnet selbst NICHTS —
 * alle Zahlen kommen aus pruefer.js / einsatz.js / aktualitaet.js.
 * Alles Eingefügte wird vor dem Zeichnen entschärft.
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

  /* Die Paarungsprüfung als eigener Schritt — damit sie NIE von der
   * Zeichenreihenfolge abhängt. (Genau daran ist es am 18.08. beim
   * ersten Einbau gescheitert: die Übersicht wurde vor der Paarung
   * gezeichnet und meldete orange, obwohl U21 gegen erste Elf lief.) */
  function paarungRechnen() {
    var b = zustand.bericht;
    if (!b) return null;
    var akt = zustand.aktualitaet;
    var a1 = akt && akt.seiten ? akt.seiten[0] : null;
    var a2 = akt && akt.seiten ? akt.seiten[1] : null;
    var s1 = b.seiten[0] || {}, s2 = b.seiten[1] || {};
    zustand.paarung = P.paarung.pruefe({
      seite1: {
        titel: [b.titel, a1 && a1.frage, a1 && a1.ereignis].filter(Boolean).join(" "),
        partie: b.titel, ausgang: s1.ausgang, link: s1.link,
        zeit: (a1 && a1.anpfiff) || null,
        liga: [a1 && a1.serie, b.bereich, b.tag].filter(Boolean).join(" ")
      },
      seite2: {
        titel: [b.partie2, a2 && a2.frage, a2 && a2.ereignis].filter(Boolean).join(" "),
        partie: b.partie2, ausgang: s2.ausgang, link: s2.link,
        zeit: (a2 && a2.anpfiff) || (b.zeiten && b.zeiten.anpfiff) || null,
        liga: [a2 && a2.serie].filter(Boolean).join(" ")
      }
    });
    return zustand.paarung;
  }

  /* ---------- ABGLEICH: Bericht gegen Anbieter (Karam 19.08.) ----
   * Bis hierher kamen alle Eingangswerte aus dem Bericht. Wer die
   * Gebuehr glaubt, die er pruefen soll, prueft nichts. Ab jetzt
   * werden Kurs, Gebuehrensatz und Menge beim Anbieter selbst geholt
   * und gegen den Bericht gestellt. */
  function abgleichZeichnen() {
    var b = zustand.bericht, akt = zustand.aktualitaet;
    if (!b) return;
    if (!akt) {
      el("abgleich").innerHTML = "";
      zustand.abgleich = null;
      return;
    }
    var ab = P.abgleich.pruefe(b, akt);
    zustand.abgleich = ab;

    var kopf = ab.stufe === "deckt sich"
      ? { klasse: "gruen", text: "Alle vom Anbieter abfragbaren Angaben decken sich mit dem Bericht." }
      : (ab.stufe === "weicht ab"
        ? { klasse: "rot", text: ab.anzahlAbweichungen + " Angabe(n) im Bericht stimmen NICHT mit dem Anbieter ueberein." +
            (ab.gebuehrFalsch ? " Darunter der Gebuehrensatz, der in jede Zeile der Rechnung eingeht." : "") }
        : { klasse: "orange", text: "Teilweise abgeglichen. Was der Anbieter nicht hergibt, bleibt ungeprueft." });

    var zeilen = ab.befunde.map(function (x) {
      var marke = x.urteil === "deckt sich" ? "ok" : (x.urteil === "weicht ab" ? "abweichung" : "unpruefbar");
      function wert(v) { return (v === null || v === undefined) ? "&mdash;" : txt(String(v)); }
      return "<tr class=\"pz-" + (x.urteil === "weicht ab" ? "falsch" : "") + "\">" +
        "<td class=\"hkwas\">Seite " + txt(x.nr) + " " + txt(x.buch) + "</td>" +
        "<td class=\"hkwas\">" + txt(x.art) + "</td>" +
        "<td class=\"mono klein\">" + wert(x.bericht) + "</td>" +
        "<td class=\"mono klein\">" + wert(x.anbieter) + "</td>" +
        "<td><span class=\"marke " + marke + "\">" + txt(x.urteil) + "</span>" +
        "<div class=\"leise klein\">" + txt(x.text) + "</div></td></tr>";
    }).join("");

    el("abgleich").innerHTML =
      "<div class=\"karte\"><div class=\"kartentitel\">Bericht gegen Anbieter, Wert fuer Wert</div>" +
      "<div class=\"warnung " + kopf.klasse + "\">" + txt(kopf.text) + "</div>" +
      "<div class=\"tabellenrahmen\"><table class=\"hktabelle\">" +
      "<thead><tr><th>Seite</th><th>Angabe</th><th>im Bericht</th><th>beim Anbieter</th><th>Urteil</th></tr></thead>" +
      "<tbody>" + zeilen + "</tbody></table></div></div>";
  }

  /* ---------- HERKUNFT + PAARUNG (Karams Vorgabe 18.08.) ----------
   * Über der Übersicht: jede Angabe mit ihrer Quelle, plus der tiefe
   * Vergleich beider Seiten (Alter, Zeit, Liga) — dieselben drei
   * Sperren, die das Panel am 18.08. bekommen hat, hier als eigene
   * zweite Fassung nachgebaut. */
  function herkunftZeichnen() {
    var b = zustand.bericht, erg = zustand.ergebnis;
    if (!b || !erg) return;
    var akt = zustand.aktualitaet;
    var paar = paarungRechnen();

    el("herkunft").innerHTML = P.herkunft.baue({
      bericht: b, ergebnis: erg, aktualitaet: akt, paarung: paar
    });
  }

  /* ---------- DIE ÜBERSICHT (Karams Vorgabe 18.08.) ----------
   * Ganz oben: die vier Fragen vor dem Setzen und der Geldfluss in
   * echtem Geld. Gerechnet wird in bewertung.js/einsatz.js, gezeichnet
   * in uebersicht.js — hier werden die Teile nur zusammengeführt. */
  function uebersichtZeichnen() {
    var b = zustand.bericht, erg = zustand.ergebnis;
    if (!b || !erg) return;
    var B = P.bewertung, E = P.einsatz;

    var betrag = Number(el('einsatz-betrag').value);
    if (!isFinite(betrag) || betrag <= 0) betrag = 100;
    var schritt = Number(el('einsatz-schritt').value) || 0.01;
    var maxE = (b.rechnung && isFinite(b.rechnung.maxEinsatz)) ? b.rechnung.maxEinsatz : null;

    /* Mit welchen Zahlen rechnen wir hier? Mit den echten, sobald der
     * Anbieter welche liefert. Sonst mit denen des Berichts. Was davon
     * gilt, steht sichtbar in der Uebersicht. */
    var qe1 = erg.qe1, qe2 = erg.qe2, frisch = { kurs: 0, gebuehr: 0 };
    var echt = zustand.aktualitaet ? P.abgleich.echteWerte(b, zustand.aktualitaet) : null;
    if (echt && echt.length >= 2) {
      var e1 = P.rechnung.qeSeite(echt[0].art, echt[0].seiteText, echt[0].wert, echt[0].gebuehr);
      var e2 = P.rechnung.qeSeite(echt[1].art, echt[1].seiteText, echt[1].wert, echt[1].gebuehr);
      if (isFinite(e1.qe) && isFinite(e2.qe)) { qe1 = e1.qe; qe2 = e2.qe; }
      [0, 1].forEach(function (i) {
        if (echt[i].wertFrisch) frisch.kurs++;
        if (echt[i].gebuehrFrisch) frisch.gebuehr++;
      });
      /* Der Hoechsteinsatz ebenfalls aus dem Orderbuch, wenn messbar:
       * es zaehlt die duennere der beiden Seiten. */
      var mengen = echt.filter(function (x) { return x.mengeFrisch; })
        .map(function (x) { return x.menge; });
      if (mengen.length) maxE = Math.min.apply(null, mengen.concat(isFinite(maxE) ? [maxE] : []));
    }
    zustand.gerechnetMit = frisch;

    var plan = (isFinite(qe1) && isFinite(qe2))
      ? E.rechne({ qe1: qe1, qe2: qe2, gesamt: betrag, schritt: schritt, maxEinsatz: maxE })
      : null;
    var fluss = plan ? B.geldfluss({
      seite1: (echt && echt[0]) || b.seiten[0],
      seite2: (echt && echt[1]) || b.seiten[1],
      qe1: qe1, qe2: qe2, s1: plan.s1, s2: plan.s2
    }) : null;

    var warn = erg.warnungen.filter(function (w) { return w.stufe === 'warnung'; }).length;
    var harte = erg.warnungen.filter(function (w) { return w.stufe === 'fehler'; }).length;
    /* Eine nachgewiesene Fehlpaarung wiegt wie ein Rechenfehler —
     * die Rechnung mag stimmen, die Absicherung besteht trotzdem nicht. */
    var paar = paarungRechnen();
    var paarungFalsch = paar && paar.stufe === "falsch";
    /* Ein falscher Gebuehrensatz im Bericht wiegt schwer: er geht in
     * jede Zeile ein und macht die ganze Rendite unglaubwuerdig. */
    var abw = zustand.abgleich;
    if (abw && abw.gebuehrFalsch) harte = harte + 1;
    var a = B.ampel({
      rechnungStufe: erg.urteil.stufe,
      paarungStufe: paar ? paar.stufe : null,
      harteBefunde: harte,
      warnungen: warn,
      rendite: fluss ? fluss.garantierteRendite : null
    });
    zustand.ampel = a;

    el('uebersicht').innerHTML = P.uebersicht.baue({
      bericht: b, ergebnis: erg, plan: plan, fluss: fluss, ampel: a,
      aktualitaet: zustand.aktualitaet,
      gerechnetMit: frisch,
      abgleich: zustand.abgleich,
      einheit: (b.rechnung && b.rechnung.sEinheit) || ''
    });
  }

  /* Der Abruf beim Anbieter läuft ab jetzt AUTOMATISCH mit (Karams
   * Vorgabe: „Du prüfst die Links aktuell"). Einmalig je Prüfung, nie
   * im Takt. Kommt das Ergebnis, wird die Übersicht nachgezogen. */
  function aktualitaetHolen() {
    var b = zustand.bericht;
    if (!b) return;
    zustand.aktualitaet = null;
    el('aktualitaet-ergebnis').innerHTML = '<div class="leise">Frage die Anbieter ab, Chef …</div>';
    P.aktualitaet.pruefeBericht(b).then(function (akt) {
      if (zustand.bericht !== b) return;   /* zwischenzeitlich neuer Bericht */
      zustand.aktualitaet = akt;
      aktualitaetZeichnen(akt, b);
      abgleichZeichnen();
      uebersichtZeichnen();
      herkunftZeichnen();
    }).catch(function (fehler) {
      el('aktualitaet-ergebnis').innerHTML = '<div class="warnung orange">Abruf fehlgeschlagen: ' + txt(fehler.message) + '</div>';
    });
  }

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

  /* Ein Schritt = EIN RECHENBLATT (Karams Vorgabe 17.08. spät):
   * heller Papierblock mit Zeilen, dunkle Schrift, Formel groß obenauf,
   * darunter die Rechnung Zeile für Zeile, darunter die Bewertung als
   * schmale Zahlenzeile. Der Erklärtext liegt eingeklappt darunter, damit
   * das Blatt nicht zur Textwand wird — aufklappen, wer es wissen will. */
  function schrittHtml(s) {
    var u = s.urteil || 'unpruefbar';
    var zeilen = (s.zeilen || []).map(function (z) {
      var eingerueckt = /^\s/.test(z);
      return '<div class="blattzeile' + (eingerueckt ? ' eingerueckt' : ' abschnitt') + '">' + txt(z.trim()) + '</div>';
    }).join('');

    /* Die Bewertung: immer MIT den Zahlen, die sie tragen. */
    var bewertung = '';
    if (s.ist !== undefined && s.ist !== null && isFinite(s.ist)) {
      var einheit = s.einheit ? ' ' + s.einheit : '';
      var felder =
        '<span class="bwfeld"><span class="bwname">eigene Rechnung</span>' +
          '<b class="mono">' + txt(f(s.ist, s.stellen)) + txt(einheit) + '</b></span>';
      if (s.soll !== undefined && s.soll !== null && isFinite(s.soll)) {
        felder +=
          '<span class="bwfeld"><span class="bwname">laut Panel</span>' +
            '<b class="mono">' + txt(f(s.soll, s.stellen)) + txt(einheit) + '</b></span>' +
          '<span class="bwfeld"><span class="bwname">Unterschied</span>' +
            '<b class="mono">' + txt(f(Math.abs(s.delta), Math.max(s.stellen, 4))) + '</b></span>' +
          '<span class="bwfeld"><span class="bwname">erlaubte Rundung</span>' +
            '<b class="mono">' + txt(f(s.toleranz, Math.max(s.stellen, 4))) + '</b></span>';
      }
      bewertung = '<div class="bewertung ' + u + '">' + felder +
        '<span class="bwurteil ' + u + '">' + txt(URTEIL_TEXT[u] || u) + '</span></div>';
    } else {
      bewertung = '<div class="bewertung ' + u + '">' +
        '<span class="bwfeld"><span class="bwname">Ergebnis</span><b>nicht nachrechenbar</b></span>' +
        '<span class="bwurteil ' + u + '">' + txt(URTEIL_TEXT[u] || u) + '</span></div>';
    }

    var erklaerung = '';
    if (s.warum || s.taschenrechner || s.toleranzGrund) {
      erklaerung = '<details class="erklaerung"><summary>Was bedeutet dieser Schritt?</summary>' +
        (s.warum ? '<p>' + txt(s.warum) + '</p>' : '') +
        (s.taschenrechner ? '<p class="rechnertipp"><b>Selbst nachtippen:</b> ' + txt(s.taschenrechner) + '</p>' : '') +
        (s.toleranzGrund ? '<p class="leise klein">Erlaubte Rundung, weil ' + txt(s.toleranzGrund) + '.</p>' : '') +
        '</details>';
    }

    return '<div class="schritt ' + u + '">' +
      '<div class="schrittkopf"><b>' + txt(s.titel) + '</b></div>' +
      '<div class="blatt">' +
        (s.formel ? '<div class="blattformel">' + txt(s.formel) + '</div>' : '') +
        (zeilen || '<div class="blattzeile abschnitt">' + txt(s.kommentar || 'Keine Rechnung möglich.') + '</div>') +
      '</div>' +
      bewertung +
      (s.kommentar && zeilen ? '<div class="kommentar">' + txt(s.kommentar) + '</div>' : '') +
      erklaerung +
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
      el('warnungen').innerHTML = '<div class="leise">Keine Warnzeichen, Chef — das Feld ist ruhig.</div>';
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

  /* ---------- Einsatzrechner ----------
   * Aus „2,53 % auf dem Papier" wird hier: wie viel lege ich wirklich auf
   * welche Seite, was kommt bei welchem Ausgang zurück, und was bleibt
   * garantiert übrig, nachdem auf brauchbare Beträge gerundet wurde. */
  function einsatzZeichnen() {
    var b = zustand.bericht, e = zustand.ergebnis;
    if (!b || !e || !isFinite(e.qe1) || !isFinite(e.qe2)) {
      el('einsatz-ergebnis').innerHTML = '<div class="leise">Erst einen Bericht prüfen, Chef.</div>';
      return;
    }
    var E = P.einsatz;
    var betrag = Number(el('einsatz-betrag').value);
    if (!isFinite(betrag) || betrag <= 0) betrag = 100;
    var schritt = Number(el('einsatz-schritt').value) || 0.01;

    /* Der Höchsteinsatz des Berichts steht in der Währung des Berichts. */
    var maxE = (b.rechnung && isFinite(b.rechnung.maxEinsatz)) ? b.rechnung.maxEinsatz : null;
    var r = E.rechne({ qe1: e.qe1, qe2: e.qe2, gesamt: betrag, schritt: schritt, maxEinsatz: maxE });
    if (!r) { el('einsatz-ergebnis').innerHTML = '<div class="warnung orange">Ohne beide Effektivquoten kein Einsatzplan.</div>'; return; }

    var b1 = b.seiten[0] || {}, b2 = b.seiten[1] || {};
    var n1 = b1.buch || 'Seite 1', n2 = b2.buch || 'Seite 2';
    var eh = (b.rechnung && b.rechnung.sEinheit) ? ' ' + b.rechnung.sEinheit : '';
    var mg = E.marge(r.inv), pf = E.puffer(e.qe1, e.qe2);

    /* Das Rechenblatt: so kommt der Einsatzplan zustande. */
    var blatt = [
      'Schritt A — ideale Aufteilung (auf gleiche Auszahlung):',
      '  ' + n1 + ': ' + f(betrag, 2) + ' × (1 ÷ ' + f(e.qe1, 3) + ') ÷ ' + f(r.inv, 4) + ' = ' + f(r.ideal1, 2),
      '  ' + n2 + ': ' + f(betrag, 2) + ' − ' + f(r.ideal1, 2) + ' = ' + f(r.ideal2, 2),
      'Schritt B — gerundet auf ' + (schritt >= 1 ? f(schritt, 0) : f(schritt, 2)) + ':',
      '  ' + n1 + ': ' + f(r.ideal1, 2) + ' → ' + f(r.s1, 2) + '   ·   ' + n2 + ': ' + f(r.ideal2, 2) + ' → ' + f(r.s2, 2),
      '  wirklich eingesetzt: ' + f(r.s1, 2) + ' + ' + f(r.s2, 2) + ' = ' + f(r.eingesetzt, 2),
      'Schritt C — was bei welchem Ausgang zurückkommt:',
      '  Ausgang ' + n1 + ': ' + f(r.s1, 2) + ' × ' + f(e.qe1, 3) + ' = ' + f(r.auszahlung1, 2) + '   → Gewinn ' + f(r.gewinn1, 2),
      '  Ausgang ' + n2 + ': ' + f(r.s2, 2) + ' × ' + f(e.qe2, 3) + ' = ' + f(r.auszahlung2, 2) + '   → Gewinn ' + f(r.gewinn2, 2),
      'Schritt D — garantiert ist der SCHLECHTERE der beiden:',
      '  min(' + f(r.gewinn1, 2) + ' · ' + f(r.gewinn2, 2) + ') = ' + f(r.garantiert, 2) +
        '   das sind ' + f(r.renditeEffektiv, 2) + ' % vom eingesetzten Geld',
      '  ohne Rundung wären es ' + f(r.idealRendite, 2) + ' % — die Rundung kostet ' + f(r.rundungsverlust, 2) + ' Punkte'
    ];

    var zettel = '<div class="blatt">' +
      '<div class="blattformel">Einsatz ' + f(betrag, 2) + eh + ', gerundet auf ' + (schritt >= 1 ? f(schritt, 0) : f(schritt, 2)) + '</div>' +
      blatt.map(function (z) {
        var ein = /^\s/.test(z);
        return '<div class="blattzeile' + (ein ? ' eingerueckt' : ' abschnitt') + '">' + txt(z.trim()) + '</div>';
      }).join('') + '</div>';

    /* Der Befehl: was tatsächlich zu tun ist. */
    var befehl =
      '<div class="einsatzbefehl">' +
        '<div class="ebseite"><span class="chip ' + (BUCH_KLASSE[b1.buchNorm] || 'xx') + '">' + txt(n1) + '</span>' +
          '<b class="ebbetrag">' + txt(f(r.s1, 2)) + txt(eh) + '</b>' +
          '<span class="leise klein">' + txt(b1.seiteText || '') + ' · Effektivquote ' + txt(f(e.qe1, 3)) + '</span></div>' +
        '<div class="ebseite"><span class="chip ' + (BUCH_KLASSE[b2.buchNorm] || 'xx') + '">' + txt(n2) + '</span>' +
          '<b class="ebbetrag">' + txt(f(r.s2, 2)) + txt(eh) + '</b>' +
          '<span class="leise klein">' + txt(b2.seiteText || '') + ' · Effektivquote ' + txt(f(e.qe2, 3)) + '</span></div>' +
        '<div class="ebseite ' + (r.nochArbitrage ? 'gutfall' : 'schlechtfall') + '">' +
          '<span class="bwname">garantierter Gewinn</span>' +
          '<b class="ebbetrag">' + (r.garantiert >= 0 ? '+' : '') + txt(f(r.garantiert, 2)) + txt(eh) + '</b>' +
          '<span class="leise klein">' + txt(f(r.renditeEffektiv, 2)) + ' % · schlechtester Ausgang</span></div>' +
      '</div>';

    /* Kennzahlen, wie sie ein Scanner zeigt — hier alle selbst gerechnet. */
    var kennzahlen = '<div class="bewertung">' +
      '<span class="bwfeld"><span class="bwname">Marge des Marktes</span><b class="mono">' + txt(f(mg, 2)) + ' %</b></span>' +
      '<span class="bwfeld"><span class="bwname">Wahrscheinlichkeit ' + txt(n1) + '</span><b class="mono">' + txt(f(E.wahrscheinlichkeit(e.qe1), 1)) + ' %</b></span>' +
      '<span class="bwfeld"><span class="bwname">Wahrscheinlichkeit ' + txt(n2) + '</span><b class="mono">' + txt(f(E.wahrscheinlichkeit(e.qe2), 1)) + ' %</b></span>' +
      (pf ? '<span class="bwfeld"><span class="bwname">Kurspuffer Seite 1</span><b class="mono">' + txt(f(pf.spielraumProzent, 2)) + ' %</b></span>' : '') +
      '</div>';

    var hinweise = [];
    if (!r.nochArbitrage) {
      hinweise.push('<div class="warnung fehler">Nach der Rundung bleibt KEIN sicherer Gewinn mehr übrig ' +
        '(' + f(r.garantiert, 2) + '). Kleiner runden oder mehr einsetzen — oder die Finger davon lassen.</div>');
    }
    if (r.unterschiedDerAusgaenge > 0.005) {
      hinweise.push('<div class="warnung hinweis">Durch die Rundung zahlen die beiden Ausgänge unterschiedlich aus ' +
        '(' + f(r.gewinn1, 2) + ' gegen ' + f(r.gewinn2, 2) + '). Verlass dich auf den kleineren Wert — der andere ist Zufall.</div>');
    }
    if (r.ueberMax === true) {
      hinweise.push('<div class="warnung warnung">Der Einsatz ' + f(r.eingesetzt, 2) + ' liegt ÜBER dem, was die dünnere Seite ' +
        'laut Bericht aufnimmt (' + f(r.maxEinsatz, 2) + '). Darüber bekommst du nicht mehr diese Kurse.</div>');
    }
    if (r.maxEinsatz === null) {
      hinweise.push('<div class="warnung hinweis">Der Bericht nennt keinen Höchsteinsatz — ob die Bücher diesen Betrag ' +
        'aufnehmen, ist damit NICHT geprüft. Unbekannt heißt nicht unbegrenzt.</div>');
    }
    if (pf && pf.spielraumProzent < 1) {
      hinweise.push('<div class="warnung warnung">Der Kurspuffer ist mit ' + f(pf.spielraumProzent, 2) + ' % sehr dünn: ' +
        'schon eine kleine Kursbewegung auf Seite 1 kippt den Vorteil. Zuerst diese Seite setzen.</div>');
    }

    el('einsatz-ergebnis').innerHTML = befehl + zettel + kennzahlen + hinweise.join('') +
      '<details class="erklaerung"><summary>Was bedeutet dieser Abschnitt?</summary>' +
      '<p>Der Panel-Bericht rechnet immer mit 100 als Grundeinsatz und tut so, als könnte man ' +
      'Beträge wie 49,71 setzen. In Wirklichkeit rundet man — und ab da zahlen die beiden Ausgänge ' +
      'nicht mehr gleich aus. Deshalb steht hier der garantierte Gewinn: der schlechtere der beiden. ' +
      'Die Marge des Marktes ist, wie viel Prozent die Kehrwertsumme unter 100 liegt. Der Kurspuffer ' +
      'sagt, wie weit sich Seite 1 bewegen darf, bevor der Vorteil weg ist.</p></details>';
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
      status.innerHTML = 'Jawohl, Chef — angemeldet als <b>' + txt(V.eigeneMail() || '?') + '</b>. Prüfungen landen im Konto, auf jedem Gerät abrufbar.';
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
    if (!text.trim()) { el('eingabe-hinweis').textContent = 'Chef, erst den kopierten Bericht einfügen.'; return; }
    var b = P.parser.parse(text);
    if (!b.erkannt) {
      el('eingabe-hinweis').textContent = 'Chef, das sieht nicht nach einem Orion-Prüfbericht aus (Kopf oder „SEITE 1" fehlen). Geprüft wird trotzdem, was erkennbar ist.';
    } else if (b.fehlend.length) {
      el('eingabe-hinweis').textContent = 'Verstanden, Chef — erkannt, aber ohne: ' + b.fehlend.join(', ') + '.';
    } else {
      el('eingabe-hinweis').textContent = 'Jawohl, Chef — Bericht erkannt und vollständig zerlegt.';
    }
    var erg = P.pruefer.pruefen(b);
    zustand.bericht = b; zustand.ergebnis = erg;

    el('ergebnis').style.display = '';
    urteilZeichnen(erg, b);
    abgleichZeichnen();
    uebersichtZeichnen();
    herkunftZeichnen();
    aufteilungZeichnen(b);
    rechenwegZeichnen(erg);
    linksZeichnen(erg);
    warnungenZeichnen(erg);
    einsatzZeichnen();
    zustand.aktualitaet = null;
    aktualitaetHolen();

    P.verlauf.speichern(b, erg).then(function (wo) {
      el('speicher-hinweis').textContent = wo.wo === 'konto' ? 'Jawohl, Chef — im Konto abgelegt.'
        : wo.wo === 'lokal' ? 'Jawohl, Chef — auf diesem Gerät abgelegt (ohne Anmeldung nur hier sichtbar).'
        : 'Chef, Speichern ging nicht (Browser-Speicher gesperrt).';
      verlaufZeichnen();
    }).catch(function (fehler) {
      el('speicher-hinweis').textContent = 'Chef, Speichern fehlgeschlagen: ' + fehler.message;
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

    /* Einsatzrechner: rechnet sofort mit, während man tippt — reine
     * Arithmetik auf zwei Zahlen, das kostet nichts. */
    ['einsatz-betrag', 'einsatz-schritt'].forEach(function (id) {
      el(id).addEventListener('input', function () { if (zustand.bericht) { einsatzZeichnen(); uebersichtZeichnen(); } });
      el(id).addEventListener('change', function () { if (zustand.bericht) { einsatzZeichnen(); uebersichtZeichnen(); } });
    });

    el('aktualitaet-knopf').addEventListener('click', function () {
      if (!zustand.bericht) return;
      var kn = el('aktualitaet-knopf');
      kn.textContent = 'Frage die Anbieter ab, Chef …';
      aktualitaetHolen();
      setTimeout(function () { kn.textContent = 'Erneut beim Anbieter nachsehen'; }, 400);
    });

    el('anmelden').addEventListener('click', function () {
      var mail = el('konto-mail').value.trim(), pw = el('konto-passwort').value;
      if (!mail || !pw) { el('konto-hinweis').textContent = 'Chef, E-Mail und Passwort eintragen.'; return; }
      el('konto-hinweis').textContent = 'Melde an, Chef …';
      P.verlauf.anmelden(mail, pw).then(function (r) {
        el('konto-hinweis').textContent = r.ok ? '' : r.grund;
        verlaufZeichnen();
      });
    });
    el('konto-anlegen').addEventListener('click', function () {
      var mail = el('konto-mail').value.trim(), pw = el('konto-passwort').value;
      if (!mail || !pw) { el('konto-hinweis').textContent = 'Chef, E-Mail und Passwort eintragen.'; return; }
      if (pw.length < 8) { el('konto-hinweis').textContent = 'Chef, das Passwort braucht mindestens 8 Zeichen.'; return; }
      el('konto-hinweis').textContent = 'Lege Konto an, Chef …';
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

    if (P.werkstatt) P.werkstatt.verdrahten(function () { return zustand.bericht; });
    verlaufZeichnen();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
})(typeof globalThis !== 'undefined' ? globalThis : this);
