// The menu, pause, end screens and the confirm box behave like modal dialogs:
// focus moves into them when they open, Tab stays inside, and Esc cancels the confirm box.
import { $ } from './dom.js';

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack = [];

const focusables = root => [...root.querySelectorAll(FOCUSABLE)]
  .filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0);

/** Shows a screen and moves the focus to `focusEl` (or its first control). */
export function openScreen(el, focusEl){
  const i = stack.indexOf(el);
  if (i >= 0) stack.splice(i, 1);
  stack.push(el);
  el.hidden = false;
  el.scrollTop = 0;
  const first = focusEl || focusables(el)[0] || el;
  first.focus({ preventScroll: true });
}

export function closeScreen(el){
  el.hidden = true;
  const i = stack.indexOf(el);
  if (i >= 0) stack.splice(i, 1);
}

export const isConfirmOpen = () => !$('confirm').hidden;

/** Keeps Tab and Shift+Tab inside the dialog on top. */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !stack.length) return;
  const top = stack[stack.length - 1];
  const items = focusables(top);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (!top.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});

/**
 * Asks before doing something that can't be undone. Resolves true (yes) or false (no / Esc).
 * The safe answer has the focus, so pressing Enter by accident does nothing harmful.
 */
export function confirmBox({ title, text, ok = 'Yes', cancel = 'Cancel' }){
  const box = $('confirm'), yes = $('confirmYes'), no = $('confirmNo');
  const back = document.activeElement;
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  yes.textContent = ok;
  no.textContent = cancel;
  openScreen(box, no);
  return new Promise(resolve => {
    const done = answer => {
      yes.onclick = no.onclick = box.onkeydown = null;
      closeScreen(box);
      if (back && back.isConnected && !back.closest('[hidden]')) back.focus({ preventScroll: true });
      resolve(answer);
    };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    box.onkeydown = e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      done(false);
    };
  });
}
