/* ORION PROTECTION PANEL, eigene Betfair-Bruecke
 *
 * WARUM es diese Bruecke gibt
 * Betfair weist Server ab (Cloudflare 403, beim Panel gemessen) und
 * verlangt eine Anmeldung. Aus dem Browser geht es gar nicht. Nur ein
 * Programm auf einem Rechner zu Hause kommt heran. Deshalb dieses
 * kleine Programm: es laeuft auf dem Laptop, fragt Betfair nach EINEM
 * Markt und gibt die Antwort an das Protection Panel weiter.
 *
 * WAS SIE STRENG NICHT TUT
 *   - Sie setzt keine Wette. Sie ruft ausschliesslich Leseverfahren auf
 *     (listMarketBook, listMarketCatalogue). Kein placeOrders, nichts.
 *   - Sie fasst die Panel-Bruecke nicht an: eigener Ordner, eigene
 *     Konfigurationsdatei, eigener Port, eigener Name. Beide koennen
 *     nebeneinander laufen, ohne voneinander zu wissen.
 *   - Sie laeuft NICHT im Takt. Sie antwortet nur, wenn gefragt wird.
 *   - Sie nimmt nur Anfragen vom eigenen Rechner an.
 *
 * ZUGANGSDATEN
 * Sie stehen in `bruecke-zugang.json` neben dieser Datei. Diese Datei
 * legst DU an, sie steht in .gitignore und wird nie hochgeladen. Ich
 * trage dort nichts ein, siehe LIESMICH.md.
 *
 * Start:  node bruecke.js
 */
'use strict';

var http = require('http');
var https = require('https');
var fs = require('fs');
var pfad = require('path');

var PORT = 8791;                       /* eigener Port, das Panel nutzt andere */
var ZUGANG = pfad.join(__dirname, 'bruecke-zugang.json');

function jetzt() {
  var d = new Date();
  function z(n) { return (n < 10 ? '0' : '') + n; }
  return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
}
function melde(text) { console.log('[' + jetzt() + '] ' + text); }

/* ---------- Zugangsdaten lesen ---------- */
function zugang() {
  if (!fs.existsSync(ZUGANG)) return null;
  try {
    var z = JSON.parse(fs.readFileSync(ZUGANG, 'utf8'));
    if (!z.appKey || !z.benutzer || !z.passwort) return null;
    return z;
  } catch (e) {
    melde('bruecke-zugang.json ist nicht lesbar: ' + e.message);
    return null;
  }
}

/* ---------- Anmeldung bei Betfair ----------
 * LIMITED_ACCESS liefert ein gueltiges Token: Wetten gesperrt, Kurse
 * lesen erlaubt. Nur FAIL ohne Token ist echt blockiert (Panel-Lehre). */
var sitzung = { token: null, seit: 0 };

function anmelden() {
  var z = zugang();
  if (!z) return Promise.reject(new Error('Keine bruecke-zugang.json vorhanden.'));
  if (sitzung.token && Date.now() - sitzung.seit < 3 * 60 * 60 * 1000) {
    return Promise.resolve(sitzung.token);
  }
  return new Promise(function (fertig, schiefgegangen) {
    var koerper = 'username=' + encodeURIComponent(z.benutzer) +
                  '&password=' + encodeURIComponent(z.passwort);
    var anfrage = https.request({
      host: 'identitysso.betfair.com',
      path: '/api/login',
      method: 'POST',
      headers: {
        'X-Application': z.appKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(koerper),
        Accept: 'application/json'
      }
    }, function (antwort) {
      var roh = '';
      antwort.on('data', function (t) { roh += t; });
      antwort.on('end', function () {
        var d;
        try { d = JSON.parse(roh); } catch (e) { return schiefgegangen(new Error('Antwort unlesbar')); }
        if (d.token) {
          sitzung = { token: d.token, seit: Date.now() };
          melde('Angemeldet (Status: ' + d.status + ').');
          return fertig(d.token);
        }
        schiefgegangen(new Error('Anmeldung abgelehnt: ' + (d.error || d.status || 'unbekannt')));
      });
    });
    anfrage.on('error', schiefgegangen);
    anfrage.write(koerper);
    anfrage.end();
  });
}

