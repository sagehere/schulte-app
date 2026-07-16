const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function trendCore() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const start = html.indexOf('/* trend-core:start */');
  const end = html.indexOf('/* trend-core:end */');
  assert.ok(start >= 0 && end > start, 'trend core markers must exist');
  const source = html.slice(start, end);
  return new Function(`${source}\nreturn { shiftDateKey, trendVariant, buildTrendSeries };`)();
}

test('90-day trend keeps calendar bounds, variants, and rolling aggregates', () => {
  const { shiftDateKey, trendVariant, buildTrendSeries } = trendCore();
  const end = '2026-07-16';
  const records = [
    { type: 'schulte', size: 5, reverse: false, colorInterference: false, timeMs: 10000, accuracy: 100, date: 'x', day: '2026-07-16' },
    { type: 'schulte', size: 5, reverse: false, colorInterference: false, timeMs: 20000, accuracy: 90, date: 'x', day: '2026-07-14' },
    { type: 'schulte', size: 7, reverse: false, colorInterference: false, timeMs: 40000, accuracy: 100, date: 'x', day: '2026-07-16' },
    { type: 'schulte', size: 5, reverse: false, colorInterference: false, timeMs: 5000, accuracy: 100, date: 'x', day: '2026-04-17' }
  ];
  const variant = trendVariant(records[0]);
  const series = buildTrendSeries(records, end, 'schulte', variant.key, (record) => record.day);

  assert.equal(series.dates.length, 90);
  assert.equal(series.dates[0], shiftDateKey(end, -89));
  assert.equal(series.dates.at(-1), end);
  assert.equal(series.filtered.length, 2);
  assert.equal(series.values.time.at(-1), 10000);
  assert.equal(series.rolling.time.at(-1), 15000);
  assert.equal(series.values.accuracy.at(-1), 100);
});

test('mindfulness trends use duration and completion rate', () => {
  const { buildTrendSeries } = trendCore();
  const series = buildTrendSeries([
    { type: 'mindfulness', timeMs: 60000, practiceMs: 60000, audioCompleted: true, day: '2026-07-16' },
    { type: 'mindfulness', timeMs: 30000, practiceMs: 30000, audioCompleted: false, day: '2026-07-16' }
  ], '2026-07-16', 'mindfulness', '', (record) => record.day);

  assert.equal(series.values.practice.at(-1), 90000);
  assert.equal(series.values.completion.at(-1), 50);
  assert.equal(series.values.count.at(-1), 2);
});
