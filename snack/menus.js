// Official restaurant sources reviewed on 2026-10-12.
// IDs refer to the existing Snack database. Name checks prevent a renamed/reused
// record from silently opening a different restaurant's menu.
export const MENU_REVIEWED_AT = '2026-10-12';
export const RESTAURANT_MENUS = Object.freeze({
  "15": {
    "name": "Bowls& Blenders",
    "url": "https://bowlsandblenders.de/",
    "label": "Speisekarte auf Website",
    "status": "Offizielle Website mit Karten-Download. Verlinktes PDF von 2024; Aktualität nicht bestätigt."
  },
  "5": {
    "name": "byvu",
    "url": "https://www.byvu.de/food",
    "status": "Offizielle Speisekarte. Keine datierte Tageskarte."
  },
  "14": {
    "name": "Coccinella",
    "url": null,
    "status": "Offizielle Karte derzeit nicht erreichbar. Keine verifizierte Online-Speisekarte."
  },
  "16": {
    "name": "Der Grieche",
    "url": null,
    "status": "Restaurant nicht eindeutig zugeordnet. Für die richtige Karte fehlt der genaue Name oder die Adresse."
  },
  "17": {
    "name": "Dogtown (RIP)",
    "url": "https://www.dogtown-burrito.co/menu",
    "label": "Marken-Speisekarte öffnen",
    "status": "Offizielle Markenkarte. Standortstatus unklar; keine bestätigte Verfügbarkeit vor Ort."
  },
  "4": {
    "name": "Döner Deluxe",
    "url": "https://doener-deluxe-restaurant.eatbu.com/?lang=de",
    "label": "Restaurant-Website öffnen",
    "status": "Offizielle Website, Dachauer Straße 25. Dort keine Speisekarte gefunden."
  },
  "10": {
    "name": "Fritz Masary",
    "url": "https://www.sandwiches-muenchen.net/mittagstisch",
    "label": "Wochenkarte öffnen",
    "status": "Fritzi Massary · Dachauer Straße 54. Wochenzeitraum auf der Website prüfen."
  },
  "2": {
    "name": "Fuyuan",
    "url": "https://fuyuan-muenchen.de/de/speisekarte/unsere-speisekarte",
    "status": "Offizielle Karte mit Mittagsgerichten. Tagesangebot und Öffnungszeiten beim Restaurant prüfen."
  },
  "7": {
    "name": "Hansa Haus",
    "url": "https://www.kkv-muenchen.de/gastronomie.html",
    "label": "Mittagskarten auf Website",
    "status": "Königsgarten im Hansa-Haus. Verlinkte Karten sind älter oder undatiert; Aktualität nicht bestätigt."
  },
  "9": {
    "name": "King Masala",
    "url": "https://www.thekingmasala.de/speisekarte",
    "status": "Offizielle Speisekarte. Tagesangebot nicht bestätigt."
  },
  "8": {
    "name": "LeDu (Rippchen)",
    "url": null,
    "status": "Standort unklar. Die Karte ist noch nicht eindeutig zugeordnet."
  },
  "1": {
    "name": "Mama Bao",
    "url": "https://mammabao.de/",
    "status": "Offizielle MAMMA-BAO-Speisekarte auf der Website. Keine datierte Tageskarte."
  },
  "18": {
    "name": "Sam´s Falafel",
    "url": "https://www.samsfalafel.de/",
    "label": "Online-Speisekarte öffnen",
    "status": "Restaurant-Onlinekarte über Lieferando. Preise und Angebot vor Ort können abweichen."
  },
  "3": {
    "name": "Seen",
    "url": "https://seen-restaurant.de/",
    "label": "Speise- und Lunchkarte",
    "status": "Offizielle Website mit Karten-Downloads. Aktualität der Karten nicht bestätigt."
  },
  "11": {
    "name": "Steinheil 16",
    "url": "https://www.steinheil16.de/speisekarte",
    "status": "Offizielle Speisekarte. Wechselnde Tageskarte laut Restaurant nur vor Ort."
  },
  "13": {
    "name": "Tre Stelle",
    "url": null,
    "status": "Keine verifizierte offizielle Online-Speisekarte gefunden."
  },
  "19": {
    "name": "Uyghur Döner",
    "url": null,
    "status": "Standort unklar. Für die richtige Speisekarte fehlt die Adresse."
  },
  "6": {
    "name": "Zitronengras",
    "url": null,
    "status": "Keine verifizierte offizielle Online-Speisekarte gefunden."
  }
});
const normalizedName = name => String(name ?? '').normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
export function menuForRestaurant(restaurant) {
  if (!restaurant) return null;
  const menu = RESTAURANT_MENUS[String(restaurant.id)];
  if (!menu || normalizedName(menu.name) !== normalizedName(restaurant.name)) {
    return {url: null, status: 'Für dieses Restaurant ist noch keine offizielle Speisekarte geprüft.'};
  }
  let url = null;
  try {
    const parsed = new URL(menu.url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href;
  } catch {}
  return {...menu, url};
}
export function renderMenu(container, restaurant) {
  container.replaceChildren();
  const menu = menuForRestaurant(restaurant);
  container.hidden = !menu;
  if (!menu) return;
  const doc = container.ownerDocument;
  if (menu.url) {
    const link = doc.createElement('a');
    link.id = 'restaurant-menu-link';
    link.className = 'menu-button';
    link.href = menu.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = menu.label || 'Speisekarte öffnen';
    link.setAttribute('aria-label', `${menu.label || 'Speisekarte öffnen'}: ${restaurant.name.trim()} (neuer Tab)`);
    link.setAttribute('aria-describedby', 'restaurant-menu-note');
    container.append(link);
  }
  const note = doc.createElement('p');
  note.id = 'restaurant-menu-note';
  note.className = 'menu-note';
  note.textContent = menu.status;
  container.append(note);
}
