// lint819: the layout breaks already open when the checker came in (2026-11-27), on tools/test-layout.mjs's key states.
// NOT exemptions: this is the worklist the pages are being fixed against (the full one: scratchpad lint819/report-now.md).
// test-layout fails on any break not here and not in tools/layout-allow.cjs, and names entries here that no longer
// happen (fixed: delete them). Written by `node tools/test-layout.mjs --baseline`; never add a line by hand to get green.
module.exports = [
  "450x1000 L12-play CROWD hud:scoreLabel x hud:score @rest", // 1.8 px apart
  "450x1000 L6-intro BALANCE page @rest", // empty band 514 px (52 % of the height) from y 68
  "450x1000 L6-intro BALANCE page @tap perk:goal", // empty band 444 px (45 % of the height) from y 138
  "450x1000 L6-intro CROWD strip:label x btn:shop:boosts @rest", // 3.4 px apart
  "450x1000 L6-intro FONTS page @rest", // 5 font sizes: 13, 15, 21/22, 25/26, 31
  "450x1000 L6-intro FONTS page @tap face:toy:glow", // 7 font sizes: 13, 15, 19, 21/22, 23, 25/26, 31
  "450x1000 L6-intro FONTS page @tap perk:goal", // 8 font sizes: 13, 15, 17, 19, 21/22, 23, 25/26, 31
  "450x1000 L6-intro ONSCREEN btn:face:toy:flame @rest", // cut by its strip: 41 % shown (27x66 of 66x66)
  "450x1000 L6-intro ONSCREEN btn:face:v:boss:raccoon @carS@end", // cut by its strip: 41 % shown (27x66 of 66x66)
  "450x1000 L6-intro TAPSIZE btn:face:toy:flame @rest", // 27x66 under 44
  "450x1000 L6-intro TAPSIZE btn:face:v:boss:raccoon @carS@end", // 27x66 under 44
  "450x1000 fail FONTS page @rest", // 5 font sizes: 15/16, 19/20, 21, 26, 30
  "450x1000 fail WORDS page @rest", // 25 words: Too many eggs broke Too many eggs lost more wins to a free spin ...
  "450x1000 levels FONTS page @mscroll@end", // 5 font sizes: 12/13, 15/16, 18, 21, 24
  "450x1000 levels FONTS page @rest", // 5 font sizes: 13, 15/16, 18, 21, 24
  "450x1000 pause BALANCE page @rest", // empty band 564 px (57 % of the height) from y 125
  "450x1000 pause CROWD btn:rs:+ x btn:rs:11 @rest", // 5.8 px apart
  "450x1000 pause CROWD btn:rs:- x btn:rs:0 @rest", // 5.8 px apart
  "450x1000 pause CROWD btn:rs:0 x btn:rs:1 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:1 x btn:rs:2 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:10 x btn:rs:11 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:2 x btn:rs:3 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:3 x btn:rs:4 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:4 x btn:rs:5 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:5 x btn:rs:6 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:6 x btn:rs:7 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:7 x btn:rs:8 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:8 x btn:rs:9 @rest", // 0 px apart
  "450x1000 pause CROWD btn:rs:9 x btn:rs:10 @rest", // 0 px apart
  "450x1000 pause TAPSIZE btn:rs:0 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:1 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:10 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:11 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:2 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:3 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:4 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:5 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:6 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:7 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:8 @rest", // 22x66 under 44
  "450x1000 pause TAPSIZE btn:rs:9 @rest", // 22x66 under 44
  "450x1000 store BALANCE page @tap tile:skin:classic", // margins top 17 px, bottom 95 px
  "450x1000 store CROWD btn:tab:boosters x btn:tile:skin:classic @sscroll@end", // 2.4 px apart
  "450x1000 store CROWD btn:tab:boosters x btn:tile:skin:speckled @sscroll@end", // 2.4 px apart
  "450x1000 store CROWD btn:tab:deals x btn:tile:skin:classic @sscroll@end", // 2.4 px apart
  "450x1000 store CROWD btn:tab:hens x btn:tile:skin:speckled @sscroll@end", // 2.4 px apart
  "450x1000 store CROWD btn:tab:hens x btn:tile:skin:striped @sscroll@end", // 2.4 px apart
  "450x1000 store CROWD btn:tab:skins x btn:tile:skin:striped @sscroll@end", // 2.4 px apart
  "450x1000 store CROWD dt:perkname x dt:perkline @tap tile:skin:lava", // 3.7 px apart
  "450x1000 store CROWD dt:perkname x dt:perkline @tap tile:skin:speckled", // 3.9 px apart
  "450x1000 store FONTS page @rest", // 5 font sizes: 13/14, 15/16, 18, 22, 26
  "450x1000 store FONTS page @tap tile:skin:classic", // 8 font sizes: 13/14, 15/16, 18, 20, 22, 25/26, 27, 30
  "450x1000 store FONTS page @tap tile:skin:lava", // 6 font sizes: 13/14, 15/16, 18/19, 22/23, 25/26, 28
  "450x1000 store FONTS page @tap tile:skin:speckled", // 8 font sizes: 13/14, 15/16, 17/18, 19/20, 22, 24, 26, 28
  "450x1000 store WORDS page @rest", // 72 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:bauble", // 90 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:classic", // 80 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:dino", // 94 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:frosty", // 91 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:galaxy", // 95 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:lava", // 96 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:speckled", // 93 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 store WORDS page @tap tile:skin:striped", // 92 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 title CROWD title:logo x btn:settings @rest", // 3.8 px apart
  "450x1000 title CROWD title:logo x title:sub @rest", // 1.8 px apart
  "450x1000 title FONTS page @rest", // 5 font sizes: 13, 15, 18/19, 21, 29
  "450x1000 title TAPSIZE btn:settings @rest", // 41x41 under 44
  "450x1000 title WORDS page @rest", // 13 words: Get every egg home to the hen FREE PLAY Level Levels Daily Extras
  "450x1000 win ALIGN stack[double,next] @rest", // wide buttons' edges differ: left 130.6 px, right 0 px
  "450x1000 win CROWD win:hen x win:badges @rest", // 4.1 px apart
  "450x1000 win CROWD win:total x win:best @rest", // 5.2 px apart
  "450x1000 win FONTS page @rest", // 8 font sizes: 14/15, 17/18, 19, 23, 25/26, 31, 41, 68
  "853x384 L12-play FONTS page @rest", // 4 font sizes: 11, 13/14, 16, 18
  "853x384 L12-play TAPSIZE btn:pause @rest", // 39x39 under 44
  "853x384 L6-intro CROWD intro:capname x intro:cap0 @tap perk:goal", // 5.3 px apart
  "853x384 L6-intro CROWD strip:label x btn:shop:boosts @rest", // 2.8 px apart
  "853x384 L6-intro FONTS page @rest", // 5 font sizes: 9, 13, 18/19, 21/22, 24
  "853x384 L6-intro FONTS page @tap face:toy:glow", // 6 font sizes: 9, 13, 16, 18/19, 21/22, 24
  "853x384 L6-intro FONTS page @tap perk:goal", // 6 font sizes: 9, 13/14, 16, 18/19, 21/22, 24
  "853x384 L6-intro ONSCREEN btn:face:chick @carS@end", // cut by its strip: 42 % shown (23x54 of 54x54)
  "853x384 L6-intro ONSCREEN btn:face:orb:fire_green @rest", // cut by its strip: 42 % shown (23x54 of 54x54)
  "853x384 L6-intro TAPSIZE btn:adboost @rest", // 43x43 under 56
  "853x384 L6-intro TAPSIZE btn:face:chick @carS@end", // 23x54 under 44
  "853x384 L6-intro TAPSIZE btn:face:orb:fire_green @rest", // 23x54 under 44
  "853x384 L6-intro TAPSIZE btn:go @rest", // 396x49 under 56
  "853x384 L6-intro TAPSIZE btn:shop:boosts @rest", // 43x43 under 56
  "853x384 L6-intro TAPSIZE btn:strip:more @rest", // 43x43 under 56
  "853x384 fail CROWD fail:near:pic x fail:ally @rest", // 5.9 px apart
  "853x384 fail FONTS page @rest", // 5 font sizes: 12/13, 15/16, 17, 21, 24
  "853x384 fail TAPSIZE btn:retry @rest", // 326x54 under 56
  "853x384 fail WORDS page @fscroll@end", // 25 words: Too many eggs lost more wins to a free spin A farm friend can ...
  "853x384 fail WORDS page @rest", // 22 words: Too many eggs lost more wins to a free spin A farm friend can ...
  "853x384 levels CROWD btn:lv:0 x btn:lv:1 @mscroll@end", // 2.8 px apart
  "853x384 levels FONTS page @rest", // 4 font sizes: 11, 13, 15, 18
  "853x384 levels TAPSIZE btn:back @rest", // 40x40 under 44
  "853x384 levels TAPSIZE btn:chest @rest", // 95x39 under 44
  "853x384 levels TAPSIZE btn:shop @rest", // 95x39 under 44
  "853x384 levels TAPSIZE btn:spin @rest", // 95x39 under 44
  "853x384 pause CROWD btn:rs:+ x btn:rs:11 @rest", // 5.6 px apart
  "853x384 pause CROWD btn:rs:- x btn:rs:0 @rest", // 5.6 px apart
  "853x384 pause CROWD btn:rs:0 x btn:rs:1 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:1 x btn:rs:2 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:10 x btn:rs:11 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:2 x btn:rs:3 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:3 x btn:rs:4 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:4 x btn:rs:5 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:5 x btn:rs:6 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:6 x btn:rs:7 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:7 x btn:rs:8 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:8 x btn:rs:9 @rest", // 0 px apart
  "853x384 pause CROWD btn:rs:9 x btn:rs:10 @rest", // 0 px apart
  "853x384 pause TAPSIZE btn:rs:0 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:1 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:10 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:11 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:2 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:3 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:4 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:5 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:6 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:7 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:8 @rest", // 22x63 under 44
  "853x384 pause TAPSIZE btn:rs:9 @rest", // 22x63 under 44
  "853x384 store BALANCE page @tap tile:skin:classic", // margins top 18 px, bottom 39 px
  "853x384 store BALANCE page @tap tile:skin:lava", // margins top 14 px, bottom 33 px
  "853x384 store CROWD btn:tab:boosters x btn:tab:hens @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:boosters x btn:tile:skin:lava @sscroll@end", // 1.8 px apart
  "853x384 store CROWD btn:tab:boosters x btn:tile:skin:striped @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:deals x btn:tab:boosters @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:deals x btn:tile:skin:galaxy @sscroll@end", // 1.8 px apart
  "853x384 store CROWD btn:tab:deals x btn:tile:skin:lava @sscroll@end", // 1.8 px apart
  "853x384 store CROWD btn:tab:deals x btn:tile:skin:speckled @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:deals x btn:tile:skin:striped @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:hens x btn:tab:skins @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:hens x btn:tile:skin:dino @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:hens x btn:tile:skin:thunder @sscroll@end", // 1.8 px apart
  "853x384 store CROWD btn:tab:skins x btn:tile:skin:bauble @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:skins x btn:tile:skin:dino @rest", // 5.5 px apart
  "853x384 store CROWD btn:tab:skins x btn:tile:skin:thunder @sscroll@end", // 1.8 px apart
  "853x384 store CROWD btn:tab:skins x btn:tile:skin:treasure @sscroll@end", // 1.8 px apart
  "853x384 store CROWD dt:perkname x dt:perkline @tap tile:skin:speckled", // 2.8 px apart
  "853x384 store CROWD store:tart:skin:bauble x store:tname:skin:bauble @rest", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:candy x store:tname:skin:candy @rest", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:classic x store:tname:skin:classic @rest", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:dino x store:tname:skin:dino @rest", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:gator x store:tname:skin:gator @sscroll@end", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:golden x store:tname:skin:golden @sscroll@end", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:robot x store:tname:skin:robot @sscroll@end", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:speckled x store:tname:skin:speckled @rest", // 4.9 px apart
  "853x384 store CROWD store:tart:skin:striped x store:tname:skin:striped @rest", // 4.9 px apart
  "853x384 store FONTS page @rest", // 5 font sizes: 10/11, 12/13, 16, 18, 22
  "853x384 store FONTS page @tap tile:skin:classic", // 6 font sizes: 10/11, 12/13, 14, 16, 18/19, 21/22
  "853x384 store FONTS page @tap tile:skin:lava", // 7 font sizes: 10/11, 12/13, 14, 16/17, 18/19, 20, 22
  "853x384 store TAPSIZE btn:dt:close @tap tile:skin:lava", // 299x42 under 44
  "853x384 store TAPSIZE btn:tab:boosters @rest", // 119x33 under 44
  "853x384 store TAPSIZE btn:tab:deals @rest", // 119x33 under 44
  "853x384 store TAPSIZE btn:tab:hens @rest", // 119x33 under 44
  "853x384 store TAPSIZE btn:tab:skins @rest", // 119x33 under 44
  "853x384 store TAPSIZE btn:try:skin:lava @tap tile:skin:lava", // 299x42 under 44
  "853x384 store WORDS page @rest", // 58 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @sscroll@end", // 48 words: Shop Free Power-ups Hens Eggs Frosty Freezes on touch Galaxy Longer orb reach Lava ...
  "853x384 store WORDS page @tap tile:skin:bauble", // 76 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:classic", // 66 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:dino", // 80 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:frosty", // 77 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:galaxy", // 81 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:lava", // 82 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:speckled", // 79 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 store WORDS page @tap tile:skin:striped", // 78 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 title BALANCE page @rest", // margins top 9 px, bottom 60 px
  "853x384 title CROWD title:logo x title:sub @rest", // 2.6 px apart
  "853x384 title FONTS page @rest", // 6 font sizes: 11, 13, 15, 18/19, 22, 30
  "853x384 title TAPSIZE btn:settings @rest", // 35x35 under 44
  "853x384 title WORDS page @rest", // 13 words: Get every egg home to the hen FREE PLAY Level Levels Daily Extras
  "853x384 win CROWD btn:spin x btn:double @rest", // 4.4 px apart
  "853x384 win CROWD btn:win:shop x btn:double @rest", // 4.4 px apart
  "853x384 win CROWD win:hen x win:badges @rest", // 3.5 px apart
  "853x384 win FONTS page @rest", // 8 font sizes: 12/13, 15/16, 17, 19, 22, 26, 35, 42
  "853x384 win TAPSIZE btn:next @rest", // 257x47 under 56
  "853x384 win TAPSIZE btn:restart @rest", // 114x47 under 56
];
