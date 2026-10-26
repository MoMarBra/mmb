# Per-app browser and Home Screen icons

`/gta/` and `/weltreise/` each own their icon files and manifest. Keep the icon links, Apple title/capability metadata and manifest link in each page's initial HTML when publishing future game/trip builds. Do not replace the root icon: other apps must retain their own branding.

The source artwork is `icons/app-20261026.svg` in each app. Opaque square PNG exports include the 180px Apple touch icon and 192/512px manifest icons. Browsers also receive SVG, PNG and multi-size ICO favicons. Icons use revisioned filenames; future artwork updates must use new filenames and update both HTML and manifest references. The manifest has a stable per-app `id`, start URL and scope, and a versioned HTML link. No service worker or offline caching is introduced.

Run from the repository root:

```
node scripts/check-app-icons.mjs .
node scripts/check-search-privacy.mjs .
```

Open the exact app URL in Safari before choosing Share → Add to Home Screen. Existing saved Web Clips may retain their previous artwork; if necessary remove the old shortcut and add it again after reloading the page. A server update cannot force iOS to redraw an existing Home Screen shortcut. Real-device iOS installation should be checked separately; a desktop browser is not an equivalent test.
