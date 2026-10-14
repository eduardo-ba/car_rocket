// The shared match state. Game modules read and change it; the UI only reads it.
import { MATCH_TIME } from '../config.js';
import { fmtClock } from '../core/math.js';

export const G = {
  phase: 'menu',          // menu | countdown | play | goal | end
  phaseT: 0,              // time left in the current countdown / goal celebration
  lastCount: 0,
  paused: false,
  tour: false,             // the HUD tour is open: the match waits
  tutorial: false,         // practice match of the tutorial: no clock, the orange car stays away
  timeLeft: MATCH_TIME,
  overtime: false,
  otTime: 0,
  score: { blue: 0, orange: 0 },
  difficulty: 'normal',
  ballCam: false,
  rulesBroken: 0,
  ruleCounts: [0, 0, 0, 0, 0],
  tuningUsed: false,      // rule 5
  jumpTimes: [],          // rule 4
  lastRadio: -9,          // rule 3
  radioBrokenT: 0,
  goalCD: 0,
  lastGoal: null,         // rule 2
  clock: 0,               // game time in seconds
  waterLevel: -1,
  kickTip: 0,             // which rule is shown during the countdown
  hype: 0                 // crowd excitement after a goal
};

export const inMatch = () => G.phase === 'countdown' || G.phase === 'play' || G.phase === 'goal';

export const clockText = () => G.tutorial ? '--:--' : G.overtime ? '+' + fmtClock(Math.floor(G.otTime)) : fmtClock(Math.ceil(G.timeLeft));

export function resetMatchState(){
  Object.assign(G, {
    timeLeft: MATCH_TIME, overtime: false, otTime: 0, paused: false,
    rulesBroken: 0, tuningUsed: false, lastRadio: -9, radioBrokenT: 0, goalCD: 0, lastGoal: null, hype: 0
  });
  G.score.blue = 0;
  G.score.orange = 0;
  G.ruleCounts.fill(0);
  G.jumpTimes.length = 0;
}
