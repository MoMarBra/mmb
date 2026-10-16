// Official-source catalogue checked 2026-10-16. No commercial chart content copied.
export const chartKey=id=>id.startsWith('hamburg')?'hamburg':id;
export const chartCatalog = {
  "a-coruna": {
    "number": "ES504126",
    "coverage": "ES504126: Puerto de La Coruña; ENC-Rahmen aus amtlichem WFS.",
    "scale": "ES504126: 1:8.000",
    "edition": "ES504126: Ausgabe 7 · Mayo 2023",
    "provider": "Instituto Hidrográfico de la Marina (Spain)",
    "source": "https://ideihm.covam.es/wfs/catalogoENC?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:Portulanos.5&OUTPUTFORMAT=geojson",
    "license": "Nichtkommerzielle Einbindung mit Quellenangabe erlaubt. © Instituto Hidrográfico de la Marina. Keine behördliche Empfehlung. Nicht zur Navigation.",
    "licenseUrl": "https://ideihm.covam.es/portal/en/licenses/",
    "purchaseUrl": null,
    "extraSources": [
      "https://ideihm.covam.es/wfs/catalogoENC?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:Portulanos.5&OUTPUTFORMAT=geojson"
    ],
    "layer": {
      "type": "wms",
      "url": "https://ideihm.covam.es/encwms",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -8.417,
        43.3375,
        -8.3275,
        43.4331
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico de la Marina",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "las-palmas": {
    "number": "ES506100",
    "coverage": "ES506100: Puerto de Las Palmas; ENC-Rahmen aus amtlichem WFS.",
    "scale": "ES506100: 1:12.000",
    "edition": "ES506100: Ausgabe 7 · Mayo 2024",
    "provider": "Instituto Hidrográfico de la Marina (Spain)",
    "source": "https://ideihm.covam.es/wfs/catalogoENC?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:Portulanos.5&OUTPUTFORMAT=geojson",
    "license": "Nichtkommerzielle Einbindung mit Quellenangabe erlaubt. © Instituto Hidrográfico de la Marina. Keine behördliche Empfehlung. Nicht zur Navigation.",
    "licenseUrl": "https://ideihm.covam.es/portal/en/licenses/",
    "purchaseUrl": null,
    "extraSources": [
      "https://ideihm.covam.es/wfs/catalogoENC?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:Portulanos.5&OUTPUTFORMAT=geojson"
    ],
    "layer": {
      "type": "wms",
      "url": "https://ideihm.covam.es/encwms",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -15.46,
        28.0817,
        -15.3684,
        28.2
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico de la Marina",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "tenerife": {
    "number": "ES506120",
    "coverage": "ES506120: Puerto de Santa Cruz de Tenerife; ENC-Rahmen aus amtlichem WFS.",
    "scale": "ES506120: 1:12.000",
    "edition": "ES506120: Ausgabe 6 · Agosto 2020",
    "provider": "Instituto Hidrográfico de la Marina (Spain)",
    "source": "https://ideihm.covam.es/wfs/catalogoENC?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:Portulanos.5&OUTPUTFORMAT=geojson",
    "license": "Nichtkommerzielle Einbindung mit Quellenangabe erlaubt. © Instituto Hidrográfico de la Marina. Keine behördliche Empfehlung. Nicht zur Navigation.",
    "licenseUrl": "https://ideihm.covam.es/portal/en/licenses/",
    "purchaseUrl": null,
    "extraSources": [
      "https://ideihm.covam.es/wfs/catalogoENC?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:Portulanos.5&OUTPUTFORMAT=geojson"
    ],
    "layer": {
      "type": "wms",
      "url": "https://ideihm.covam.es/encwms",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -16.273,
        28.4285,
        -16.142,
        28.5055
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico de la Marina",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "mindelo": {
    "number": "PT568502 · 66402 / INT 1965",
    "coverage": "PT568502: Ilha de São Vicente - Porto Grande; 66402 / INT 1965: Aproximações ao Mindelo; Einbindung auf den geprüften Hafenausschnitt begrenzt, keine Behauptung über die komplette Zellgrenze.",
    "scale": "PT568502: Maßstab nicht verifiziert; 66402 / INT 1965: 1:40.000; Porto Grande (Ilha de São Vicente): 1:10.000",
    "edition": "PT568502: Ausgabe / laufende Berichtigungen nicht verifiziert; 66402 / INT 1965: Papierkarte · Ausgabe 2 · 2019-07; ENC-Ausgabe und laufende Berichtigungen: vom Dienst bereitgestellt, nicht separat verifiziert.",
    "provider": "Instituto Hidrográfico (Portugal)",
    "source": "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
    "license": "CC BY-NC-SA 4.0: nichtkommerzielle Nutzung mit Namensnennung, Bearbeitungen unter derselben Lizenz. Amtliche Web-Einbindung dokumentiert. Nicht zur Navigation.",
    "licenseUrl": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "purchaseUrl": null,
    "extraSources": [
      "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
      "https://faq.hidrografico.pt/books/hidrografico/page/wms-enc-en"
    ],
    "layer": {
      "type": "wms",
      "url": "https://enc.hidrografico.pt/",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -25.054407340626575,
        16.84171771177402,
        -24.95559265937343,
        16.936270444546597
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico · CC BY-NC-SA 4.0",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "praia": {
    "number": "PT568501 · 66401 / INT 1964",
    "coverage": "PT568501: Ilha de Santiago - Porto da Praia; 66401 / INT 1964: Aproximações ao Porto da Praia; Einbindung auf den geprüften Hafenausschnitt begrenzt, keine Behauptung über die komplette Zellgrenze.",
    "scale": "PT568501: Maßstab nicht verifiziert; 66401 / INT 1964: 1:40.000; Porto da Praia (Ilha de Santiago): 1:7.500",
    "edition": "PT568501: Ausgabe / laufende Berichtigungen nicht verifiziert; 66401 / INT 1964: Papierkarte · Ausgabe 1 · 2017-11; ENC-Ausgabe und laufende Berichtigungen: vom Dienst bereitgestellt, nicht separat verifiziert.",
    "provider": "Instituto Hidrográfico (Portugal)",
    "source": "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
    "license": "CC BY-NC-SA 4.0: nichtkommerzielle Nutzung mit Namensnennung, Bearbeitungen unter derselben Lizenz. Amtliche Web-Einbindung dokumentiert. Nicht zur Navigation.",
    "licenseUrl": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "purchaseUrl": null,
    "extraSources": [
      "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
      "https://faq.hidrografico.pt/books/hidrografico/page/wms-enc-en"
    ],
    "layer": {
      "type": "wms",
      "url": "https://enc.hidrografico.pt/",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -23.553407340626578,
        14.864251297566902,
        -23.45459265937343,
        14.959738107911988
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico · CC BY-NC-SA 4.0",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "funchal": {
    "number": "PT538506 · 36402 / INT 1920",
    "coverage": "PT538506: Ilha da Madeira - Porto do Funchal; 36402 / INT 1920: Ponta Gorda à Ponta de São Lourenço; Einbindung auf den geprüften Hafenausschnitt begrenzt, keine Behauptung über die komplette Zellgrenze.",
    "scale": "PT538506: Maßstab nicht verifiziert; 36402 / INT 1920: 1:30.000; Porto do Funchal: 1:10.000",
    "edition": "PT538506: Ausgabe / laufende Berichtigungen nicht verifiziert; 36402 / INT 1920: Papierkarte · Ausgabe 2 · 2007-10; ENC-Ausgabe und laufende Berichtigungen: vom Dienst bereitgestellt, nicht separat verifiziert.",
    "provider": "Instituto Hidrográfico (Portugal)",
    "source": "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
    "license": "CC BY-NC-SA 4.0: nichtkommerzielle Nutzung mit Namensnennung, Bearbeitungen unter derselben Lizenz. Amtliche Web-Einbindung dokumentiert. Nicht zur Navigation.",
    "licenseUrl": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "purchaseUrl": null,
    "extraSources": [
      "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
      "https://faq.hidrografico.pt/books/hidrografico/page/wms-enc-en"
    ],
    "layer": {
      "type": "wms",
      "url": "https://enc.hidrografico.pt/",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -16.95840734062657,
        32.59938605325185,
        -16.859592659373426,
        32.68259459606501
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico · CC BY-NC-SA 4.0",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "lisbon": {
    "number": "PT526304 · PT526306 · 26306 / INT 1878",
    "coverage": "PT526304: Porto de Lisboa (Ribeira do Jamor ao Terreiro do Trigo); PT526306: Porto de Lisboa (Santa Apolónia a Sacavém); 26306 / INT 1878: Porto de Lisboa (do Cais do Sodré a Sacavém); Einbindung auf den geprüften Hafenausschnitt begrenzt, keine Behauptung über die komplette Zellgrenze.",
    "scale": "PT526304: Maßstab nicht verifiziert; PT526306: Maßstab nicht verifiziert; 26306 / INT 1878: 1:15.000",
    "edition": "PT526304: Ausgabe / laufende Berichtigungen nicht verifiziert; PT526306: Ausgabe / laufende Berichtigungen nicht verifiziert; 26306 / INT 1878: Papierkarte · Ausgabe 5 · 2008-12; ENC-Ausgabe und laufende Berichtigungen: vom Dienst bereitgestellt, nicht separat verifiziert.",
    "provider": "Instituto Hidrográfico (Portugal)",
    "source": "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
    "license": "CC BY-NC-SA 4.0: nichtkommerzielle Nutzung mit Namensnennung, Bearbeitungen unter derselben Lizenz. Amtliche Web-Einbindung dokumentiert. Nicht zur Navigation.",
    "licenseUrl": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "purchaseUrl": null,
    "extraSources": [
      "https://loja.hidrografico.pt/ln/web/wp-content/uploads/2025/10/20251031_HI_Catlogo_de_Cartas_outubro_V1-022026-2025.pdf",
      "https://faq.hidrografico.pt/books/hidrografico/page/wms-enc-en"
    ],
    "layer": {
      "type": "wms",
      "url": "https://enc.hidrografico.pt/",
      "layers": "ENC",
      "version": "1.3.0",
      "bounds": [
        -9.169407340626572,
        38.67443762435922,
        -9.070592659373425,
        38.7515415840825
      ],
      "params": {
        "CSVALUE": ",,,,,3",
        "CSBOOL": "2183"
      }
    },
    "attribution": "© Instituto Hidrográfico · CC BY-NC-SA 4.0",
    "description": "Amtliche ENC-Darstellung direkt als lagegerechte Ebene in der Reisekarte. Der amtliche Dienst wählt die zum Zoom passenden Zellen und Details."
  },
  "hamburg": {
    "number": "DE48 / INT 1455",
    "coverage": "DE48 / INT 1455: River Elbe, Lühesand to Hamburg",
    "scale": "DE48 / INT 1455: 1:30.000; A Lühesand to Teufelsbrück: 1:30.000; B Hamburg: 1:12.500",
    "edition": "DE48 / INT 1455: Papierkarte · 2025-03",
    "provider": "Bundesamt für Seeschifffahrt und Hydrographie; UKHO for cooperation paper chart",
    "source": "https://msi.admiralty.co.uk/NoticesToMariners/DownloadFile?batchId=cee78f4e-dbdc-4ccc-8403-c1a7af2c2f12&fileName=12wknm25.pdf&frequency=Weekly&mimeType=application%2Fpdf",
    "license": "Keine offene Einbindungserlaubnis verifiziert. Der BSH-ENC-Dienst verlangt Anmeldung. Papierkarte über amtliche Vertriebsstellen; Website-Nutzungsrecht gesondert klären.",
    "licenseUrl": "https://nokis.mdi-de-dienste.org/trefferanzeige?docuuid=eff14f06-e508-4dc9-84e4-078d865f3ae0",
    "purchaseUrl": "https://www.geoseaportal.de/",
    "extraSources": [
      "https://msi.admiralty.co.uk/NoticesToMariners/DownloadFile?batchId=cee78f4e-dbdc-4ccc-8403-c1a7af2c2f12&fileName=12wknm25.pdf&frequency=Weekly&mimeType=application%2Fpdf"
    ]
  },
  "port-louis": {
    "number": "2514 / INT 7739 · IN62514P · IN52514A",
    "coverage": "2514 / INT 7739: Approaches to Port Louis / Port Louis; IN62514P: Port Louis; IN52514A: Approaches to Port Louis",
    "scale": "2514 / INT 7739: 1:37.500; Port Louis: 1:12.500; IN62514P: 1:12.500; IN52514A: 1:37.500",
    "edition": "2514 / INT 7739: Papierkarte · 2018-10-15; IN62514P: Ausgabe / laufende Berichtigungen nicht verifiziert; IN52514A: Ausgabe / laufende Berichtigungen nicht verifiziert",
    "provider": "Mauritius Hydrographic Service / Indian National Hydrographic Office",
    "source": "https://www.hydrobharat.gov.in/documents/d/guest/catalogue-inm-06_2026",
    "license": "Keine offene Einbindungslizenz verifiziert. Originalkarte über Mauritius Hydrographic Service / Indian Naval Hydrographic Office; digitale Website-Nutzung gesondert klären.",
    "licenseUrl": null,
    "purchaseUrl": "https://housing.govmu.org/Pages/Dept%20and%20Org/Divisions/Survey/MH-Service.aspx",
    "extraSources": [
      "https://www.hydrobharat.gov.in/documents/d/guest/catalogue-inm-06_2026"
    ]
  },
  "le-port": {
    "number": "7183 / INT 7736",
    "coverage": "7183 / INT 7736: La Réunion - Partie Nord - De la Pointe des Châteaux à la Pointe de la Rivière du Mât",
    "scale": "7183 / INT 7736: 1:60.000; B Port Réunion (Pointe des Galets) - Port Ouest: 1:10.000; C Port Réunion (Pointe des Galets) - Port Est: 1:10.000",
    "edition": "7183 / INT 7736: Papierkarte · Ausgabe 5 · 2021 · Revision 2026-09-16 · Berichtigung 19 · GAN 2638",
    "provider": "Shom (France)",
    "source": "https://services.data.shom.fr/geonetwork/root/api/records/CARTO_CARTES_PAPIER_7183.xml",
    "license": "RasterMarine erfordert eine gesonderte Lizenz / ein Abonnement für die Kartendarstellung. Sichtbarkeit im amtlichen Viewer erlaubt keine Übernahme seiner Kacheln.",
    "licenseUrl": "https://diffusion.shom.fr/cartes/assemblages-cartographiques/rastermarine350.html",
    "purchaseUrl": "https://data.shom.fr/donnees",
    "extraSources": [
      "https://services.data.shom.fr/geonetwork/root/api/records/CARTO_CARTES_PAPIER_7183.xml"
    ]
  },
  "maputo": {
    "number": "MZ16401 / INT 7583",
    "coverage": "MZ16401 / INT 7583: Aproximações ao Porto de Maputo",
    "scale": "MZ16401 / INT 7583: 1:30.000; Porto de Maputo: 1:10.000",
    "edition": "MZ16401 / INT 7583: Papierkarte · Ausgabe 1 · 2023-02",
    "provider": "INAHINA (Mozambique), co-produced with Instituto Hidrográfico Portugal",
    "source": "https://iho.int/uploads/user/Inter-Regional%20Coordination/RHC/SAIHC/SAIHC19/SAIHC%20ICCWG11-2_2023_EN_Mauritius_Report_amended.pdf",
    "license": "Keine freie Website-Einbindung verifiziert. Originalkarte über die amtlichen Vertriebswege; digitale Nutzung / Vervielfältigung gesondert beim Herausgeber lizenzieren.",
    "licenseUrl": null,
    "purchaseUrl": "https://www.portmaputo.com/pt/info-do-porto/mapas-nauticos/",
    "extraSources": [
      "https://iho.int/uploads/user/Inter-Regional%20Coordination/RHC/SAIHC/SAIHC19/SAIHC%20ICCWG11-2_2023_EN_Mauritius_Report_amended.pdf"
    ]
  },
  "east-london": {
    "number": "SAN 1027 / INT 7541 · ZA500140",
    "coverage": "SAN 1027 / INT 7541: Approaches to East London; ZA500140: East London Harbour",
    "scale": "SAN 1027 / INT 7541: 1:40.000; East London: 1:12.000; ZA500140: Maßstab nicht verifiziert",
    "edition": "SAN 1027 / INT 7541: Papierkarte; ZA500140: Ausgabe 3 · letztes Update 2026-05",
    "provider": "South African Navy Hydrographic Office (SANHO)",
    "source": "https://sanho.co.za/products/paper_charts.htm",
    "license": "Vervielfältigung oder Übertragung nur mit ausdrücklicher Genehmigung des National Hydrographer. ENC-Bezug über lizenzierte Vertriebsstellen. Kein frei nutzbarer Originalkartenlayer verifiziert.",
    "licenseUrl": "https://sanho.co.za/products/SANHO-3%20Catalogue/SAN%20HO3%20-%20Full%20version.pdf",
    "purchaseUrl": "https://sanho.co.za/products/paper_charts.htm",
    "extraSources": [
      "https://sanho.co.za/products/paper_charts.htm",
      "https://sanho.co.za/products/harbour.htm"
    ]
  },
  "gqeberha": {
    "number": "SAN 1025 / INT 7532 · ZA500120",
    "coverage": "SAN 1025 / INT 7532: Plans in Algoa Bay; ZA500120: Port Elizabeth Harbour",
    "scale": "SAN 1025 / INT 7532: Maßstab nicht verifiziert; Port Elizabeth: 1:15.000; Bird Island Passage: 1:40.000; ZA500120: Maßstab nicht verifiziert",
    "edition": "SAN 1025 / INT 7532: Papierkarte; ZA500120: Ausgabe 6 · letztes Update 2026-05",
    "provider": "South African Navy Hydrographic Office (SANHO)",
    "source": "https://sanho.co.za/products/paper_charts.htm",
    "license": "Vervielfältigung oder Übertragung nur mit ausdrücklicher Genehmigung des National Hydrographer. ENC-Bezug über lizenzierte Vertriebsstellen. Kein frei nutzbarer Originalkartenlayer verifiziert.",
    "licenseUrl": "https://sanho.co.za/products/SANHO-3%20Catalogue/SAN%20HO3%20-%20Full%20version.pdf",
    "purchaseUrl": "https://sanho.co.za/products/paper_charts.htm",
    "extraSources": [
      "https://sanho.co.za/products/paper_charts.htm",
      "https://sanho.co.za/products/harbour.htm"
    ]
  },
  "cape-town": {
    "number": "SAN 1014 / INT 2682 · ZA500050",
    "coverage": "SAN 1014 / INT 2682: Table Bay; ZA500050: Table Bay",
    "scale": "SAN 1014 / INT 2682: 1:10.000; ZA500050: Maßstab nicht verifiziert",
    "edition": "SAN 1014 / INT 2682: Papierkarte; ZA500050: Ausgabe 9 · letztes Update 2026-05",
    "provider": "South African Navy Hydrographic Office (SANHO)",
    "source": "https://sanho.co.za/products/paper_charts.htm",
    "license": "Vervielfältigung oder Übertragung nur mit ausdrücklicher Genehmigung des National Hydrographer. ENC-Bezug über lizenzierte Vertriebsstellen. Kein frei nutzbarer Originalkartenlayer verifiziert.",
    "licenseUrl": "https://sanho.co.za/products/SANHO-3%20Catalogue/SAN%20HO3%20-%20Full%20version.pdf",
    "purchaseUrl": "https://sanho.co.za/products/paper_charts.htm",
    "extraSources": [
      "https://sanho.co.za/products/paper_charts.htm",
      "https://sanho.co.za/products/harbour.htm"
    ]
  },
  "walvis-bay": {
    "number": "SAN 1004 / INT 2612 · ZA5N0010",
    "coverage": "SAN 1004 / INT 2612: Walvis Bay Harbour; ZA5N0010: Walvis Bay Harbour",
    "scale": "SAN 1004 / INT 2612: 1:15.000; ZA5N0010: Maßstab nicht verifiziert",
    "edition": "SAN 1004 / INT 2612: Papierkarte; ZA5N0010: Ausgabe 8 · letztes Update 2026-08",
    "provider": "South African Navy Hydrographic Office (SANHO)",
    "source": "https://sanho.co.za/products/paper_charts.htm",
    "license": "Vervielfältigung oder Übertragung nur mit ausdrücklicher Genehmigung des National Hydrographer. ENC-Bezug über lizenzierte Vertriebsstellen. Kein frei nutzbarer Originalkartenlayer verifiziert.",
    "licenseUrl": "https://sanho.co.za/products/SANHO-3%20Catalogue/SAN%20HO3%20-%20Full%20version.pdf",
    "purchaseUrl": "https://sanho.co.za/products/paper_charts.htm",
    "extraSources": [
      "https://sanho.co.za/products/paper_charts.htm",
      "https://sanho.co.za/products/harbour.htm"
    ]
  },
  "easter-island": {
    "number": "2512",
    "coverage": "2512: Hanga Roa y Hanga Piko",
    "scale": "2512: 1:10.000; Hanga Roa: 1:5.000; Hanga Piko: 1:2.000",
    "edition": "2512: Ausgabe 8th edition, 2026",
    "provider": "SHOA",
    "source": "https://tienda.shoa.cl/productos/rada-hanga-roa-rada-hanga-piko/",
    "license": "Schriftliche SHOA-Genehmigung vor Kopie, Veröffentlichung oder Übertragung erforderlich (Nutzungsbedingungen XI.B). Der Kauf eines Papierblatts umfasst keine Weblizenz.",
    "licenseUrl": "https://tienda.shoa.cl/terminos-condiciones/",
    "purchaseUrl": "https://tienda.shoa.cl/terminos-condiciones/",
    "extraSources": []
  },
  "tahiti": {
    "number": "7460",
    "coverage": "7460: De la Passe de Taapuna à la Passe d’Arue",
    "scale": "7460: 1:10.000",
    "edition": "7460: Ausgabe 5th edition 2024; correction 3, GAN 2638; revision 2026-09-16",
    "provider": "SHOM",
    "source": "https://services.data.shom.fr/geonetwork/zip/api/records/CARTO_CARTES_PAPIER_7460.xml",
    "license": "RasterMarine erfordert eine gesonderte Lizenz / ein Abonnement für die Kartendarstellung. Sichtbarkeit im amtlichen Viewer erlaubt keine Übernahme seiner Kacheln.",
    "licenseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "purchaseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "extraSources": []
  },
  "moorea": {
    "number": "6657",
    "coverage": "6657: Baies de Cook et d’Opunohu",
    "scale": "6657: 1:12.500",
    "edition": "6657: Ausgabe 4th edition 2017; correction 6, GAN 2544; revision 2025-10-29",
    "provider": "SHOM",
    "source": "https://services.data.shom.fr/geonetwork/lic/api/records/CARTO_CARTES_PAPIER_6657.xml",
    "license": "RasterMarine erfordert eine gesonderte Lizenz / ein Abonnement für die Kartendarstellung. Sichtbarkeit im amtlichen Viewer erlaubt keine Übernahme seiner Kacheln.",
    "licenseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "purchaseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "extraSources": []
  },
  "raiatea": {
    "number": "6280",
    "coverage": "6280: Partie Nord de Raiatea – Port d’Uturoa",
    "scale": "6280: 1:12.000",
    "edition": "6280: Ausgabe 6th edition 2025; correction 1, GAN 2540; revision 2025-10-01",
    "provider": "SHOM",
    "source": "https://services.data.shom.fr/geonetwork/srv/api/records/CARTO_CARTES_PAPIER_6280.xml",
    "license": "RasterMarine erfordert eine gesonderte Lizenz / ein Abonnement für die Kartendarstellung. Sichtbarkeit im amtlichen Viewer erlaubt keine Übernahme seiner Kacheln.",
    "licenseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "purchaseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "extraSources": []
  },
  "lifou": {
    "number": "6820",
    "coverage": "6820: Mouillages de l’Île Lifou – Baie du Santal",
    "scale": "6820: 1:35.000",
    "edition": "6820: Ausgabe 3rd edition 2015; correction 8, GAN 2604; revision 2026-01-21",
    "provider": "SHOM",
    "source": "https://services.data.shom.fr/geonetwork/docs/api/records/CARTO_CARTES_PAPIER_6820.xml",
    "license": "RasterMarine erfordert eine gesonderte Lizenz / ein Abonnement für die Kartendarstellung. Sichtbarkeit im amtlichen Viewer erlaubt keine Übernahme seiner Kacheln.",
    "licenseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "purchaseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "extraSources": []
  },
  "noumea": {
    "number": "7643",
    "coverage": "7643: Port de Nouméa",
    "scale": "7643: 1:10.000",
    "edition": "7643: Ausgabe 5th edition 2026; correction 2, GAN 2616; revision 2026-04-15",
    "provider": "SHOM",
    "source": "https://services.data.shom.fr/geonetwork/roles/api/records/CARTO_CARTES_PAPIER_7643.xml",
    "license": "RasterMarine erfordert eine gesonderte Lizenz / ein Abonnement für die Kartendarstellung. Sichtbarkeit im amtlichen Viewer erlaubt keine Übernahme seiner Kacheln.",
    "licenseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "purchaseUrl": "https://services.data.shom.fr/geonetwork/WSDL/api/records/CARTO_RASTER_MARINE.xml",
    "extraSources": []
  },
  "aitutaki": {
    "number": "CK 142",
    "coverage": "CK 142: Plans of the Cook Islands – Southern Sheet; Eingebundener Ausschnitt: Aitutaki, 1:60.000. Im Nahzoom zusätzlich Arutanga Anchorage 1:15.000, ebenfalls am gedruckten Gradnetz registriert.",
    "scale": "CK 142: 1:60.000; Aitutaki: 1:60.000; Arutanga Anchorage: 1:15.000",
    "edition": "CK 142: Ausgabe Januar 2022",
    "provider": "LINZ",
    "source": "https://charts.linz.govt.nz/charts/paper-chart/ck142",
    "license": "CC BY 4.0. Namensnennung und Kennzeichnung der Bearbeitung erforderlich. TIFF-Originale enthalten keine laufenden Notices-to-Mariners-Berichtigungen.",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "purchaseUrl": null,
    "extraSources": [
      "https://data.linz.govt.nz/layer/110038-chart-ck-142-plans-of-the-cook-islands-southern-sheet-aitutaki/",
      "https://data.linz.govt.nz/services/api/v1.x/layers/110038/",
      "https://data.linz.govt.nz/layer/110039-chart-ck-142-plans-of-the-cook-islands-southern-sheet-arutanga-anchorage/"
    ],
    "layer": {
      "type": "image",
      "url": "./assets/charts/ck142-overlay.png",
      "preview": "./assets/charts/ck142-overlay-preview.png",
      "detailMinZoom": 14,
      "bounds": [
        -159.89701816463514,
        -19.01977714535997,
        -159.66672319928196,
        -18.764810975928537
      ],
      "original": "https://static.charts.linz.govt.nz/chart/tiff/ck142.tif",
      "date": "01/2022",
      "label": "CK142 · Aitutaki · 1:60.000",
      "detail": {
        "url": "./assets/charts/arutanga-overlay.png",
        "preview": null,
        "minZoom": 15,
        "detailMinZoom": 15,
        "bounds": [
          -159.82313253147177,
          -18.87563983501068,
          -159.7931219100268,
          -18.843039360441175
        ],
        "label": "CK142 · Arutanga Anchorage · 1:15.000"
      }
    },
    "attribution": "Sourced from Toitū Te Whenua Land Information New Zealand · Crown copyright · CC BY 4.0 · registrierte Ableitung",
    "description": "Amtliches LINZ-Original (Januar 2022), für diese Darstellung anhand des gedruckten Gradnetzes registriert und nach Web-Mercator umgerechnet. Keine amtlich gelieferte Geodatei. Nicht laufend berichtigt.",
    "notice": "Nur Reiseansicht, nicht zur Navigation. Originalausgabe Januar 2022 ohne laufende Notices-to-Mariners-Berichtigungen. Umprojektion am Gradnetz registriert, keine Navigationsgenauigkeit zugesichert.",
    "zoom": 12
  },
  "nukualofa": {
    "number": "TO 504 · TO 502",
    "coverage": "TO 504: Nuku’alofa Harbour; TO 502: Approaches to Nuku’alofa Harbour; Eingebundener Ausschnitt: TO504 Nuku’alofa Harbour, 1:10.000. TO502 ist nur eine zusätzliche Bezugsquelle.",
    "scale": "TO 504: 1:10.000; TO 502: 1:30.000",
    "edition": "TO 504: Ausgabe Januar 2022; TO 502: Ausgabe Januar 2022",
    "provider": "LINZ",
    "source": "https://charts.linz.govt.nz/charts/paper-chart/to504",
    "license": "CC BY 4.0. Namensnennung und Kennzeichnung der Bearbeitung erforderlich. TIFF-Originale enthalten keine laufenden Notices-to-Mariners-Berichtigungen.",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "purchaseUrl": null,
    "extraSources": [
      "https://data.linz.govt.nz/layer/110098-chart-to-504-nukualofa-harbour/",
      "https://data.linz.govt.nz/services/api/v1.x/layers/110098/"
    ],
    "layer": {
      "type": "image",
      "url": "./assets/charts/to504-overlay.png",
      "preview": "./assets/charts/to504-overlay-preview.png",
      "detailMinZoom": 16,
      "bounds": [
        -175.21166152179362,
        -21.14416633667809,
        -175.1499958885179,
        -21.102496886343157
      ],
      "original": "https://static.charts.linz.govt.nz/chart/tiff/to504.tif",
      "date": "01/2022",
      "label": "TO504 · Nuku’alofa Harbour · 1:10.000"
    },
    "attribution": "Sourced from Toitū Te Whenua Land Information New Zealand · Crown copyright · CC BY 4.0 · registrierte Ableitung",
    "description": "Amtliches LINZ-Original (Januar 2022), für diese Darstellung anhand des gedruckten Gradnetzes registriert und nach Web-Mercator umgerechnet. Keine amtlich gelieferte Geodatei. Nicht laufend berichtigt.",
    "notice": "Nur Reiseansicht, nicht zur Navigation. Originalausgabe Januar 2022 ohne laufende Notices-to-Mariners-Berichtigungen. Umprojektion am Gradnetz registriert, keine Navigationsgenauigkeit zugesichert.",
    "zoom": 14
  },
  "suva": {
    "number": "BA 1660",
    "coverage": "BA 1660: Suva Harbour",
    "scale": "BA 1660: 1:12.000",
    "edition": "BA 1660: aktuelle Ausgabe und Berichtigungen nicht verifiziert. Die archivierte SHOM-Angabe von 2009 wird nicht als aktuell ausgegeben.",
    "provider": "UKHO",
    "source": "https://services.data.shom.fr/geonetwork/srv/api/records/CARTO_CARTES_COMPLEMENT_1660.xml/formatters/xsl-view?portalLink=&view=default",
    "license": "Gesonderte UKHO-Copyright-Lizenz erforderlich, auch bei nichtkommerzieller Nutzung. Eine nichtkommerzielle Lizenz kann gebührenfrei sein, ist aber nicht automatisch erteilt; Originalmaterial muss selbst vorliegen.",
    "licenseUrl": "https://copyright.ukho.gov.uk/aboutus.aspx",
    "purchaseUrl": "https://copyright.ukho.gov.uk/aboutus.aspx",
    "extraSources": [
      "https://www.msaf.com.fj/category/alerts-notices/page/42/"
    ]
  },
  "lautoka": {
    "number": "BA 1670",
    "coverage": "BA 1670: Plans in Viti Levu",
    "scale": "Lautoka-Detailplan 1:7.500 laut reproduziertem UKHO-Katalog; aktueller Primärkatalog-Maßstab nicht separat verifiziert.",
    "edition": "BA 1670: Ausgabe / laufende Berichtigungen nicht verifiziert",
    "provider": "UKHO",
    "source": "https://www.msaf.com.fj/05-2026-wreck-reported/",
    "license": "Gesonderte UKHO-Copyright-Lizenz erforderlich, auch bei nichtkommerzieller Nutzung. Eine nichtkommerzielle Lizenz kann gebührenfrei sein, ist aber nicht automatisch erteilt; Originalmaterial muss selbst vorliegen.",
    "licenseUrl": "https://copyright.ukho.gov.uk/aboutus.aspx",
    "purchaseUrl": "https://copyright.ukho.gov.uk/aboutus.aspx",
    "extraSources": [
      "https://mdnautical.com/img/pdf/P1.pdf"
    ]
  },
  "mystery-island": {
    "number": "BA 1581",
    "coverage": "BA 1581: Islands and Anchorages in Southern Vanuatu",
    "scale": "BA 1581: Maßstab nicht verifiziert; Anatom, Anelghowhat Bay (panel C): 1:25.000",
    "edition": "BA 1581: Ausgabe 2018 (as listed in SHOM official catalogue; current 2026 edition not independently verified)",
    "provider": "UKHO",
    "source": "https://services.data.shom.fr/static/catalog/4A/004-ZKA.pdf",
    "license": "Gesonderte UKHO-Copyright-Lizenz erforderlich, auch bei nichtkommerzieller Nutzung. Eine nichtkommerzielle Lizenz kann gebührenfrei sein, ist aber nicht automatisch erteilt; Originalmaterial muss selbst vorliegen.",
    "licenseUrl": "https://copyright.ukho.gov.uk/aboutus.aspx",
    "purchaseUrl": "https://copyright.ukho.gov.uk/aboutus.aspx",
    "extraSources": [
      "https://iho.int/uploads/user/Capacity%20Building/Reports%20Assessments/2011/1.April_Vanuatu_Tech_Visit.pdf"
    ]
  },
  "sydney": {
    "number": "AUS200 · AU6SYD01",
    "coverage": "AUS200: Port Jackson; AU6SYD01: Sydney Overseas Passenger Terminal",
    "scale": "AUS200: 1:25.000; AU6SYD01: Maßstab nicht verifiziert",
    "edition": "AUS200: Ausgabe 4 · 2023-09-29 · Update 21; AU6SYD01: Ausgabe 10 · Update 0 · veröffentlicht 2026-06-18",
    "provider": "AHO",
    "source": "https://webapps.hydro.gov.au/webapps/jsp/charts/charts.jsp?chart=AUS200&subchart=0",
    "license": "Schriftliche Genehmigung der Commonwealth of Australia / AHO für Vervielfältigung und Veröffentlichung erforderlich. Der öffentliche Produktindex zeigt nur Katalogumrisse, keine Seekarten.",
    "licenseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "purchaseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "extraSources": []
  },
  "burnie": {
    "number": "AUS163 · AU5BWT01",
    "coverage": "AUS163: Approaches to Burnie; AU5BWT01: Burnie",
    "scale": "AUS163: 1:25.000; AU5BWT01: Maßstab nicht verifiziert",
    "edition": "AUS163: Ausgabe 4 · 2023-06-23 · Update 1; AU5BWT01: Ausgabe 3 · Update 0 · veröffentlicht 2026-04-23",
    "provider": "AHO",
    "source": "https://webapps.hydro.gov.au/webapps/jsp/charts/charts.jsp?chart=AUS163&subchart=0",
    "license": "Schriftliche Genehmigung der Commonwealth of Australia / AHO für Vervielfältigung und Veröffentlichung erforderlich. Der öffentliche Produktindex zeigt nur Katalogumrisse, keine Seekarten.",
    "licenseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "purchaseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "extraSources": []
  },
  "melbourne": {
    "number": "AUS155 · AU5MEL01",
    "coverage": "AUS155: Approaches to Port of Melbourne; AU5MEL01: Melbourne",
    "scale": "AUS155: 1:37.500; AU5MEL01: Maßstab nicht verifiziert",
    "edition": "AUS155: Ausgabe 3 · 2025-09-05 · Update 7; AU5MEL01: Ausgabe 9 · Update 3 · veröffentlicht 2026-10-08",
    "provider": "AHO",
    "source": "https://webapps.hydro.gov.au/webapps/jsp/charts/charts.jsp?chart=AUS155&subchart=0",
    "license": "Schriftliche Genehmigung der Commonwealth of Australia / AHO für Vervielfältigung und Veröffentlichung erforderlich. Der öffentliche Produktindex zeigt nur Katalogumrisse, keine Seekarten.",
    "licenseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "purchaseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "extraSources": []
  },
  "adelaide": {
    "number": "AUS130 · AU5ADL01",
    "coverage": "AUS130: Approaches to Port Adelaide; AU5ADL01: Gulf St Vincent - Port Adelaide and approaches",
    "scale": "AUS130: 1:37.500; AU5ADL01: Maßstab nicht verifiziert",
    "edition": "AUS130: Ausgabe 4 · 2025-03-07 · Update 5; AU5ADL01: Ausgabe 3 · Update 15 · veröffentlicht 2026-10-01",
    "provider": "AHO",
    "source": "https://webapps.hydro.gov.au/webapps/jsp/charts/charts.jsp?chart=AUS130&subchart=0",
    "license": "Schriftliche Genehmigung der Commonwealth of Australia / AHO für Vervielfältigung und Veröffentlichung erforderlich. Der öffentliche Produktindex zeigt nur Katalogumrisse, keine Seekarten.",
    "licenseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "purchaseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "extraSources": []
  },
  "kangaroo-island": {
    "number": "AUS780 · AU436137",
    "coverage": "AUS780: Althorpe Islands to Backstairs Passage; AU436137: Investigator Strait to Backstairs Passage; Der vorhandene Routenpunkt liegt bei Kingscote. Der genaue Ankerplatz ist nicht bestätigt; deshalb keine ungesicherte Zuordnung eines Penneshaw-Detailplans.",
    "scale": "AUS780: 1:150.000; AU436137: Maßstab nicht verifiziert",
    "edition": "AUS780: Ausgabe 4 · 2025-06-13 · Update 5; AU436137: Ausgabe 16 · Update 9 · veröffentlicht 2026-10-15",
    "provider": "AHO",
    "source": "https://webapps.hydro.gov.au/webapps/jsp/charts/charts.jsp?chart=AUS780&subchart=0",
    "license": "Schriftliche Genehmigung der Commonwealth of Australia / AHO für Vervielfältigung und Veröffentlichung erforderlich. Der öffentliche Produktindex zeigt nur Katalogumrisse, keine Seekarten.",
    "licenseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "purchaseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "extraSources": []
  },
  "fremantle": {
    "number": "AUS112 · AUS117 · AU5FRE01",
    "coverage": "AUS112: Approaches to Fremantle, deckt den Hafenpunkt ab. AU5FRE01: detaillierter Fremantle-Hafen-ENC. AUS117: Gage Roads / Cockburn Sound, südliche Zufahrt; der Punkt selbst liegt knapp nördlich der Papierkarten-BBox.",
    "scale": "AUS112: 1:37.500; AUS117: 1:25.000; AU5FRE01: Maßstab nicht verifiziert",
    "edition": "AUS112: Ausgabe 8 · 2026-08-21 · Update 1; AUS117: Ausgabe 10 · 2026-08-21 · Update 1; AU5FRE01: Ausgabe 6 · Update 1 · veröffentlicht 2026-07-30",
    "provider": "AHO",
    "source": "https://webapps.hydro.gov.au/webapps/jsp/charts/charts.jsp?chart=AUS112&subchart=0",
    "license": "Schriftliche Genehmigung der Commonwealth of Australia / AHO für Vervielfältigung und Veröffentlichung erforderlich. Der öffentliche Produktindex zeigt nur Katalogumrisse, keine Seekarten.",
    "licenseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "purchaseUrl": "https://webapps.hydro.gov.au/prodserv/licensing/licensing.htm",
    "extraSources": []
  },
  "santarem": {
    "provider": "Centro de Hidrografia da Marinha · Brasilien",
    "number": "4020A",
    "coverage": "Porto de Santarém",
    "scale": "Maßstab nicht separat verifiziert; im Originalblatt prüfen",
    "edition": "Datei 29.07.2026 · NtM 2026-64–65",
    "source": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "license": "Amtliche BSB-Raster für nichtkommerzielle Nutzung frei, Copyright bleibt bei der Marinha do Brasil. Keine kommerzielle Weitergabe. Nicht zur Navigation in dieser Reiseansicht.",
    "licenseUrl": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "blocker": "Die amtlichen Rasterdateien waren bei der Prüfung technisch nicht abrufbar (HTTP 502); der alternative WMS war zugriffsbeschränkt. Daher kein ungesichertes Originalbild eingebunden."
  },
  "fortaleza": {
    "provider": "Centro de Hidrografia da Marinha · Brasilien",
    "number": "701",
    "coverage": "Porto de Mucuripe",
    "scale": "1:13.000",
    "edition": "Rasterdatei 05.01.2022 · NtM 2021-197",
    "source": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "license": "Amtliche BSB-Raster für nichtkommerzielle Nutzung frei, Copyright bleibt bei der Marinha do Brasil. Keine kommerzielle Weitergabe. Nicht zur Navigation in dieser Reiseansicht.",
    "licenseUrl": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "blocker": "Die amtlichen Rasterdateien waren bei der Prüfung technisch nicht abrufbar (HTTP 502); der alternative WMS war zugriffsbeschränkt. Daher kein ungesichertes Originalbild eingebunden."
  },
  "ilheus": {
    "provider": "Centro de Hidrografia da Marinha · Brasilien",
    "number": "1211",
    "coverage": "Porto de Ilhéus",
    "scale": "Maßstab nicht separat verifiziert; im Originalblatt prüfen",
    "edition": "Datei 10.08.2026 · NtM 2026-69",
    "source": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "license": "Amtliche BSB-Raster für nichtkommerzielle Nutzung frei, Copyright bleibt bei der Marinha do Brasil. Keine kommerzielle Weitergabe. Nicht zur Navigation in dieser Reiseansicht.",
    "licenseUrl": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "blocker": "Die amtlichen Rasterdateien waren bei der Prüfung technisch nicht abrufbar (HTTP 502); der alternative WMS war zugriffsbeschränkt. Daher kein ungesichertes Originalbild eingebunden."
  },
  "rio-de-janeiro": {
    "provider": "Centro de Hidrografia da Marinha · Brasilien",
    "number": "1512",
    "coverage": "Porto do Rio de Janeiro",
    "scale": "Maßstab nicht separat verifiziert; im Originalblatt prüfen",
    "edition": "Datei 14.09.2026 · NtM 2026-98",
    "source": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "license": "Amtliche BSB-Raster für nichtkommerzielle Nutzung frei, Copyright bleibt bei der Marinha do Brasil. Keine kommerzielle Weitergabe. Nicht zur Navigation in dieser Reiseansicht.",
    "licenseUrl": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "blocker": "Die amtlichen Rasterdateien waren bei der Prüfung technisch nicht abrufbar (HTTP 502); der alternative WMS war zugriffsbeschränkt. Daher kein ungesichertes Originalbild eingebunden."
  },
  "boca-da-valeria": {
    "provider": "Centro de Hidrografia da Marinha · Brasilien",
    "number": "4025 · Kandidat, Abdeckung nicht abschließend verifiziert",
    "coverage": "Amazonas bei Boca da Valéria. 4024: Ilha de Santa Rita bis Ilhas do Calderão; 4025: Ilhas do Calderão bis Paraná do Ramos. Exakte Abdeckung am Routenpunkt noch offen.",
    "scale": "1:100.000 (Hauptkarte 4025); Hafenpunkt-Zuordnung noch offen",
    "edition": "Katalogdateien 19.08.2024 · NtM 2024-162; richtige Zelle noch zu prüfen",
    "source": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "license": "Nichtkommerzielle amtliche BSB-Raster grundsätzlich verfügbar. Keine Darstellung ohne verifizierte räumliche Zuordnung.",
    "licenseUrl": "https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster",
    "blocker": "Die exakte amtliche Blattzuordnung für diesen Ankerplatz ist noch nicht gesichert. Keine Karte wird fälschlich als passendes Original ausgegeben."
  },
  "buenos-aires": {
    "provider": "Servicio de Hidrografía Naval · Argentinien",
    "number": "AR401560",
    "coverage": "Puerto de Buenos Aires",
    "scale": "1:22.000",
    "edition": "Ausgabe 7 · 05.11.2025 · Update 002 vom 28.09.2026",
    "source": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7",
    "license": "Amtliche ENCs werden über IC-ENC-Vertriebsstellen lizenziert. Keine offene Website-Vervielfältigungs- oder Einbindungserlaubnis verifiziert.",
    "licenseUrl": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7",
    "purchaseUrl": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7"
  },
  "puerto-madryn": {
    "provider": "Servicio de Hidrografía Naval · Argentinien",
    "number": "AR402640",
    "coverage": "Golfo Nuevo: Punta Arco bis Punta Loma",
    "scale": "1:22.000",
    "edition": "Ausgabe 2 · 19.12.2018 · Update 002 vom 30.10.2023",
    "source": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7",
    "license": "Amtliche ENCs werden über IC-ENC-Vertriebsstellen lizenziert. Keine offene Website-Vervielfältigungs- oder Einbindungserlaubnis verifiziert.",
    "licenseUrl": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7",
    "purchaseUrl": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7"
  },
  "ushuaia": {
    "provider": "Servicio de Hidrografía Naval · Argentinien",
    "number": "AR504800",
    "coverage": "Bahía Ushuaia · Puerto",
    "scale": "1:4.000",
    "edition": "Ausgabe 3 · 13.11.2023 · Update 002 vom 27.11.2024",
    "source": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7",
    "license": "Amtliche ENCs werden über IC-ENC-Vertriebsstellen lizenziert. Keine offene Website-Vervielfältigungs- oder Einbindungserlaubnis verifiziert.",
    "licenseUrl": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7",
    "purchaseUrl": "https://www.hidro.gob.ar/nautica/CartasNauticas.asp?op=7"
  },
  "montevideo": {
    "provider": "SOHMA · Armada de Uruguay",
    "number": "41 · UY500041.000",
    "coverage": "Puerto de Montevideo: Puerto de Buceo bis Punta Yeguas",
    "scale": "Maßstab der Ausgabe 2025 nicht separat verifiziert",
    "edition": "Papierkarte 41: Ausgabe 2025. ENC UY500041.000: Ausgabe 8; aktueller Berichtigungsstand nicht verifiziert.",
    "source": "https://sohma.armada.mil.uy/index.php/servicios/publicaciones-nauticas",
    "license": "Keine offene Einbindungslizenz verifiziert. Papierbezug über SOHMA; amtliche ENC über IC-ENC-Vertrieb. Website-Rechte gesondert klären.",
    "licenseUrl": "https://sohma.armada.mil.uy/index.php/servicios/publicaciones-nauticas",
    "purchaseUrl": "https://sohma.armada.mil.uy/index.php/servicios/publicaciones-nauticas"
  },
  "san-antonio": {
    "provider": "SHOA · Chile",
    "number": "5115",
    "coverage": "Puerto San Antonio",
    "scale": "1:5.000",
    "edition": "2018 · laufende Berichtigungen im Original prüfen",
    "source": "https://tienda.shoa.cl/productos/puerto-san-antonio/",
    "license": "Schriftliche SHOA-Genehmigung vor Kopie, Veröffentlichung oder Übertragung erforderlich (Nutzungsbedingungen XI.B). Der Kauf eines Papierblatts umfasst keine Weblizenz.",
    "licenseUrl": "https://tienda.shoa.cl/terminos-condiciones/",
    "purchaseUrl": "https://tienda.shoa.cl/productos/puerto-san-antonio/"
  },
  "puerto-montt": {
    "provider": "SHOA · Chile",
    "number": "7321",
    "coverage": "Puerto Montt · Zona Portuaria · Marina Chinquihue",
    "scale": "1:10.000; Zona Portuaria 1:5.000; Marina Chinquihue 1:2.000",
    "edition": "2004 · c/c 2021 · laufende Berichtigungen im Original prüfen",
    "source": "https://tienda.shoa.cl/productos/puerto-montt-zona-portuaria-maria-chinquihue/",
    "license": "Schriftliche SHOA-Genehmigung vor Kopie, Veröffentlichung oder Übertragung erforderlich (Nutzungsbedingungen XI.B). Der Kauf eines Papierblatts umfasst keine Weblizenz.",
    "licenseUrl": "https://tienda.shoa.cl/terminos-condiciones/",
    "purchaseUrl": "https://tienda.shoa.cl/productos/puerto-montt-zona-portuaria-maria-chinquihue/"
  }
};
