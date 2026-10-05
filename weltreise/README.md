# AIDAsol Weltreise 2026/27

Independent, mobile-first static travel view. Served under `/weltreise/` on the repository's existing GitHub Pages custom domain. No build, API key, analytics, external fonts, or paid service.

## Sources and interpretation

- Provided AIDAsol timetable: Hamburg, 18 October 2026 19:30 through Hamburg, 21 February 2027 08:00; 126 advertised travel days, 44 calls including Hamburg twice, 43 distinct ports.
- Port order checked against the [official AIDA route](https://aida.de/route/weltreise-2026/HAMC6005).
- Timetable times are interpreted as local port time because the supplied image does not explicitly state its timezone convention. UTC epochs include IANA timezone and daylight-saving rules.
- Cape Town `31.01.2027 24:00` means `01.02.2027 00:00` in Africa/Johannesburg.
- The civil date-line change between the Cook Islands and Tonga differs from the geometric ±180° map wrap between Tonga and Fiji.
- The detailed timetable places the return equator passage on February 8; the schematic map says February 9. Precise passage times are not published and are not claimed by this view.

## Position model

The marker remains at an approximate port coordinate throughout its scheduled stay. Between departure and the next arrival, it advances at constant distance-per-time speed along a curated sequence of approximate sea, estuary, river, and fjord waypoints. Each segment uses spherical interpolation and distance weighting; the rendered route follows those same segments. Paths split at the antimeridian instead of drawing across the map.

This is a schedule simulation, not AIS, a confirmed actual position, a nautical chart, or a guarantee of navigability or navigational clearance. Weather, rerouting, channel traffic, tides, pilotage, and delays are not modeled. The small-scale land map omits narrow waterways and tiny islands. Port clocks display the relevant port's timezone; the view never claims an exact ship timezone at sea.

## Interface

- Live mode uses the device clock.
- The discreet bottom-right settings button opens a date/time preview, explicit timezone choice, trip slider, playback controls, and reset to live mode.
- Ambiguous and nonexistent DST input times are rejected with an explanation.
- Settings are ephemeral in this tab, with no server-side storage.
- Months and port-preview controls provide an accessible itinerary; the map has button and keyboard zoom/pan controls, one-finger drag, and focal-point-anchored two-finger pinch/pan. Gestures starting inside the map operate the map; page scrolling remains available outside it.
- Reduced-motion preference is respected for scrolling. The 3D ship has no automatic rotation or animation; its button turns the view by 45 degrees.
- A small procedural XYZ mesh is rendered with WebGL perspective and a depth buffer. The same geometry is projected and depth-sorted into SVG when WebGL is unavailable or lost; the map marker uses that geometry too. No external 3D library or model downloads. The ship marker has no circular backing. The model is stylized, not an exact AIDAsol replica.
- Two always-visible clock tiles use the same live or preview instant, show the full civil date and UTC offset, and use IANA zones for both local port time and Germany (Europe/Berlin). At sea, the clearly named next port supplies a reference clock, not an asserted onboard time. Before departure and after return the local clock is Hamburg.
- Small screen-sized port labels prioritize the current and next harbor, avoid label/control collisions, and reveal additional names when zooming.

## Checks

Run from this folder:

```sh
npm test
```

Run the existing repository privacy check from its root:

```sh
node scripts/check-search-privacy.mjs .
```

Serve the repository root using any static HTTP server, then open `/weltreise/`.

## Search privacy

All public HTML includes `noindex, nofollow, nosnippet, noimageindex`. The repository's existing `robots.txt` and privacy CI remain unchanged. HTML stays crawlable so cooperating search engines can see `noindex`. The URL and repository remain public. These instructions are not authentication and do not block arbitrary bots.

## Map data

`assets/land.json` is a rounded-coordinate derivative of [Natural Earth's 1:110m land polygons](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), public-domain cartographic data. River centerlines use Natural Earth 1:50m/1:110m data; narrow channels have a schematic water-colored underlay. See SOURCES.md for attribution and limits. No provided user image or private personal information is published.
