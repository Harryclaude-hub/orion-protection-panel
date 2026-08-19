# Der Abruf-Dienst: einmal hochladen, dann laeuft er

Der Dienst `abruf` holt Kurse bei **Kalshi** und **Smarkets**. Beide weisen
den Browser ab (CORS, gemessen am 17.08.2026), antworten aber einem Server
ohne Probleme (ebenfalls gemessen). Der Browser fragt also den Dienst, und
der Dienst fragt das Buch.

**Ohne diesen Dienst laeuft alles weiter wie bisher.** Dann steht bei
Kalshi und Smarkets weiterhin ehrlich "nicht pruefbar" statt einer
geratenen Zahl. Es geht nichts kaputt, es fehlt nur die Pruefung.

## Hochladen

Der Schritt braucht deine Anmeldung, deshalb kann ich ihn nicht selbst
machen. Zwei Befehle:

```bash
npx --yes supabase@latest login
```

```bash
npx --yes supabase@latest functions deploy abruf --project-ref jjvceatwrzxycrzmowbt --no-verify-jwt
```

Der erste oeffnet den Browser zur Anmeldung. Der zweite laedt die Datei
`supabase/functions/abruf/index.ts` in **dein eigenes** Pruefstand-Projekt
hoch, nicht ins Panel-Projekt.

`--no-verify-jwt` heisst: die Seite darf den Dienst ohne Anmeldung rufen.
Das ist hier richtig, denn der Dienst **liest nur** und kennt genau zwei
Adressen. Er nimmt keine Zugangsdaten an, setzt keine Wette und ruehrt
kein Geld an.

## Danach pruefen

```bash
curl -s -X POST https://jjvceatwrzxycrzmowbt.supabase.co/functions/v1/abruf -H "Content-Type: application/json" -d "{\"buch\":\"smarkets\",\"ereignis\":\"44991234\"}"
```

Kommt eine Antwort mit `"status"`, laeuft er. Ab dann prueft das Protection
Panel auch Kalshi und Smarkets selbst, statt dem Bericht zu glauben.

## Was der Dienst NICHT tut

- Er kennt nur `kalshi` und `smarkets`. Alles andere weist er ab.
- Er nimmt keine Anmeldedaten entgegen und speichert nichts.
- Betfair fehlt mit Absicht: es blockt Server (Cloudflare) und braucht
  eine Anmeldung. Dafuer gibt es die getrennte Bruecke am Laptop,
  siehe `bruecke/LIESMICH.md`.
