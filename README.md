# Orion Protection Panel

Tactical Verification Interface, unabhängige Nachrechnung für die
Prüfberichte des **Orion Panel Pro** (hieß bis 17.08.2026 „Orion Prüfstand").
Bewusst ein **getrenntes Programm**: das Panel sucht, dieses Programm schützt.
Kein gemeinsamer Code, keine gemeinsamen Daten, kein Takt, keine Kopplung, **bis in die Datenbank: eigenes Supabase-Projekt** (`orion-pruefstand`,
`jjvceatwrzxycrzmowbt`), nicht das Panel-Projekt. Es wird NICHTS automatisch
vom Panel übernommen; der einzige Weg hinein ist der eingefügte Text.
Fällt eines aus, läuft das andere weiter.

**Live:** https://harryclaude-hub.github.io/orion-protection-panel/

## Design und Funktion laufen getrennt (Karams Regel)

Die Optik (Navy/Cyan-Taktik-HUD nach Referenzbild, Logo, UTC-Uhr, Militär-Ton
„Jawohl, Chef") lebt NUR in `css/stil.css`, `logo.svg` und `js/schmuck.js`.
Diese Dateien sind **löschbar**, fällt eine weg, fehlt Schmuck, nie ein Wert
und nie eine Rechnung. Alle Farben sind Tokens am Kopf von `stil.css`; ein
Thema-Wechsel tauscht nur die Tokens, nie Markup oder Logik. Keine schweren
Effekte: die Seite bleibt auf einem normalen Laptop flüssig, Animationen sind
sparsame CSS-Arbeit mit `prefers-reduced-motion`-Rücksicht. Nach jeder
Designarbeit laufen die Funktions-Selbsttests.

## Zwei getrennte Ampeln, weil es zwei getrennte Fragen sind

Ganz oben stehen zwei gleich grosse Lampen nebeneinander:

| | Frage | rot heisst |
|---|---|---|
| **Pruefung 1** | Stimmt die Rechnung, die du mir gegeben hast? | im Bericht steckt ein Rechenfehler |
| **Pruefung 2** | Ist es profitabel? | kein Gewinn, oder zwei verschiedene Spiele |

Sie faerben sich **unabhaengig voneinander**. Belegt im Browser:

- Ein in sich stimmiger Bericht mit Verlust: Lampe 1 gruen, Lampe 2 rot.
- Ein Rechenfehler bei guter Rendite: Lampe 1 rot, Lampe 2 gruen, mit dem
  Zusatz, dass die Gewinnzahl aus der eigenen Nachrechnung stammt.
- Eine U21-Fehlpaarung: Lampe 1 gruen, Lampe 2 rot.

Wer beides in eine Lampe presst, verliert genau die Auskunft, auf die es
ankommt.

## Die Übersicht: lohnt es sich, und stimmt die Rechnung?

Ganz oben, vor allen Einzelheiten, beantwortet der Prüfstand vier Fragen:

1. **Mache ich Gewinn?** (ja / knapp / nein, mit Prozentzahl)
2. **Stimmt die Rechnung?** (deckt sich / weicht ab / teilweise prüfbar)
3. **Führen die Links zur Partie?**
4. **Sind die Kurse noch aktuell?** (der Anbieter-Abruf startet automatisch mit)

Darunter der Geldfluss in echtem Geld, je Seite: Einsatz, brutto zurück,
**Gebühr in Euro**, netto zurück, Gewinn. Und die Zusammenfassung: eingesetzt,
davon Gebühren, sicher zurück, garantierter Gewinn.

### Die Ampel trennt zwei Dinge, die nicht dasselbe sind

| Farbe | Bedeutung |
|---|---|
| **GRÜN** | Rechnung stimmt UND es bleibt mindestens 1 % sicherer Gewinn |
| **ORANGE** | knapp: unter 1 %, oder Warnzeichen, oder Teile nicht prüfbar |
| **ROT** | Rechenfehler / falscher Link, **oder: Rechnung richtig, aber kein Gewinn** |

Der letzte Fall ist der wichtigste: Ein Bericht kann fehlerfrei gerechnet sein
und trotzdem keinen Cent bringen. Dann steht dort ausdrücklich
**„RECHNUNG RICHTIG, ABER KEIN GEWINN"**, während die Rechenprüfung weiter
„deckt sich" meldet. Beides ist wahr, und beides muss man sehen.

## Was der Pruefstand SELBST holt, statt dem Bericht zu glauben

Karams Einwand vom 19.08.2026 war berechtigt: bis dahin kamen ALLE
Eingangswerte aus dem Bericht, und nur die Ableitungen wurden selbst
gerechnet. Wer die Gebuehr glaubt, die er pruefen soll, prueft nichts.

| Angabe | Woher jetzt | Weg |
|---|---|---|
| Kurs Polymarket | CLOB-Orderbuch, bester Brief | direkt aus dem Browser |
| **Gebuehrensatz Polymarket** | feeSchedule.rate des Anbieters | direkt aus dem Browser |
| **Handelbare Menge** | Menge an derselben Orderbuch-Stufe | direkt aus dem Browser |
| Mindestbestellung, Tickgroesse | Marktangaben | direkt aus dem Browser |
| Marktfrage, Anpfiff, Serie | Marktangaben | direkt aus dem Browser |
| Kurs und Menge Kalshi | trade-api | ueber den eigenen Abruf-Dienst |
| Partie und Maerkte Smarkets | v3-Schnittstelle | ueber den eigenen Abruf-Dienst |
| Kurs, Kommission, Menge Betfair | Exchange, nur lesend | ueber die eigene Bruecke am Laptop |

Das Modul `js/abgleich.js` stellt jede dieser Angaben dem Bericht
gegenueber, mit eigenem Massstab je Art: ein Gebuehrensatz muss praktisch
exakt stimmen, Mengen duerfen 15 Prozent schwanken, Kurse nur um die
Druckrundung. Ein falscher Gebuehrensatz zaehlt als harter Befund und
faerbt die Ampel.

**Die Uebersicht rechnet mit den echten Werten**, sobald der Anbieter
welche liefert, und schreibt sichtbar dazu, worauf die Prozentzahl steht.
Der Rechenweg in Abschnitt 3 prueft weiter den Bericht gegen sich selbst.
Das sind zwei verschiedene Fragen, und beide bekommen ihre Antwort.

### Die zwei Wege, die einmal eingerichtet werden muessen

- **Abruf-Dienst** fuer Kalshi und Smarkets: siehe `supabase/ANLEITUNG.md`,
  zwei Befehle. Ohne ihn steht dort weiterhin ehrlich "nicht pruefbar".
- **Eigene Bruecke** fuer Betfair: siehe `bruecke/LIESMICH.md`. Sie liest
  nur Kurse, setzt nie eine Wette, laeuft nicht im Takt und fasst die
  Panel-Bruecke nicht an. Ohne sie: "nicht pruefbar" und der Orbit-Link.

Beides ist so gebaut, dass **ohne diese Wege nichts kaputtgeht**: dann
bleibt es bei der ehrlichen Auskunft, dass diese Seite von hier aus nicht
pruefbar ist. Kein stiller Ausfall, keine geratene Zahl.

## Meinen beide Bücher dasselbe Spiel? (Paarungsprüfung)

Die gefährlichste Fehlerklasse ist nicht die Rechnung, sondern die Paarung:
zwei Bücher, die verschiedene Partien meinen. Die Rechnung ist dann fehlerfrei, und die Wette trotzdem offen. Das Orion Panel hat dagegen am 18.08.2026 drei
Sperren bekommen; `js/paarung.js` baut sie **eigenständig nach** (zweite Fassung,
kein kopierter Code):

| Prüfung | Was sie fängt |
|---|---|
| **Alter** | U15–U23 gegen erste Elf, der Fund des Auftraggebers; die Namen sehen identisch aus |
| **Geschlecht** | Frauen- gegen Männerpartie |
| **Reserve** | zweite Mannschaft, Academy, „(Res)" gegen erste |
| **Anpfiffzeit** | Toleranz 180 min (Panel-Messung an 274 Paaren: zwischen 2 und 3 Stunden lag kein echtes Paar, die falschen begannen bei 270 min). Fängt zusätzlich das **Rückspiel**, bei dem Namen und Kennungen gleich sind und nur der Termin abweicht |
| **Liga** | Jugend-, Reserve- oder Frauenliga auf nur einer Seite (live belegter Fall: „Argentinian Primera Division Reserves") |

Eine erkannte Fehlpaarung stellt die Ampel auf **ROT**, aber mit eigener,
ehrlicher Begründung: **„NICHT SETZEN, ZWEI VERSCHIEDENE SPIELE"**, während
Frage 2 weiterhin korrekt „geprüft, deckt sich" meldet. Eine falsche Begründung
wäre fast so schlimm wie gar kein Alarm.

Fehlt eine Angabe, wird **nicht** gesperrt und **nicht** geraten, dann steht dort
„nicht prüfbar" mit der Aufforderung, beide Links selbst zu öffnen.

## Woher jede Zahl stammt

Über der Übersicht steht eine Herkunftstabelle. Jede Angabe trägt ihre Quelle,
und wo es geht, einen Link zum Nachsehen:

- **aus dem Bericht**, steht so im eingefügten Text des Panels
- **beim Anbieter nachgefragt**, direkt geholt (Marktfrage, Anpfiff, Serie, Kurs),
  mit Link auf die Abfrage
- **selbst gerechnet**, vom Prüfstand aus den beiden anderen erzeugt

Was von hier aus nicht erreichbar ist (Kalshi, Smarkets, Betfair), wird ausdrücklich
als solches benannt, statt eine Zahl zu erfinden.

## Rechen-Werkstatt und Nebennotiz

Ganz unten: Felder, in denen jede Zahl geändert werden kann, Kurs, Gebühr,
Einsatz, Rundung, Back/Lay/Anteilspreis. Es rechnet sofort mit und zeigt jede
Formel. Was dort steht, ändert **kein Urteil** und landet in **keinem Verlauf**;
die Prüfung oben bleibt unberührt. Daneben ein Notizblock, der auf dem Gerät
erhalten bleibt.

## Was es tut

1. **Einfügen:** Im Panel auf einer Karte „Kopieren" drücken, den Bericht hier
   einfügen, die Prüfung startet von selbst.
2. **Aufteilen:** Der Bericht wird in alle Einzelteile zerlegt: Spiel, Bereich,
   Zuordnung, beide Seiten (Buch, Seite, Kurs, Gebühr, Effektivquote, Kursalter,
   Menge, Link), Rechnung, Zeiten, Absage-Bilanz.
3. **Nachrechnen:** Jede Zahl wird mit einer eigenständigen Zweitfassung der
   Formeln neu gerechnet, Schritt für Schritt, mit Formel, eingesetzten Zahlen
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
   Kalshi-Kennungen und Orbit-Marktnummern tragen keine Wörter, dort steht
   ehrlich „von außen nicht prüfbar". Beim Aktualitäts-Abruf nennt Polymarket
   zusätzlich die FRAGE des Marktes, den der Link öffnet, der schärfste Beleg.
6. **Einsatzrechner, „was setze ich wirklich?"** Der Bericht rechnet immer
   mit 100 als Grundeinsatz und mit Beträgen wie 49,71. Gesetzt wird aber
   mit echtem Geld und auf runde Summen, und **ab da zahlen die beiden
   Ausgänge nicht mehr gleich aus**. Der Rechner zeigt: Einsatz je Seite
   (frei wählbarer Gesamtbetrag, Rundung auf Cent/1/5/10), Auszahlung und
   Gewinn **je Ausgang getrennt**, den **garantierten** Gewinn (immer der
   schlechtere Ausgang, nie der bessere), die effektive Rendite nach
   Rundung und was die Rundung gekostet hat. Dazu die Kennzahlen eines
   Scanners: Marge des Marktes, implizite Wahrscheinlichkeiten je Seite,
   Kurspuffer. Warnt, wenn die Rundung die Arbitrage auffrisst oder der
   Einsatz über dem Höchstbetrag des Berichts liegt.
   *(Fachliche Arbeitsschritte wie bei professionellen Surebet-Rechnern, die Rechnung ist hier eigenständig umgesetzt und getestet.)*
7. **Warnzeichen:** Dinge, die rechnerisch stimmen und trotzdem gefährlich
   sind, mit den Erfahrungswerten der Panel-Messungen vom 13.08.2026:
   - Kurs länger als 15 Minuten unverändert (7 von 8 falschen Funden kamen
     von einem klebenden Kurs)
   - Buchprobe des Gegenbuchs unter 1,00 (Buch widerspricht sich selbst)
   - Rendite über ~4,4 % (alle als falsch erwiesenen Funde lagen über 4,48 %,
     alle richtigen zwischen 2,07 und 3,27 %)
   - wacklige Zuordnung, unbekannte Menge, fehlender Link, ungemessener
     Gebührensatz, Absage-Bilanz
   - erkennt außerdem, wenn eine Effektivquote der **alten** Polymarket-
     Gebührenformel `Satz × min(p, 1−p)` folgt statt der belegten
     `Satz × p × (1−p)`, und sagt das ausdrücklich.
6. **Aktualität:** Auf Klick (einmalig, kein Takt) beim Anbieter nachsehen,
   ob die Zahlen noch stimmen, und den Eintrag mit den aktuellen Zahlen neu
   rechnen. Gemessen am 17.08.2026: **Polymarket** antwortet dem Browser
   (Gamma-Katalog + CLOB-Orderbuch, Briefkurs `side=sell`); **Kalshi** und
   **Smarkets** blocken den Browser in der Regel (CORS), dann steht dort
   „nicht prüfbar" statt einer geratenen Zahl; **Betfair** kann nur die
   Bridge lesen, der Orbit-Link dient zum Selbstvergleich.
7. **Verlauf:** Jede Prüfung wird gespeichert. Ohne Anmeldung nur auf dem
   Gerät (localStorage, max. 50). Mit E-Mail + Passwort in Supabase, dann
   auf jedem Gerät abrufbar. Row Level Security: jeder sieht nur seine
   eigenen Zeilen.

## Dateien (Logik und Anzeige getrennt)

| Datei | Aufgabe |
|---|---|
| `js/rechnung.js` | eigenständige Zweitfassung der Formeln (kein Panel-Code) |
| `js/parser.js` | zerlegt den kopierten Bericht, rät nie |
| `js/linkpruefung.js` | Buch↔Adresse + Wortabgleich der Links, drei Zustände |
| `js/einsatz.js` | Einsatzrechner: Rundung, Gewinn je Ausgang, Marge, Puffer |
| `js/bewertung.js` | Ampel (lohnt es sich?) + Geldfluss mit Gebühren in Geld |
| `js/uebersicht.js` | die Übersicht ganz oben: vier Fragen + Geldtabelle |
| `js/paarung.js` | Alter, Anpfiffzeit, Liga, meinen beide dasselbe Spiel? |
| `js/herkunft.js` | Herkunftstabelle mit Quellen-Links + Paarungsvergleich |
| `js/werkstatt.js` | Rechen-Werkstatt zum Selbernachrechnen (ohne Rückwirkung) |
| `js/pruefer.js` | Nachrechnung, Querproben, Warnzeichen, Urteil |
| `js/aktualitaet.js` | einmaliger Anbieter-Abruf + Neuberechnung |
| `js/verlauf.js` | Anmeldung (Supabase auth/v1) + Ablage (rest/v1), localStorage-Rückfall |
| `js/oberflaeche.js` | zeichnet alles, rechnet nichts |
| `css/stil.css` | Design-Schicht: Navy/Cyan-Taktik-HUD, alle Farben als Tokens, löschbar |
| `js/schmuck.js` | Design-Schicht: nur die UTC-Uhr der Fußleiste, löschbar |
| `logo.svg` | Logo und Favicon (Delta im Taktik-Rahmen), löschbar |

## Rechnet es wirklich nach?, gemessen, nicht behauptet

`node pruefung/haertetest.js` verfälscht einen echten Bericht gezielt und
zählt, was gefangen wird. Stand 17.08.2026:

```
TREFFER:     13 von 13 Verfälschungen erkannt
FEHLALARME:  0 beim korrekten Bericht · 0 von 2 bei erlaubter Rundung
```

Gefangen werden u. a.: geschönte Rendite (auch nur um 0,09 Punkte),
gefälschte Kehrwertsumme, zu hohe Effektivquote, heimlich gesenkte Gebühr,
manipulierter Kurs oder Quote, 50/50-Aufteilung statt nach Effektivquote,
zu hohe Auszahlung, falscher Gewinn, Link auf eine fremde Partie, Link aufs
falsche Buch, alte Gebührenformel.

**Die Nachrechnung ist reine Mathematik im Browser, kein KI-Modell, kein
Raten, kein Zufall.** Dieselbe Eingabe ergibt immer dasselbe Urteil, und
jede Zahl steht sichtbar auf dem Rechenblatt.

### Was er NICHT sehen kann (ebenfalls gemessen)

1. **Halbzeit gegen ganzes Spiel.** Ist die Rechnung stimmig, aber die
   beiden Bücher meinen verschiedene Fragen, ist das aus dem Text allein
   nicht entscheidbar, der Bericht nennt beim Gegenbuch nur die Partie.
   Dagegen helfen: Link-Prüfung, Zuordnungswert, und beide Links öffnen.
2. **Ein durchgehend stimmig erfundener Kurs.** Passt alles zueinander,
   kann reines Nachrechnen es nicht widerlegen. Dagegen helfen: der
   Aktualitäts-Abruf beim Anbieter und die Warnzeichen (im Testfall schlug
   das Rendite-Band an: 3,60 % liegt über dem gemessenen 2,07–3,27 %).

## Wie es geprüft wurde

- `node pruefung/pruefstand.test.js`, **223 Prüfungen**, darunter für jede
  Schutzregel ein Test, der sie **auslöst**: eingebaute falsche Rendite,
  Effektivquote nach alter Formel, Selbstwiderspruch Formelzeile/Endwert,
  Kursalter, unstimmige Buchprobe, Lay-Seite, Euro-Umrechnung, fremde
  Partie im Link, falsches Buch in der Adresse, fehlender Link.
- Im Browser gegen einen Muster-Bericht im exakten Panel-Format verifiziert;
  Polymarket-Aktualität live gegen die echte Gamma/CLOB-Schnittstelle
  gemessen (17.08.2026).
- **Nicht geprüft:** Anmeldung mit echtem Konto (kein Testkonto angelegt);
  ob die Bestätigungs-E-Mail nötig ist, zeigt sich beim ersten Konto, beide Wege werden abgefangen.

## Datenbank

**Eigenes** Supabase-Projekt `orion-pruefstand` (`jjvceatwrzxycrzmowbt`), getrennt vom Panel-Projekt. Eine Tabelle `pruefstand_verlauf` (id, nutzer →
auth.users, titel, urteil, urteil_text, rendite, nummer, bericht, erstellt)
mit RLS auf `nutzer = auth.uid()`. Das Panel-Projekt wird von diesem
Programm weder gelesen noch geschrieben.
