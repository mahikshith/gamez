# Crawlers

Crawlers are four-legged lizards that walk the rings. They all use one rig, `src/render/crawlers.js`:

- `drawCrawler(ctx, x, y, s, t, opts, species)` draws one.
- `crawlerAnim()` blends between poses. A walk that stops runs on until all four feet are down.

Each species has its own skin and its own trait. Every trait helps the player in one way and gets in the way in another.

So far this is art and design only. No crawler is wired into a level yet. The QA strips come from `tools/salamander-qa/`:

```
node tools/salamander-qa/shoot.cjs [salamander scenario | species:scenario ...]
```

## Traits

| Crawler | Where | Trait (what it does) | Advantage for the player | Disadvantage for the player | Counter (weakness) |
|---|---|---|---|---|---|
| **Lava Salamander** (1.8 m snout to hips, the boss) | Volcano, L21–25 | Walks the channels and climbs through ring gaps. Every few seconds it rears up and breathes a fire jet onto a ring wall. That section stays red-hot for about 4 s. | Thorns on a hot section burn away. It grips both walls, so turning the ring it stands on carries it round: the player can steer it. | An egg that touches the hot section cracks. The salamander also blocks the channel it is in. | **Water orb or water egg:** it hisses and cools to grey stone, harmless for a few seconds, then backs off. A **stone egg** rolling into it dazes it. On a win it dives into a lava pit. |
| **Frost Gecko** (1.1 m) | Frozen Lake, L11–14 | Walks on top of a ring, not in the channel. The section it walks over freezes for a while. | On ice, eggs slide fast and need less ring turning. A frozen ring surface can carry an egg over a short gap. | On ice an egg can't stop. It overshoots a gap or the nest, and slides into spikes. | **Fire** (fire egg, fire orb or a hot ring) melts it into a puddle with its eyes floating on top, and its ice thaws. A few seconds later it pulls itself back together. |
| **Thorn-back Lizard** (1.5 m, wide and spiny) | Wild Woods L6–9, Crystal Caves L16–19 | Waddles along a channel. Every so often it hunches and flicks a thorn off its back. The thorn lands behind it and stays there, working like a spike. | Thorns land in a predictable trail. The lizard is slow and easy to time a path around. | The channel behind it fills with thorns. Once thorns cover a route, that route is closed. | A **stone egg** rolling into it, or a **dash chick**, knocks it onto its back. It flails, then rights itself. While it is on its back, every thorn it dropped crumbles. |
| **Chameleon** (1.4 m, long curled tail) | Storm Peaks L26–29, Fortress L31–34 | Takes on the colour of the ring or floor it sits on, so it is nearly invisible until it moves. Its tongue snatches a power orb from about 2 m away. | You can bait it. Leave a bad orb in its reach and it takes that orb off the board. While it is still, its eyes give it away. | It steals the orbs you were aiming for, and can cross your egg's path without being seen. | If it swallows a **bad orb** (fox curse), it flashes bright colours, runs off in a panic and drops every orb it stole. The orbs go back on the board where it drops them. |

## Notes for wiring (later)

- **Scale.** `s = SPECIES[name].svl * k`, where k is px per metre. The snout goes at `(x, y)`.
- **Path.** Pass `trail(d)`, the walked path in px space, so the body and the planted feet follow the curve. Passing `curve` (1/R) is also enough for a plain channel arc.
- **Walking position.** Pass `gait`, the distance walked in px. A crawler on the ring surface (the frost gecko) walks at the ring radius. The others walk at the channel middle.
- **Face direction.** Give each crawler a stable `opts.id`. The face flips so it always reads upright on screen, and the id keeps that from flickering.
- **Positions the game can read back.** `opts.out` returns:
  - the feet;
  - the fire jet tip (salamander);
  - the tongue tip and its progress `k` (chameleon);
  - the popping thorn, `{x, y, k}` (thorn-back). Spawn the real hazard where it lands, then draw it with `drawCrawlerThorn(ctx, x, y, r, rot, crumble)`.
- **Chameleon colour.** Read the ring or floor colour under the chameleon and pass it as `camoColor`. Ease `camo` to 1 when it sits still and toward 0 when it walks.
- **Draw cost.** Headless software Chromium, 2× canvas:

  | Species | Walk | Busiest pose |
  |---|---|---|
  | Salamander | 1.3 ms | about 3.9 ms (fire breath) |
  | Gecko | 1.3 ms | about 2 ms |
  | Thorn-back | 1.4 ms | about 2.5 ms |
  | Chameleon | 1.5 ms | about 2.2 ms |
