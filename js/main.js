// Car Rocket: connects the modules and runs the game loop.
//
// Loop: physics runs in fixed steps (STEP in config.js) so the game plays the same at any
// frame rate; visuals, HUD and sound update once per frame. The cars and the ball are drawn
// between their last two physics steps (interpolation), so motion is smooth on any monitor
// (60, 75, 144 Hz...) instead of jumping by one step now and then.
import { STEP } from './config.js';
import { on, emit } from './core/events.js';
import { G, inMatch, clockText } from './game/state.js';
import { player, bot } from './game/actors.js';
import { pressButton } from './game/actions.js';
import { startMatch, goToMenu, setPaused, step, placeForKickoff } from './game/match.js';
import { render, adaptResolution, warmUp } from './engine/renderer.js';
import { follow, orbit } from './engine/camera-rig.js';
import { buildStadium, updateCrowd } from './world/stadium.js';
import { updateBoards, drawScoreboard, redrawBoards } from './world/boards.js';
import { updatePadVisuals } from './world/pads.js';
import { updateWater, cameraUnderwater } from './world/water.js';
import { updateSky } from './world/sky.js';
import { ball, syncBall } from './world/ball.js';
import { updateParticles } from './fx/particles.js';
import { A, initAudio, setMuted, updateAmbience } from './audio/audio.js';
import { bgm, loadSavedSong } from './audio/music.js';
import { initVoice, duckLevel, narrate } from './audio/voice.js';
import { initTooltips } from './ui/tooltip.js';
import { initNotify } from './ui/notify.js';
import { initListen } from './ui/listen.js';
import { initCaption } from './ui/caption.js';
import { initTour, isTourOpen, startTour } from './ui/tour.js';
import { initTutorial, updateTutorial } from './ui/tutorial.js';
import { initHud, refreshHud, updateBallArrow } from './ui/hud.js';
import { initScreens, showMenu, showStart } from './ui/screens.js';
import { isConfirmOpen } from './ui/dialog.js';
import { $ } from './ui/dom.js';
import { wrapAngle } from './core/math.js';
import * as THREE from './core/three.js';
import { initControls, readInput } from './input/controls.js';

/* ---------- actions shared by the keyboard, the HUD buttons and the menus ---------- */
function toggleCamera(){
  G.ballCam = !G.ballCam;
  emit('camera:changed', G.ballCam);
  emit('toast', G.ballCam ? 'Ball camera ON' : 'Ball camera OFF');
}
function toggleSound(){
  initAudio();
  setMuted(!A.muted);
  emit('sound:changed', !A.muted);
  emit('toast', A.muted ? 'Sound OFF' : 'Sound ON');
}
/** H: opens the pause screen on the rules, or closes it. */
function toggleHelp(){
  if (!inMatch()) return;
  setPaused(!G.paused, 'rules');
}

/* ---------- build the world and the interface ---------- */
buildStadium();
placeForKickoff();

initTooltips();
initNotify();
initListen();
initCaption();
initHud({
  onButton: pressButton,
  onCamera: toggleCamera,
  onMute: toggleSound,
  onHelp: toggleHelp,
  onPause: () => setPaused(true)
});
initScreens({
  onPlay: () => startMatch(true),
  onMatch: () => startMatch(),
  onResume: () => setPaused(false),
  onRestart: () => { setPaused(false); startMatch(G.tutorial); },
  onMenu: goToMenu,
  onTour: () => { setPaused(false); startTour(); }
});
initTour();
initTutorial({ onPlay: () => startMatch(), onMenu: goToMenu });
initControls({
  inMenu: () => G.phase === 'menu' || G.phase === 'end',
  isPaused: () => G.paused,
  isBlocked: () => isConfirmOpen() || isTourOpen(),
  onStart: () => startMatch(G.phase === 'menu'),   // Enter: PLAY in the menu, PLAY AGAIN at the end
  onPause: setPaused,
  onHelp: toggleHelp,
  onButton: pressButton,
  onCamera: toggleCamera,
  onMute: toggleSound,
  onHidden: () => { if (inMatch() && !G.paused) setPaused(true); }
});

loadSavedSong();
const voiceReady = initVoice();

// browsers only allow sound after the first click or key press
window.addEventListener('pointerdown', () => initAudio(), { once: true });
window.addEventListener('keydown', () => initAudio(), { once: true });

