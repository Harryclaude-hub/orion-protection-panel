/* ORION PRÜFSTAND, Verlauf und Anmeldung
 *
 * Jede Prüfung wird aufgehoben, damit sie auf JEDEM Gerät nachlesbar ist:
 *   - angemeldet: in Supabase, Tabelle `pruefstand_verlauf` (nur der eigene
 *     Nutzer sieht seine Zeilen, Row Level Security)
 *   - ohne Anmeldung: nur im Browser-Speicher dieses Geräts
 *
 * ABSICHTLICH GETRENNT vom Orion Panel, bis in die Datenbank: der
 * Prüfstand hat sein EIGENES Supabase-Projekt (`orion-pruefstand`,
 * jjvceatwrzxycrzmowbt). Kein gemeinsames Projekt, keine gemeinsame
 * Tabelle, kein Takt, kein Abgleich. Fällt eines aus, läuft das andere.
 *
 * Ohne Fremdbibliothek: Anmeldung und Ablage laufen über die offenen
 * HTTP-Schnittstellen von Supabase (auth/v1 + rest/v1) mit fetch.
 */
(function (welt) {
  'use strict';

  var URL_BASIS = 'https://jjvceatwrzxycrzmowbt.supabase.co';
  var SCHLUESSEL = 'sb_publishable_QTVkKApv-zS4SEoeavxcZA_JiF-wqvg';
  var ABLAGE = 'pruefstand_sitzung';       // access/refresh-Token im localStorage
  var LOKAL = 'pruefstand_verlauf_lokal';  // Verlauf ohne Anmeldung
  var LOKAL_MAX = 50;

  function lesen(name) {
    try { return JSON.parse(localStorage.getItem(name) || 'null'); } catch (e) { return null; }
  }
  function schreiben(name, wert) {
    try { localStorage.setItem(name, JSON.stringify(wert)); return true; } catch (e) { return false; }
  }

  function sitzung() { return lesen(ABLAGE); }
  function angemeldet() { var s = sitzung(); return !!(s && s.access_token); }
  function eigeneMail() { var s = sitzung(); return s && s.email ? s.email : null; }

  function authRuf(pfad, koerper) {
    return fetch(URL_BASIS + '/auth/v1/' + pfad, {
      method: 'POST',
      headers: { apikey: SCHLUESSEL, 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper)
    }).then(function (a) {
      return a.json().then(function (d) { return { ok: a.ok, status: a.status, daten: d }; });
    });
  }

  function sitzungMerken(d, email) {
    schreiben(ABLAGE, {
      access_token: d.access_token, refresh_token: d.refresh_token,
      email: email || (d.user && d.user.email) || null,
      seit: new Date().toISOString()
    });
  }

  function anmelden(email, passwort) {
    return authRuf('token?grant_type=password', { email: email, password: passwort })
      .then(function (r) {
        if (r.ok && r.daten.access_token) { sitzungMerken(r.daten, email); return { ok: true }; }
        var grund = (r.daten && (r.daten.error_description || r.daten.msg || r.daten.message)) || ('HTTP ' + r.status);
        if (/invalid login/i.test(grund)) grund = 'E-Mail oder Passwort stimmen nicht, oder das Konto ist noch nicht bestätigt.';
        return { ok: false, grund: grund };
      })
      .catch(function (f) { return { ok: false, grund: 'Keine Verbindung: ' + f.message }; });
  }

  function kontoAnlegen(email, passwort) {
    return authRuf('signup', { email: email, password: passwort })
      .then(function (r) {
        if (r.ok && r.daten.access_token) { sitzungMerken(r.daten, email); return { ok: true, sofort: true }; }
        if (r.ok) {
          return { ok: true, sofort: false,
                   hinweis: 'Konto angelegt. Falls eine Bestätigungs-E-Mail kommt: bestätigen, dann hier anmelden.' };
        }
        var grund = (r.daten && (r.daten.error_description || r.daten.msg || r.daten.message)) || ('HTTP ' + r.status);
        return { ok: false, grund: grund };
      })
      .catch(function (f) { return { ok: false, grund: 'Keine Verbindung: ' + f.message }; });
  }

  function abmelden() { try { localStorage.removeItem(ABLAGE); } catch (e) { /* egal */ } }

  function erneuern() {
    var s = sitzung();
    if (!s || !s.refresh_token) return Promise.resolve(false);
    return authRuf('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
      .then(function (r) {
        if (r.ok && r.daten.access_token) { sitzungMerken(r.daten, s.email); return true; }
        abmelden(); return false;
      })
      .catch(function () { return false; });
  }

  /* REST-Aufruf mit einmaligem Erneuerungs-Versuch bei abgelaufenem Token. */
  function rest(pfad, optionen, zweiterVersuch) {
    var s = sitzung();
    if (!s) return Promise.reject(new Error('nicht angemeldet'));
    var o = optionen || {};
    o.headers = Object.assign({
      apikey: SCHLUESSEL,
      Authorization: 'Bearer ' + s.access_token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }, o.headers || {});
    return fetch(URL_BASIS + '/rest/v1/' + pfad, o).then(function (a) {
      if (a.status === 401 && !zweiterVersuch) {
        return erneuern().then(function (ging) {
          if (!ging) throw new Error('Anmeldung abgelaufen, bitte neu anmelden.');
          return rest(pfad, optionen, true);
        });
      }
      if (!a.ok) return a.text().then(function (t) { throw new Error('HTTP ' + a.status + ': ' + t.slice(0, 200)); });
      return a.status === 204 ? null : a.json();
    });
  }

  /* ---------- Ablage einer Prüfung ---------- */
  function eintragBauen(bericht, ergebnis) {
    return {
      titel: bericht.titel || 'ohne Titel',
      urteil: ergebnis && ergebnis.urteil ? ergebnis.urteil.stufe : null,
      urteil_text: ergebnis && ergebnis.urteil ? ergebnis.urteil.text : null,
      rendite: bericht.rechnung && typeof bericht.rechnung.rendite === 'number' ? bericht.rechnung.rendite : null,
      nummer: bericht.nummer || null,
      bericht: bericht.roh
    };
  }

  function speichern(bericht, ergebnis) {
    var e = eintragBauen(bericht, ergebnis);
    if (angemeldet()) {
      return rest('pruefstand_verlauf', { method: 'POST', body: JSON.stringify(e) })
        .then(function (zeilen) { return { wo: 'konto', id: zeilen && zeilen[0] && zeilen[0].id }; });
    }
    var l = lesen(LOKAL) || [];
    e.id = 'lokal-' + Date.now();
    e.erstellt = new Date().toISOString();
    l.unshift(e);
    if (l.length > LOKAL_MAX) l = l.slice(0, LOKAL_MAX);
    var ging = schreiben(LOKAL, l);
    return Promise.resolve({ wo: ging ? 'lokal' : 'nirgends' });
  }

  function laden() {
    if (angemeldet()) {
      return rest('pruefstand_verlauf?select=id,titel,urteil,urteil_text,rendite,nummer,bericht,erstellt&order=erstellt.desc&limit=200')
        .then(function (zeilen) { return { wo: 'konto', zeilen: zeilen || [] }; });
    }
    return Promise.resolve({ wo: 'lokal', zeilen: lesen(LOKAL) || [] });
  }

  function loeschen(id) {
    if (String(id).indexOf('lokal-') === 0) {
      var l = (lesen(LOKAL) || []).filter(function (e) { return e.id !== id; });
      schreiben(LOKAL, l);
      return Promise.resolve(true);
    }
    if (!angemeldet()) return Promise.resolve(false);
    return rest('pruefstand_verlauf?id=eq.' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function () { return true; });
  }

  (welt.PS = welt.PS || {}).verlauf = {
    angemeldet: angemeldet, eigeneMail: eigeneMail,
    anmelden: anmelden, kontoAnlegen: kontoAnlegen, abmelden: abmelden,
    speichern: speichern, laden: laden, loeschen: loeschen
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
