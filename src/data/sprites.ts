/* Pixel art as rows of text: '.' is empty, anything else is a pixel.
   The cast is signal interference given a body. */
export const SPRITE_ROWS = {
  /* Watcher: a diamond eye that blinks on every march step. */
  watcher: [
    ['...XX...', '..XXXX..', '.XX..XX.', 'XX.XX.XX', 'XX.XX.XX', '.XX..XX.', '..XXXX..', '.X....X.'],
    ['...XX...', '..XXXX..', '.XXXXXX.', 'XX....XX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', 'X......X'],
  ],
  /* Receiver: a walking television whose screen flips between two faces. */
  receiver: [
    ['...X...X...', '....X.X....', '.XXXXXXXXX.', 'XX.......XX', 'XX.XX.XX.XX', 'XX.......XX', '.XXXXXXXXX.', '..XX...XX..'],
    ['...X...X...', '....X.X....', '.XXXXXXXXX.', 'XX.......XX', 'XX..XXX..XX', 'XX.......XX', '.XXXXXXXXX.', '.XX.....XX.'],
  ],
  /* Corruptor: a data block whose lower rows tear left and right. */
  corruptor: [
    ['.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XX.XX..XX.XX', 'XXXXXXXXXXXX', '..XXXXXXXXXX', 'XXXXXXXXXX..', 'XX..XX..XX..', '..XX..XX..XX'],
    ['.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XX.XX..XX.XX', 'XXXXXXXXXXXX', 'XXXXXXXXXX..', '..XXXXXXXXXX', '..XX..XX..XX', 'XX..XX..XX..'],
  ],
  /* Bulwark: armoured, takes two hits. */
  bulwark: [
    ['.XXXXXXXX.', 'XXXXXXXXXX', 'XX......XX', 'XX.XXXX.XX', 'XX......XX', 'XXXXXXXXXX', '.XX.XX.XX.', '.X..XX..X.'],
    ['.XXXXXXXX.', 'XXXXXXXXXX', 'XX......XX', 'XX..XX..XX', 'XX......XX', 'XXXXXXXXXX', 'XX..XX..XX', 'X...XX...X'],
  ],
  /* Splitter: two cells that break into shards when destroyed. */
  splitter: [
    ['.XXX..XXX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXX..XXXX', '.XXX..XXX.', '..X....X..', '.X......X.'],
    ['.XXX..XXX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXX....XXX', '.XXX..XXX.', '.X......X.', '..X....X..'],
  ],
  /* Lobber: a mortar that drops shells where you are standing. */
  lobber: [
    ['....XXX....', '....X.X....', '...XX.XX...', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XX.XXXXX.XX', 'XXXXXXXXXXX', '.XX.....XX.'],
    ['...........', '....XXX....', '...XX.XX...', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XX.XXXXX.XX', 'XXXXXXXXXXX', '..XX...XX..'],
  ],
  /* Sniper: paints a line on you, then fires down it. */
  sniper: [
    ['.XXXXXXX.', 'XXXXXXXXX', 'XX.XXX.XX', 'XXXXXXXXX', '.XXXXXXX.', '...XXX...', '...XXX...', '....X....'],
    ['.XXXXXXX.', 'XXXXXXXXX', 'XXX.X.XXX', 'XXXXXXXXX', '.XXXXXXX.', '...XXX...', '...XXX...', '...X.X...'],
  ],
  /* Shard: what a Splitter leaves behind. */
  shard: [
    ['..X..', '.XXX.', 'XX.XX', '.XXX.', '..X..'],
    ['X...X', '.XXX.', '.X.X.', '.XXX.', 'X...X'],
  ],
  /* Carrier: the boss. */
  carrier: [
    '......XXXXXXXXXX......', '...XXXXXXXXXXXXXXXX...', '.XXXXXXXXXXXXXXXXXXXX.',
    'XXXX..XXXXXXXXXX..XXXX', 'XXX....XXXXXXXX....XXX', 'XXXX..XXX....XXX..XXXX',
    'XXXXXXXXX....XXXXXXXXX', '.XXXXXXXXXXXXXXXXXXXX.', '..XXX.XXXXXXXXXX.XXX..',
    '..XX...XX.XX.XX...XX..', '.XX....X..XX..X....XX.',
  ],
  /* The player's interceptor. */
  ship: [
    '.......X.......', '.......X.......', '......XXX......', '..X...XXX...X..',
    '..X..XXXXX..X..', '.XXXXXXXXXXXXX.', 'XXXX.XXXXX.XXXX', 'XX....XXX....XX',
  ],
  /* Relay: a hijacked satellite that crosses the top of the screen. */
  relay: [
    'XX............XX', 'XXX..XXXXXX..XXX', 'XXXXXXXXXXXXXXXX', 'XXX.XX.XX.XX.XXX',
    'XXXXXXXXXXXXXXXX', 'XXX..XXXXXX..XXX', 'XX............XX',
  ],
  bomb: [
    ['.X.', 'XXX', '.X.', '.X.', 'XXX', '.X.'],
    ['.X.', 'X..', '.X.', '..X', '.X.', 'X..'],
    ['X.X', '.X.', 'X.X', '.X.', 'X.X', '.X.'],
  ],
  bombAlt: [
    ['XXX', '.X.', '.X.', 'XXX', '.X.', '.X.'],
    ['.X.', '..X', '.X.', 'X..', '.X.', '..X'],
    ['.X.', 'X.X', '.X.', 'X.X', '.X.', 'X.X'],
  ],
} as const;

/* 22x16 — the shield pylon's destructible cell grid. */
export const BUNKER_MASK = [
  '......XXXXXXXXXX......', '....XXXXXXXXXXXXXX....', '..XXXXXXXXXXXXXXXXXX..',
  '.XXXXXXXXXXXXXXXXXXXX.', 'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXX..XXXXXXXXXX', 'XXXXXXXXX....XXXXXXXXX',
  'XXXXXXXX......XXXXXXXX', '.XXXXXX........XXXXXX.', '.XXXXX..........XXXXX.',
  '..XXXX..........XXXX..', '..XXX............XXX..', '...XX............XX...',
  '...XX............XX...',
] as const;
