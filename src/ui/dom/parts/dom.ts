/** Tiny DOM helpers for the shared Menu parts. Text is set with `textContent` only. */

let uid = 0;
/** A fresh id for aria links. */
export const nextId = (prefix: string): string => `${prefix}-${uid++}`;

/** Adds children in order. (`Element.append` is typed for the Worker's HTMLRewriter here.) */
export function put<T extends HTMLElement>(parent: T, ...kids: (HTMLElement | null)[]): T {
  for (const k of kids) if (k) parent.appendChild(k);
  return parent;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
