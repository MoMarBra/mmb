# Search privacy

All public HTML contains noindex, nofollow, nosnippet and noimageindex in its initial head. This covers the homepage, /snack/, /test/ and /gta/, their index.html URLs and query strings. Snack tabs share the same document. Direct URL access and application behavior are unchanged.

robots.txt deliberately allows normal HTML crawling: blocking HTML would prevent Google and Bing from reading noindex. Dedicated image/video crawlers and media file patterns are excluded. Do not add a sitemap announcement. The GitHub check scans every HTML file, including newly added pages, and flags missing or conflicting directives. It is a validation check, not an access control or a gate on GitHub's separate Pages deployment.

After every change run node scripts/check-search-privacy.mjs . in the published site checkout (or npm run test:privacy in the game source). The game source dist/index.html also carries the policy, so a normal game update preserves it.

Existing search results disappear only after crawlers process the exclusion; Search Console/Bing removal requests can accelerate removal when the owner has verified access. These rules are not passwords, do not prevent visitors sharing URLs, and cannot control third-party copies or non-compliant crawlers.

Cloudflare proxies the GitHub Pages origin. GitHub Pages cannot set a custom response header from an _headers file. A future Cloudflare response-header rule matching the entire hostname can additionally set X-Robots-Tag: noindex, nofollow, nosnippet, noimageindex on all resources, including directly requested JSON/TXT/PDF files. This rule is not claimed active without access to the Cloudflare account and live verification.
