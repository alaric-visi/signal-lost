/* Wave layouts: five rows of eleven cells. Each letter is an enemy type
   (its index in CODES is the type id); '.' is an empty slot.
     W Watcher    dives at you          R Receiver   plain
     C Corruptor  plain                 B Bulwark    takes two hits
     S Splitter   breaks into shards    L Lobber     drops shells on you
     N Sniper     telegraphed aimed bolt
   Every fifth wave is the boss instead; the layouts cycle through the rest. */
export const CODES = 'WRCBSLN';

export const LAYOUTS: readonly (readonly string[])[] = [
  /* 1 — the basics */
  [
    'WWWWWWWWWWW',
    'RRRRRRRRRRR',
    'RRRRRRRRRRR',
    'CCCCCCCCCCC',
    'CCCCCCCCCCC',
  ],
  /* 2 — an armoured front line */
  [
    'WWWWWWWWWWW',
    'RRRRRRRRRRR',
    'CCCCCCCCCCC',
    'CCCCCCCCCCC',
    'B.B.B.B.B.B',
  ],
  /* 3 — a wedge with snipers on the wings */
  [
    'WW.......WW',
    'WNR.....RNW',
    '.RRRR.RRRR.',
    '..CCCCCCC..',
    '...CCCCC...',
  ],
  /* 4 — columns, with mortars and splitters */
  [
    'WW.WW.WW.WW',
    'LR.RL.LR.RL',
    'RR.RR.RR.RR',
    'CC.CC.CC.CC',
    'SS.CC.SS.CC',
  ],
  /* 6 — two halves */
  [
    'WWWW...WWWW',
    'NRRR...RRRN',
    'BBBB...BBBB',
    'CCCC...CCCC',
    'SSSS...SSSS',
  ],
  /* 7 — checkerboard */
  [
    'W.W.W.W.W.W',
    '.L.R.N.R.L.',
    'B.B.B.B.B.B',
    '.S.C.S.C.S.',
    'C.C.C.C.C.C',
  ],
  /* 8 — fortress */
  [
    'NWWWWWWWWWN',
    'LBBBBBBBBBL',
    'RRSRRSRRSRR',
    'CCCCCCCCCCC',
    'BCBCBCBCBCB',
  ],
  /* 9 — diamond */
  [
    '...WWNWW...',
    '..LRRRRRL..',
    '.BBSSSSSBB.',
    '..CCCCCCC..',
    '...SCCCS...',
  ],
];

export const BOSS_EVERY = 5;
export const isBossWave = (level: number): boolean => level % BOSS_EVERY === 0;
export const layoutFor = (level: number): readonly string[] =>
  LAYOUTS[(level - Math.floor(level / BOSS_EVERY) - 1) % LAYOUTS.length];
