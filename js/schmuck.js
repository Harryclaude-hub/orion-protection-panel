/* ORION PROTECTION PANEL — Schmuck (Design-Schicht, LÖSCHBAR)
 *
 * Einzige Aufgabe: die UTC-Uhr in der HUD-Fußleiste. Fällt diese Datei
 * weg, zeigt das Feld ein ruhiges „—" — es fehlt Schmuck, nie ein Wert
 * und nie eine Rechnung. Kein Zugriff auf Daten, Rechnung oder Ablage.
 * Takt: 1×/Sekunde ein Textknoten — auf jedem Laptop unmerklich.
 */
(function () {
  'use strict';
  var feld = document.getElementById('hud-uhr');
  if (!feld) return;
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    var d = new Date();
    var text = zwei(d.getUTCHours()) + ':' + zwei(d.getUTCMinutes()) + ':' + zwei(d.getUTCSeconds()) + ' Z';
    if (feld.textContent !== text) feld.textContent = text;
  }
  tick();
  setInterval(tick, 1000);
})();
