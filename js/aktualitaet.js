/* ORION PRÜFSTAND — Aktualität
 *
 * Schaut EINMALIG (auf Klick, nie im Takt) beim Anbieter nach, ob die
 * Zahlen des Berichts noch stimmen — und rechnet den Eintrag danach mit
 * den aktuellen Zahlen komplett neu.
 *
 * Ehrlichkeit vor Vollständigkeit (drei Zustände, nie zwei):
 *   Polymarket  prüfbar aus dem Browser (Gamma-Katalog + CLOB-Orderbuch;
 *               side=sell ist der ASK, also der Kaufpreis — side=buy wäre
 *               der Bid und erzeugte Schein-Arbitrage)
 *   Kalshi      Versuch über die öffentliche Schnittstelle; blockt der
 *               Browser (CORS), wird das GESAGT statt geraten
 *   Smarkets    wie Kalshi; zusätzlich ist der Marktlink nur die PARTIE,
 *               der Zielmarkt muss über den Namen gefunden werden
 *   Betfair     aus dem Browser NICHT prüfbar (Ländersperre/Cloudflare) —
 *               nur die Bridge am Heim-PC kann Betfair lesen. Der Prüfstand
 *               sagt das und verweist auf den Orbit-Link zum Selbstablesen.
 */
(function (welt) {
  'use strict';

  function holeJson(url, optionen) {
    return fetch(url, optionen || {}).then(function (antwort) {
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      return antwort.json();
    });
  }

  function liste(x) {
    if (Array.isArray(x)) return x;
    if (typeof x === 'string') { try { return JSON.parse(x); } catch (e) { return []; } }
    return [];
  }

  /* Welcher Ausgang ist gemeint? JA/NEIN bzw. ÜBER/UNTER auf die
   * outcomes-Liste abbilden; passt nichts, wird der Reihenfolge des
   * Scanners gefolgt (JA/ÜBER = 0, NEIN/UNTER = 1). */
  function ausgangIndex(seiteText, outcomes) {
    var s = String(seiteText || '').toLowerCase();
    var wunsch = null;
    if (s === 'ja') wunsch = 'yes';
    else if (s === 'nein') wunsch = 'no';
    else if (s === 'über' || s === 'ueber') wunsch = 'over';
    else if (s === 'unter') wunsch = 'under';
    if (wunsch) {
      for (var i = 0; i < outcomes.length; i++) {
        if (String(outcomes[i]).toLowerCase().indexOf(wunsch) === 0) return i;
      }
    }
    return (s === 'nein' || s === 'unter') ? 1 : 0;
  }

  /* ---------- Polymarket ---------- */
  function pruefePolymarket(seite) {
    var m = String(seite.link || '').match(/polymarket\.com\/event\/[^/]+\/([^/?#]+)/);
    if (!m) {
      return Promise.resolve({ status: 'unpruefbar', text: 'Kein Polymarket-Marktlink im Bericht.' });
    }
    var slug = m[1];
    return holeJson('https://gamma-api.polymarket.com/markets?slug=' + encodeURIComponent(slug))
      .then(function (maerkte) {
        if (!maerkte || !maerkte.length) {
          return { status: 'unpruefbar', text: 'Markt „' + slug + '" ist bei Polymarket nicht (mehr) auffindbar.' };
        }
        var markt = maerkte[0];
        if (markt.closed === true || markt.active === false) {
          return { status: 'vorbei', text: 'Der Markt ist bei Polymarket geschlossen — die Zahlen des Berichts sind Geschichte.' };
        }
        var tokens = liste(markt.clobTokenIds);
        var outcomes = liste(markt.outcomes);
        var idx = ausgangIndex(seite.seiteText, outcomes);
        if (!tokens[idx]) {
          return { status: 'unpruefbar', text: 'Der Markt nennt keine Orderbuch-Kennung für diesen Ausgang.' };
        }
        /* side=sell = ASK = Kaufpreis. NIE side=buy, nie outcomePrices. */
        return holeJson('https://clob.polymarket.com/price?token_id=' + tokens[idx] + '&side=sell')
          .then(function (p) {
            var preis = Number(p && p.price);
            if (!(preis > 0 && preis < 1)) {
              return { status: 'unpruefbar', text: 'Das Orderbuch nennt keinen gültigen Briefkurs.' };
            }
            return { status: 'ok', wert: preis, ausgangName: outcomes[idx] || null,
                     frage: markt.question || markt.title || null,
                     quelle: 'CLOB-Orderbuch, Briefkurs (side=sell)' };
          });
      })
      .catch(function (f) {
        return { status: 'unpruefbar', text: 'Polymarket antwortet nicht (' + f.message + ').' };
      });
  }

  /* ---------- Kalshi ---------- */
  function pruefeKalshi(seite) {
    var m = String(seite.link || '').match(/kalshi\.com\/(?:markets|events)\/[^?#]*?([A-Za-z0-9-]+)\/?(?:[?#]|$)/);
    if (!m) {
      return Promise.resolve({ status: 'unpruefbar', text: 'Kein Kalshi-Link mit erkennbarer Marktkennung.' });
    }
    var ticker = m[1].toUpperCase();
    return holeJson('https://api.elections.kalshi.com/trade-api/v2/markets/' + encodeURIComponent(ticker))
      .then(function (d) {
        var markt = d && d.market;
        if (!markt) return { status: 'unpruefbar', text: 'Kalshi kennt die Kennung „' + ticker + '" nicht.' };
        if (markt.status && markt.status !== 'active') {
          return { status: 'vorbei', text: 'Der Kalshi-Markt steht auf „' + markt.status + '".' };
        }
        var s = String(seite.seiteText || '').toLowerCase();
        var cents = (s === 'nein' || s === 'unter') ? markt.no_ask : markt.yes_ask;
        var preis = Number(cents) / 100;
        if (!(preis > 0 && preis < 1)) return { status: 'unpruefbar', text: 'Kalshi nennt keinen gültigen Briefkurs.' };
        return { status: 'ok', wert: preis, quelle: 'Kalshi trade-api, ' + (s === 'nein' ? 'no_ask' : 'yes_ask') };
      })
      .catch(function (f) {
        return { status: 'unpruefbar', text: 'Kalshi ist aus dem Browser nicht erreichbar (' + f.message + ') — im geöffneten Kalshi-Fenster ablesen.' };
      });
  }

  /* ---------- Smarkets ---------- */
  function pruefeSmarkets(seite) {
    var m = String(seite.link || '').match(/smarkets\.com\/event\/(\d+)/);
    if (!m) {
      return Promise.resolve({ status: 'unpruefbar', text: 'Kein Smarkets-Partienlink mit Ereignisnummer.' });
    }
    var eventId = m[1];
    return holeJson('https://api.smarkets.com/v3/events/' + eventId + '/markets/')
      .then(function (d) {
        var maerkte = (d && d.markets) || [];
        if (!maerkte.length) return { status: 'unpruefbar', text: 'Smarkets nennt keine Märkte zur Partie.' };
        return { status: 'teilweise',
                 text: 'Smarkets erreichbar: die Partie führt ' + maerkte.length + ' Märkte. Der Bericht verlinkt ' +
                   'nur die PARTIE — welcher Markt gemeint ist, steht auf der Panel-Karte. Kurs bitte dort ablesen; ' +
                   'eine automatische Zuordnung wäre geraten, und geraten wird hier nicht.' };
      })
      .catch(function (f) {
        return { status: 'unpruefbar', text: 'Smarkets ist aus dem Browser nicht erreichbar (' + f.message + ') — im geöffneten Smarkets-Fenster ablesen.' };
      });
  }

  function pruefeSeite(seite) {
    if (!seite) return Promise.resolve({ status: 'unpruefbar', text: 'Seite fehlt.' });
    if (seite.buchNorm === 'polymarket') return pruefePolymarket(seite);
    if (seite.buchNorm === 'kalshi') return pruefeKalshi(seite);
    if (seite.buchNorm === 'smarkets') return pruefeSmarkets(seite);
    if (seite.buchNorm === 'betfair') {
      return Promise.resolve({
        status: 'unpruefbar',
        text: 'Betfair ist aus dem Browser nicht lesbar (Ländersperre/Cloudflare) — das kann nur die Bridge ' +
          'am Heim-PC. Den Orbit-Link öffnen und die Quote von Hand vergleichen.'
      });
    }
    return Promise.resolve({ status: 'unpruefbar', text: 'Unbekanntes Buch „' + (seite.buch || '?') + '".' });
  }

  /* Beide Seiten prüfen und — wo es frische Zahlen gibt — den ganzen
   * Eintrag mit den AKTUELLEN Zahlen neu rechnen. */
  function pruefeBericht(bericht) {
    var R = welt.PS.rechnung;
    var s1 = bericht.seiten[0], s2 = bericht.seiten[1];
    return Promise.all([pruefeSeite(s1), pruefeSeite(s2)]).then(function (beide) {
      var aus = { seiten: beide, neu: null, zeitpunkt: new Date() };
      var w1 = beide[0].status === 'ok' ? beide[0].wert : (s1 ? s1.wert : null);
      var w2 = beide[1].status === 'ok' ? beide[1].wert : (s2 ? s2.wert : null);
      var frisch = beide[0].status === 'ok' || beide[1].status === 'ok';
      if (frisch && s1 && s2 && R.istZahl(w1) && R.istZahl(w2) &&
          R.istZahl(s1.gebuehr) && R.istZahl(s2.gebuehr)) {
        var q1 = R.qeSeite(s1.art, s1.seiteText, w1, s1.gebuehr).qe;
        var q2 = R.qeSeite(s2.art, s2.seiteText, w2, s2.gebuehr).qe;
        if (R.istZahl(q1) && R.istZahl(q2)) {
          aus.neu = R.pruefe(q1, q2, 100);
          aus.neu.wert1 = w1; aus.neu.wert2 = w2;
          aus.neu.frisch1 = beide[0].status === 'ok';
          aus.neu.frisch2 = beide[1].status === 'ok';
        }
      }
      return aus;
    });
  }

  (welt.PS = welt.PS || {}).aktualitaet = { pruefeSeite: pruefeSeite, pruefeBericht: pruefeBericht };
})(typeof globalThis !== 'undefined' ? globalThis : this);
