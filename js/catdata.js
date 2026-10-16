/* Static catalog of cats, accessories, and the streak milestones that unlock them. */

const ACCESSORIES = {
  party_hat: { name: "Party Hat", glyph: "🎉", slot: "head", category: "hat" },
  flower_crown: { name: "Flower Crown", glyph: "🌸", slot: "head", category: "hat" },
  bandana: { name: "Red Bandana", glyph: "🧣", slot: "neck", category: "clothes" },
  scarf: { name: "Cozy Scarf", glyph: "🧶", slot: "neck", category: "clothes" },
  boots: { name: "Lil Boots", glyph: "🥾", slot: "feet", category: "shoes" },
  bowtie: { name: "Blue Bowtie", glyph: "🎀", slot: "neck", category: "accessories" },
  bell_collar: { name: "Bell Collar", glyph: "🔔", slot: "neck", category: "accessories" },
};

// Tabs shown in each cat's floating closet board, in display order.
const CLOSET_CATEGORIES = [
  { id: "hat", label: "Hat" },
  { id: "clothes", label: "Clothes" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
];

// Toys live in a separate "toy box" board (hover menu's 🧸 button) rather
// than the closet — they're played with, not worn.
const TOYS = {
  teddy: { name: "Teddy Bear", glyph: "🧸" },
  mouse: { name: "Toy Mouse", glyph: "🐭" },
  feather: { name: "Feather Wand", glyph: "🪶" },
};

// Food lives in its own board (hover menu's 🍗 button). Drumstick is
// available from day one; the rest unlock with the streak.
const FOODS = {
  drumstick: { name: "Drumstick", glyph: "🍗" },
  fish: { name: "Fish", glyph: "🐟" },
  can: { name: "Canned Food", glyph: "🥫" },
  milk: { name: "Milk", glyph: "🥛" },
};

const CAT_CATALOG = [
  { id: "mochi", name: "Mochi", palette: "mochi", unlockDays: 0, blurb: "Your very first desk pet. Loves sunny windowsills." },
  { id: "shadow", name: "Shadow", palette: "shadow", unlockDays: 7, blurb: "A sleek night prowler, unlocked at a 7-day streak." },
  { id: "snowy", name: "Snowy", palette: "snowy", unlockDays: 30, blurb: "Fluffy and calm, unlocked at a 30-day streak." },
  { id: "celestial", name: "Celestial", palette: "celestial", unlockDays: 100, blurb: "A legendary starlit cat, unlocked at a 100-day streak." },
];

const ACCESSORY_MILESTONES = [
  { id: "bandana", unlockDays: 3 },
  { id: "boots", unlockDays: 10 },
  { id: "bell_collar", unlockDays: 14 },
  { id: "bowtie", unlockDays: 21 },
  { id: "scarf", unlockDays: 45 },
  { id: "flower_crown", unlockDays: 60 },
  { id: "party_hat", unlockDays: 100 },
];

const TOY_MILESTONES = [
  { id: "mouse", unlockDays: 5 },
  { id: "feather", unlockDays: 18 },
  { id: "teddy", unlockDays: 35 },
];

const FOOD_MILESTONES = [
  { id: "fish", unlockDays: 8 },
  { id: "can", unlockDays: 25 },
  { id: "milk", unlockDays: 50 },
];

// Combined, sorted milestone timeline shown in the Streak tab.
const MILESTONES = [
  ...CAT_CATALOG.filter(c => c.unlockDays > 0).map(c => ({
    days: c.unlockDays, label: `Unlock ${c.name} the cat`, kind: "cat", refId: c.id,
  })),
  ...ACCESSORY_MILESTONES.map(a => ({
    days: a.unlockDays, label: `Unlock ${ACCESSORIES[a.id].name}`, kind: "accessory", refId: a.id,
  })),
  ...TOY_MILESTONES.map(t => ({
    days: t.unlockDays, label: `Unlock ${TOYS[t.id].name} toy`, kind: "toy", refId: t.id,
  })),
  ...FOOD_MILESTONES.map(f => ({
    days: f.unlockDays, label: `Unlock ${FOODS[f.id].name}`, kind: "food", refId: f.id,
  })),
].sort((a, b) => a.days - b.days);
