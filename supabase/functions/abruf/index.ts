/* ORION PROTECTION PANEL, Abruf-Dienst
 *
 * Warum es diesen Dienst gibt: Kalshi und Smarkets weisen den Browser ab
 * (keine CORS-Freigabe, gemessen am 17.08.2026). Von einem Server aus
 * antworten beide sauber, ebenfalls gemessen. Der Browser fragt also
 * diesen Dienst, und der Dienst fragt das Buch.
 *
 * Zwei Grundsaetze:
 *   1. NUR LESEN. Der Dienst holt Kurse und Marktangaben, sonst nichts.
 *      Keine Anmeldung, kein Schluessel, keine Wette, kein Geld.
 *   2. NUR die drei bekannten Buecher. Eine offene Weiterleitung waere
 *      ein Werkzeug fuer Fremde; deshalb steht die Liste der erlaubten
 *      Adressen fest im Code, und alles andere wird abgewiesen.
 *
 * Aufruf:
 *   POST { buch: "kalshi",   kennung: "KXMLBGAME-..." , seite: "ja" }
 *   POST { buch: "smarkets", ereignis: "44991234" }
 *
 * Antwort immer in derselben Form:
 *   { status: "ok" | "vorbei" | "unpruefbar", wert, gebuehrSatz, ... }
 * Was der Anbieter nicht hergibt, bleibt null. Es wird nichts geraten.
 */

const KOPF = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function antwort(daten: unknown, code = 200) {
  return new Response(JSON.stringify(daten), { status: code, headers: KOPF });
}

/* Kalshi. Der Gebuehrensatz steht nicht je Markt in der Antwort; Kalshi
 * rechnet ihn nach fester Formel (0,07 mal Preis mal Gegenpreis, bei
 * neun Serien null). Deshalb wird hier NUR der Kurs gemeldet und der
 * Satz ausdruecklich als nicht mitgeliefert gekennzeichnet. */
async function kalshi(kennung: string, seite: string) {
  const url = 'https://api.elections.kalshi.com/trade-api/v2/markets/' + encodeURIComponent(kennung);
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) {
    return { status: 'unpruefbar', text: 'Kalshi antwortet mit HTTP ' + r.status + ' auf die Kennung ' + kennung + '.' };
  }
  const d = await r.json();
  const m = d && d.market;
  if (!m) return { status: 'unpruefbar', text: 'Kalshi kennt die Kennung ' + kennung + ' nicht.' };
  if (m.status && m.status !== 'active') {
    return { status: 'vorbei', text: 'Der Kalshi-Markt steht auf "' + m.status + '".' };
  }
  const nein = seite === 'nein' || seite === 'unter';
  const cents = nein ? m.no_ask : m.yes_ask;
  const preis = Number(cents) / 100;
  if (!(preis > 0 && preis < 1)) {
    return { status: 'unpruefbar', text: 'Kalshi nennt keinen gueltigen Briefkurs fuer diese Seite.' };
  }
  const menge = nein ? m.no_ask_quantity : m.yes_ask_quantity;
  return {
    status: 'ok',
    wert: preis,
    frage: m.title || m.subtitle || null,
    ereignis: m.event_ticker || null,
    anpfiff: m.open_time || null,
    endet: m.close_time || null,
    serie: m.series_ticker || null,
    gebuehrSatz: null,          /* Kalshi liefert ihn nicht je Markt */
    mengeAnteile: typeof menge === 'number' ? menge : null,
    mengeGeld: typeof menge === 'number' ? menge * preis : null,
    quelle: 'Kalshi trade-api, ' + (nein ? 'no_ask' : 'yes_ask') + ', ueber den eigenen Abruf-Dienst',
    quellLink: url
  };
}

/* Smarkets. Der Link im Bericht nennt nur die PARTIE, nicht den Markt.
 * Deshalb wird die Marktliste geholt und ehrlich gemeldet, was dort
 * steht. Welcher davon gemeint ist, entscheidet der Mensch. */
async function smarkets(ereignis: string) {
  const url = 'https://api.smarkets.com/v3/events/' + encodeURIComponent(ereignis) + '/markets/';
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) {
    return { status: 'unpruefbar', text: 'Smarkets antwortet mit HTTP ' + r.status + '.' };
  }
  const d = await r.json();
  const maerkte = (d && d.markets) || [];
  if (!maerkte.length) {
    return { status: 'unpruefbar', text: 'Smarkets nennt keine Maerkte zu dieser Partie.' };
  }
  /* Zusaetzlich die Partie selbst, wegen Anpfiffzeit und Name. */
  let ev: Record<string, unknown> | null = null;
  try {
    const re = await fetch('https://api.smarkets.com/v3/events/' + encodeURIComponent(ereignis) + '/');
    if (re.ok) {
      const de = await re.json();
      ev = (de && de.events && de.events[0]) || null;
    }
  } catch (_) { /* die Partie ist ein Zusatz, kein Muss */ }

  return {
    status: 'teilweise',
    text: 'Smarkets ist erreichbar und fuehrt ' + maerkte.length + ' Maerkte zu dieser Partie. ' +
          'Welcher davon gemeint ist, sagt der Link nicht, denn er zeigt nur auf die Partie. ' +
          'Kurs bitte im geoeffneten Fenster ablesen.',
    frage: ev ? (ev.name as string) : null,
    anpfiff: ev ? (ev.start_datetime as string) : null,
    serie: ev ? (ev.full_slug as string) : null,
    maerkte: maerkte.slice(0, 12).map((m: Record<string, unknown>) => ({
      id: m.id, name: m.name, typ: m.market_type
    })),
    gebuehrSatz: null,
    quelle: 'Smarkets v3 Marktliste, ueber den eigenen Abruf-Dienst',
    quellLink: url
  };
}

Deno.serve(async (anfrage: Request) => {
  if (anfrage.method === 'OPTIONS') return new Response('ok', { headers: KOPF });
  if (anfrage.method !== 'POST') {
    return antwort({ status: 'unpruefbar', text: 'Nur POST.' }, 405);
  }
  let k: Record<string, string> = {};
  try { k = await anfrage.json(); } catch (_) {
    return antwort({ status: 'unpruefbar', text: 'Kein lesbarer Auftrag.' }, 400);
  }

  try {
    if (k.buch === 'kalshi') {
      if (!k.kennung) return antwort({ status: 'unpruefbar', text: 'Ohne Kennung kein Abruf.' });
      return antwort(await kalshi(k.kennung, String(k.seite || 'ja').toLowerCase()));
    }
    if (k.buch === 'smarkets') {
      if (!k.ereignis) return antwort({ status: 'unpruefbar', text: 'Ohne Ereignisnummer kein Abruf.' });
      return antwort(await smarkets(k.ereignis));
    }
    /* Betfair fehlt hier mit Absicht: es blockt Server (Cloudflare) und
     * braucht eine Anmeldung. Dafuer gibt es den getrennten Weg ueber
     * die eigene Bruecke am Laptop. */
    return antwort({
      status: 'unpruefbar',
      text: 'Dieser Dienst kennt nur kalshi und smarkets. Polymarket geht direkt aus dem Browser, ' +
            'Betfair braucht die eigene Bruecke.'
    });
  } catch (f) {
    return antwort({ status: 'unpruefbar', text: 'Abruf fehlgeschlagen: ' + String((f as Error).message) });
  }
});
