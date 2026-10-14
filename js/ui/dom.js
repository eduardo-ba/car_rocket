// DOM helpers: find an element by id, and h() to build elements without long HTML strings.
export const $ = id => document.getElementById(id);

/**
 * h('button', {class: 'btn', onclick: fn, 'aria-label': 'Pause'}, 'Text', childNode, [more])
 * Props: class, html (trusted markup only, e.g. icons), style, on<event>, any attribute.
 * null / false props and children are skipped, arrays are flattened.
 */
export function h(tag, props = {}, ...children){
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)){
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)){
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}