// the stadium screens are drawn on canvases: redraw them once the web fonts are ready
if (document.fonts && document.fonts.load){
  Promise.all([document.fonts.load('40px Bungee'), document.fonts.load('700 20px "Chakra Petch"')])
    .then(redrawBoards).catch(() => {});
}

/* ---------- game loop ---------- */
/** How loud the background music should be right now (0..1). */
function musicLevel(){
  if (!A.ctx) return 0;
  const duck = duckLevel();   // quieter while the narrator speaks
  if (G.phase === 'menu' || G.phase === 'end') return .8 * duck;
  if (G.paused || G.radioBrokenT > 0) return 0;
  return (player.radio ? 1 : .5) * duck;
}

function syncWorld(dt){
  player.sync(dt);
  bot.sync(dt);
  syncBall(dt);
  updatePadVisuals(dt);
  updateBoards(dt);
  updateWater(dt, G.waterLevel);
  updateSky(dt);
  updateCrowd(dt, G.hype);
  updateParticles(dt);
}

/* ---------- interpolation ----------
   Before each physics step we keep the previous position. When drawing, the bodies are put
   between the previous and the current step for a moment, then put back. */
const bodies = [player, bot].map(car => ({ car, prev: new THREE.Vector3(), now: new THREE.Vector3(), prevH: 0, nowH: 0 }));
const ballPrev = new THREE.Vector3(), ballNow = new THREE.Vector3();
function savePrevious(){
  for (const b of bodies){ b.prev.copy(b.car.pos); b.prevH = b.car.heading; }
  ballPrev.copy(ball.pos);
}
savePrevious();
function blendIn(alpha){
  for (const b of bodies){
    const c = b.car;
    b.now.copy(c.pos); b.nowH = c.heading;
    // a jump of many metres in one step is a teleport (kickoff, respawn): don't slide across the field
    if (b.prev.distanceToSquared(b.now) < 25){
      c.pos.lerpVectors(b.prev, b.now, alpha);
      c.heading = b.prevH + wrapAngle(b.nowH - b.prevH) * alpha;
    }
  }
  ballNow.copy(ball.pos);
  if (ballPrev.distanceToSquared(ballNow) < 25) ball.pos.lerpVectors(ballPrev, ballNow, alpha);
}
function blendOut(){
  for (const b of bodies){ b.car.pos.copy(b.now); b.car.heading = b.nowH; }
  ball.pos.copy(ballNow);
}

let last = performance.now(), accumulator = 0;
on('match:pause', paused => { if (!paused) last = performance.now(); });

function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .1);
  last = now;

  if (G.phase === 'menu' || G.phase === 'end'){
    orbit(dt);
    G.waterLevel = Math.max(-1, G.waterLevel - 6 * dt);
    syncWorld(dt);
  } else if (!G.paused){
    if (!G.tour){            // the HUD tour freezes the match, but the camera and HUD keep drawing
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 14){ savePrevious(); step(STEP, readInput()); accumulator -= STEP; steps++; }
      if (steps >= 14) accumulator = 0;
    }
    if (G.phase !== 'end'){
      blendIn(G.tour ? 1 : accumulator / STEP);
      syncWorld(dt);
      follow(dt, player, ball, G.ballCam);
      updateBallArrow();
      blendOut();
      refreshHud();
      updateTutorial(dt);
      drawScoreboard(G.score.blue, G.score.orange, clockText());
      adaptResolution(dt);
    }
  }

  const live = inMatch() && !G.paused && !G.tour;
  updateAmbience({
    engineOn: live && player.dead <= 0, speed: Math.abs(player.vF), burning: player.burning,
    crowdOn: live, hype: G.hype, menu: G.phase === 'menu'
  });
  bgm.update(dt, musicLevel(), cameraUnderwater(), inMatch() && G.paused);
  render();
}

/* ---------- ready: hide the loading screen and open the menu ---------- */
warmUp();
$('loading').hidden = true;
showStart(() => {
  initAudio();
  if (bgm.el) bgm.el.play().catch(() => {});   // start the song inside the click; the loop sets its volume
  showMenu();
  voiceReady.then(() => { if (G.phase === 'menu') narrate(['intro']); });   // the welcome, in the team's voice
});
requestAnimationFrame(frame);