/* ---------- Nur lesende Aufrufe ---------- */
var ERLAUBT = ['listMarketBook', 'listMarketCatalogue'];

function betfair(verfahren, parameter) {
  if (ERLAUBT.indexOf(verfahren) < 0) {
    return Promise.reject(new Error('Dieses Verfahren ist hier nicht erlaubt: ' + verfahren));
  }
  return anmelden().then(function (token) {
    var z = zugang();
    return new Promise(function (fertig, schiefgegangen) {
      var koerper = JSON.stringify({
        jsonrpc: '2.0', method: 'SportsAPING/v1.0/' + verfahren, params: parameter, id: 1
      });
      var anfrage = https.request({
        host: 'api.betfair.com',
        path: '/exchange/betting/json-rpc/v1',
        method: 'POST',
        headers: {
          'X-Application': z.appKey,
          'X-Authentication': token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(koerper),
          Accept: 'application/json'
        }
      }, function (antwort) {
        var roh = '';
        antwort.on('data', function (t) { roh += t; });
        antwort.on('end', function () {
          try {
            var d = JSON.parse(roh);
            if (d.error) return schiefgegangen(new Error(JSON.stringify(d.error).slice(0, 200)));
            fertig(d.result);
          } catch (e) { schiefgegangen(new Error('Antwort unlesbar')); }
        });
      });
      anfrage.on('error', schiefgegangen);
      anfrage.write(koerper);
      anfrage.end();
    });
  });
}

/* ---------- Einen Markt nachschlagen ----------
 * Liefert dieselbe Form wie die anderen Buecher, damit der Abgleich im
 * Protection Panel ohne Sonderfall damit rechnen kann. */
function marktLesen(marktId, laeuferName, seiteText) {
  return Promise.all([
    betfair('listMarketBook', {
      marketIds: [marktId],
      priceProjection: { priceData: ['EX_BEST_OFFERS'] }
    }),
    betfair('listMarketCatalogue', {
      filter: { marketIds: [marktId] },
      marketProjection: ['EVENT', 'MARKET_START_TIME', 'RUNNER_DESCRIPTION', 'COMPETITION', 'MARKET_DESCRIPTION'],
      maxResults: 1
    })
  ]).then(function (beides) {
    var buch = beides[0] && beides[0][0];
    var katalog = beides[1] && beides[1][0];
    if (!buch) return { status: 'unpruefbar', text: 'Betfair kennt den Markt ' + marktId + ' nicht.' };
    if (buch.status && buch.status !== 'OPEN') {
      return { status: 'vorbei', text: 'Der Betfair-Markt steht auf ' + buch.status + '.' };
    }

    /* Den richtigen Laeufer finden. Ohne Namen: der erste. */
    var laeufer = null;
    var namen = {};
    if (katalog && katalog.runners) {
      katalog.runners.forEach(function (r) { namen[r.selectionId] = r.runnerName; });
    }
    (buch.runners || []).forEach(function (r) {
      if (laeufer) return;
      if (!laeuferName) { laeufer = r; return; }
      var n = String(namen[r.selectionId] || '').toLowerCase();
      if (n && n.indexOf(String(laeuferName).toLowerCase().slice(0, 12)) >= 0) laeufer = r;
    });
    if (!laeufer) laeufer = (buch.runners || [])[0];
    if (!laeufer) return { status: 'unpruefbar', text: 'Der Markt nennt keine Auswahl.' };

    var lay = String(seiteText || '').toLowerCase() === 'lay';
    var seiteDaten = lay ? (laeufer.ex && laeufer.ex.availableToLay) : (laeufer.ex && laeufer.ex.availableToBack);
    var bester = seiteDaten && seiteDaten[0];
    if (!bester || !(bester.price > 1)) {
      return { status: 'unpruefbar', text: 'Zu dieser Seite steht gerade kein Kurs im Buch.' };
    }

    /* Der Kommissionssatz steht JE MARKT, nicht pauschal bei 5 Prozent. */
    var satz = null;
    if (katalog && katalog.description && typeof katalog.description.marketBaseRate === 'number') {
      satz = katalog.description.marketBaseRate / 100;
    }

    return {
      status: 'ok',
      wert: bester.price,
      gebuehrSatz: satz,
      mengeGeld: lay ? (bester.size * (bester.price - 1)) : bester.size,
      mengeAnteile: bester.size,
      frage: katalog ? katalog.marketName : null,
      ereignis: katalog && katalog.event ? katalog.event.name : null,
      anpfiff: katalog && katalog.event ? katalog.event.openDate : null,
      endet: katalog ? katalog.marketStartTime : null,
      serie: katalog && katalog.competition ? katalog.competition.name : null,
      auswahl: namen[laeufer.selectionId] || null,
      quelle: 'Betfair Exchange, ' + (lay ? 'availableToLay' : 'availableToBack') + ', ueber die eigene Bruecke',
      quellLink: 'https://www.orbitexch.com/customer/sport/1/market/' + marktId
    };
  });
}

