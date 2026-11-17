import { UI_STRINGS } from '../../content/strings/ui';
import type { ReasonCode, Trust } from '../../save/integrity/reasons';

const T = UI_STRINGS.trust;
const SVG = 'http://www.w3.org/2000/svg';

/** What the seal says for a trust state, as plain data. */
export function sealText(trust: Trust): { label: string; body: string; reasons: string[] } {
  return trust.state === 'flagged'
    ? {
        label: T.flagged,
        body: T.flaggedText,
        reasons: trust.reasons.map((c: ReasonCode) => T.reason[c] ?? T.reason.MALFORMED_STATE),
      }
    : { label: T.intact, body: T.intactText, reasons: [] };
}

function glyph(flagged: boolean): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'pow-seal-glyph');
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS(SVG, 'circle');
  ring.setAttribute('cx', '8');
  ring.setAttribute('cy', '8');
  ring.setAttribute('r', '6.5');
  svg.appendChild(ring);
  const mark = document.createElementNS(SVG, 'polyline');
  // A check inside a solid seal, a crack through a flagged one.
  mark.setAttribute('points', flagged ? '9,2 6,7 10,9 7,14' : '5,8.5 7.2,10.7 11,5.8');
  svg.appendChild(mark);
  return svg;
}

/**
 * The seal: a glyph button that is solid for an Intact save and cracked for a Flagged one. A tap
 * opens a plain explanation under it, and a second tap closes it. No gameplay effect. Built with
 * createElement and `textContent` only.
 */
export function createSeal(trust: Trust): HTMLElement {
  const text = sealText(trust);
  const flagged = trust.state === 'flagged';
  const wrap = document.createElement('div');
  wrap.className = `pow-seal ${flagged ? 'pow-seal-flagged' : 'pow-seal-intact'}`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pow-seal-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.appendChild(glyph(flagged));
  const label = document.createElement('span');
  label.className = 'pow-seal-label';
  label.textContent = text.label;
  btn.appendChild(label);
  const hint = document.createElement('span');
  hint.className = 'pow-seal-tap';
  hint.textContent = T.tapHint;
  btn.appendChild(hint);

  const info = document.createElement('div');
  info.className = 'pow-seal-info';
  info.hidden = true;
  const body = document.createElement('p');
  body.textContent = text.body;
  info.appendChild(body);
  if (text.reasons.length > 0) {
    const title = document.createElement('p');
    title.className = 'pow-seal-reasons-title';
    title.textContent = T.reasonsTitle;
    info.appendChild(title);
    const ul = document.createElement('ul');
    for (const r of text.reasons) {
      const li = document.createElement('li');
      li.textContent = r;
      ul.appendChild(li);
    }
    info.appendChild(ul);
  }

  btn.addEventListener('click', () => {
    info.hidden = !info.hidden;
    btn.setAttribute('aria-expanded', String(!info.hidden));
  });
  wrap.appendChild(btn);
  wrap.appendChild(info);
  return wrap;
}
