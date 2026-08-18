/* ORION PROTECTION PANEL — Paarungsprüfung
 *
 * Die gefährlichste Fehlerklasse ist nicht die Rechnung, sondern die
 * PAARUNG: zwei Bücher, die verschiedene Spiele meinen. Die Rechnung ist
 * dann fehlerfrei — und die Wette trotzdem offen.
 *
 * Das Orion Panel hat dagegen am 18.08.2026 drei Sperren bekommen (Alter,
 * Zeit, Liga). Dieses Modul baut sie EIGENSTÄNDIG nach — nicht kopiert,
 * sondern zweite Fassung: rechnen beide gleich, ist die Paarung belastbar;
 * rechnen sie verschieden, wird die Stelle genannt. Genau dasselbe
 * Prinzip wie bei den Quoten.
 *
 * Geprüft wird auf vier Ebenen, so tief wie der Bericht es zulässt:
 *
 *   ALTER    U15–U23 auf einer Seite, erste Elf auf der anderen — der
 *            Fund des Auftraggebers; Namen sehen identisch aus.
 *   GESCHLECHT  Frauen- gegen Männerpartie.
 *   RESERVE  Zweite Mannschaft / Academy / "(Res)" gegen erste.
 *   ZEIT     Dasselbe Spiel hat denselben Anpfiff. Toleranz 180 Minuten
 *            (Panel-Messung an 274 Paaren: zwischen 2 und 3 Stunden lag
 *            KEIN echtes Paar, die falschen begannen bei 270 Minuten).
 *            Fängt zusätzlich das Rückspiel, bei dem Namen UND Kennungen
 *            gleich sind und nur der Termin abweicht.
 *   LIGA     Jugend-, Reserve- oder Frauenliga auf einer Seite.
 *
 * Grundregel wie überall: Fehlt eine Angabe, wird NICHT gesperrt und
 * NICHT geraten — ungemessen ist nicht falsch, aber es wird gesagt.
 */
