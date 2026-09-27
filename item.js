// item.js
// Everything related to the ITEM entity (an artist or an event/anniversary)
// — matches EXCEL 2 in the 3-spreadsheet data model.

// Country abbreviation is a display-only concern: the source data (items.json,
// eventually EXCEL 2) always keeps the full country name. Add more entries
// here as new nationalities appear in the calendar; unknown countries simply
// fall back to their full name.
const COUNTRY_ABBREVIATIONS = {
    "Italy": "ITA", "Austria": "AUT", "Germany": "GER", "France": "FRA",
    "Poland": "POL", "Russia": "RUS", "Spain": "ESP", "Hungary": "HUN",
    "Czech Republic": "CZE", "United Kingdom": "GBR", "Great Britain": "GBR",
    "United States": "USA", "Latvia": "LVA", "Switzerland": "CHE",
    "Sweden": "SWE", "Norway": "NOR", "Finland": "FIN", "Netherlands": "NLD",
    "Belgium": "BEL", "Portugal": "PRT", "India": "IND", "Brazil": "BRA",
    "Argentina": "ARG", "Ukraine": "UKR"
};

// The left-hand label in the About panel and the top badge both depend on
// item_type. "MORE BELOW" (the toggle on the right) is intentionally NOT
// part of this config — it stays constant across every card type, so the
// word "more" only ever needs one meaning on screen.
const CATEGORY_CONFIG = {
    BORN_TODAY:  { badge: "BORN TODAY",  aboutLabel: "Artist:" },
    PREMIERE:    { badge: "CELEBRATION", aboutLabel: "Celebration:" },
    CELEBRATION: { badge: "CELEBRATION", aboutLabel: "Celebration:" },
    ANNIVERSARY: { badge: "ANNIVERSARY", aboutLabel: "Anniversary:" },
    MOVIE:       { badge: "MOVIE",       aboutLabel: "Score:" }
};

export function getCategoryConfig(itemType) {
    return CATEGORY_CONFIG[itemType] || CATEGORY_CONFIG.BORN_TODAY;
}

export function formatCountry(rawCountry) {
    return COUNTRY_ABBREVIATIONS[rawCountry] || rawCountry || "";
}

export function formatMeta(item) {
    const country = formatCountry(item.nationality);
    return `${item.birth_year}–${item.death_year} (${item.period}) • ${country}`;
}

/**
 * Builds a Wikipedia (or Wikipedia-search) URL for an item, falling back
 * gracefully when wiki_url is missing.
 */
export function resolveWikiUrl(item) {
    if (item.wiki_url) return item.wiki_url;
    if (item.display_name) {
        return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(item.display_name)}`;
    }
    return null;
}
