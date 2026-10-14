// The 10 buttons from the project notes (the array keeps the order of the notes).
//   key    what the button shows (its main key)
//   keys   every keyboard shortcut, as written on screen
//   group  'action' or 'transform' (how the remote groups them)
//   slot   position inside its group on the remote
//   rules  numbers of the rules that talk about this button
//   desc   the sentence the team says in its recording (assets/voices/); how: what it does in the game
//
// Key layout: the 4 ACTIONS sit around W A S D, so you press them without letting go of the
// steering (thumb: Space, little finger: Shift, index finger: R and F). The 6 TRANSFORMS are 1-6
// in the order the rules need: 4 TUNING comes right before 5 4X4 (rule 5: first TUNING, then 4X4),
// and 6 MAD MAX is last, next to the TURBO it needs (rule 1).
export const BUTTONS = [
  {id:'jump',   key:'Space', keys:['Space'], group:'action',    slot:1, rules:[2, 4], name:'JUMP',      color:'#e8f1ff', desc:'To jump, press the JUMP button and the car jumps.', how:'Hold it to jump higher. Press it again in the air to flip: W front flip, S backflip, A / D side flip.'},
  {id:'turbo',  key:'Shift', keys:['Shift'], group:'action',    slot:2, rules:[1],    name:'TURBO',     color:'#ff5a36', desc:'To liberate all the acceleration power, you need to press the TURBO button.', how:'Turns turbo ON or OFF. It uses the boost bar. In the air it pushes the car where its nose points (aerial).'},
  {id:'goal',   key:'F',     keys:['F'],     group:'action',    slot:3, rules:[],     name:'GOAL',      color:'#ffd23f', desc:'To score a goal, you need to press the GOAL button.', how:'Get close to the ball and press it: power shot!'},
  {id:'sub',    key:'1',     keys:['1'],     group:'transform', slot:1, rules:[],     name:'SUBMARINE', color:'#26d4ff', desc:'If you want to be a submarine, you can press the SUBMARINE button, and the RC car transforms into a submarine.', how:'The field fills with water. JUMP swims up.'},
  {id:'radio',  key:'R',     keys:['R'],     group:'action',    slot:4, rules:[3],    name:'RADIO',     color:'#3ee08f', desc:'To elevate the antenna, you need to press the RADIO button, and you can listen to the soundtrack of the game.', how:'The antenna goes up and the music gets louder.'},
  {id:'robot',  key:'2',     keys:['2'],     group:'transform', slot:2, rules:[],     name:'TRANSFORMER', color:'#c9d4e3', desc:'Press the TRANSFORMER button to make your car transform like a Transformer. Hell yeah!', how:'Slow, but it kicks the ball very hard.'},
  {id:'4x4',    key:'5',     keys:['5'],     group:'transform', slot:5, rules:[5],    name:'4X4',       color:'#d39a55', desc:'Press the 4X4 option to make your car a 4X4.', how:'Big wheels. Heavy and strong. Use TUNING (4) first!'},
  {id:'plane',  key:'3',     keys:['3'],     group:'transform', slot:3, rules:[],     name:'PLANE',     color:'#9fd8ff', desc:'Press the PLANE mode to make the RC car display two airplane wings.', how:'Drive fast and hold forward to fly.'},
  {id:'madmax', key:'6',     keys:['6'],     group:'transform', slot:6, rules:[1],    name:'MAD MAX',   color:'#e0672c', desc:'Press the MAD MAX button to transform your car into a similar car from Mad Max.', how:'Spikes and armor. Turn TURBO on first! With turbo, it destroys the orange car.'},
  {id:'tuning', key:'4',     keys:['4'],     group:'transform', slot:4, rules:[5],    name:'TUNING',    color:'#ff3fd0', desc:'Press the TUNING button to transform your RC car into the fastest car in the world.', how:'The fastest mode in the game.'}
];

export const BUTTON_BY_ID = Object.fromEntries(BUTTONS.map(b => [b.id, b]));
/** Lower-case KeyboardEvent.key -> button ('f', '1', ' ' for Space, 'shift'...). */
export const BUTTON_BY_KEY = Object.fromEntries(BUTTONS.flatMap(b => b.keys.map(k => [k === 'Space' ? ' ' : k.toLowerCase(), b])));
/** The buttons of one group in the order they sit on the remote. */
export const buttonsIn = group => BUTTONS.filter(b => b.group === group).sort((a, b) => a.slot - b.slot);
