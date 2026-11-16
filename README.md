# Last Rail

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/firtualz/last-rail/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/firtualz/last-rail/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![license MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![vanilla JS](https://img.shields.io/badge/vanilla-JS%20%2B%20Canvas%202D-blue)](./game)

**Build the rail. Outrun the Void.**

A train races toward Dawn Terminus, 300 tiles away — but the track ahead does
not exist yet. Lay each rail tile by tile, in real time, in front of the
moving train, collect Lumen crystals on the way, and keep ahead of the Void
that chases you from behind. Reach **tile 300** or the darkness catches you.

## How to play

| Control | Does |
| --- | --- |
| Click a palette card / 1–4 | Select a piece (STRAIGHT 1, CURVE 2, JUNCTION 4, BRIDGE 5 LUMEN) |
| Click a tile | Build the selected piece (green = valid, red = invalid) |
| Drag in a straight line | Lay Straight rails one after another |
| R / right-click | Rotate the ghost preview 90° |
| Space | Use Boost from inventory (train ×1.5 for 5s) |
| Q | Use Void Shield from inventory (Void frozen 5s) |
| Click a rock / X | Bulldoze a rock (5 LUMEN) |
| P | Pause · R in pause/station/end screens: restart · M: sound |

Between stages, stop at the Station: pick 1 of 3 Depot Draft boons and buy
Boost, Void Shield, or the Ember Lantern at the shop. One win condition:
**reach tile 300 — DAWN TERMINUS**. One lose condition: **the Void catches
you** (out of rail, or the gap closes). Stage 5 brings the Void Herald, whose
Surge jumps +3 tiles every 20 seconds — telegraphed 2 seconds ahead.

## Run it

```sh
node serve.ts   # http://localhost:8080
```

A pure static game: vanilla JS + Canvas 2D, no libraries, no network.
Deterministic screenshots: `?shot=cover|title|play|nightend`.

## How Last Rail differs

The core loop — laying track in front of a moving train while collecting
resources on the route — is shared with Unrailed!, and we say so openly.
What makes Last Rail different: (1) single-player only (Unrailed! is co-op);
(2) no resource gathering — no chopping, mining, or watering; (3) a Lumen
per-tile economy with a priced build palette; (4) a Void chaser with gap
math and a boss Surge; (5) a run that ends at tile 300 across 5 stages with
draft and shop (not endless procedural). No combat, no turrets, no shooting.

An entry for [make.fun best-game-01](https://make.fun/bounty/best-game-01).
