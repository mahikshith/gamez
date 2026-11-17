# Noted for later (not fixed in this pass)

## Physics feel (from the feel audit, all need planner re-validation)
1. Floaty eggs everywhere: gravity 10 m/s2 (sim.js:148). Try 14-16 with CRACK_V/SHATTER_V scaled by sqrt(g/10).
2. Dead bounce: egg restitution 0.12. Try 0.2-0.22 on wood/stone only, sponge stays 0.02.
3. Eggs spin too fast (19-25 rad/s on L2,5,19,24,30,43,49,50): angularDamping 0.35 -> 0.8-1.0.
4. Sticky gaps: eggs sit over an open gap >0.6 s on L11,13,18,33(x4),36,37,41,44(x2). Gap 0.78 -> 0.84, or lip friction 0.2 + small inward nudge.
5. Rest jitter when a held ring drives into resting eggs: L28,40,49,20,50,30,15.
6. Borderline cracks at v<6 on L5,13,14,18: CRACK_V 5.6 -> 6.0 or subtract surface velocity.
7. Thorns have no grace: any graze breaks instantly on medium. Break only on tip contact or closing speed > 0.6.
8. "Missed the nest" is the commonest non-thorn death (L1,2,7,8,9,18,21,25,27,30,43,46,50): nest +0.2 m on medium or stronger drop guide.
9. Sim emits a bump event per egg per step; debounce in sim.
10. End-card timers use real setTimeout, not game time.
(Tunnelling: none found.)

## UI / journey
- New players see two cards before first play (world intro then level card): merge into one.
- Boss bar internals (boss.js drawBossBar, owl.js, kingcrab.js pips) still small flat pills.
- HUD height fixed at 104u in portrait: +6-8u would let it breathe.
- Home at 1280x720 unbalanced (vault left, logo centred).
- Daily button after claim: show a countdown.

## Board
- Rings are 0.16 m thick (about 5 px on a phone). Truly chunky rings need a thicker RING_TH plus level re-validation.
- Bigger eggs need level/physics scale changes (fewer or wider channels), not render scale.
- Honey pads and gap shutters still old flat art. Nest still pale at phone scale.
- Water world: slab wall should flip for sim.water. L8 "mushroom" theme rings do not use the mushroom material.

## Android app (0.5)
- Never run on a real phone or emulator; frame rate of the ring shader on mid-range phones unmeasured; safe area unverified.
- Hen rig not upgraded (no new anticipation/blink work). World map cards and title emblem still old flat art. Fail page sparse. Weasel art and portals not reviewed.
- Bot cannot prove L4-L5 winnable (also true in 0.4).
- No settings screen (sound, haptics, reduced motion). No music. No release-signed AAB.
- Worlds 2-10: backdrop.gd is farm only; needs per-world layers, ground, plate tint, every creature rig and mechanic from src/sim.

## Characters (cast part 1)
- Crystal Golem (L20) and the salamander boss have no boss body on screen, only ring effects: a boss level with no character. Needs a new creature.
- Gecko, thornback, chameleon are not in any of the 50 levels.
- Blizzard intro card (L15) showed an empty portrait at 1.5 s.
- Hen is squeezed on L20 and L35 (outer ring comes low beside the nest): larger nest.drop in level data.
- Thief pounce landings have no squash; tail has no follow-through. Snake entry speed is level data (delay, speed).
- Snake head, salamander, chicks, eagle, blizzard cloud: audited, judged acceptable, not rebuilt.

## Characters (cast part 2)
- Frog, octopus, status looks, Warp Gate: audited, judged acceptable, unchanged. The earlier "white outline, bigger frog" request is still not applied.
- powers2.js (newer power visuals): NOT reviewed.
- Fish are about 12 px long on a phone (FISH.len 0.34 m): draw 1.4x.
- King Crab claw head small at play scale (1.3x draw would help).
- Creatures carried by a turning ring play their walk cycle: needs a "carried" flag from the sim.
- Hermit crab is drawn upside-down on channel ceilings underwater. Gator death roll can show both eyes mid-turn.

## Parked by the owner (2026-11-13)
- Bring Wonder Vault mechanics into the main levels, Twin Vaults (linked rings across two panes) first. Owner's favourite.
- Redraw the in-ring chicks (glow chick and the other chick kinds) in the strike-chick style.
- Hen body type to match the strike chicks.
- Villain face-offs: any level with two or more villains needs a designed face-off (animation and physics).
- Gecko, thorn-back, chameleon: only in levels with no villain figure (15, 20) or new levels, never added to existing villain levels.

## Owner requests 2026-11-13 09:11 (do after current work)
- Villain info: an "i" button (and the pause screen) lists every villain in the current level with a portrait and one or two lines on what it does and how to counter it. First-time villain tips vanish too fast: keep them longer or until tapped.
- Clockwork Spider: it vanishes and reappears elsewhere to fill gaps, with no proper animation. It must visibly crawl to the gap it is going to plug.
- Clockwork Beetle: the owner could not tell what it does. Make its purpose readable in play (and in the villain info).
