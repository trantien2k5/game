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
    const definition = globalThis.lucide.icons[pascal] || globalThis.lucide.icons.Circle;
    const element = globalThis.lucide.createElement(definition);
    element.setAttribute('class', 'icon ' + cls);
    element.setAttribute('aria-hidden', 'true');
    cache.set(key, element.outerHTML);
  }
  return cache.get(key);
}
