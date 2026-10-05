# AIDAsol route engine: source and validation notes

## Delivered runtime

Copy `engine.js`, `ports.js`, `routes.js`, and `passages.js` together. All are native browser ES modules and have no package dependencies. The local `package.json` is for Node test execution only.

- 44 port calls, including Hamburg at both ends; 43 distinct port names; 43 moving legs.
- Starts 18 October 2026 at 19:30 Europe/Berlin = 17:30 UTC.
- Finishes 21 February 2027 at 08:00 Europe/Berlin = 07:00 UTC.
- Printed trip length is 126 days. Actual elapsed UTC time between those instants is 125.5625 days. Do not substitute the 127 inclusive civil date labels for the printed duration.
- Schematic route length: approximately 69,361 km. Maximum leg-average speed: 18.30 knots, San Antonio–Osterinsel. These are model outputs, not measured cruising distances or operating speeds.

## Evidence and source priority

1. The supplied timetable image was viewed upright and transcribed row by row from the supplied image. Its explicit times, overnight pairs and dates are authoritative for this simulation.
2. The supplied map was viewed upright. It establishes the broad ocean itinerary and scenic passages; it explicitly calls its own route simplified and subject to change.
3. Official AIDA route and trip pages corroborate the port sequence and voyage window, but the web content retrieved did not establish a timezone convention for every printed time:
   - https://aida.de/route/weltreise-2026/HAMC6005
   - https://aida.de/reiseziele/weltreise/2026
4. Amazon centerlines were adapted from public-domain Natural Earth 1:50m and 1:110m river geometry:
   - https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_rivers_lake_centerlines.geojson
   - https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_rivers_lake_centerlines.geojson
5. Fiji's government suspended daylight saving. Pacific/Fiji is UTC+12 for these calls, as in the IANA runtime:
   - https://www.fiji.gov.fj/cabinet-decisions-3-october-2023/
6. Chilean channel geography was cross-checked against the Chilean national library's SHOA charts and published geographic references. Those checks support approximate corridors, not a surveyed vessel route:
   - https://www.bibliotecanacionaldigital.gob.cl/bnd/631/w3-article-347916.html
   - https://www.bibliotecanacionaldigital.gob.cl/bnd/631/w3-article-347919.html
   - https://data.aad.gov.au/aadc/gaz/place_names_near_place.cfm?country_id=152&lat=-51.3&lon=-74.1667&offset=1.0&place_name=Isla+Whidbey
   - https://doi.org/10.1002/esp.6012 (Eyre Fjord geography)

## Important interpretation details

- The uploaded timetable does not explicitly say port-local versus ship-local. The model assumes each explicit time is port-local and applies that port's IANA timezone, including DST and Adelaide's half hour. This assumption must remain visible to users.
- Epochs are precomputed to avoid silently changing the timetable according to an older browser's timezone database. The `localTimeToEpoch` utility uses the executing platform's IANA implementation. A future government rule change requires reviewing both.
- Boca da Valeria uses America/Manaus (UTC−4); Santarém uses America/Santarem (UTC−3).
- Cape Town's printed 31 January 24:00 is 1 February 00:00 local, equivalent to 31 January 22:00 UTC.
- The civil date line bends east of Tonga: Aitutaki UTC−10 to Tonga UTC+13 has a 61-hour sea interval. The actual geometric ±180° wrap occurs on the following Tonga–Suva leg. Both are handled separately.
- Return equator passage: timetable says 8 February, map says 9 February. Timetable takes priority. Passage rows have no exact times, so the model does not pretend to know them.
- Scenic passage dates are stored as schedule information, while position is distance-weighted at constant speed over each full port-to-port leg. This can place the model near a named passage at a different time than a real itinerary. It is not a timed waypoints or AIS model.

## Geometry fidelity and limits

The route includes the Elbe and English Channel, Amazon out-and-back, Beagle/Cape Horn/Garibaldi/western Magellan and Patagonian fjord corridors, south of Australia, south of Madagascar, and around Agulhas/Good Hope. It avoids straight continental chords. Spherical interpolation is used within every segment; distances weight the motion. The same model feeds the visible line and moving marker.

Harbor, river, island and fjord coordinates are approximate. They do not assert a booked berth, hydrographic navigability, shipping-lane compliance, depth, weather clearance, or an official AIDAsol track. Especially in the Chilean archipelago, no navigational guarantee is possible with these inputs. Do not label the map an exact waterway route or say all land intersections were formally ruled out.

A coarse Natural Earth 1:110m land-intersection diagnostic was run. It identified and helped correct a real Río de la Plata shortcut, Golfo Nuevo approach, and island approaches. Its remaining overlaps include rivers and narrow waterways omitted by that world-scale land mask, plus simplified coasts near ports. This diagnostic is not a high-resolution navigational validation. Higher-resolution land files exceeded the connector's file-size limit. `interiorWaterways` is an optional schematic water-colored map underlay; it does not increase the geometry's accuracy.

## Automated tests

Run `npm test` in this folder. All nine test groups pass:

1. Every call's local-time/UTC round trip, strict chronology, endpoints, speed bounds.
2. Every arrival and departure at −1 ms, exact time and +1 ms: 258 event-adjacent instants. Port state is arrival-inclusive/departure-exclusive; final arrival is complete.
3. Current date, before-start, exact start, final arrival, well-after-finish, invalid input.
4. DST, Adelaide half-hour, all six overnight stays, 24:00, invalid dates, ambiguous autumn and nonexistent spring local times.
5. Civil date jump, continuous westward antimeridian interpolation and split map lines.
6. Constant distance-weighted leg progression and endpoint continuity.
7. A 15-minute sweep of the whole voyage, proving no gaps and monotone elapsed/distance progress.
8. Visible completed/remaining route endpoints match the moving marker; no ±180° screen-spanning line.
9. Presence of required major ocean detours.

Tests confirm the mathematical simulation and schedule handling, not real-time ship location or nautical routing safety.
