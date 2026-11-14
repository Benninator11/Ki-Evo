# Plattformer-KI – Evolution im Level

> **Kurzbeschreibung:** Ki-Evo ist ein browserbasiertes KI-Experiment: Agenten lernen, ein selbst gestaltetes Plattform-Level zu bewältigen. Neuronale Netze steuern die Agenten; ein genetischer Algorithmus entwickelt sie über Generationen weiter.

Ein browserbasiertes Experiment, bei dem eine Population kleiner KI-Agenten lernt, ein selbst gestaltetes Plattform-Level zu durchqueren. Ein neuronales Netz entscheidet über Bewegung und Springen; ein genetischer Algorithmus entwickelt die Netze über Generationen weiter.

## Funktionen
- Level-Editor für Plattformen, Wände, Spezialblöcke und Gefahren.
- Start- und Zielposition direkt im Level festlegen.
- Physik mit Kollisionen, Schwerkraft, Sprüngen und unterschiedlichen Oberflächen.
- Mehrere Agenten gleichzeitig simulieren und ihre Entwicklung beobachten.
- Evolution mit Turnierselektion, uniformem Crossover, Mutation und Elitismus.
- Populationsgröße, Mutationsrate, Simulationsgeschwindigkeit und Zeitlimit einstellen.
- Statistiken und Fitness-Verlauf anzeigen.
- Level und trainierte KI als JSON exportieren und importieren.
- Level und beste KI zusätzlich lokal im Browser speichern.

## Schnellstart
Es ist keine Installation zusätzlicher Pakete vorgesehen.
1. Repository herunterladen oder klonen.
2. `index.html` in einem aktuellen Browser öffnen.
3. Im Editor Startpunkt und Ziel setzen.
4. Ein Level bauen oder das Beispiel-Level laden.
5. Im Bereich **Training** auf **Start** klicken.

Falls der Browser lokale Dateien einschränkt, kann das Projekt über einen lokalen statischen Webserver geöffnet werden.

## Bedienung
### Level erstellen
- Eine Kachel aus der Block-Palette auswählen und anschließend im Spielfeld platzieren oder per Drag-and-drop hineinziehen.
- Einen vorhandenen Block anklicken, um Typ, Größe, Farbe und Kollisionsverhalten zu bearbeiten.
- Die Ecke unten rechts eines Blocks dient zum Ändern seiner Größe.
- Mit Entf, Rechtsklick oder **Block löschen** kann ein ausgewählter Block entfernt werden.
- **Start setzen** und **Ziel setzen** aktivieren den jeweiligen Platzierungsmodus.
- Das Raster-Snapping kann ein- oder ausgeschaltet werden.

### Training
- **Population:** Anzahl der Agenten pro Generation.
- **Mutation-Rate:** Wahrscheinlichkeit, mit der einzelne Genomwerte verändert werden.
- **Geschwindigkeit:** Simulationsgeschwindigkeit.
- **Max. Zeit pro Generation:** Zeitlimit für einen Trainingsdurchlauf.
- **Start/Pause/Weiter:** Training starten oder pausieren.
- **Nächste Generation:** Eine Generation manuell abschließen.
- **Reset:** Training und die lokal gespeicherte KI zurücksetzen.

Eine Generation endet, wenn keine Agenten mehr aktiv sind oder das Zeitlimit erreicht wurde. Die Fitness bewertet den erreichten Fortschritt in Richtung Ziel; das Erreichen des Ziels gibt einen großen Zusatzbonus.

## Projektstruktur
```text
.
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── engine.js
│   ├── nn.js
│   ├── ai.js
│   ├── level.js
│   └── main.js
└── beispielbilder/
    └── *.jpg
```

Die JavaScript-Dateien werden in der Reihenfolge eingebunden, die in `index.html` festgelegt ist:
- **engine.js** – Spielwelt, Blocktypen, Physik, Agenten, Fitness und Canvas-Rendering.
- **nn.js** – neuronales Netz und reproduzierbarer Zufallszahlengenerator.
- **ai.js** – genetischer Algorithmus mit Selektion, Crossover, Mutation und Elitismus.
- **level.js** – Level-Datenmodell und Editor-Funktionen.
- **main.js** – Benutzeroberfläche, Trainingsablauf, Statistiken sowie Import und Export.

## KI-Architektur
Das neuronale Netz besitzt die Schichten **6 → 12 → 8 → 2**.

Die sechs Eingaben beschreiben normierte Position, Geschwindigkeit, Entfernung zum Ziel und Bodenkontakt. Die zwei Ausgaben steuern horizontale Bewegung und Springen.

Die Evolution verwendet Turnierselektion, uniformes Crossover, gaußsche Mutation und Elitismus.

## Speichern und Exportieren
- **Level:** exportiert das aktuelle Level als `level.json`.
- **KI:** exportiert die bisher beste trainierte KI als `ki.json`.
- **Level + KI:** exportiert beides gemeinsam, sofern eine trainierte KI vorhanden ist.
- JSON-Dateien können über die Import-Schaltflächen wieder geladen werden.

Die automatische Speicherung verwendet `localStorage` und ist browser- und gerätebezogen. Sie ersetzt keinen Export als Datei.

## Voraussetzungen
- Aktueller Browser mit JavaScript- und Canvas-Unterstützung.
- Keine externe KI-API und keine zusätzlichen JavaScript-Pakete erforderlich.

## Lizenz
Eine Lizenz ist in diesem Repository derzeit nicht angegeben. Vor Weiterverwendung oder Weiterverteilung sollte eine passende Lizenz ergänzt werden.