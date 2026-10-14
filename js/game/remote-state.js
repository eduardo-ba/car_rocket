// What the UI should show for each of the 10 buttons right now: on/off, recharging, broken,
// ready, or a warning that pressing it would break a rule. Read-only: it never changes the game.
import { G } from './state.js';
import { player } from './actors.js';
import { ball } from '../world/ball.js';
import { GOAL_CD, POWER_SHOT_RANGE, RULE } from '../config.js';

const TRANSFORMS = new Set(['sub', 'robot', '4x4', 'plane', 'madmax', 'tuning']);
export const TOGGLE_BUTTONS = new Set(['turbo', 'radio', ...TRANSFORMS]);

/**
 * @returns {{on:boolean, dim:boolean, ready:boolean, broken:boolean, warn:string,
 *            cooldown:number, badge:string, state:string}}
 *   on: switched on · dim: can't do anything useful now · ready: a good moment to press it
 *   warn: pressing it now breaks a rule · cooldown: 0..1 recharge progress
 *   badge: short text on the button ('7s', '!') · state: sentence for the tooltip
 */
export function remoteState(id){
  const s = { on: false, dim: false, ready: false, broken: false, warn: '', cooldown: 0, badge: '', state: '' };
  if (player.dead > 0){
    s.dim = true;
    s.state = `Your car is coming back in ${Math.ceil(player.dead)} s.`;
    return s;
  }
  switch (id){
    case 'jump': {
      if (G.phase === 'goal' && G.lastGoal && G.lastGoal.team === 'blue' && !G.lastGoal.cancelled){
        s.warn = "You just scored: don't press JUMP now! (Rule 2)";
      } else {
        const recent = G.jumpTimes.filter(t => G.clock - t < RULE.spamWindow).length;
        // a jump + flip is 2 presses, so the warning starts at the press before the explosion
        if (recent >= RULE.spamLimit - 1) s.warn = `${recent} quick jumps. Slow down! (Rule 4)`;
      }
      break;
    }
    case 'turbo':
      s.on = player.turbo;
      if (!player.turbo && player.boost < 5){ s.dim = true; s.state = 'No boost left. Drive over a glowing pad.'; }
      else s.state = `Boost: ${Math.round(player.boost)} / 100`;
      break;
    case 'goal':
      if (G.goalCD > 0){
        const left = Math.ceil(G.goalCD);
        s.cooldown = 1 - G.goalCD / GOAL_CD;
        s.dim = true;
        s.badge = left + 's';
        s.state = `Recharging: ${left} s`;
      } else if (!ball.visible){
        s.dim = true;
        s.state = 'Wait for the kickoff.';
      } else {
        const d = Math.hypot(ball.pos.x - player.pos.x, ball.pos.y - (player.pos.y + 1), ball.pos.z - player.pos.z);
        s.ready = d <= POWER_SHOT_RANGE;
        s.dim = !s.ready;
        s.state = s.ready ? 'Ready: the ball is close. Shoot!' : 'Get closer to the ball.';
      }
      break;
    case 'radio':
      s.on = player.radio;
      if (G.radioBrokenT > 0){
        const left = Math.ceil(G.radioBrokenT);
        s.broken = true;
        s.dim = true;
        s.badge = left + 's';
        s.state = `The radio is broken: ${left} s`;
      } else s.state = player.radio ? 'The radio is ON: the music is loud.' : 'The radio is OFF.';
      break;
    case 'madmax':
      s.on = player.mode === 'madmax';
      if (!s.on && !player.turbo) s.warn = 'Turn TURBO on first. (Rule 1)';
      break;
    case '4x4':
      s.on = player.mode === '4x4';
      if (!s.on && !G.tuningUsed) s.warn = 'Use TUNING first. (Rule 5)';
      break;
    default:
      s.on = player.mode === id;
  }
  if (s.warn && !s.badge) s.badge = '!';
  if (TRANSFORMS.has(id) && s.on && !s.state) s.state = 'Press it again to go back to the RC car.';
  return s;
}
