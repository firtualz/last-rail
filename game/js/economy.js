// LAST RAIL — ekonomi: Lumen, kristal, inventory, shop, draft (§2, §8.1, §9.2).
import { PRICES, CRYSTAL_LUMEN, START_LUMEN, START_BOOST, MAX_BOOST, MAX_SHIELD, BOONS, CHAIN_MAX_MULT } from './config.js';

export class Economy {
  constructor(startLumen = START_LUMEN, scoreMult = 1) {
    this.lumen = startLumen;
    this.boost = START_BOOST;
    this.shield = 0;
    this.lantern = false; // Ember Lantern: sekali per run
    this.boons = []; // id boon yang sudah diambil (rank II = id muncul 2x)
    this.crystalsCollected = 0;
    this.lumenEarned = 0; // total Lumen dari kristal + delivery (untuk statistik)
    this.toolsUsed = 0;
    this.draftOffer = null; // 3 boon yang ditawarkan di Station ini
    this.draftPicked = false;
    this.rerolled = false; // reroll sekali per Station
    // CRYSTAL CHAIN (revisi 2, item 2) — SKOR SAJA, tidak pernah Lumen.
    this.chain = 0; // kristal berurutan tanpa sel kosong di antaranya
    this.chainScore = 0; // bonus skor kumulatif dari chain
    this.maxChain = 0; // chain terpanjang run ini (untuk FEAT CHAIN MASTER, revisi 3)
    this.scoreMult = scoreMult; // pengali skor akhir (difficulty)
  }

  hasBoon(id) {
    return this.boons.includes(id);
  }

  // Rank boon: 0 = belum diambil, 1 = rank I, 2 = rank II.
  boonRank(id) {
    let n = 0;
    for (const b of this.boons) if (b === id) n++;
    return n;
  }

  crystalValue() {
    let v = CRYSTAL_LUMEN;
    if (this.lantern) v += 1;
    if (this.hasBoon('bright-lamp')) v += 1;
    return Math.min(v, 5);
  }

  railPrice(kind) {
    let p = PRICES[kind] ?? 0;
    const r = this.boonRank('iron-rails');
    if (r >= 1) p = Math.max(0, p - 1); // rank I: semua -1 (min 0)
    // rank II: Junction 3->2, Bridge 4->3; Straight 0, Curve 1 tidak berubah.
    if (r >= 2 && (kind === 'junction' || kind === 'bridge')) p = Math.max(0, p - 1);
    return p;
  }

  // Kristal: Lumen seperti biasa + CHAIN (skor saja). Kembalikan detail chain
  // agar main.js bisa menampilkan popup CHAIN xN. Lumen TIDAK PERNAH berubah
  // oleh chain — satu kebocoran ke Lumen membatalkan DP VALUE-3.
  collectCrystal() {
    const v = this.crystalValue();
    this.lumen += v;
    this.lumenEarned += v;
    this.crystalsCollected++;
    this.chain += 1;
    if (this.chain > this.maxChain) this.maxChain = this.chain;
    const mult = Math.min(CHAIN_MAX_MULT, Math.max(1, this.chain));
    const chainGain = v * (mult - 1);
    this.chainScore += chainGain;
    return { value: v, chain: this.chain, mult, chainGain };
  }

  // Chain putus saat kereta melewati sel tanpa kristal (stasiun tidak mereset).
  breakChain() {
    this.chain = 0;
  }

  // Kembalikan false bila Lumen tidak cukup.
  spend(n) {
    if (this.lumen < n) return false;
    this.lumen -= n;
    return true;
  }

  earn(n) {
    this.lumen += n;
    this.lumenEarned += n;
  }

  // Daftar build run ini sebagai chips (revisi 3, item 7): boon + rank,
  // ditambah Ember Lantern bila dibeli. Contoh: ['IRON RAILS II', 'BRIGHT LAMP'].
  buildList() {
    const chips = [];
    const counts = {};
    for (const id of this.boons) counts[id] = (counts[id] || 0) + 1;
    for (const b of BOONS) {
      const n = counts[b.id] || 0;
      if (n > 0) chips.push(b.name + (n >= 2 ? ' II' : ''));
    }
    if (this.lantern) chips.push('EMBER LANTERN');
    return chips;
  }

  // --- Shop (§9.2) ---
  shopItems() {
    return [
      { id: 'boost', name: 'BOOST ENGINE', desc: 'Train x1.5 for 5s', price: PRICES.boost, owned: this.boost, max: MAX_BOOST },
      { id: 'shield', name: 'VOID SHIELD', desc: 'Void frozen 5s', price: PRICES.shield, owned: this.shield, max: MAX_SHIELD },
      { id: 'lantern', name: 'EMBER LANTERN', desc: 'Crystal +1 LUMEN, forever', price: PRICES.lantern, owned: this.lantern ? 1 : 0, max: 1 },
    ];
  }

  buyShop(id) {
    if (id === 'boost') {
      if (this.boost >= MAX_BOOST) return false;
      if (!this.spend(PRICES.boost)) return false;
      this.boost++;
      return true;
    }
    if (id === 'shield') {
      if (this.shield >= MAX_SHIELD) return false;
      if (!this.spend(PRICES.shield)) return false;
      this.shield++;
      return true;
    }
    if (id === 'lantern') {
      if (this.lantern) return false;
      if (!this.spend(PRICES.lantern)) return false;
      this.lantern = true;
      return true;
    }
    return false;
  }

  // --- Depot Draft (§8.1, revisi 2: stacking rank II) ---
  // Pool = boon yang belum dimiliki (tawaran rank I) + boon stackable yang
  // sudah dimiliki di rank I (tawaran rank II). Boon ekonomi (maxRank 1)
  // yang sudah dimiliki TIDAK PERNAH ditawarkan lagi.
  offerDraft(rng) {
    const pool = [];
    for (const b of BOONS) {
      const r = this.boonRank(b.id);
      if (r === 0) pool.push({ id: b.id, name: b.name, desc: b.desc, rank: 1, synergy: b.synergy });
      else if (r === 1 && b.maxRank >= 2) pool.push({ id: b.id, name: b.name + ' II', desc: b.desc2, rank: 2, synergy: b.synergy });
    }
    const offer = [];
    const copy = pool.slice();
    while (offer.length < 3 && copy.length > 0) {
      const i = Math.floor(rng() * copy.length);
      offer.push(copy.splice(i, 1)[0]);
    }
    this.draftOffer = offer;
    this.draftPicked = false;
    this.rerolled = false;
    return offer;
  }

  rerollDraft(rng) {
    if (this.rerolled || this.draftPicked) return null;
    if (!this.spend(PRICES.reroll)) return null;
    this.rerolled = true;
    return this.offerDraft(rng);
  }

  pickBoon(id) {
    if (this.draftPicked || !this.draftOffer) return false;
    const b = this.draftOffer.find((x) => x.id === id);
    if (!b) return false;
    this.boons.push(id);
    this.draftPicked = true;
    if (id === 'spare-parts') this.earn(15); // +15 LUMEN langsung di Station ini
    return true;
  }
}
