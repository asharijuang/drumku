import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
const lanes = await readFile(new URL('../lanes.js', import.meta.url), 'utf8');
const source = (await readFile(new URL('../sheet.js', import.meta.url), 'utf8')).replace("'./lanes.js'", JSON.stringify('data:text/javascript;base64,' + Buffer.from(lanes).toString('base64')));
const { createSheet } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
function frame(now, width = 1000) {
  const notes = [];
  const labels = [];
  const ctx = new Proxy({}, { get(target, key) {
    if (key === 'translate') return (x, y) => notes.push({ x, y });
    if (key === 'fillText') return (text, x) => labels.push({ text, x });
    return target[key] ?? (() => {});
  }});
  const sheet = createSheet({ clientWidth: width, clientHeight: 300, getContext: () => ctx });
  sheet.setBeats(Array.from({ length: 80 }, (_, i) => i * 0.5));
  sheet.render(now * 0.5, [15, 16, 17, 32].map(b => ({ t: b * 0.5, note: 38 })));
  return { notes, labels };
}
test('next page notes are visible ahead of the playhead before beat 16', () => {
  assert.ok(frame(14).notes.some(n => n.x === 240 + 2 * 84));
});
test('notes move continuously across the page boundary, including trailing notes', () => {
  const before = frame(15.99).notes;
  const after = frame(16.01).notes;
  assert.equal(before.length, 3);
  assert.equal(after.length, 3);
  before.forEach((note, i) => assert.ok(Math.abs(note.x - after[i].x - 0.02 * 84) < 1e-8));
});
test('wide view previews more than one page with continuing bar numbers', () => {
  const { notes, labels } = frame(14, 2400);
  assert.ok(notes.some(n => n.x === 576 + 18 * 84));
  assert.ok(labels.some(l => l.text === 9 && l.x === 576 + 18 * 84));
});
