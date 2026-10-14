// Entry point. Loads the game and shows a clear message if the 3D engine can't load
// (for example without internet, or on a computer without WebGL).
import('./main.js').catch(err => {
  console.error(err);
  document.getElementById('loading').hidden = true;
  document.getElementById('loadError').hidden = false;
});
