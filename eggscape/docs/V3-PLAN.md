# Eggscape v3: from "new backdrop" to "new puzzle"

Source: mykee's playtest of v2 (unlocked test build), 2026-11-01 12:26 UTC. Verdict: right direction, not there yet.
Levels feel repetitive: environments only change the picture, never the thinking. Camera too zoomed in. Snake too
late, too slow, too small. Powers too few and some meaningless. Claude did not bring enough of its own ideas.

Every point from that message is listed below (G = mykee, I = Claude). Status: `v3` = in this round, `later` = parked.

## The one big change

**Environments, not levels.** Each environment runs 5 levels and has its own *trait*: a hazard, a villain and a
signature power that only exist there, introduced in its first level and pushed harder in each next one. The
fifth level is a boss. Levels reuse the same assets (Angry Birds / Candy Crush model); what changes is the
problem to solve. 7 environments × 5 = **35 levels**.

| Env | Levels | Trait (hazard / villain) | Signature power | Boss (level 5) |
|-----|--------|--------------------------|-----------------|----------------|
| 1 Farm | 1–5 | Gate doors and crack ladder; the fox drops a bad orb now and then | Red flame (fetch it low, burn the thorns for the others) | Fox at the top throws thorn balls and curse orbs |
| 2 Wild Woods | 6–10 | **Snake** from L6, two snakes from L9; wooden barriers it melts with venom | Rock skin (all eggs turn to stone: snakes can't eat them); Sun flame chick | Big snake + small snake together |
| 3 Frozen Lake | 11–15 | Ice (slippery), **one-way rings**, falling icicles that crack | Slow time | Blizzard: gusts + one-way rings + icicles |
| 4 Crystal Caves | 16–20 | **Portals that suck** from every side, more of them, spitting orbs; glass floors | Magnet / Guardian feather | Portal maze with snake |
| 5 Volcano | 21–25 | **Lava rocks** erupt from the back: melt a hole in a ring for a while; touching one blasts the egg away | Water shell (cools lava, immune to embers) | Erupting volcano, rocks every few seconds |
| 6 Storm Peaks | 26–30 | Lightning + **eagle** that dives at eggs in the outer channel, and also grabs snakes | Guardian feather (all eggs invincible 6 s) | Eagle and snake at once |
| 7 Fox's Fortress | 31–35 | Everything mixed; the fox walks the nest area and throws curse orbs | All | The fox himself |

Stars open the next environment (Angry Birds style) at a low bar (about half the stars), so kids are never stuck.

## mykee's points (2026-11-01)

| # | Point | v3 answer | Status |
|---|-------|-----------|--------|
| G1 | Camera zooms in far too much (L9, L10, most levels); can't tell which ring you are in | (Corrected by mykee 12:30: auto zoom stays, it just goes too far.) Auto zoom keeps following the eggs but much gentler: always shows the ring the eggs are in plus at least one ring around it, never crops a big vault down to the eggs | v3 |
| G2 | Let the player zoom out (and back in) whenever they want | Zoom buttons in the HUD (− / +) plus pinch and mouse wheel; the player's choice overrides auto zoom until they tap "auto" again | v3 |
| G3 | Loves gate doors; use them in early levels | Doors from L2 | v3 |
| G4 | L1–L2 far too easy | L1 already 3 rings with thorns; L2 has doors | v3 |
| G5 | More rings even in early levels | 3 rings from L1, 4 by L3, 5–7 later | v3 |
| G6 | More kinds of power-ups early; show we're not playing around | Orbs from L1, a new power every 1–2 levels, portals from L4 | v3 |
| G7 | "Epic loop competition" from the first level | Read as: a strong core loop with challenge from L1 (3-star score chase, bonus goals, fuse pressure, boss every 5 levels). Ask mykee whether something else was meant | v3 |
| G8 | Remodel the snake like the Breaker princess-level snake | Reuse mykee's own Breaker snake: rendered head sprite (13 expressions) + lit, tapered body | v3 |
| G9 | Snake has a whitish outline/background: remove | New drawing has no light halo | v3 |
| G10 | Snake too slow; Medium should be challenging | ~2× speed on Medium, mode-scaled | v3 |
| G11 | Snake too small | Body about twice as thick; head sprite sized to the channel | v3 |
| G12 | Snake first appears at L17: too late | Snake from L6 | v3 |
| G13 | Two snakes | Two snakes from L9 | v3 |
| G14 | Vertical barriers that block the snake; snake melts them with venom | Wooden barriers across channels; snake stops, spits venom (telegraphed, ~3 s), barrier melts. Eggs are blocked too, so barriers are puzzle pieces | v3 |
| G15 | Harder levels need more powers | Powers scale with the environment | v3 |
| G16 | Stone and water powers have no meaningful effect | Stone: can't crack, can't be eaten, smashes thorns and cracked glass it lands on. Water: soft landings, cools lava rocks, immune to embers | v3 |
| G17 | By L17 most powers and portals never seen | Every power appears in at least two environments; portals from L4 | v3 |
| G18 | Portals should suck eggs in from all directions | Radial pull within ~1.2 m | v3 |
| G19 | More portals, more orbs floating out of them | 2–3 portals per level in Crystal Caves, portals spit orbs | v3 |
| G20 | Only one kind of thorn | Sharp hooks, blunt spikes, retracting spikes, plus new **thorn curtains** across gaps that only fire can clear | v3 |
| G21 | Different barriers | Wooden barriers (snake-meltable, fire-burnable), ice blocks (melt in volcano), grates (small eggs only) | v3 |
| G22 | Rings that turn only one way, with matching obstacles | One-way (ratchet) rings with arrow marks | v3 |
| G23 | Spots impossible without a power | Thorn curtains (need red flame), solid rings (need black flame), barriers (fire or snake) | v3 |
| G24 | Ad for a power in the menu, so players feel good about the ad | Pre-level card: "Watch an ad: free booster". Stuck mid-level: ad hint already; add ad for one power orb | v3 |
| G25 | Reasoning: send one egg down to grab a power, destroy thorns, let the rest through | Levels designed around this from L3 (fetch-the-flame puzzles) | v3 |
| G26 | Reasoning from L3–L4, not L17 | Each environment teaches its trait in level 1 of the env, then 4 levels of twists | v3 |
| G27 | Other shapes (rectangles, squares) | Parked by mykee for later | later |
| G28 | Some hard levels need powers to pass | Power-gated levels, the power is always reachable in the level | v3 |
| G29 | Slow-time power | Hourglass orb: world at half speed 6 s, fuse paused | v3 |
| G30 | Fox-dropped bad power: eggs turn foxy and time runs faster for 5–8 s | Fox curse orb: eggs get fox ears and grin, fuse runs 2×, 6 s | v3 |
| G31 | Volcano must have a purpose: villain/rocks melt rings, blast eggs | Lava rocks (see table) | v3 |
| G32 | Every environment has an effect that works against or for the eggs | Trait table above | v3 |
| G33 | Chick earlier (L6–7), bigger, with a real trait; for or against us? | Chick from L7, ~1.5× bigger. Trait: it **pecks away thorns it lands on** (for us) but **snakes and the eagle go for chicks first** (bait). Flutters, never cracks | v3 |
| G34 | Crack ladder: 1–2 ring drops crack, 3 cracks = broken, green heals; subtle, not frustrating | Straight drop through 2 rings = 1 crack, 3 rings = 2 cracks, 4+ = broken; 1-ring drops and sponge landings stay safe (else every move hurts). Green heals **all** cracks. Clear crack stages on the egg + HUD. Easy: one level gentler | v3 |
| G35 | Fortress fox banners have no proper face: reuse the fox | Banners use the real fox drawing | v3 |
| G36 | Fortress has nothing special | Fox walks the nest area and throws curse orbs; boss at L35 | v3 |
| G37 | One environment per level is pointless; build on the previous level, go past 30 | 5 levels per environment, 35 levels | v3 |
| G38 | Learn from REA teardowns: Angry Birds birds have traits, Candy Crush specials | Special egg types with traits (I3) and unique powers | v3 |
| G39 | Invincible power: all eggs safe a few seconds (escape snake) | Guardian feather, 6 s | v3 |
| G40 | Turn all eggs to stone so the snake can't eat | Rock skin, 6 s | v3 |
| G41 | Design urgency: looks hopeless, but there is always a way out | Boss and snake levels always place a counter-power on the path; planner verifies | v3 |
| G42 | Chick bigger; looks small next to the fox | 1.5× | v3 |
| G43 | Volcano thorns blend into the red background | Volcano thorns dark obsidian with a bright rim; background less red behind rings | v3 |
| G44 | Win animation: hen smiles, fox cries | Win card: happy hen dance + crying fox | v3 |
| G45 | Moving nest + moving hen every time: why? | Moving nest only where there is a reason (fox chases the hen in the Fortress, river current on the lake); others static or two nests | v3 |
| G46 | Bosses | One per environment (table) | v3 |
| G47 | Didn't like the dragon silhouette | Removed; dragon theme dropped | v3 |
| G48 | Other animals (eagle) that prey on snake and hen | Eagle in Storm Peaks: dives at eggs in the outer channel, grabs snakes | v3 |
| G49 | Use sub-agents on cheaper models, break work into sub-steps, self-check visuals | Done: art/camera/research/review on Sonnet; physics and levels on Opus; screenshots checked every step | v3 |
| G50 | Use /advisor, caveman, ponytail | Not runnable in this cloud thread; applied the spirit (smallest complete change, terse replies, cheaper models) | v3 |
| G51 | Research hooks and what makes asset-frozen games addictive | research doc, round 3 | v3 |

## Claude's own ideas (v3)

| # | Idea | Why |
|---|------|-----|
| I1 | Environment traits + boss per environment (table above) | The core fix for "repetitive" |
| I2 | Chick as bait: predators chase chicks first | Hatching becomes a decision: sacrifice speed for a decoy |
| I3 | **Special eggs with traits** (Angry Birds birds): Ostrich egg (big, heavy: smashes thorns and cracked glass, too big for narrow gaps), Quail egg (small: slips through grates, cracks easily), Duck egg (floats on the lake current) | Each level asks "which egg goes where" |
| I4 | Grates: ring floors only quail eggs fall through | Pairs with I3 |
| I5 | Star gates between environments, low bar | Reason to replay for 3 stars without blocking kids |
| I6 | Boss intro card with the villain's face and one line | Makes bosses an event |
| I7 | Fetch-the-power puzzles: thorn curtains across gaps, the flame is one ring lower | Directly mykee's G25 idea, as a repeatable puzzle |
| I8 | Danger music/heartbeat when a snake is within one ring of an egg | Urgency without text |

## Work split (sub-agents)

1. Camera + zoom button (Sonnet), `src/main.js` camera/HUD only.
2. Art (Sonnet): `src/render/characters.js`, `src/render/powers.js`, `src/themes.js`.
3. Research (Sonnet): hooks, environment traits, power uniqueness, star gates. Writes the research doc.
4. Snake and predators (Opus): snake speed/size/multi, barriers + venom, eagle, fox thrower, chick bait.
5. Physics and powers (Opus): crack ladder, portal suction, one-way rings, new powers, stone/water rework, egg
   types, grates, thorn curtains, lava rocks.
6. Levels (Opus, after 4–5): 7 environments × 5 levels, generator + planner, validated on every mode.
7. Review + QA (Sonnet): bugs, overlap check, screenshots of every new thing.

## Follow-up (mykee, 2026-11-01 12:35)

- Offered reference images (M365 image generator). Prompts sent for: snake sheet, eagle, chick/hen/fox moods, 7 world key art, item sheet. Use as direction only; game art stays drawn in code.
- **More physics fun / crazy ideas** (for the level designer, pick the ones that fit an environment): trampolines, fans that blow eggs sideways, see-saws, balloons that lift an egg, a catapult that flings an egg up a ring, conveyor ring sections, chain reactions (one falling egg knocks others loose).
- **Harder must never mean "quit"**: sawtooth curve (each boss is followed by a breather level), every hard spot has a visible way out (planner-verified), Easy stays gentle, hints and boosters on hand, the fail card shows how close you got.

## v3.2 backlog (mykee, 2026-11-01 18:56) — nothing here may be skipped

Audit before planning (levels.js feature scan): gears appear in **one** level (L29); the chick only via the gold flame;
the salamander is only a cropped portrait on the L25 intro card, never in play. Root cause: mechanics were built
but never placed across the level curve, and nothing checked coverage. Fix the process, not just the levels.

| # | Item | Plan |
|---|------|------|
| K1 | Gears missing from early levels | Teach a single gear pair at L2–L3, two pairs by L6–L8, gear chained to a one-way ring later; gears recur in every environment |
| K2 | Coverage check | tools/coverage.mjs prints a mechanic × level matrix; rule: every mechanic is taught alone in one level, then reused in ≥3 later levels; build fails the check if not |
| K3 | Boss intro cards are cut-off M365 crops | Show the full card image in a frame, or nothing. No M365 crop is ever used as an in-level actor |
| K4 | Salamander missing in Volcano | Real code-drawn salamander creature (L21–25, boss L25), with its own trait unlike the snake; frame strip approved before it ships |
| K5 | Chick kinds with powers (Angry Birds) | Egg look tells which chick it hatches; one tap = one power. Candidates: glow bomb (flash stuns predators), dash (very fast, knocks snakes), flier (lifts off, clears a thorn curtain), big (puffs up, blocks a channel), ice breaker (shatters an ice ring section) |
| K6 | Birds that break rings | Ice rings / ice walls that only the ice-breaker chick (or ice orb) can shatter |
| K7 | More hooking ideas + real research | Research doc eggscape-v32-chicks-hooks.md; Claude brings its own ranked ideas |
| K8 | Eagle | Rebuilt with real anatomy and a purpose (in progress, v3.1) |
| K9 | Magnet | Magnetic field effect, no tether line (in progress, v3.1) |

**Standing rule (mykee, 2026-11-01 19:26): animation first.** Every new character, creature or animated thing gets a
dedicated animation pass before it enters any level: frame strips of every move at real in-game scale next to the rings,
reviewed critically, and shown to mykee. Only then is it wired into gameplay.

## v3.3 backlog (mykee, 2026-11-01 19:56)

| # | Item | Plan |
|---|------|------|
| M1 | Salamander approved | Fix brows/grin/lava pit, wire into L21–25 with the aimable fire-breath trait |
| M2 | Crawler family on the salamander rig, each with its own advantage + disadvantage | Frost gecko (freezes the ring it walks: fast slides, overshoot risk; fire melts it off), thorn-back lizard (lays thorns; stone egg flips it), chameleon (near-invisible, tongue steals orbs; fox curse orb makes it spit them out). Strips on the review page first |
| M3 | Thorns not animated | Living thorns: sway, timed retract/extend, crumble when burned, thorn vines that grow across a gap (urgency) |
| M4 | Game slows after the snake (L11+) | A chaser in every world, 5–7 rings, earlier mechanics mixed in; keep "lock in and go" pressure |
| M5 | 35 levels too few | 50 levels = 10 worlds × 5; 3 new worlds built around the new crawlers and chick kinds |
| M6 | Full app later | Parked by mykee; HTML first |

## v3.3 additions (mykee, 2026-11-01 19:59)

| # | Item | Plan |
|---|------|------|
| M7 | Hen floats beside the nest | Done first pass: contact shadow, straw at her feet, idle pecks. Next: a fully animated code-drawn hen (walks, pecks, flaps, cheers), via the review page |
| M8 | Sea creatures and frogs | Reef world (theme exists): octopus (tentacles on the snake's chain body: grabs an egg and holds it until inked/zapped), fish schools (current that pushes eggs), frog (hops across rings through gaps, tongue snatches orbs or chicks; it's the only creature that crosses rings). Animation-first |
| M9 | Snake vs salamander style | Snake head is a soft raster sprite, salamander is crisp cel-shaded code art: redraw the snake head in code in the same style, keeping the face mykee likes; compare side by side on the review page |
| M10 | Shapes beyond circles | Prototype square, hex and spiral vaults on the same physics, plus a "tilt the whole vault" mechanic; one prototype level each on the review page before any level set |

## v3.4 powers and rivalries (mykee, 2026-11-01 20:12)

Eggs are weak while they fall, so powers must make them strong and push creatures back. Every power has an upside AND a
downside. Each new power is animated and shown on the review page before it enters a level.

| Power | Upside | Downside |
|-------|--------|----------|
| Frost Nova | Whole vault freezes 6 s: every creature locked in ice, thorns turn brittle (an egg landing shatters them) | Rings are frozen for the first 2 s, then icy: eggs slide fast and can overshoot gaps |
| Shock Ring | Electrifies one ring for 6 s: any creature touching it is zapped and runs off for ~8 s | Eggs touching that ring get bounced away (no crack, but you lose position) |
| Thunderclap | Every creature on the board is stunned 5 s (bigger ones 3 s) | Gates and portals black out while it lasts |
| Laser Beak | Tap to fire a beam from the centre: cuts thorns, barriers and thorn curtains along its line, scares creatures off it | It also burns every sponge pad it crosses (hard landings after) |
| Spin Storm | The whole rig spins as one for 3 s and flings creatures out to the rim | Eggs tumble too and can hit thorns |
| Pepper Puff | Creatures sneeze and flee for 8 s | A smoke cloud hides part of the board for 3 s |
| Shrink Ray | Eggs shrink to quail size 8 s: slip through grates, creatures lose track of them | Small eggs crack easier |
| Iron Shell | Eggs turn steel: can't crack or be eaten, smash thorns | Heavy: they need wide gaps and fall fast past sponge |
| Decoy Egg | A fake egg every creature chases for 8 s | It can plug a gap |

**Power combos (Candy Crush style hook):** two powers active at once make a combo, e.g. Frost + Shock = frozen creatures
are knocked out of the vault; Laser + Spin = the beam sweeps a full circle; Shrink + Iron = tiny cannonballs. Combos are
shown once, then players discover the rest (combo album page).

**Creature rivalries:** when two creatures go for the same egg they fight instead: snake vs salamander (venom vs fire),
snake vs snake (clash, done), eagle vs snake (grab, being rebuilt), frog vs chameleon (tongue duel). The fight is a
4–6 s window the player uses to move eggs past; the winner chases harder after. Each fight has its own animation,
reviewed first. A food chain makes it readable: eagle > snake > frog; salamander scares frogs; chicks distract everyone.

## v3.2 placement pass (K1, K2, K5)

Gears (K1). The sim now takes gear trains, not just pairs: spec `gear: true` on rings i and i+1 links i, i+1 and i+2,
and each ring turns against its neighbours. Brass teeth and a brass idler cog mark every geared edge; while the player
turns one ring, every ring it drives shows a brass arrow the way it is going, and the first time ever a "Geared!" label
says so. A ring geared to a one-way ring is one-way too (gen.mjs keeps its floor thorns off).

| Level | Gears |
|---|---|
| L2 | First pair (rings 1-2), safe; the tip explains it |
| L3, L4, L5, L7, L8 | One pair each, moving to different rings (L4 drives the curtain ring) |
| L10 | Chain of three (rings 0-1-2) in the snake boss |
| L12 | Pair with a one-way ring |
| L17, L32, L33 | Chains of three |
| L24, L29 | Pair / two pairs |

Chick kinds in the campaign (K5). Each is taught alone with an intro card in a level that had none (the generator
requires the strong player to actually use the tap there), then comes back at least three times.

| Kind | Taught | Reused |
|---|---|---|
| Glow | L9 (two snakes) | L13, L28, L35 |
| Pick | L14 (solid hard-ice ring; a swirl makes a new orb every 9 s) | L15, L31, L34 (hard-ice rings) |
| Bulk | L18 (Ostrich Run, glass) | L20, L29, L33 |
| Swoop | L19 (adds a curtain) | L24, L32, L35 |
| Dash | L23 (snake and salamander) | L28, L30, L33 |

Coverage (K2): `node tools/coverage.mjs [--matrix]` lists where each mechanic is taught and reused, and fails when one
comes back fewer than 3 times. First run (before this pass) failed 15 mechanics, among them retracting thorns, honey,
duck egg, current, icicles, magnet and the frost orb. Those feed the pacing pass (M4) and the 50-level extension (M5).
