# Orion Prüfstand

Unabhängige Nachrechnung für die Prüfberichte des **Orion Panel Pro** —
bewusst ein **getrenntes Programm**: das Panel sucht, der Prüfstand prüft.
Kein gemeinsamer Code, keine gemeinsamen Daten, kein Takt, keine Kopplung —
**bis in die Datenbank: eigenes Supabase-Projekt** (`orion-pruefstand`,
`jjvceatwrzxycrzmowbt`), nicht das Panel-Projekt. Es wird NICHTS automatisch
vom Panel übernommen; der einzige Weg hinein ist der eingefügte Text.
Fällt eines aus, läuft das andere weiter.

**Live:** https://saifokaram1-hub.github.io/orion-pruefstand/

## Was es tut

1. **Einfügen:** Im Panel auf einer Karte „Kopieren" drücken, den Bericht hier
   einfügen — die Prüfung startet von selbst.
2. **Aufteilen:** Der Bericht wird in alle Einzelteile zerlegt: Spiel, Bereich,
   Zuordnung, beide Seiten (Buch, Seite, Kurs, Gebühr, Effektivquote, Kursalter,
   Menge, Link), Rechnung, Zeiten, Absage-Bilanz.
3. **Nachrechnen:** Jede Zahl wird mit einer eigenständigen Zweitfassung der
   Formeln neu gerechnet — Schritt für Schritt, mit Formel, eingesetzten Zahlen
   und dem Panel-Wert daneben. Drei Urteile, nie zwei:
   **deckt sich · weicht ab · nicht prüfbar.**
4. **Querproben:** Zusätzlich formelunabhängige Kontrollen: beide Ausgänge
   zahlen gleich aus (S1·qE1 = S2·qE2 = Auszahlung), Rendite passt zur
   Kehrwertsumme, Gewinn passt zum Max-Einsatz, Währungslogik (Dollar↔Euro
   über den EZB-Kurs des Berichts).
5. **Link-Prüfung:** Führen beide Links zur Partie? Stufe 1: gehört die
   Adresse zum genannten Buch (Polymarket↔polymarket.com, Betfair↔Orbit …)?
   Stufe 2: finden sich die Wörter des Link-Pfads in Spiel/Partie wieder
   (Stoppwörter nach Panel-Lehre: reine Zahlen, „will/does/…", vs/fc/…)?
   Kalshi-Kennungen und Orbit-Marktnummern tragen keine Wörter — dort steht
   ehrlich „von außen nicht prüfbar". Beim Aktualitäts-Abruf nennt Polymarket
   zusätzlich die FRAGE des Marktes, den der Link öffnet — der schärfste Beleg.
6. **Warnzeichen:** Dinge, die rechnerisch stimmen und trotzdem gefährlich
   sind — mit den Erfahrungswerten der Panel-Messungen vom 13.08.2026:
   - Kurs länger als 15 Minuten unverändert (7 von 8 falschen Funden kamen
     von einem klebenden Kurs)
   - Buchprobe des Gegenbuchs unter 1,00 (Buch widerspricht sich selbst)
   - Rendite über ~4,4 % (alle als falsch erwiesenen Funde lagen über 4,48 %,
     alle richtigen zwischen 2,07 und 3,27 %)
   - wacklige Zuordnung, unbekannte Menge, fehlender Link, ungemessener
     Gebührensatz, Absage-Bilanz
   - erkennt außerdem, wenn eine Effektivquote der **alten** Polymarket-
     Gebührenformel `Satz × min(p, 1−p)` folgt statt der belegten
     `Satz × p × (1−p)` — und sagt das ausdrücklich.
6. **Aktualität:** Auf Klick (einmalig, kein Takt) beim Anbieter nachsehen,
   ob die Zahlen noch stimmen, und den Eintrag mit den aktuellen Zahlen neu
   rechnen. Gemessen am 17.08.2026: **Polymarket** antwortet dem Browser
   (Gamma-Katalog + CLOB-Orderbuch, Briefkurs `side=sell`); **Kalshi** und
   **Smarkets** blocken den Browser in der Regel (CORS) — dann steht dort
   „nicht prüfbar" statt einer geratenen Zahl; **Betfair** kann nur die
   Bridge lesen, der Orbit-Link dient zum Selbstvergleich.
7. **Verlauf:** Jede Prüfung wird gespeichert. Ohne Anmeldung nur auf dem
   Gerät (localStorage, max. 50). Mit E-Mail + Passwort in Supabase — dann
   auf jedem Gerät abrufbar. Row Level Security: jeder sieht nur seine
   eigenen Zeilen.

## Dateien (Logik und Anzeige getrennt)

| Datei | Aufgabe |
|---|---|
| `js/rechnung.js` | eigenständige Zweitfassung der Formeln (kein Panel-Code) |
| `js/parser.js` | zerlegt den kopierten Bericht, rät nie |
| `js/linkpruefung.js` | Buch↔Adresse + Wortabgleich der Links, drei Zustände |
| `js/pruefer.js` | Nachrechnung, Querproben, Warnzeichen, Urteil |
| `js/aktualitaet.js` | einmaliger Anbieter-Abruf + Neuberechnung |
| `js/verlauf.js` | Anmeldung (Supabase auth/v1) + Ablage (rest/v1), localStorage-Rückfall |
| `js/oberflaeche.js` | zeichnet alles, rechnet nichts |
| `css/stil.css` | ruhiges Militär-Graphit, Buchfarben wie im Panel, keine Animationen |

## Wie es geprüft wurde

- `node pruefung/pruefstand.test.js` — **65 Prüfungen**, darunter für jede
  Schutzregel ein Test, der sie **auslöst**: eingebaute falsche Rendite,
  Effektivquote nach alter Formel, Selbstwiderspruch Formelzeile/Endwert,
  Kursalter, unstimmige Buchprobe, Lay-Seite, Euro-Umrechnung, fremde
  Partie im Link, falsches Buch in der Adresse, fehlender Link.
- Im Browser gegen einen Muster-Bericht im exakten Panel-Format verifiziert;
  Polymarket-Aktualität live gegen die echte Gamma/CLOB-Schnittstelle
  gemessen (17.08.2026).
- **Nicht geprüft:** Anmeldung mit echtem Konto (kein Testkonto angelegt);
  ob die Bestätigungs-E-Mail nötig ist, zeigt sich beim ersten Konto —
  beide Wege werden abgefangen.

## Datenbank

**Eigenes** Supabase-Projekt `orion-pruefstand` (`jjvceatwrzxycrzmowbt`) —
getrennt vom Panel-Projekt. Eine Tabelle `pruefstand_verlauf` (id, nutzer →
auth.users, titel, urteil, urteil_text, rendite, nummer, bericht, erstellt)
mit RLS auf `nutzer = auth.uid()`. Das Panel-Projekt wird von diesem
Programm weder gelesen noch geschrieben.
