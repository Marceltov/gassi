// Encounters with dogs (#37) and with people (#90): the choices each detail offers and their German words, firmest or
// calmest first. The details themselves are entry details (entry.ts), checked there.

/** How strongly the dog reacted to another dog: 0 ruhig … 4 explodiert. */
export const REACTION_LABEL = ["ruhig", "schaut", "fiept", "bellt", "explodiert"] as const;
export const REACTION_MAX = REACTION_LABEL.length - 1;

/** Whether we still got his attention. */
export const ATTENTIONS = ["good", "partial", "none"] as const;
export type Attention = (typeof ATTENTIONS)[number];
export const ATTENTION_LABEL: Record<Attention, string> = { good: "gut", partial: "teilweise", none: "nicht" };

/** How we got past the other dog. */
export const HANDLINGS = ["horizon", "avoided", "wideBerth", "turned", "passed", "through"] as const;
export type Handling = (typeof HANDLINGS)[number];
export const HANDLING_LABEL: Record<Handling, string> = { horizon: "am Horizont", avoided: "vermieden", wideBerth: "großer Bogen", turned: "umgedreht", passed: "ausgewichen", through: "mussten durch" };

/** How close the other dog came. */
export const DISTANCES = ["near", "medium", "far"] as const;
export type Distance = (typeof DISTANCES)[number];
export const DISTANCE_LABEL: Record<Distance, string> = { near: "nah", medium: "mittel", far: "weit" };

/** Where we met the person: at home, outside, at their place. */
export const PLACES = ["home", "outside", "theirs"] as const;
export type Place = (typeof PLACES)[number];
export const PLACE_LABEL: Record<Place, string> = { home: "bei uns", outside: "draußen", theirs: "bei ihnen" };

/** How the dog was with the person; several at once. */
export const MOODS = ["friendly", "curious", "excited", "unsure", "afraid", "aggressive"] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_LABEL: Record<Mood, string> = { friendly: "freundlich", curious: "neugierig", excited: "aufgeregt", unsure: "unsicher", afraid: "ängstlich", aggressive: "aggressiv" };

/** The 1-to-10 scales of a person encounter: how it went, how unsure he was. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 10;
