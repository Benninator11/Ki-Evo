# Ki-Evo – Plattform-KI lernt durch Evolution

Ki-Evo ist ein browserbasiertes Neuroevolution-Experiment. Du baust eigene Plattform-Level und beobachtest, wie eine Population von Agenten mithilfe eines neuronalen Netzes und eines genetischen Algorithmus lernt, das Ziel zu erreichen.

![Ki-Evo – Beispielszene mit mehreren Agenten](docs/ki-evo-preview.jpg)

**[Live-Demo öffnen](https://benninator11.github.io/Ki-Evo/)** · [Quellcode](https://github.com/Benninator11/Ki-Evo)

> Die Live-Demo wird über GitHub Actions veröffentlicht. Nach dem ersten Einrichten von Pages kann es einen Moment dauern, bis die Seite erreichbar ist.

## Funktionen

- **Live-Level-Editor:** Plattformen, Wände, Spezialblöcke und Gefahren auch während des Trainings platzieren, auswählen, verschieben, skalieren und löschen – ohne Generations-Neustart.
- **Drei Start-Level:** „Einfacher Sprung“, „Abgründe“ und „Hindernisparcours“ als auswählbare Vorlagen.
- **18 Raycast-Sensoren + semantische Blockerkennung:** Die Agenten erfassen Hindernisse, Gefahren und Bodenabdeckung. Zusätzlich erkennt das Netz den konkreten Blocktyp vor dem Agenten – z. B. Steinwand, Eis, Trampolin, Plattform, Lava, Wasser, Säge oder Laser – und erhält dessen Entfernung als eigene Eingaben. Die Sichtstrahlen des aktuell besten Agenten können direkt im Level angezeigt werden.
- **Neuronales Netz:** Live-Visualisierung der Schichten `14 → 12 → 8 → 2`. Aktivierte positive Beiträge werden grün, negative rot dargestellt.
- **Genetischer Algorithmus:** Turnierselektion, uniformes Crossover, Gauß-Mutation und Elitismus.
- **Fitness-Funktion:** Fortschritt zum Ziel, Erkundung neuer Bereiche, Stillstandsstrafe und Zielbonus.
- **Umweg-Hilfe:** Bei hohen Wänden auf der direkten Route suchen Agenten erst einen Rückweg bzw. Abstieg, statt dauerhaft gegen die Wand zu springen.
- **Neue Spezialblöcke:** Super-Trampolin, Turbo-Bänder in beide Richtungen und Klebeschleim.
- **Neue Gefahren:** Feuer, Stromfelder, Säure und Laser-Barrieren.
- **Training:** Populationsgröße, Mutationsrate, Simulationsgeschwindigkeit und Zeitlimit einstellen.
- **Statistiken:** Generation, aktive Population, beste Fitness, Rekord, Zielerreichung und Fitness-Verlauf.
- **Import / Export:** Level und trainierte KI als JSON speichern und wieder laden.
- **Lokale Speicherung:** Level und beste KI werden zusätzlich im Browser gespeichert.
- **Keine Backend- oder KI-API erforderlich.**

## Schnellstart

Ki-Evo verwendet native JavaScript-ES-Module. Öffne die Seite deshalb über einen lokalen Webserver und nicht per `file://`.

### Mit Python

```bash
python3 -m http.server 8000
```

Danach im Browser `http://localhost:8000` öffnen.

### Mit Node.js

```bash
npx serve .
```

Oder du verwendest direkt die [GitHub-Pages-Demo](https://benninator11.github.io/Ki-Evo/).

## Bedienung

### Level erstellen

- Einen Block aus der Palette in das Spielfeld ziehen oder anklicken und im Spielfeld platzieren.
- Vorhandene Blöcke anklicken, um Typ, Größe, Farbe und Kollisionsverhalten zu ändern.
- Die Ecke unten rechts eines ausgewählten Blocks dient zum Skalieren.
- Mit **Entf**, Rechtsklick oder **Block löschen** den ausgewählten Block entfernen.
- Während des Trainings bleiben Palette und Block-Menü aktiv. Änderungen gelten sofort für alle laufenden Agenten; Agenten in neu gesetzten festen Blöcken werden sicher herausgeschoben, Agenten in neuen Gefahren scheiden sofort aus.
- **Start setzen** und **Ziel setzen** aktivieren den jeweiligen Platzierungsmodus.
- Unter **Beispiel-Level** eine der drei Vorlagen auswählen und mit **Beispiel-Level laden** übernehmen.

### Training

1. Ein Level laden oder Start, Ziel und Hindernisse selbst platzieren.
2. Population, Mutationsrate, Geschwindigkeit und Zeitlimit einstellen.
3. **Start** drücken und die Agenten beobachten.
4. Über **Raycasts im Level anzeigen** die Sichtstrahlen des aktuell besten Agenten ein- oder ausblenden.
5. Im Netzwerkdiagramm verfolgen, welche Neuronen und Verbindungen gerade aktiv sind.

Eine Generation endet, wenn keine Agenten mehr aktiv sind oder das Zeitlimit erreicht wurde. Die Evolution übernimmt die besten Genome in die nächste Generation.

## KI-Architektur

Das neuronale Netz hat die Schichten **14 → 12 → 8 → 2**.

Das neuronale Netz nutzt die Architektur **65 → 12 → 8 → 2**. Die Eingaben enthalten sechs Bewegungs-/Positionswerte, 18 Raycast-Werte, vier Ziel-/Gefahrenwerte, einen One-hot-Vektor für alle 36 Blocktypen sowie die Entfernung zum nächsten erkannten Block vor dem Agenten. Die Ausgaben steuern horizontale Bewegung und Springen. Ältere KI-Dateien mit 6, 14 oder 28 Eingaben werden beim Import automatisch auf das neue Format migriert.

Die Fitness berücksichtigt den erreichten Fortschritt zum Ziel, neu erkundete Bereiche, eine Strafe für längeren Stillstand und einen hohen Bonus für das Erreichen des Ziels.

### Kompatibilität älterer KI-Dateien

KI-Dateien aus der vorherigen Architektur `6 → 12 → 8 → 2` können weiterhin importiert werden. Die bisherigen Gewichte bleiben erhalten; die zusätzlichen Raycast-Eingänge werden beim Laden neutral initialisiert.

## Projektstruktur

```text
.
├── index.html
├── README.md
├── LICENSE
├── package.json
├── css/
│   └── style.css
├── docs/
│   └── ki-evo-preview.jpg
├── js/
│   ├── engine.js
│   ├── nn.js
│   ├── ai.js
│   ├── level.js
│   └── main.js
├── tests/
│   └── smoke-test.js
└── .github/
    └── workflows/
        └── pages.yml
```

Alle JavaScript-Dateien nutzen ES-Module (`import` / `export`); `main.js` ist der Einstiegspunkt.

## Tests

Für die grundlegenden Funktionstests wird Node.js benötigt:

```bash
npm run check
```

Die Tests prüfen unter anderem die Netzwerkgröße, semantische Blockerkennung, Sensorwerte und Raycasts, alle Level-Vorlagen, den Import alter Genome, den genetischen Algorithmus und einen Physikschritt.

## GitHub Pages

Der Workflow in `.github/workflows/pages.yml` veröffentlicht den Inhalt des Repositorys automatisch bei Pushes auf `main`. Einmalig muss unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** ausgewählt werden. Danach wird die Seite automatisch aktualisiert.

## Repository-Metadaten

Empfohlene GitHub-Beschreibung:

> Browserbasiertes Neuroevolution-Spiel: Level-Editor, Raycast-Sensoren und neuronale Netze lernen per genetischem Algorithmus.

Empfohlene Topics: `genetic-algorithm`, `neural-network`, `javascript`, `canvas`, `neuroevolution`.

## Lizenz

Dieses Projekt steht unter der **MIT-Lizenz**. Siehe [LICENSE](LICENSE).
