/**
 * Curated, license-free category imagery (Unsplash). Keyed by the lowercased
 * category name. Each URL was verified to return a real image. Callers fall
 * back to the category `color` when a name has no mapped photo, so newly added
 * categories degrade gracefully instead of showing a broken image.
 */
const PARAMS = "?w=600&q=80&auto=format&fit=crop";
const BASE = "https://images.unsplash.com/photo-";

const CATEGORY_IMAGES: Record<string, string> = {
  coffee: `${BASE}1495474472287-4d71bcdd2085${PARAMS}`,
  tea: `${BASE}1576092768241-dec231879fc3${PARAMS}`,
  "cold drinks": `${BASE}1437418747212-8d9709afab22${PARAMS}`,
  snacks: `${BASE}1568901346375-23c9450c58cd${PARAMS}`,
  desserts: `${BASE}1551024601-bec78aea704b${PARAMS}`,
  meals: `${BASE}1546069901-ba9599a7e63c${PARAMS}`,
};

/** Returns a representative photo URL for a category name, or null if none. */
export function categoryImageUrl(name?: string | null): string | null {
  if (!name) return null;
  return CATEGORY_IMAGES[name.trim().toLowerCase()] ?? null;
}
