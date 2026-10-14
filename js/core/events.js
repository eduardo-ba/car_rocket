// A tiny event bus so the game logic never touches the DOM directly.
// Game code calls emit('toast', ...) and the UI listens with on('toast', ...).
const handlers = new Map();

export function on(name, fn){
  if (!handlers.has(name)) handlers.set(name, []);
  handlers.get(name).push(fn);
}

export function emit(name, ...args){
  const list = handlers.get(name);
  if (list) for (const fn of list) fn(...args);
}