/* ---------- Der kleine Dienst ---------- */
var dienst = http.createServer(function (anfrage, antwort) {
  var kopf = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Content-Type': 'application/json; charset=utf-8'
  };
  if (anfrage.method === 'OPTIONS') { antwort.writeHead(204, kopf); return antwort.end(); }

  /* Nur vom eigenen Rechner. */
  var von = anfrage.socket.remoteAddress || '';
  if (von.indexOf('127.0.0.1') < 0 && von.indexOf('::1') < 0) {
    antwort.writeHead(403, kopf);
    return antwort.end(JSON.stringify({ status: 'unpruefbar', text: 'Nur vom eigenen Rechner.' }));
  }

  if (anfrage.method === 'GET') {
    antwort.writeHead(200, kopf);
    return antwort.end(JSON.stringify({
      status: 'bereit',
      zugang: zugang() ? 'vorhanden' : 'fehlt, siehe LIESMICH.md',
      hinweis: 'Diese Bruecke liest nur Kurse. Sie setzt keine Wetten.'
    }));
  }

  var roh = '';
  anfrage.on('data', function (t) { roh += t; if (roh.length > 4000) anfrage.destroy(); });
  anfrage.on('end', function () {
    var auftrag;
    try { auftrag = JSON.parse(roh); } catch (e) {
      antwort.writeHead(400, kopf);
      return antwort.end(JSON.stringify({ status: 'unpruefbar', text: 'Kein lesbarer Auftrag.' }));
    }
    if (!auftrag.marktId) {
      antwort.writeHead(200, kopf);
      return antwort.end(JSON.stringify({ status: 'unpruefbar', text: 'Ohne Marktnummer kein Abruf.' }));
    }
    melde('Frage Betfair nach Markt ' + auftrag.marktId + '.');
    marktLesen(String(auftrag.marktId), auftrag.auswahl, auftrag.seite)
      .then(function (d) {
        antwort.writeHead(200, kopf);
        antwort.end(JSON.stringify(d));
        melde('Antwort: ' + d.status + (d.wert ? ' (Kurs ' + d.wert + ')' : ''));
      })
      .catch(function (f) {
        antwort.writeHead(200, kopf);
        antwort.end(JSON.stringify({ status: 'unpruefbar', text: 'Betfair-Abruf fehlgeschlagen: ' + f.message }));
        melde('Fehlgeschlagen: ' + f.message);
      });
  });
});

dienst.listen(PORT, '127.0.0.1', function () {
  melde('Bruecke laeuft auf http://127.0.0.1:' + PORT);
  melde(zugang()
    ? 'Zugangsdaten gefunden. Sie wird bei der ersten Anfrage benutzt.'
    : 'ACHTUNG: bruecke-zugang.json fehlt. Bitte LIESMICH.md lesen.');
  melde('Sie liest nur Kurse und setzt keine Wetten. Beenden mit Strg+C.');
});