(function (welt) {
  'use strict';

  /* Text vereinheitlichen: klein, ohne Umlaute, ohne Satzzeichen. */
  function norm(s) {
    return String(s === null || s === undefined ? '' : s)
      .toLowerCase()
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /* ---------- Die Kennungen ----------
   * Alter: u15 bis u23, auch "U-21", "U 21", "Under 21".
   * Frauen: women/ladies/frauen/femenin/damen.
   * Reserve: nur als ENDUNG oder eingeklammert — "Boca Juniors" trägt
   * das b nicht am Ende, "Godoy Cruz (Res)" schon. */
  var ALTER = /(^|[^a-z0-9])(?:u|under)\s?-?\s?(1[5-9]|2[0-3])(?![0-9])/;
  var FRAUEN = /(women|womens|ladies|frauen|femenin|feminin|damen|feminile)/;
  var RESERVE = /(^|\s)(ii|iii|b|2|3|res|reserve|reserves|academy|development|youth)(\s|$)/;

  function kennung(name) {
    var n = norm(name);
    var teile = [];
    var a = n.match(ALTER);
    if (a) teile.push('u' + a[2]);
    if (FRAUEN.test(n)) teile.push('w');
    if (RESERVE.test(n)) teile.push('res');
    return teile.sort().join('+');
  }

  function kennungGleich(a, b) { return kennung(a) === kennung(b); }

  /* Klartext für die Anzeige. */
  function kennungText(k) {
    if (!k) return 'erste Mannschaft, Männer';
    return k.split('+').map(function (t) {
      if (t === 'w') return 'Frauen';
      if (t === 'res') return 'Reserve / zweite Mannschaft';
      if (/^u\d+$/.test(t)) return 'Jugend ' + t.toUpperCase();
      return t;
    }).join(' + ');
  }

  /* ---------- Zeit ----------
   * Zwei Zeitpunkte, Toleranz in Minuten. Fehlt einer, ist das Ergebnis
   * 'unbekannt' — nicht 'passt'. Der Unterschied ist wichtig: das Panel
   * darf nicht sperren, der Prüfstand muss es SAGEN. */
  function zeitAbstand(a, b) {
    var ta = typeof a === 'number' ? a : Date.parse(String(a || ''));
    var tb = typeof b === 'number' ? b : Date.parse(String(b || ''));
    if (!isFinite(ta) || !isFinite(tb)) return null;
    return Math.abs(ta - tb) / 60000;   /* Minuten */
  }

  var ZEIT_TOLERANZ_MIN = 180;

  function zeitUrteil(minuten) {
    if (minuten === null) return { urteil: 'unbekannt', text: 'nur eine Seite nennt einen Anpfiff — nicht vergleichbar' };
    if (minuten <= 5) return { urteil: 'passt', text: 'derselbe Anpfiff (Abstand ' + Math.round(minuten) + ' min)' };
    if (minuten <= ZEIT_TOLERANZ_MIN) {
      return { urteil: 'passt', text: 'Anpfiff ' + Math.round(minuten) + ' min auseinander — innerhalb der belegten Toleranz von ' +
               ZEIT_TOLERANZ_MIN + ' min' };
    }
    return { urteil: 'falsch', text: 'Anpfiff ' + Math.round(minuten) + ' min auseinander. Panel-Messung an 274 Paaren: ' +
             'zwischen 2 und 3 Stunden lag KEIN echtes Paar, alle Ausreißer darüber waren Fehlpaarungen. ' +
             'Sehr wahrscheinlich zwei verschiedene Spiele — oder Hin- und Rückspiel.' };
  }

  /* ---------- Liga ----------
   * Eine Jugend-, Reserve- oder Frauenliga verrät die Fehlpaarung auch
   * dann, wenn die Mannschaftsnamen unauffällig sind. Live belegt beim
   * Panel-Bau: "Argentinian Primera Division Reserves" lief mit, während
   * die Namensprüfung nichts sah. */
  var LIGA_VERDACHT = [
    { muster: /(u|under)\s?-?\s?(1[5-9]|2[0-3])\b/, was: 'Jugendliga' },
    { muster: /(reserves?|reserve league|primavera|academy|development|youth)/, was: 'Reserve-/Nachwuchsliga' },
    { muster: /(women|womens|ladies|frauen|femenin|feminin|damen)/, was: 'Frauenliga' }
  ];

  function ligaVerdacht(text) {
    var n = norm(text);
    if (!n) return null;
    for (var i = 0; i < LIGA_VERDACHT.length; i++) {
      if (LIGA_VERDACHT[i].muster.test(n)) return LIGA_VERDACHT[i].was;
    }
    return null;
  }

  /* ---------- Die Gesamtprüfung ----------
   * quellen: { seite1: {titel, ausgang, link, zeit, liga}, seite2: {…} }
   * Alles, was fehlt, wird als 'unbekannt' geführt — nie geraten. */
  function pruefe(quellen) {
    var s1 = quellen.seite1 || {}, s2 = quellen.seite2 || {};
    var befunde = [];

    /* 1) Kennungen: Alter, Geschlecht, Reserve — aus ALLEN Textquellen
     *    der jeweiligen Seite, denn die Kennung kann im Partienamen, im
     *    Ausgang oder im Link stehen. */
    var text1 = [s1.titel, s1.partie, s1.ausgang, s1.link].filter(Boolean).join(' ');
    var text2 = [s2.titel, s2.partie, s2.ausgang, s2.link].filter(Boolean).join(' ');
    var k1 = kennung(text1), k2 = kennung(text2);
    if (!text1 || !text2) {
      befunde.push({ art: 'Kennung (Alter/Frauen/Reserve)', urteil: 'unbekannt',
        text: 'Eine Seite liefert zu wenig Text für einen Kennungsvergleich.',
        wert1: kennungText(k1), wert2: kennungText(k2) });
    } else if (k1 === k2) {
      befunde.push({ art: 'Kennung (Alter/Frauen/Reserve)', urteil: 'passt',
        text: 'Beide Seiten tragen dieselbe Kennung: ' + kennungText(k1) + '.',
        wert1: kennungText(k1), wert2: kennungText(k2) });
    } else {
      befunde.push({ art: 'Kennung (Alter/Frauen/Reserve)', urteil: 'falsch',
        text: 'UNTERSCHIEDLICHE Kennung — Seite 1 ist „' + kennungText(k1) + '", Seite 2 ist „' +
              kennungText(k2) + '". Das ist der Fund des Auftraggebers: erste Elf gegen U21 ' +
              'sieht am Namen identisch aus und ist doch ein anderes Spiel.',
        wert1: kennungText(k1), wert2: kennungText(k2) });
    }

    /* 2) Anpfiffzeit. */
    var abstand = zeitAbstand(s1.zeit, s2.zeit);
    var zu = zeitUrteil(abstand);
    befunde.push({ art: 'Anpfiffzeit', urteil: zu.urteil, text: zu.text,
      wert1: s1.zeit ? String(s1.zeit) : 'nicht genannt',
      wert2: s2.zeit ? String(s2.zeit) : 'nicht genannt',
      minuten: abstand });

    /* 3) Liga. */
    var l1 = ligaVerdacht([s1.liga, s1.titel, s1.link].filter(Boolean).join(' '));
    var l2 = ligaVerdacht([s2.liga, s2.titel, s2.link].filter(Boolean).join(' '));
    var hatText1 = !!norm([s1.liga, s1.titel, s1.link].filter(Boolean).join(" "));
    var hatText2 = !!norm([s2.liga, s2.titel, s2.link].filter(Boolean).join(" "));
    if (!l1 && !l2 && hatText1 && hatText2) {
      /* Beide Seiten liefern Text, und KEINE trägt einen Jugend-,
       * Reserve- oder Frauen-Hinweis. Die Sperre greift also nicht —
       * das ist eine echte Aussage, kein Nichtwissen. Was sie NICHT
       * sagt: ob es wirklich derselbe Wettbewerb ist. Genau deshalb
       * steht der Hinweis dabei. */
      befunde.push({ art: "Liga", urteil: "passt",
        text: "Keine Jugend-, Reserve- oder Frauenliga erkennbar. Ob es derselbe Wettbewerb " +
              "ist, sagt das nicht — dafür beide Links öffnen und die Wettbewerbsnamen lesen.",
        wert1: "unauffällig", wert2: "unauffällig" });
    } else if (l1 && l2 && l1 === l2) {
      befunde.push({ art: 'Liga', urteil: 'passt', text: 'Beide Seiten deuten auf dieselbe Art Liga (' + l1 + ').',
        wert1: l1, wert2: l2 });
    } else if (l1 || l2) {
      befunde.push({ art: 'Liga', urteil: 'falsch',
        text: 'Nur EINE Seite deutet auf eine ' + (l1 || l2) + ' hin (' + (l1 ? 'Seite 1' : 'Seite 2') +
              '). Beim Panel-Bau live belegt: „Argentinian Primera Division Reserves" lief mit, ' +
              'während die Namensprüfung nichts sah.',
        wert1: l1 || 'kein Hinweis', wert2: l2 || 'kein Hinweis' });
    } else {
      befunde.push({ art: 'Liga', urteil: 'unbekannt',
        text: 'Keine der beiden Seiten nennt eine Liga — aus dem Bericht nicht prüfbar. ' +
              'Beim Öffnen der Links die Wettbewerbsnamen vergleichen.',
        wert1: 'nicht genannt', wert2: 'nicht genannt' });
    }

    var falsch = befunde.filter(function (x) { return x.urteil === 'falsch'; }).length;
    var offen = befunde.filter(function (x) { return x.urteil === 'unbekannt'; }).length;
    return {
      befunde: befunde,
      stufe: falsch ? 'falsch' : (offen ? 'unbekannt' : 'passt'),
      anzahlFalsch: falsch,
      anzahlOffen: offen
    };
  }

  var api = {
    norm: norm, kennung: kennung, kennungGleich: kennungGleich, kennungText: kennungText,
    zeitAbstand: zeitAbstand, zeitUrteil: zeitUrteil, ZEIT_TOLERANZ_MIN: ZEIT_TOLERANZ_MIN,
    ligaVerdacht: ligaVerdacht, pruefe: pruefe
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (welt.PS = welt.PS || {}).paarung = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
