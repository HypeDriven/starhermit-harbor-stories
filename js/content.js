/* Harbor Stories — versioned content: tool chains, themes, journey stages,
 * story scenes, challenges, practice presets, daily ruleset generator.
 * Shared browser (window.HSContent) / Node. Content is data-only; all
 * randomness enters through the config seed.
 */
(function (root, factory) {
  var RNG = (typeof module === 'object' && module.exports) ? require('./rng.js') : root.HSRNG;
  var api = factory(RNG);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSContent = api;
})(typeof self !== 'undefined' ? self : this, function (RNG) {
  'use strict';

  var CONTENT_VERSION = 1;

  // ---------- tool chains ----------
  // Icon + label + tier names reinforce color (color is never the only cue).
  var CHAIN_ORDER = ['hammer', 'rope', 'lantern', 'brush', 'net', 'brick'];
  var CHAINS = {
    hammer:  { label: 'Hammer',  icon: '\u{1F528}', color: 0xc96a3d, colorHC: 0xe4572e,
               tiers: ['Mallet', 'Claw Hammer', 'Sledge', 'Forge Hammer'] },
    rope:    { label: 'Rope',    icon: '\u{1FAA2}', color: 0xd9b06a, colorHC: 0xb7791f,
               tiers: ['Twine', 'Rope Coil', 'Mooring Line', 'Anchor Cable'] },
    lantern: { label: 'Lantern', icon: '\u{1F3EE}', color: 0xe8c46a, colorHC: 0xf5d90a,
               tiers: ['Candle Lamp', 'Pier Lantern', 'Storm Lantern', 'Harbor Beacon'] },
    brush:   { label: 'Brush',   icon: '\u{1F58C}', color: 0x5b7fb8, colorHC: 0x2e6fe4,
               tiers: ['Chip Brush', 'Paintbrush', 'Wide Roller', 'Mural Kit'] },
    net:     { label: 'Net',     icon: '\u{1F3A3}', color: 0x5d9c59, colorHC: 0x17a398,
               tiers: ['Hand Net', 'Cast Net', 'Trawl Net', 'Harbor Seine'] },
    brick:   { label: 'Brick',   icon: '\u{1F9F1}', color: 0xb85450, colorHC: 0xc62828,
               tiers: ['Loose Brick', 'Paver Stack', 'Stone Block', 'Harbor Keystone'] }
  };
  function itemLabel(chain, tier) {
    var ch = CHAINS[chain];
    return ch ? ch.tiers[Math.min(tier, ch.tiers.length - 1)] : chain + ' ' + tier;
  }

  // ---------- themes (cosmetic only: light, sky, water, wood) ----------
  var THEMES = [
    { id: 'golden-hour', name: 'Golden Hour',  unlockStars: 0,
      palette: { sky: 0x3a2a4a, horizon: 0xf2a65a, sun: 0xffd9a0, water: 0x1d2f45,
                 wood: 0x8a5a34, woodDark: 0x5d3a20, dock: 0x6e4526, light: 0xffc98a,
                 accent: 0xffb066, fog: 0x2a1d30, ambient: 0xffe0b8 } },
    { id: 'dawn-mist', name: 'Dawn Mist',      unlockStars: 10,
      palette: { sky: 0x4a5568, horizon: 0xd8c8b8, sun: 0xfff2dd, water: 0x2e3d4a,
                 wood: 0x7a6a4a, woodDark: 0x4f4526, dock: 0x5d5230, light: 0xf0e8d0,
                 accent: 0xd8c890, fog: 0x3a4550, ambient: 0xe8e0d0 } },
    { id: 'high-noon', name: 'High Noon',      unlockStars: 25,
      palette: { sky: 0x3a6a9a, horizon: 0xaad4e8, sun: 0xffffff, water: 0x2a5a7a,
                 wood: 0x9a6a40, woodDark: 0x6a4526, dock: 0x7a5230, light: 0xfff4e0,
                 accent: 0x70c0e0, fog: 0x4a7a9a, ambient: 0xeaf4ff } },
    { id: 'stormwatch', name: 'Stormwatch',    unlockStars: 45,
      palette: { sky: 0x1e2a34, horizon: 0x5a7a80, sun: 0xc8d8d0, water: 0x14222c,
                 wood: 0x5a4a3a, woodDark: 0x3a2e24, dock: 0x4a3a2c, light: 0xa8d8c8,
                 accent: 0x6fd0b8, fog: 0x16202a, ambient: 0xb8d0cc } },
    { id: 'night-market', name: 'Night Market', unlockStars: 70,
      palette: { sky: 0x141226, horizon: 0x4a3a6a, sun: 0xf0e0ff, water: 0x0e1424,
                 wood: 0x4a3a30, woodDark: 0x2e221c, dock: 0x3a2c24, light: 0xffb060,
                 accent: 0xff9a50, fog: 0x100e20, ambient: 0x9080c0 } }
  ];

  // ---------- journey ----------
  // Compact authored rows:
  // [id, name, seed, [rows,cols], nChains, startItems, [spawnEvery,spawnPer],
  //  tasks:[[label,[[chainIdx,tier,count],...]],...],
  //  moveLimit, timeLimitSec, parMoves, parTimeSec, themeIdx, intro]
  var J = [
    // Chapter 1 — The Old Pier (hammer, rope, lantern; brush from j03)
    ['j01','First Light Repairs', 201,[5,5],3, 8,[3,1],
      [['Coil the mooring lines',[[1,1,1]]],['Hang the pier lamp',[[2,1,1]]]],
      0,0,14,180,0,'Merge two matching tools side by side to build better ones, then deliver what the repairs ask for.'],
    ['j02','Planks and Pegs',      202,[5,5],3, 8,[3,1],
      [['Re-nail the loose planks',[[0,1,2]]],['Tie off the cleats',[[1,1,1]]]],
      0,0,20,200,0,''],
    ['j03','Tob\u2019s Workbench', 203,[5,5],4, 9,[3,1],
      [['Stain the workbench',[[3,1,1]]],['Sort the tool wall',[[0,1,2]]]],
      0,0,22,220,0,'A new chain: brushes. The tide brings whatever the tasks need most.'],
    ['j04','Paint the Railings',   204,[5,5],4, 9,[2,1],
      [['White railings, fresh',[[3,1,2]]],['Lamps along the rail',[[2,1,1]]]],
      0,0,22,220,0,'Supplies arrive more often now — keep open water on the board.'],
    ['j05','Line Drying Day',      205,[5,5],4, 9,[3,1],
      [['Twist a long line',[[1,2,1]]],['Trim the lamp wicks',[[2,1,2]]]],
      0,0,26,260,0,'Tier-2 tools take four base supplies. Plan your merges.'],
    ['j06','The Long Bench',       206,[5,5],4, 9,[3,1],
      [['Rebuild the long bench',[[0,2,1]]],['Lash the bench legs',[[1,1,2]]]],
      30,0,24,240,0,'New: a move limit. Every action must pull its weight.'],
    ['j07','Storm Prep',           207,[5,5],4,10,[2,1],
      [['Rig the storm lamps',[[2,2,1]]],['Brace the shutters',[[0,1,2]]],['Bundle kindling',[[3,1,1]]]],
      0,0,30,300,0,''],
    ['j08','Pier Reopening',       208,[5,5],4,10,[2,1],
      [[' ceremonial arch',[[0,2,1],[1,2,1]]],['Light the gateway',[[2,1,2]]]],
      34,0,28,280,0,'MASTERY: the whole pier job at once.'],

    // Chapter 2 — Boathouse Row (adds net)
    ['j09','Net Loft',             209,[5,6],5,10,[3,1],
      [['Mend the hand nets',[[4,1,2]]],['Coil the anchor line',[[1,1,1]]]],
      0,0,24,260,0,'A new chain: nets. Five chains share the board now.'],
    ['j10','Canvas and Cord',      210,[5,6],5,10,[3,1],
      [['Re-rig the sail ties',[[1,2,1]]],['Patch the trawl nets',[[4,1,2]]]],
      0,0,28,280,0,''],
    ['j11','The Blue Boathouse',   211,[5,6],5,10,[2,1],
      [['Paint the blue boathouse',[[3,2,1]]],['Hang its doors',[[0,1,2]]]],
      0,0,28,300,0,''],
    ['j12','Tob\u2019s Apprentice',212,[5,6],5,10,[3,1],
      [['Plane the oars',[[0,2,1]]],['Weave a casting net',[[4,2,1]]]],
      36,0,30,300,0,''],
    ['j13','High Tide',            213,[5,6],5,11,[2,2],
      [['Raise the lamp platform',[[2,2,1]]],['Stow the nets high',[[4,1,2]]]],
      0,0,30,300,0,'Two supplies wash in at once. Deliver promptly.'],
    ['j14','Double Berth',         214,[5,6],5,11,[2,1],
      [['Twin mooring lines',[[1,2,2]]],['Freshen the hulls',[[3,1,1]]]],
      0,0,32,320,0,''],
    ['j15','Race the Tide',        215,[5,6],5,10,[2,1],
      [['Caulk the skiff',[[0,2,1]]],['Lanterns for the fog',[[2,2,1]]]],
      0,240,28,220,1,'New: a time limit. The tide waits for no one.'],
    ['j16','Regatta Day',          216,[5,6],5,11,[2,1],
      [['Rig the regatta nets',[[4,2,2]]],['Tune the starting bell',[[0,2,1]]],['Paint the buoys',[[3,2,1]]]],
      40,0,34,340,1,'MASTERY: five chains, three jobs, one tide.'],

    // Chapter 3 — Market Steps (tier 3 appears)
    ['j17','Sela\u2019s Oven Door',217,[6,6],5,11,[3,1],
      [['Fix the oven hinge',[[0,2,1]]],['Scrub the soot',[[3,2,1]]]],
      0,0,30,320,1,''],
    ['j18','Awning Stripes',       218,[6,6],5,11,[2,1],
      [['Paint the grand awning',[[3,3,1]]]],
      0,0,30,340,1,'Tier-3 tools take eight base supplies. Chain your merges.'],
    ['j19','Crate Stacks',         219,[6,6],5,11,[2,1],
      [['Bind the crate stacks',[[1,2,2]]],['Net the day\u2019s catch',[[4,2,1]]]],
      0,0,34,340,1,''],
    ['j20','Lantern Row',          220,[6,6],5,12,[2,1],
      [['Raise the festival beacon',[[2,3,1]]],['Trim the stall lamps',[[2,1,2]]]],
      0,0,36,360,1,''],
    ['j21','The Fish Stall',       221,[6,6],5,12,[2,1],
      [['Mend Sela\u2019s great seine',[[4,3,1]]]],
      0,0,34,360,1,''],
    ['j22','Coin for the Ferryman',222,[6,6],5,11,[2,1],
      [['Splice the ferry cable',[[1,3,1]]],['Peg the ticket board',[[0,2,1]]]],
      44,0,38,380,1,''],
    ['j23','Festival Rush',        223,[6,6],5,12,[2,2],
      [['Decorate the square',[[3,2,2]]],['Lamps for the dance',[[2,2,1]]]],
      0,300,34,280,2,'Double supplies and a ticking clock.'],
    ['j24','Grand Market',         224,[6,6],5,12,[2,1],
      [['The merchant\u2019s hammer',[[0,3,1]]],['Drape the stalls',[[4,2,2]]],['Light every corner',[[2,2,1]]]],
      48,0,42,420,2,'MASTERY: the market must open at dawn.'],

    // Chapter 4 — Seawall & Chapel (adds brick)
    ['j25','First Stones',         225,[6,6],6,12,[3,1],
      [['Lay the first stones',[[5,1,2]]],['Tamp the footing',[[0,1,2]]]],
      0,0,32,360,2,'A new chain: bricks. Six chains, one crowded quay.'],
    ['j26','Mortar Lines',         226,[6,6],6,12,[2,1],
      [['Point the mortar',[[5,2,1]]],['Hoist with new rope',[[1,1,2]]]],
      0,0,34,360,2,''],
    ['j27','The Leaning Post',     227,[6,6],6,12,[2,1],
      [['Rebuild the leaning post',[[5,2,2]]]],
      0,0,36,380,2,''],
    ['j28','Bell Rope',            228,[6,6],6,12,[2,1],
      [['Splice the great bell rope',[[1,3,1]]],['Lamps in the nave',[[2,1,2]]]],
      0,0,40,400,2,''],
    ['j29','Chapel Windows',       229,[6,6],6,12,[2,1],
      [['Reglaze the windows',[[3,3,1]]],['Set the sills',[[5,2,1]]]],
      0,0,40,420,2,''],
    ['j30','After the Storm',      230,[6,6],6,13,[2,1],
      [['Drag the wrack nets',[[4,2,2]]],['Patch the wall gaps',[[5,2,1]]]],
      46,0,40,420,2,''],
    ['j31','The Long Wall',        231,[6,7],6,13,[2,1],
      [['Cap the long wall',[[5,3,1]]],['Drive the stakes',[[0,2,2]]]],
      0,0,44,440,2,''],
    ['j32','Seawall Complete',     232,[6,7],6,13,[2,1],
      [['Set the harbor keystone',[[5,3,1]]],['The keeper\u2019s cable',[[1,3,1]]],['Beacon along the wall',[[2,2,2]]]],
      52,360,46,340,3,'MASTERY: hold back the sea itself.'],

    // Chapter 5 — Lighthouse Point
    ['j33','The Winding Path',     233,[6,7],6,13,[2,1],
      [['Lights up the winding path',[[2,2,2]]],['Whitewash the gate',[[3,2,1]]]],
      0,0,40,440,3,''],
    ['j34','Keeper\u2019s Quarters',234,[6,7],6,13,[2,1],
      [['Forge the hearth crane',[[0,3,1]]],['Floor the loft',[[5,2,1]]]],
      0,0,44,460,3,''],
    ['j35','Brass and Glass',      235,[6,7],6,13,[2,1],
      [['Rebuild the great lens lamp',[[2,3,1]]],['Polish the brass',[[0,2,1]]]],
      0,0,46,460,3,''],
    ['j36','Wren\u2019s Discovery',236,[6,7],6,14,[2,1],
      [['Salvage the wreck net',[[4,3,1]]],['Haul with stout lines',[[1,2,2]]]],
      0,0,46,480,3,''],
    ['j37','The Oil Room',         237,[6,7],6,14,[2,1],
      [['Seal the oil tanks',[[1,3,1]]],['Floor the oil room',[[5,2,2]]]],
      0,0,48,480,3,''],
    ['j38','Spiral Stairs',        238,[6,7],6,14,[2,1],
      [['The stair-smith\u2019s hammer',[[0,3,1]]],['Stone stair treads',[[5,3,1]]]],
      54,0,48,500,3,''],
    ['j39','Before the Storm',     239,[7,7],6,14,[2,2],
      [['Twin storm beacons',[[2,3,2]]]],
      0,360,44,340,4,'The sky is already turning. Work fast.'],
    ['j40','The Beacon Lit',       240,[7,7],6,15,[2,1],
      [['The forge hammer',[[0,3,1]]],['The anchor cable',[[1,3,1]]],['The harbor keystone',[[5,3,1]]],['Oil for the first light',[[2,2,1]]]],
      60,420,54,400,4,'MASTERY: relight Brinemist Quay. Everything you know, at once.']
  ];

  function expandLevel(row, idx) {
    var tasks = row[7].map(function (t) {
      return {
        label: t[0].replace(/^\s+/, ''),
        reqs: t[1].map(function (r) { return { chain: CHAIN_ORDER[r[0]], tier: r[1], count: r[2] }; })
      };
    });
    return {
      id: row[0], version: CONTENT_VERSION, kind: 'journey', index: idx,
      name: row[1], seed: row[2],
      board: { rows: row[3][0], cols: row[3][1] },
      chains: CHAIN_ORDER.slice(0, row[4]), maxTier: 3,
      startItems: row[5],
      spawn: row[6] ? { every: row[6][0], per: row[6][1] } : null,
      tasks: tasks,
      moveLimit: row[8] || 0, timeLimitSec: row[9] || 0,
      par: { moves: row[10], timeSec: row[11] },
      mechanics: { undo: true, hint: true },
      endless: false,
      theme: THEMES[row[12]].id,
      intro: row[13] || '',
      chapter: Math.min(4, Math.floor(idx / 8)),
      mastery: /MASTERY/.test(row[13] || ''),
      scene: SCENES[idx]
    };
  }

  var CHAPTER_NAMES = ['The Old Pier', 'Boathouse Row', 'Market Steps', 'Seawall & Chapel', 'Lighthouse Point'];

  // ---------- story scenes ----------
  // One short scene per journey stage, revealed on completion.
  // [title, line, [choiceA, replyA], [choiceB, replyB]]
  var SCENES = [
    ['First Light', 'Old Tob runs a thumb along the new planks. "Holds. The quay remembers your hands already."',
      ['Ask about the pier', '"My grandfather laid these piles. You\u2019re walking on his patience."'],
      ['Ask about Tob', '"Just a man who refuses to let the sea win an argument."']],
    ['Pegs', 'A gull steals a peg and thinks better of it. Tob laughs for the first time in years.',
      ['Laugh with him', 'He wipes his eye. "Good. The harbor needed a laugh today."'],
      ['Chase the gull', 'It drops the peg at your feet, offended. Tob approves.']],
    ['The Workbench', 'The bench gleams. Tob sets his palm flat on it, like greeting an old friend.',
      ['Sand one more corner', '"Care like that can\u2019t be taught," he says quietly.'],
      ['Admire the grain', '"Driftwood from the \u201994 storm. Nothing here is wasted."']],
    ['Fresh Paint', 'The railings shine white in the low sun. A fisherman nods as he passes — the harbor salute.',
      ['Nod back', 'It feels like being let into a very old club.'],
      ['Keep painting', 'The last stroke lands just as the light turns gold.']],
    ['Long Lines', 'Wren, the harbor kid, appears with a knot she found. "Can you beat this one?"',
      ['Untie it slowly', 'She watches your fingers like a hawk. "Again. Slower."'],
      ['Show her the twist', 'Her eyes go wide. "The sea ties knots. We just learn them."']],
    ['The Long Bench', 'Two old sailors claim the rebuilt bench instantly, arguing about a race from 1971.',
      ['Settle the argument', 'You declare it a tie. Both pretend to be annoyed. Both are pleased.'],
      ['Just listen', 'The story gets better every time they tell it.']],
    ['Storm Sky', 'The lamps are rigged before the clouds arrive. Tob counts them twice.',
      ['Watch the storm roll in', '"Good light is a promise," Tob says. "We keep ours."'],
      ['Check the lashings', 'Everything holds. The wind only finds what you finished.']],
    ['Reopening', 'The whole quay walks the new pier at sunset. Nobody says much. Nobody needs to.',
      ['Walk it with Tob', 'Halfway out he stops. "This is why," he says. The water does the rest.'],
      ['Stand at the rail', 'Wren leans next to you. "What\u2019s next, fixer?"']],
    ['Net Loft', 'The loft smells of tar and salt. The mended nets hang like sleeping animals.',
      ['Run a hand over the mesh', 'Every knot you tied holds firm.'],
      ['Open the shutters', 'Light pours in. Even the dust looks gold.']],
    ['Canvas', 'A sail snaps in the wind, repaired and proud. Tob salutes it with his coffee.',
      ['Salute back', '"To boats that outlive their builders," he toasts.'],
      ['Check the ties', 'The new cord sings a low note in the wind.']],
    ['Blue Paint', 'The blue boathouse glows. Sela from the market brings buns in official appreciation.',
      ['Take a bun', 'Still warm. Cardamom. The harbor runs on these, apparently.'],
      ['Save one for Tob', 'He pretends he doesn\u2019t want it. He wants it.']],
    ['The Apprentice', 'Wren planes her first oar. It is not straight. It is hers.',
      ['Praise the work', 'She beams. Tob pretends not to smile and fails.'],
      ['Offer to fix it', '"No," she says fiercely. Fair enough.']],
    ['High Water', 'The tide slaps the top step. Everything you stowed sits dry above it.',
      ['Watch the water', 'It rises, finds nothing of yours, and retreats.'],
      ['Mark the tide line', 'Wren scratches the date into the post: a small harbor record.']],
    ['Double Berth', 'Two boats raft side by side, sharing your new lines like good neighbors.',
      ['Toast the skippers', 'They argue over who got the better berth. Neither moves.'],
      ['Coil the spare line', 'A tidy dock is its own reward.']],
    ['Fog Coming', 'The last lantern is hung as the fog swallows the point. The light holds.',
      ['Stand in the beam', 'For a moment you are the only thing the harbor can see.'],
      ['Listen', 'Somewhere out there, a boat finds its way home by your work.']],
    ['Regatta', 'Seven boats cross the line on your nets and buoys. The quay roars.',
      ['Cheer the winner', 'A twelve-year-old in a borrowed dinghy. Obviously.'],
      ['Check the buoys', 'Still painted, still proud, slightly rammed.']],
    ['Oven Door', 'Sela\u2019s oven door shuts with a satisfying iron clunk. Bread is imminent.',
      ['Stay for the first loaf', 'It cracks like thunder and tastes like morning.'],
      ['Take the recipe', '"It\u2019s just flour and stubbornness," Sela says.']],
    ['The Awning', 'Stripes of red and cream unroll over the square. The market has a sky again.',
      ['Watch from below', 'Shoppers drift in out of the sun without noticing your work. Perfect.'],
      ['Wave at Sela', 'She conducts the square like an orchestra of stalls.']],
    ['Crates', 'Every crate is bound, stacked, and labeled in Wren\u2019s surprisingly good handwriting.',
      ['Inspect her labels', '"EELS — DO NOT SIT." Sound advice.'],
      ['Stack one more', 'The tower leans. You stop. Everyone agrees this was wise.']],
    ['Festival Lights', 'The beacon catches as dusk falls. Lantern Row answers it, one by one.',
      ['Count the lights', 'Twenty-three. The harbor has never looked so awake.'],
      ['Find Tob', 'He\u2019s watching from the pier, coffee in hand, saying nothing at all.']],
    ['The Great Seine', 'The mended net spreads across the stall like a silver field. Sela whistles.',
      ['Ask what it caught', '"Nothing yet," she grins. "But it\u2019s ready for everything."'],
      ['Check the knots', 'Two hundred knots. Each one yours.']],
    ['The Ferry', 'The ferry cable sings taut. The first crossing of the year leaves on time.',
      ['Ride it across', 'The ferryman refuses your coin. "Fixers ride free."'],
      ['Wave from the dock', 'The passengers wave back like you\u2019re a landmark. Maybe you are.']],
    ['Festival Eve', 'The square hums. Lanterns, paint, music leaking from the tavern door.',
      ['Dance one song', 'Wren spins, Sela claps, and for one song the work is done.'],
      ['Walk the quiet edge', 'Beyond the lights, the sea keeps its own rhythm.']],
    ['Grand Opening', 'The market opens at dawn. Sela rings the bell. The sound rolls over the water.',
      ['Ring it again', 'She lets you. It sounds like a beginning.'],
      ['Buy the first bun', '"Full price," Sela says, and gives you two.']],
    ['First Stones', 'The seawall\u2019s first course sits level and true. The harbor approves in waves.',
      ['Tap the stone', 'A deep, honest sound. It will outlive everyone here.'],
      ['Look out to sea', 'The water tests the wall once, politely.']],
    ['Mortar', 'Your joints are clean. Tob inspects them and finds, to his visible discomfort, nothing wrong.',
      ['Tease him', '"I found a flaw," he lies, pointing at a seagull.'],
      ['Take the compliment', 'His silence is the highest grade he gives.']],
    ['The Leaning Post', 'The old post stands straight for the first time in thirty years.',
      ['Push it gently', 'It doesn\u2019t move. Not even a little.'],
      ['Read its carvings', 'Initials from 1954. You add nothing. Some things are archives.']],
    ['The Bell', 'The chapel bell speaks at noon. Windows rattle. Wren covers her ears, delighted.',
      ['Ring it again', 'The whole quay looks up. Worth it.'],
      ['Let it fade', 'The echo crosses the water twice before it dies.']],
    ['New Windows', 'Evening light pours through the reglazed windows in sheets of amber.',
      ['Sit in the light', 'For five minutes, the chapel is the warmest place on earth.'],
      ['Wave Tob inside', 'He pretends to inspect the frames. He stays for the quiet.']],
    ['Wrack Line', 'The storm\u2019s debris is cleared. The beach is a beach again.',
      ['Keep a shell', 'Wren says it\u2019s lucky. It goes in your pocket.'],
      ['Skip a stone', 'Four skips. A personal record, unwitnessed and therefore legendary.']],
    ['The Long Wall', 'You walk the finished length. On one side, harbor. On the other, everything else.',
      ['Stand against the wind', 'The wall takes it so the town doesn\u2019t have to.'],
      ['Touch the capstone', 'Cool, solid, permanent. Like a promise kept in stone.']],
    ['Wall\u2019s End', 'The seawall is complete. Tob sets the last lamp and says only: "On to the light."',
      ['Ask what he means', '"The lighthouse has been dark eleven years," he says. "Not twelve."'],
      ['Study the point', 'The tower waits on its rock, patient as stone.']],
    ['The Path', 'Lamps climb the winding path like a string of low stars.',
      ['Walk it slowly', 'Each lamp lights the next bend. Like the whole year, really.'],
      ['Look back', 'The town glows below. You helped build that glow.']],
    ['Keeper\u2019s Hearth', 'Maren, the old keeper, lights the quarters\u2019 first fire in a decade.',
      ['Warm your hands', '"A lighthouse is just a house that promises," she says.'],
      ['Ask about the dark years', '"Storms took the lens. Grief kept the door. You fixed both."']],
    ['The Lens', 'The rebuilt lamp turns slowly in your hands, catching the sun and throwing it miles.',
      ['Look through the glass', 'The horizon bends. Out there, ships you\u2019ll never see will steer by this.'],
      ['Polish one more pane', 'Maren nods once. From her, it\u2019s a parade.']],
    ['The Wreck', 'Wren\u2019s wreck yields its secret: a keeper\u2019s log, last page unfinished.',
      ['Read the last line', '"Light held. All ships safe. K." You finish the sentence: "Keeper."'],
      ['Give it to Maren', 'She reads it twice, then puts it where the lamp can see it.']],
    ['The Oil Room', 'Tanks sealed, floor laid. The heart of the light is ready to beat.',
      ['Test the valve', 'It turns like it was oiled yesterday, not eleven years ago.'],
      ['Listen to the tower', 'The wind moves through it like breath before a word.']],
    ['The Stairs', 'One hundred and twelve steps, each one solid. You climb them slowly, counting.',
      ['Stop at the top', 'The whole harbor fits in one look: pier, boats, market, wall. Your year.'],
      ['Count them again', 'One hundred and twelve. Every one of them yours.']],
    ['Storm Coming', 'The sky goes violet. Both beacons burn steady as the first rain arrives.',
      ['Watch from the gallery', 'The storm throws everything it has. The light doesn\u2019t blink.'],
      ['Stand with Maren', '"Now," she says. "While it matters."']],
    ['The Beacon Lit', 'The great lens turns. Light sweeps the sea for the first time in eleven years, and Brinemist Quay answers with every lamp it has.',
      ['Light your own lamp', 'You hold it to the rail. One small light among hundreds. It counts.'],
      ['Just watch', 'Tob, Sela, Wren, Maren — nobody speaks. The light speaks for everyone.']]
  ];

  // ---------- challenges ----------
  var CHALLENGES = [
    { id: 'c1', name: 'Tide Clock',       seed: 601, kind: 'challenge',
      board: { rows: 5, cols: 5 }, chains: CHAIN_ORDER.slice(0, 4), maxTier: 3,
      startItems: 8, spawn: { every: 3, per: 1 },
      tasks: [ { label: 'Repairs before dark', reqs: [ { chain: 'hammer', tier: 2, count: 1 }, { chain: 'lantern', tier: 1, count: 2 } ] } ],
      moveLimit: 0, timeLimitSec: 150, par: { moves: 26, timeSec: 140 },
      mechanics: { undo: false, hint: true }, endless: false, theme: 'golden-hour',
      intro: 'Ninety seconds of light left. No undo.' },
    { id: 'c2', name: 'Rope Burn',        seed: 602, kind: 'challenge',
      board: { rows: 5, cols: 5 }, chains: CHAIN_ORDER.slice(0, 4), maxTier: 3,
      startItems: 8, spawn: { every: 3, per: 1 },
      tasks: [ { label: 'The rigger\u2019s list', reqs: [ { chain: 'rope', tier: 2, count: 2 }, { chain: 'hammer', tier: 1, count: 1 } ] } ],
      moveLimit: 22, timeLimitSec: 0, par: { moves: 19, timeSec: 200 },
      mechanics: { undo: false, hint: true }, endless: false, theme: 'dawn-mist',
      intro: 'Twenty-two moves. Waste nothing.' },
    { id: 'c3', name: 'Cramped Jetty',    seed: 603, kind: 'challenge',
      board: { rows: 4, cols: 4 }, chains: CHAIN_ORDER.slice(0, 3), maxTier: 3,
      startItems: 6, spawn: { every: 2, per: 1 },
      tasks: [ { label: 'Small dock, big job', reqs: [ { chain: 'lantern', tier: 2, count: 1 }, { chain: 'rope', tier: 1, count: 2 } ] } ],
      moveLimit: 0, timeLimitSec: 0, par: { moves: 26, timeSec: 260 },
      mechanics: { undo: true, hint: true }, endless: false, theme: 'high-noon',
      intro: 'Sixteen cells. Every delivery is urgent.' },
    { id: 'c4', name: 'Master\u2019s Order', seed: 604, kind: 'challenge',
      board: { rows: 6, cols: 6 }, chains: CHAIN_ORDER.slice(0, 5), maxTier: 3,
      startItems: 9, spawn: { every: 2, per: 1 },
      tasks: [ { label: 'The keeper\u2019s commission', reqs: [ { chain: 'lantern', tier: 3, count: 1 }, { chain: 'brush', tier: 3, count: 1 } ] } ],
      moveLimit: 44, timeLimitSec: 0, par: { moves: 38, timeSec: 420 },
      mechanics: { undo: false, hint: false }, endless: false, theme: 'stormwatch',
      intro: 'Two tier-3 masterworks. No assists.' },
    { id: 'c5', name: 'Storm Surge',      seed: 605, kind: 'challenge',
      board: { rows: 5, cols: 5 }, chains: CHAIN_ORDER.slice(0, 4), maxTier: 3,
      startItems: 7, spawn: { every: 1, per: 1 },
      tasks: [ { label: 'Hold the jetty', reqs: [ { chain: 'net', tier: 2, count: 1 }, { chain: 'rope', tier: 2, count: 1 } ] } ],
      moveLimit: 0, timeLimitSec: 0, par: { moves: 30, timeSec: 300 },
      mechanics: { undo: true, hint: true }, endless: false, theme: 'stormwatch',
      intro: 'The tide delivers after EVERY action.' },
    { id: 'c6', name: 'The Gauntlet',     seed: 606, kind: 'challenge',
      board: { rows: 6, cols: 6 }, chains: CHAIN_ORDER.slice(0, 6), maxTier: 3,
      startItems: 10, spawn: { every: 2, per: 2 },
      tasks: [ { label: 'Everything at once', reqs: [ { chain: 'brick', tier: 3, count: 1 }, { chain: 'hammer', tier: 2, count: 2 } ] },
               { label: 'And the lights', reqs: [ { chain: 'lantern', tier: 2, count: 2 } ] } ],
      moveLimit: 56, timeLimitSec: 360, par: { moves: 48, timeSec: 340 },
      mechanics: { undo: false, hint: false }, endless: false, theme: 'night-market',
      intro: 'Move limit, clock, double tide, no assists. The full test.' }
  ].map(function (c) { c.version = CONTENT_VERSION; return c; });

  // ---------- practice presets ----------
  var PRACTICE = [
    { id: 'casual', name: 'Casual',
      board: { rows: 5, cols: 5 }, chains: CHAIN_ORDER.slice(0, 3), maxTier: 3,
      startItems: 7, spawn: { every: 4, per: 1 },
      tasks: [ { label: 'Odd jobs', reqs: [ { chain: 'hammer', tier: 1, count: 1 } ] },
               { label: 'Harbor chores', reqs: [ { chain: 'rope', tier: 1, count: 1 } ] } ],
      moveLimit: 0, timeLimitSec: 0, par: { moves: 16, timeSec: 200 },
      mechanics: { undo: true, hint: true }, endless: false },
    { id: 'apprentice', name: 'Apprentice',
      board: { rows: 5, cols: 6 }, chains: CHAIN_ORDER.slice(0, 5), maxTier: 3,
      startItems: 9, spawn: { every: 2, per: 1 },
      tasks: [ { label: 'Boathouse list', reqs: [ { chain: 'hammer', tier: 2, count: 1 }, { chain: 'net', tier: 1, count: 2 } ] },
               { label: 'Lamp duty', reqs: [ { chain: 'lantern', tier: 1, count: 2 } ] } ],
      moveLimit: 0, timeLimitSec: 0, par: { moves: 28, timeSec: 300 },
      mechanics: { undo: true, hint: true }, endless: false },
    { id: 'expert', name: 'Expert',
      board: { rows: 6, cols: 6 }, chains: CHAIN_ORDER.slice(0, 6), maxTier: 3,
      startItems: 10, spawn: { every: 2, per: 1 },
      tasks: [ { label: 'Keeper\u2019s commission', reqs: [ { chain: 'lantern', tier: 3, count: 1 } ] },
               { label: 'Wall works', reqs: [ { chain: 'brick', tier: 2, count: 2 } ] } ],
      moveLimit: 0, timeLimitSec: 0, par: { moves: 40, timeSec: 420 },
      mechanics: { undo: true, hint: true }, endless: false }
  ].map(function (p) { p.version = CONTENT_VERSION; p.kind = 'practice'; return p; });

  // ---------- score chase ruleset (endless) ----------
  var SCORE_CHASE = {
    id: 'score-std', version: CONTENT_VERSION, kind: 'score', name: 'Endless Tide',
    board: { rows: 6, cols: 6 }, chains: CHAIN_ORDER.slice(0, 5), maxTier: 3,
    startItems: 9, spawn: { every: 2, per: 1 },
    tasks: [ { label: 'Harbor commission 1.1', reqs: [ { chain: 'hammer', tier: 1, count: 1 } ] },
             { label: 'Harbor commission 1.2', reqs: [ { chain: 'lantern', tier: 1, count: 1 } ] } ],
    moveLimit: 0, timeLimitSec: 0, par: null,
    mechanics: { undo: false, hint: false }, endless: true, theme: 'golden-hour',
    intro: 'Commissions never stop. Play until the board jams solid.'
  };

  // ---------- daily ----------
  // One immutable ruleset per UTC day, derived purely from the date string.
  function dailyConfig(dateStr) {
    var seed = RNG.hashString('harborstories-daily-v' + CONTENT_VERSION + '-' + dateStr);
    var day = Math.floor(Date.parse(dateStr + 'T00:00:00Z') / 86400000);
    var rot = ((day % 7) + 7) % 7;
    var nChains = 4 + (rot % 3); // 4..6
    var chains = CHAIN_ORDER.slice(0, nChains);
    var dims = [[5, 5], [5, 6], [6, 6], [6, 6], [6, 7], [5, 6], [6, 6]][rot];
    function req(chainIdx, tier, count) { return { chain: chains[chainIdx % chains.length], tier: tier, count: count }; }
    var tasks = [
      { label: 'The day\u2019s commission', reqs: [ req(rot, 1 + (rot % 2), 1), req((rot + 1) % nChains, 1, 2) ] },
      { label: 'Harbor chores', reqs: [ req((rot + 2) % nChains, rot >= 4 ? 2 : 1, rot >= 5 ? 2 : 1) ] }
    ];
    return {
      id: 'daily-' + dateStr, version: CONTENT_VERSION, kind: 'daily',
      name: 'Daily ' + dateStr, seed: seed, date: dateStr,
      board: { rows: dims[0], cols: dims[1] },
      chains: chains, maxTier: 3,
      startItems: 8 + (rot % 3),
      spawn: { every: rot >= 4 ? 2 : 3, per: rot >= 5 ? 2 : 1 },
      tasks: tasks,
      moveLimit: 0, timeLimitSec: rot === 6 ? 300 : 0,
      par: { moves: 26 + nChains * 3, timeSec: 260 },
      mechanics: { undo: true, hint: true }, endless: false,
      theme: THEMES[rot % THEMES.length].id,
      intro: 'One shared seed for everyone, today only.'
    };
  }

  function utcDateString(nowMs) {
    var d = new Date(nowMs == null ? Date.now() : nowMs);
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }

  // ---------- tutorial (Learn) ----------
  function tutorialLessons() {
    return [
      { id: 't1', title: 'Walk the docks',
        text: 'This is your work dock. Move the mallet to any other open cell: tap it (or press Enter), then tap a glowing empty cell.',
        goal: { event: 'move', count: 1 },
        cfg: { id: 't1', version: CONTENT_VERSION, kind: 'tutorial', seed: 9101,
          board: { rows: 4, cols: 4 }, chains: ['hammer'], maxTier: 3, startItems: 2,
          spawn: null, tasks: [{ label: 'Far-off repairs', reqs: [{ chain: 'hammer', tier: 3, count: 1 }] }],
          moveLimit: 0, timeLimitSec: 0, par: null, mechanics: { undo: false, hint: false }, endless: false } },
      { id: 't2', title: 'Two of a kind',
        text: 'Two identical tools on ADJACENT cells merge into a better one. Merge the two mallets into a claw hammer.',
        goal: { event: 'merge', count: 1 },
        cfg: { id: 't2', version: CONTENT_VERSION, kind: 'tutorial', seed: 9102,
          board: { rows: 4, cols: 4 }, chains: ['hammer'], maxTier: 3, startItems: 0,
          spawn: null, tasks: [{ label: 'Fix the sign', reqs: [{ chain: 'hammer', tier: 1, count: 1 }] }],
          moveLimit: 0, timeLimitSec: 0, par: null, mechanics: { undo: false, hint: true }, endless: false },
        force: [{ r: 1, c: 1, item: { c: 'hammer', t: 0 } }, { r: 1, c: 2, item: { c: 'hammer', t: 0 } }] },
      { id: 't3', title: 'Deliver the goods',
        text: 'The task list (left) shows what the neighborhood needs. That claw hammer is wanted — select it and press Deliver (or D).',
        goal: { event: 'deliver', count: 1 },
        cfg: { id: 't3', version: CONTENT_VERSION, kind: 'tutorial', seed: 9103,
          board: { rows: 4, cols: 4 }, chains: ['hammer'], maxTier: 3, startItems: 0,
          spawn: null, tasks: [{ label: 'Hang the boathouse door', reqs: [{ chain: 'hammer', tier: 1, count: 1 }] }],
          moveLimit: 0, timeLimitSec: 0, par: null, mechanics: { undo: false, hint: true }, endless: false },
        force: [{ r: 2, c: 2, item: { c: 'hammer', t: 1 } }] },
      { id: 't4', title: 'The tide provides',
        text: 'Every few actions the tide delivers fresh supplies. If the board fills with no merge and nothing wanted, the harbor jams. Finish the task to win.',
        goal: { event: 'win', count: 1 },
        cfg: { id: 't4', version: CONTENT_VERSION, kind: 'tutorial', seed: 9104,
          board: { rows: 4, cols: 4 }, chains: ['hammer', 'rope'], maxTier: 3, startItems: 4,
          spawn: { every: 2, per: 1 }, tasks: [{ label: 'Rig the jetty', reqs: [{ chain: 'rope', tier: 1, count: 1 }] }],
          moveLimit: 0, timeLimitSec: 0, par: null, mechanics: { undo: false, hint: true }, endless: false },
        force: [{ r: 0, c: 0, item: { c: 'rope', t: 0 } }, { r: 0, c: 1, item: { c: 'rope', t: 0 } }] },
      { id: 't5', title: 'Second thoughts',
        text: 'In relaxed modes you can undo (U) or ask for a hint (H). Make any move or merge, then undo it to finish the lesson.',
        goal: { event: 'undo', count: 1 },
        cfg: { id: 't5', version: CONTENT_VERSION, kind: 'tutorial', seed: 9105,
          board: { rows: 4, cols: 4 }, chains: ['hammer', 'rope'], maxTier: 3, startItems: 3,
          spawn: null, tasks: [{ label: 'Far-off repairs', reqs: [{ chain: 'rope', tier: 3, count: 1 }] }],
          moveLimit: 0, timeLimitSec: 0, par: null, mechanics: { undo: true, hint: true }, endless: false } }
    ];
  }

  // ---------- achievements (stable lowercase keys, idempotent) ----------
  var ACHIEVEMENTS = [
    { key: 'first-merge',   name: 'First Merge',        desc: 'Merge your first pair of tools.' },
    { key: 'first-deliver', name: 'Signed & Delivered', desc: 'Deliver your first tool to a task.' },
    { key: 'first-repair',  name: 'First Repair',       desc: 'Complete every task in a stage.' },
    { key: 'tier3',         name: 'Masterwork',         desc: 'Craft a tier-3 master tool.' },
    { key: 'streak-6',      name: 'Harbor Rhythm',      desc: 'Reach a 6-action productive streak.' },
    { key: 'merges-250',    name: 'Dock Veteran',       desc: 'Merge 250 pairs across all play.' },
    { key: 'journey-half',  name: 'Half the Quay',      desc: 'Finish 20 journey stages.' },
    { key: 'journey-done',  name: 'Keeper of Brinemist', desc: 'Finish all 40 journey stages.' },
    { key: 'daily-7',       name: 'Regular at the Quay', desc: 'Finish 7 daily challenges.' },
    { key: 'delivers-300',  name: 'Neighborhood Hero',  desc: 'Deliver 300 tools across all play.' }
  ];

  var JOURNEY = J.map(function (row, i) { return expandLevel(row, i); });

  return {
    CONTENT_VERSION: CONTENT_VERSION,
    CHAINS: CHAINS,
    CHAIN_ORDER: CHAIN_ORDER,
    THEMES: THEMES,
    JOURNEY: JOURNEY,
    CHAPTER_NAMES: CHAPTER_NAMES,
    SCENES: SCENES,
    CHALLENGES: CHALLENGES,
    PRACTICE: PRACTICE,
    SCORE_CHASE: SCORE_CHASE,
    ACHIEVEMENTS: ACHIEVEMENTS,
    itemLabel: itemLabel,
    dailyConfig: dailyConfig,
    utcDateString: utcDateString,
    tutorialLessons: tutorialLessons
  };
});
