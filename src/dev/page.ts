import './dev.css';

/** Turns the page into a scrolling dev page and returns the container for its content. */
export function mountDevPage(title: string): HTMLElement {
  document.title = `${title} (dev)`;
  document.body.classList.add('dev-page');
  const main = document.createElement('main');
  main.className = 'dev-main';
  const h1 = document.createElement('h1');
  h1.textContent = title;
  main.appendChild(h1);
  document.body.appendChild(main);
  return main;
}

/** Small DOM helper: element with class and text. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
