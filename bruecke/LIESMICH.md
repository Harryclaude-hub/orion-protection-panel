# Die eigene Betfair-Bruecke

Betfair ist der einzige Anbieter, den weder der Browser noch ein Server
erreicht: es blockt Rechenzentren (Cloudflare) und verlangt eine
Anmeldung. Nur ein Programm auf deinem Laptop kommt heran. Genau das ist
diese Bruecke.

## Was sie tut und was nicht

**Sie tut:** auf Anfrage EINEN Betfair-Markt nachschlagen und Kurs,
Kommissionssatz, Menge, Anpfiff und Wettbewerb zurueckgeben.

**Sie tut nicht:**

- keine Wette, kein Geld. Erlaubt sind nur `listMarketBook` und
  `listMarketCatalogue`, beides reine Leseverfahren. Der Code weist alles
  andere ab.
- kein Takt. Sie fragt nur, wenn du im Protection Panel auf den Knopf
  drueckst.
- sie fasst die **Panel-Bruecke nicht an**. Eigener Ordner, eigene
  Zugangsdatei, eigener Port (8791), eigener Name. Beide koennen
  gleichzeitig laufen, ohne voneinander zu wissen.
- sie nimmt nur Anfragen von deinem eigenen Rechner an.

## Einrichten

Lege neben `bruecke.js` eine Datei `bruecke-zugang.json` an:

```json
{
  "appKey": "DEIN_BETFAIR_APP_KEY",
  "benutzer": "dein-betfair-benutzername",
  "passwort": "dein-betfair-passwort"
}
```

**Diese Datei fuellst du selbst aus.** Sie steht in `.gitignore` und wird
nie hochgeladen. Ich trage dort grundsaetzlich nichts ein, auch nicht
wenn du mir die Daten gibst: Passwoerter gehoeren nicht durch einen
Chatverlauf.

Den App-Key hast du bereits fuer die Panel-Bruecke. Derselbe Key
funktioniert auch hier, du musst keinen neuen beantragen.

## Starten

```bash
node bruecke.js
```

Sie meldet dann, ob sie die Zugangsdaten gefunden hat. Laeuft sie, prueft
das Protection Panel auch die Betfair-Seite selbst, statt dem Bericht zu
glauben. Laeuft sie nicht, steht dort weiterhin ehrlich "nicht pruefbar".
Es geht nichts kaputt.

## Was NICHT getestet ist

Ich habe die Bruecke **ohne echte Anmeldung** gebaut, weil ich keine
Zugangsdaten habe und auch keine eintragen wuerde. Geprueft ist:

- das Programm startet, antwortet auf Anfragen und meldet fehlende
  Zugangsdaten sauber
- es weist alles ausser den beiden Leseverfahren ab
- es nimmt nur Anfragen vom eigenen Rechner an

**Nicht geprueft ist der Weg mit echter Anmeldung.** Der erste Lauf mit
deinen Daten ist der eigentliche Test. Wenn dabei etwas klemmt, sag mir
die Fehlermeldung, dann ziehe ich nach.

Beim ersten Start kann Windows nach einer Freigabe fuer Node fragen. Da
die Bruecke nur auf 127.0.0.1 hoert, reicht "privates Netzwerk", oder du
kannst auch ablehnen: sie ist trotzdem vom eigenen Rechner erreichbar.
