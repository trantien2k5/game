import '../assets/lucide.min.js';

const cache = new Map();
export function icon(name, cls = '') {
  if (name === 'basket-shopping') name = 'shopping-basket';
  const key = name + cls;
  if (!cache.has(key)) {
    const pascal = name
      .split('-')
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join('');
    const luc = globalThis.lucide;
    if (luc && luc.icons && luc.createElement) {
      const definition = luc.icons[pascal] || luc.icons.Circle;
      if (definition) {
        const element = luc.createElement(definition);
        element.setAttribute('class', 'icon ' + cls);
        element.setAttribute('aria-hidden', 'true');
        cache.set(key, element.outerHTML);
      } else {
        cache.set(key, `<span class="icon ${cls}" aria-hidden="true"></span>`);
      }
    } else {
      cache.set(key, `<span class="icon ${cls}" aria-hidden="true"></span>`);
    }
  }
  return cache.get(key) || '';
}
