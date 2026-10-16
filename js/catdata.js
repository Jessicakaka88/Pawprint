/* Static catalog of cats, accessories, toys, food, decor, and the study-point
   milestones that unlock them. */

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
// available from day one; the rest unlock with study points.
const FOODS = {
  drumstick: { name: "Drumstick", glyph: "🍗" },
  fish: { name: "Fish", glyph: "🐟" },
  can: { name: "Canned Food", glyph: "🥫" },
  milk: { name: "Milk", glyph: "🥛" },
};

// Home decor is placed on the desktop itself (the Decor tab toggles each
// unlocked piece on/off) rather than worn by a cat or carried around.
// `pos` is a fixed CSS placement so pieces don't overlap each other or the
// dock/menu bar.
const DECOR = {
  plant: { name: "Potted Plant", glyph: "🪴", pos: { left: "26px", bottom: "84px" } },
  frame: { name: "Framed Photo", glyph: "🖼️", pos: { left: "38%", top: "54px" } },
  bed: { name: "Cozy Cat Bed", glyph: "🛏️", pos: { right: "140px", bottom: "78px" } },
  lamp: { name: "Reading Lamp", glyph: "🪔", pos: { right: "34px", bottom: "90px" } },
  trophy: { name: "Trophy Shelf", glyph: "🏆", pos: { left: "58%", top: "54px" } },
};

const CAT_CATALOG = [
  { id: "mochi", name: "Mochi", palette: "mochi", unlockPoints: 0, blurb: "Your very first desk pet. Loves sunny windowsills." },
  { id: "shadow", name: "Shadow", palette: "shadow", unlockPoints: 15, blurb: "A sleek night prowler, unlocked at 15 study points." },
  { id: "snowy", name: "Snowy", palette: "snowy", unlockPoints: 50, blurb: "Fluffy and calm, unlocked at 50 study points." },
  { id: "celestial", name: "Celestial", palette: "celestial", unlockPoints: 120, blurb: "A legendary starlit cat, unlocked at 120 study points." },
];

const ACCESSORY_MILESTONES = [
  { id: "bandana", unlockPoints: 5 },
  { id: "boots", unlockPoints: 20 },
  { id: "bell_collar", unlockPoints: 30 },
  { id: "bowtie", unlockPoints: 40 },
  { id: "scarf", unlockPoints: 65 },
  { id: "flower_crown", unlockPoints: 85 },
  { id: "party_hat", unlockPoints: 130 },
];

const TOY_MILESTONES = [
  { id: "mouse", unlockPoints: 10 },
  { id: "feather", unlockPoints: 35 },
  { id: "teddy", unlockPoints: 55 },
];

const FOOD_MILESTONES = [
  { id: "fish", unlockPoints: 15 },
  { id: "can", unlockPoints: 45 },
  { id: "milk", unlockPoints: 75 },
];

const DECOR_MILESTONES = [
  { id: "plant", unlockPoints: 12 },
  { id: "frame", unlockPoints: 25 },
  { id: "bed", unlockPoints: 45 },
  { id: "lamp", unlockPoints: 70 },
  { id: "trophy", unlockPoints: 100 },
];

// Combined, sorted milestone timeline shown in the Study tab.
const MILESTONES = [
  ...CAT_CATALOG.filter(c => c.unlockPoints > 0).map(c => ({
    points: c.unlockPoints, label: `Unlock ${c.name} the cat`, kind: "cat", refId: c.id,
  })),
  ...ACCESSORY_MILESTONES.map(a => ({
    points: a.unlockPoints, label: `Unlock ${ACCESSORIES[a.id].name}`, kind: "accessory", refId: a.id,
  })),
  ...TOY_MILESTONES.map(t => ({
    points: t.unlockPoints, label: `Unlock ${TOYS[t.id].name} toy`, kind: "toy", refId: t.id,
  })),
  ...FOOD_MILESTONES.map(f => ({
    points: f.unlockPoints, label: `Unlock ${FOODS[f.id].name}`, kind: "food", refId: f.id,
  })),
  ...DECOR_MILESTONES.map(d => ({
    points: d.unlockPoints, label: `Unlock ${DECOR[d.id].name}`, kind: "decor", refId: d.id,
  })),
].sort((a, b) => a.points - b.points);
