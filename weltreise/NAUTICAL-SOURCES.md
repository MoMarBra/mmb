# Seekarten in der Reiseansicht

Stand der Quellenprüfung: 16. Oktober 2026. Die Route stammt unverändert aus `ports.js`: 44 Anläufe, 43 unterschiedliche Häfen. Hamburg wird am Anfang und Ende angefahren.

## Darstellung

Der kleine Schalter „Seekarte“ wechselt ausschließlich die Kartenebene. Normalansicht und Seekartenmodus benutzen dieselbe Leaflet-Karte in EPSG:3857. Kartenmittelpunkt und Zoom werden beim Schalten nicht verändert. Hafenwahl, Kartenpunkte und „Zum Hafen“ zoomen ausdrücklich zum gewünschten Hafen. Die Zeitreise aktualisiert die geschätzte Schiffsposition und zurückgelegte Strecke, ohne den betrachteten Kartenausschnitt zu verschieben.

Die bestehende SVG-Weltkarte bleibt als Fallback erhalten, falls die geografische Karte nicht initialisiert werden kann. Kalender, Fahrplan, Zeitzonen, Geburtstags-/Feiertagsgestaltung und Schiffsmodell bleiben bestehen.

## Amtliche Quellen und Rechte

Jeder Eintrag in `nautical-data.js` enthält die konkrete Karte oder ENC, räumliche Abdeckung, Maßstab, Ausgabe/Berichtigungsstand und Primärquelle. Nicht verifizierte Angaben sind ausdrücklich als solche gekennzeichnet. Papierausgaben werden nicht als Aktualisierungsstand der ENC ausgegeben.

- Spanien: IHM ENC WMS `https://ideihm.covam.es/encwms`, Layer ENC. Nichtkommerzielle Wiederverwendung mit Quellenangabe. [Bedingungen](https://ideihm.covam.es/portal/en/licenses/). A Coruña, Las Palmas und Santa Cruz de Tenerife. Abdeckungsrahmen aus dem amtlichen WFS-Katalog.
- Portugal / Kap Verde / Madeira: IH ENC WMS `https://enc.hidrografico.pt/`, Layer ENC. CC BY-NC-SA 4.0. [Dokumentierte Web-Einbindung](https://faq.hidrografico.pt/books/hidrografico/page/wms-enc-en). Mindelo, Praia, Funchal und Lissabon. Auf die tatsächlich geprüften Hafenfenster begrenzt; diese Grenzen sind keine behaupteten vollständigen ENC-Zellgrenzen.
- LINZ: Aitutaki (CK142, 1:60.000; Arutanga-Detail ab Zoom 15, 1:15.000) und Nuku’alofa (TO504, 1:10.000), Originalausgaben Januar 2022, CC BY 4.0. Gedruckte Gradnetzlinien wurden als Kontrollpunkte verwendet; die Ausschnitte wurden nach EPSG:3857 umgerechnet und gegen die amtlichen LDS-Extents sowie die amtliche Küsten-/Hafendarstellung geprüft. Details und Registrierungsresiduen in `assets/charts/georeferencing.json`. Es handelt sich um registrierte Ableitungen, nicht um amtlich gelieferte GeoTIFFs. Quelle: https://charts.linz.govt.nz/. Kleine Vorschauen bei weitem Zoom reduzieren den Bildspeicherbedarf auf Mobilgeräten; im Nahzoom werden die hochaufgelösten Originalableitungen geladen. Keine laufenden NtM-Berichtigungen.
- Weitere Herausgeber: BSH, SHOM, SANHO, INAHINA, MHS/INHO, CHM, SHN, SOHMA, SHOA, UKHO und AHO. Wo kein offenes Web-Nutzungsrecht verifiziert ist, werden nur Quellen und konkrete Bezugs-/Lizenzwege verlinkt. Es wurden keine Lizenzen gekauft, keine Konten eingerichtet und keine geschützten Portal-Tokens übernommen.
- Brasilien: freie nichtkommerzielle BSB-Dateien grundsätzlich vorhanden, Downloads bei der Prüfung jedoch HTTP 502. Zugriffsbeschränkte Dienste wurden nicht umgangen. GeoTIFF ist ausdrücklich für akademische Zwecke angeboten und wurde nicht ungeprüft übernommen. Boca da Valéria: 4025 ist ein gestützter Kandidat, aber die genaue Abdeckung bleibt ungeklärt; keine vorgetäuschte Zuordnung.

## Normale Orientierungskarte

Weltübersicht: lokal gespeicherte Natural-Earth-Geometrie. Ab Zoom 7: OpenStreetMap-Standardkacheln, ausdrücklich als Orientierung und nicht als Seekarte bezeichnet. Sichtbare Attribution, HTTPS, gültiger Referrer und normales Browser-Caching. Keine Offline-/Massendownloads, keine Vorabrufe ganzer Gebiete. [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).

Amtliche WMS werden erst nach bewusstem Aktivieren von „Seekarte“ und bei Hafenzoom geladen. Fehlende Rechte, außerhalb des geprüften Ausschnitts liegende Positionen und Ladefehler werden sichtbar bezeichnet. Fehler einzelner Kacheln dürfen nicht durch eine spätere erfolgreiche Kachel als vollständig behoben ausgegeben werden.

## Grenzen

Nur Reiseinformation, nicht Navigation. Die Route und Hafenmarkierungen sind Näherungen; keine Live-AIS-Position und kein bestätigter Liegeplatz. Laufende amtliche Berichtigungen und ECDIS-Konformität werden nicht zugesichert. Eine amtliche Originalquelle allein macht diese Webdarstellung nicht zu einem zugelassenen Navigationssystem.

Der bisherige Zugriff bleibt unverändert: öffentlich erreichbar mit noindex, kein Zugriffsschutz. Es wurden keine ACLs oder Veröffentlichungsziele geändert.
