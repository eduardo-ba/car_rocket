// Accessible tabs: ARIA roles, one tab stop, and arrow keys / Home / End to move between tabs.
import { h } from './dom.js';

let uid = 0;

/**
 * createTabs([{id, label, content}], {label}) -> {el, select(id)}
 * `content` is the DOM node shown in that tab's panel.
 */
export function createTabs(defs, { label }){
  const base = 'tabs' + (++uid);
  const list = h('div', { class: 'tablist', role: 'tablist', 'aria-label': label });
  const panels = h('div', { class: 'tabpanels' });
  const items = defs.map(d => {
    const tab = h('button', {
      type: 'button', class: 'tab', role: 'tab', id: `${base}-tab-${d.id}`,
      'aria-controls': `${base}-panel-${d.id}`, 'aria-selected': 'false', tabindex: '-1'
    }, d.label);
    const panel = h('div', {
      class: 'tabpanel', role: 'tabpanel', id: `${base}-panel-${d.id}`,
      'aria-labelledby': tab.id, tabindex: '0', hidden: true
    }, d.content);
    tab.addEventListener('click', () => select(d.id));
    list.append(tab);
    panels.append(panel);
    return { id: d.id, tab, panel };
  });

  function select(id, focus = false){
    for (const it of items){
      const on = it.id === id;
      it.tab.setAttribute('aria-selected', String(on));
      it.tab.tabIndex = on ? 0 : -1;
      it.panel.hidden = !on;
      if (on && focus) it.tab.focus();
    }
    panels.scrollTop = 0;
  }

  list.addEventListener('keydown', e => {
    const i = items.findIndex(it => it.tab === document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(items[next].id, true);
  });

  select(defs[0].id);
  return { el: h('div', { class: 'tabs' }, list, panels), select };
}
