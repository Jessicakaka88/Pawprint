/* Static catalog of cats, accessories, and the streak milestones that unlock them. */

const ACCESSORIES = {
  bandana: { name: "Red Bandana", glyph: "🧣", slot: "neck" },
  bowtie: { name: "Blue Bowtie", glyph: "🎀", slot: "neck" },
  party_hat: { name: "Party Hat", glyph: "🎉", slot: "head" },
  bell_collar: { name: "Bell Collar", glyph: "🔔", slot: "neck" },
  flower_crown: { name: "Flower Crown", glyph: "🌸", slot: "head" },
  scarf: { name: "Cozy Scarf", glyph: "🧶", slot: "neck" },
};

const CAT_CATALOG = [
  { id: "mochi", name: "Mochi", palette: "mochi", unlockDays: 0, blurb: "Your very first desk pet. Loves sunny windowsills." },
  { id: "shadow", name: "Shadow", palette: "shadow", unlockDays: 7, blurb: "A sleek night prowler, unlocked at a 7-day streak." },
  { id: "snowy", name: "Snowy", palette: "snowy", unlockDays: 30, blurb: "Fluffy and calm, unlocked at a 30-day streak." },
  { id: "celestial", name: "Celestial", palette: "celestial", unlockDays: 100, blurb: "A legendary starlit cat, unlocked at a 100-day streak." },
];

const ACCESSORY_MILESTONES = [
  { id: "bandana", unlockDays: 3 },
  { id: "bell_collar", unlockDays: 14 },
  { id: "bowtie", unlockDays: 21 },
  { id: "scarf", unlockDays: 45 },
  { id: "flower_crown", unlockDays: 60 },
  { id: "party_hat", unlockDays: 100 },
];

// Combined, sorted milestone timeline shown in the Streak tab.
const MILESTONES = [
  ...CAT_CATALOG.filter(c => c.unlockDays > 0).map(c => ({
    days: c.unlockDays, label: `Unlock ${c.name} the cat`, kind: "cat", refId: c.id,
  })),
  ...ACCESSORY_MILESTONES.map(a => ({
    days: a.unlockDays, label: `Unlock ${ACCESSORIES[a.id].name}`, kind: "accessory", refId: a.id,
  })),
].sort((a, b) => a.days - b.days);
