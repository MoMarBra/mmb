# BBE GTA: Git-Versionierung

## Quelle und aktueller Referenzstand

Das Spiel liegt im Unterordner `gta/` des Repositories
[MoMarBra/mmb](https://github.com/MoMarBra/mmb/tree/main/gta).
Es ist bereits in Git versioniert. Nicht erneut initialisieren, keine Historie
ersetzen und kein zweites Repository als konkurrierende Quelle anlegen.

Am 17.11.2026 geprüft:
- Ausgangscommit: `7bb4eb5c87aa825d831f61f164e5b38091019b88`.
- Benannter Referenzbranch: `gta/baseline-2026-11-17`, unverändert auf diesem Commit.
- GitHub Pages nutzt den bestehenden Veröffentlichungsweg; Spielpfad:
  `https://www.brandauer.group/gta/`.
- Das Repository ist öffentlich. `noindex` verhindert keinen Zugriff und ist
  keine Zugriffskontrolle. Keine Geheimnisse oder privaten Arbeitsdateien einchecken.
- Diese Dokumentation ändert keine Spielbytes und veröffentlicht keine neue Spielversion.

## Historie richtig lesen

| Stand | Commit | Änderung |
| --- | --- | --- |
| 2.8.0 | `c70b5a4` | Aufgabenführung und Türübergänge |
| nach 2.8.0 | `1d5d7b3` | Dialogaufnahmen und synchronisierte Wiedergabe |
| nach 2.8.0 | `9704bed` | Mobile Joystick- und Touchsteuerung |
| Referenz 2026-11-17 | `7bb4eb5` | Browser- und Home-Screen-Icons |

`release.json` beschreibt noch die historische 2.8.0-Abnahme vom 03.10.2026.
Sie ist **keine vollständige Versionsbeschreibung des heutigen main**.
Ihr `sourceCommit` gehört zum damaligen Herkunftsnachweis und darf nicht ohne
entsprechende erneute Prüfung als aktueller Testnachweis umgeschrieben werden.
Die späteren Commits bleiben eigenständige, nachvollziehbare Änderungen.

## Künftiger Ablauf

1. `main` aktualisieren; pro Änderung einen Branch wie `feat/gta-...` oder
   `fix/gta-...` erstellen. Keine Änderungen anderer Projekte mitmischen.
2. Kleine, beschreibende Commits erstellen. Niemals Force-Push auf main oder
   den Referenzbranch.
3. Aus `gta/` ausführen:
   ```sh
   npm run test:voices
   npm run test:assets
   npm run test:mobile
   ```
   Zusätzlich `git diff --check` und die zum Verhalten passenden Browserprüfungen.
4. Änderungen als Pull Request prüfen. Merge und Pages-Veröffentlichung sind
   getrennte Schritte; den vorhandenen Veröffentlichungsweg beibehalten.
5. Bei der nächsten tatsächlich abgenommenen Spielversion eine neue,
   konsistente Versionsnummer und einen projektspezifischen Tag
   `gta/vX.Y.Z` verwenden. Nicht rückwirkend den aktuellen Stand als
   vollständig visuell geprüfte Veröffentlichung ausgeben.
6. Nach Veröffentlichung exakten Remote-Commit, Pages-Ergebnis und ausgelieferte
   Dateien prüfen. Rücknahmen als Revert-Commit durchführen, nicht durch
   Umschreiben der gemeinsamen Historie.

Der Referenzbranch ist kein geschützter oder unveränderlicher Tag. Er dient
als klar benannter Ausgangspunkt; seine SHA oben ist die feste Referenz.

## Prüfungen am 17.11.2026

Am unveränderten Ausgangscommit bestanden:
- Voice-Regressionen: 1.235 Assertions.
- Asset-Prüfung: 1.430 Assertions, 140 Laufzeit-Audiodateien.
- Mobile-Steuerung: 14 Tests.

Dies sind automatisierte, überwiegend isolierte Tests. Kein neuer vollständiger
Browser-/Hörtest, keine neue Deployment-Abnahme und keine Produktionsfreigabe.
