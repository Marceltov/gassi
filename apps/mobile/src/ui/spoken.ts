// What a screen reader says for a label with signs in it: the words only ("🐕 Gassi gehen" → "Gassi gehen"), since an
// emoji is read out by its name ("Hund Gassi gehen").
const SIGNS = /[\p{Extended_Pictographic}✓✗️‍]/gu;

export const spoken = (label: string): string => label.replace(SIGNS, "").replace(/\s+/g, " ").trim();
