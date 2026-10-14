// Game tuning in one place: field size, physics, teams, difficulty and the car modes.

/* field (metres). x = width, z = length; the blue goal is at +z, the orange goal at -z */
export const HALF_W = 40;
export const HALF_L = 60;
export const WALL_H = 14;
export const GOAL_HW = 11;
export const GOAL_H = 9;
export const GOAL_D = 8;
export const CEIL = 36;

/* physics */
export const GRAV = 32;
export const BALL_R = 2.1;
export const STEP = 1/120;      // fixed physics step in seconds
export const WATER_TOP = 7.5;   // water height when the submarine is on

/* match */
export const MATCH_TIME = 180;  // seconds
export const GOAL_CD = 10;      // GOAL button recharge time in seconds
export const POWER_SHOT_RANGE = 9;   // how close to the ball the GOAL button works (metres)

/* limits and penalties of the 5 rules */
export const RULE = {
  doubleClick: .45,   // seconds between two RADIO presses that count as a double-click (rule 3)
  spamWindow: 1.5,    // seconds (rule 4)
  spamLimit: 4,       // jumps inside spamWindow that make the car explode (rule 4)
  stallMadMax: 3,     // seconds the engine stalls (rule 1)
  stall4x4: 2,        // seconds the wheels get stuck (rule 5)
  radioBroken: 10     // seconds without radio (rule 3)
};

/* Rocket League moves. The real game's values (RLBot wiki: jumping physics, useful game values)
   scaled to this field: a tap jumps 62% and holding JUMP 0.2 s adds the rest; the second jump
   must come within ~1.25 s; the backflip pushes a bit more than the front flip; boost in the air
   is stronger than gravity, so you can fly (aerials). */
export const MOVES = {
  hopShare: .62,        // share of the jump a quick tap gives
  holdTime: .2,         // holding JUMP this long gives the full jump
  dodgeWindow: 1.35,    // seconds after jumping in which the second jump is a flip or double jump
  doubleJump: .55,      // straight double jump (no direction), share of the mode's jump
  dodgeForward: 10.5,   // flip impulses (m/s)
  dodgeBack: 11.5,
  dodgeSide: 10,
  flipTime: .62,        // one full flip rotation (s)
  flipStall: .3,        // the car floats this long at the start of a flip
  cancelWindow: .32,    // forward this soon after a backflip = half flip
  halfFlipTime: .42,
  airPitch: 3.2,        // rad/s with W / S in the air
  airYaw: 2.4,          // rad/s with A / D in the air
  airRoll: 4.5,         // rad/s with Q / E in the air
  airThrottle: 3,       // m/s² forward with W in the air (tiny, like in Rocket League)
  airBoost: 52,         // m/s² of turbo in the air, along the nose (gravity is 32; RL ratio 1058 / 650)
  slideGrip: 1.3,       // sideways grip while powersliding (normal: 9)
  slideTurn: 1.6,       // turn rate multiplier while powersliding
  dodgeHit: 1.45        // a flip into the ball hits it this much harder
};

export const TEAM = {
  blue:   {color:0x2f8cff, tuning:0x7a3cff, spawn:{x:0, z:42,  h:Math.PI}},
  orange: {color:0xff8a1f, tuning:0xff2f6d, spawn:{x:0, z:-42, h:0}}
};

/* orange car: speed multiplier and how far it misses the centre of the goal */
export const DIFFICULTY = {
  easy:   {speed:.62, aimError:9},
  normal: {speed:.8,  aimError:6},
  hard:   {speed:.97, aimError:2.5}
};

/* every transformation changes how the car drives */
export const MODES = {
  car:    {name:'RC CAR',    max:30, acc:34, turn:2.6, jump:13, mass:1,   power:1,    grav:1},
  sub:    {name:'SUBMARINE', max:22, acc:22, turn:2.1, jump:8,  mass:1.3, power:1.1,  grav:.25},
  robot:  {name:'TRANSFORMER',     max:20, acc:26, turn:3.2, jump:16, mass:2,   power:1.8,  grav:1},
  '4x4':  {name:'4X4',       max:28, acc:32, turn:2.3, jump:15, mass:2.5, power:1.3,  grav:1},
  plane:  {name:'PLANE',     max:32, acc:30, turn:2.2, jump:13, mass:1,   power:1,    grav:.35},
  madmax: {name:'MAD MAX',   max:36, acc:38, turn:2.4, jump:13, mass:3,   power:1.5,  grav:1},
  tuning: {name:'TUNING',    max:44, acc:48, turn:2.9, jump:13, mass:1,   power:1.15, grav:1}
};

/* hit box against the ball (half sizes + centre height) */
export const HITBOX = {
  car:{hw:1.15, hh:.55, hl:2.1, cy:.8},   tuning:{hw:1.2, hh:.5, hl:2.15, cy:.72},
  madmax:{hw:1.25, hh:.6, hl:2.5, cy:.85}, plane:{hw:2.6, hh:.5, hl:2.1, cy:.85},
  '4x4':{hw:1.55, hh:1.0, hl:2.3, cy:1.5}, sub:{hw:1.0, hh:1.0, hl:2.8, cy:1.1},
  robot:{hw:1.2, hh:2.0, hl:.7, cy:2.1}
};

/* collision radius against the other car */
export const RADIUS = {car:1.8, tuning:1.8, madmax:1.9, plane:1.8, '4x4':2.1, sub:1.6, robot:1.3};

/* where the radio antenna and the turbo flames sit on each model */
export const MODE_FX = {
  car:{ant:[.8,1.1,-1.5], fl:[0,.68,-2.15]},     tuning:{ant:[.8,1.02,-1.5], fl:[0,.6,-2.15]},
  madmax:{ant:[.8,1.1,-1.2], fl:[0,.68,-2.3]},   plane:{ant:[.8,1.1,-1.5], fl:[0,.68,-2.15]},
  '4x4':{ant:[.8,1.85,-1.5], fl:[0,1.43,-2.15]}, sub:{ant:[-.25,2.7,0], fl:[0,1.1,-3.7]},
  robot:{ant:[.45,4.1,-.1], fl:[0,2.7,-.6]}
};
