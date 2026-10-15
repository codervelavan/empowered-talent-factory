// Building blocks for the illustrative example boards the guide stands beside at each stop.
// Boards are plain HTML (placed in the 3D room on desktop, inside the guide panel on phones).
// Every board is labelled as an illustrative example and carries no figures or outcomes.
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const R = ' class="sxR"';

/** A board: label, title and parts. Rows are numbered here so they reveal one after another (CSS reads --i). */
export function board(title: string, ...parts: string[]): string {
  let k = 0;
  const html = `<small class="sxTag">Illustrative example</small><h4${R}>${esc(title)}</h4>` + parts.join('');
  return html.replace(/ class="sxR"/g, () => ` class="sxR" style="--i:${k++}"`);
}
/** Label and explanation pairs. */
export const rows = (items: [string, string][]) => `<dl class="sxRows">${items.map(([a, b]) => `<div${R}><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;
/** Steps joined by arrows; `on` marks the current step. */
export const flow = (items: [string, string][], on = -1) => `<ol class="sxFlow">${items.map(([a, b], i) => `<li${R}${i === on ? ' data-on' : ''}><b>${esc(a)}</b>${b ? `<span>${esc(b)}</span>` : ''}</li>`).join('')}</ol>`;
/** A small table: header row then body rows. */
export const table = (head: string[], body: string[][]) =>
  `<table class="sxTable"><thead><tr${R}>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map((b) => `<tr${R}>${b.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
/** Chips (roles, tags). */
export const chips = (items: string[]) => `<ul class="sxChips"${R}>${items.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`;
/** A one-line note under the board. */
export const note = (t: string) => `<p class="sxNote"${R}>${esc(t)}</p>`;
/** The six POD delivery stages. */
export const STAGES: [string, string][] = [['Discover', ''], ['Design', ''], ['Build', ''], ['Test & Secure', ''], ['Deploy & Operate', ''], ['Demo & Validate', '']];
