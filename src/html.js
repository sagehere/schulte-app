const fs = require('fs');
const path = require('path');
const {
  escapeHtml,
  formatPracticeMs,
  totalPracticeMs,
  formatSeconds,
  trainingLabel,
  memoryReplaySuffix,
  recordDateKey,
  cloudTaskText,
  scoreCloudRecord,
  todayDateKey
} = require('./utils');

const INDEX_HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');

let indexHtml;

function getIndexHtml() {
  if (!indexHtml) {
    indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  }
  return indexHtml;
}

const TREND_SCRIPT = String.raw`
(() => {
  const data = JSON.parse(document.getElementById('trendData').textContent);
  const records = data.records || [];
  const labels = { schulte: '舒尔特方格', stroop: '斯特鲁普', idiom: '成语训练', poem: '古诗训练', memory: '记忆训练', decode: '译码训练', mindfulness: '正念练习' };
  const trendModeTabs = document.getElementById('trendModeTabs');
  const trendVariantSelect = document.getElementById('trendVariantSelect');
  const trendMetricTabs = document.getElementById('trendMetricTabs');
  const trendSummary = document.getElementById('trendSummary');
  const trendChart = document.getElementById('trendChart');
  const trendModeHint = document.getElementById('trendModeHint');
  let trendMode = 'schulte';
  const trendMetricByMode = {};
  const trendVariantByMode = {};

  function recordDateKey(record) {
    const date = new Date(record && record.date);
    if (Number.isNaN(date.getTime())) {
      const fallback = String(record && record.date || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : '';
    }
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: data.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return value.year + '-' + value.month + '-' + value.day;
  }

  /* trend-core:start */
  function shiftDateKey(dateKey, days) {
    const date = new Date(dateKey + 'T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function trendMetricDefinitions(mode) {
    if (mode === 'mindfulness') return [
      { id: 'practice', label: '每日练习时长', kind: 'practice', bar: true },
      { id: 'completion', label: '完整播放率', kind: 'completion' },
      { id: 'count', label: '练习次数', kind: 'count', bar: true }
    ];
    const metrics = [
      { id: 'time', label: '平均用时', kind: 'time' },
      { id: 'accuracy', label: '平均正确率', kind: 'accuracy' },
      { id: 'count', label: '练习次数', kind: 'count', bar: true }
    ];
    if (mode === 'memory') metrics.splice(2, 0, { id: 'span', label: '平均无辅助跨度', kind: 'span' });
    return metrics;
  }

  function trendVariant(record) {
    const type = record.type || 'schulte';
    const yesNo = (value, yes, no) => value ? yes : no;
    if (type === 'schulte') {
      const size = Number(record.size || 5);
      const reverse = Boolean(record.reverse);
      const color = Boolean(record.colorInterference);
      return { key: size + '|' + reverse + '|' + color, label: size + '×' + size + ' ' + yesNo(reverse, '倒序', '正序') + ' · ' + yesNo(color, '颜色干扰', '无颜色干扰') };
    }
    if (type === 'stroop') return { key: String(Boolean(record.textAnswer)), label: record.textAnswer ? '按文字作答' : '按字色作答' };
    if (type === 'idiom') {
      const cols = Number(record.cols || 4);
      const color = Boolean(record.colorInterference);
      return { key: cols + '|' + color, label: '4×' + cols + ' · ' + yesNo(color, '颜色干扰', '无颜色干扰') };
    }
    if (type === 'poem') return { key: (record.title || '未知古诗') + '|' + Boolean(record.colorInterference), label: (record.title || '未知古诗') + ' · ' + yesNo(record.colorInterference, '颜色干扰', '无颜色干扰') };
    if (type === 'decode') return { key: String(Boolean(record.reverse)), label: record.reverse ? '字母→符号' : '符号→字母' };
    if (type === 'mindfulness') return { key: String(record.audioId || record.audioName || 'default'), label: record.audioName || '引导音频' };
    return { key: 'default', label: '默认配置' };
  }

  function trendBucket() {
    return { count: 0, timeSum: 0, timeCount: 0, accuracySum: 0, accuracyCount: 0, spanSum: 0, spanCount: 0, practiceSum: 0, completeCount: 0 };
  }

  function addTrendRecord(bucket, record) {
    bucket.count += 1;
    const time = Number(record.timeMs);
    if (Number.isFinite(time)) { bucket.timeSum += Math.max(0, time); bucket.timeCount += 1; }
    const accuracy = Number(record.accuracy);
    if ((record.type || 'schulte') !== 'mindfulness' && Number.isFinite(accuracy)) { bucket.accuracySum += Math.max(0, Math.min(100, accuracy)); bucket.accuracyCount += 1; }
    const span = Number(record.memorySpan);
    if (record.memorySpan !== null && record.memorySpan !== undefined && Number.isFinite(span)) { bucket.spanSum += Math.max(0, span); bucket.spanCount += 1; }
    bucket.practiceSum += Math.max(0, Number(record.practiceMs || record.timeMs) || 0);
    if (record.audioCompleted) bucket.completeCount += 1;
  }

  function sumTrendBuckets(buckets) {
    return buckets.reduce((sum, bucket) => {
      Object.keys(sum).forEach((key) => { sum[key] += bucket[key]; });
      return sum;
    }, trendBucket());
  }

  function trendMetricValue(bucket, metric) {
    if (metric.kind === 'count') return bucket.count;
    if (metric.kind === 'time') return bucket.timeCount ? bucket.timeSum / bucket.timeCount : null;
    if (metric.kind === 'accuracy') return bucket.accuracyCount ? bucket.accuracySum / bucket.accuracyCount : null;
    if (metric.kind === 'span') return bucket.spanCount ? bucket.spanSum / bucket.spanCount : null;
    if (metric.kind === 'practice') return bucket.practiceSum;
    if (metric.kind === 'completion') return bucket.count ? bucket.completeCount * 100 / bucket.count : null;
    return null;
  }

  function buildTrendSeries(records, endDate, mode, variantKey, dateKeyForRecord) {
    const dates = Array.from({ length: 90 }, (_, index) => shiftDateKey(endDate, index - 89));
    const buckets = dates.map(trendBucket);
    const indexByDate = new Map(dates.map((date, index) => [date, index]));
    const filtered = records.filter((record) => {
      const date = dateKeyForRecord(record);
      return (record.type || 'schulte') === mode && indexByDate.has(date) && (!variantKey || trendVariant(record).key === variantKey);
    });
    filtered.forEach((record) => addTrendRecord(buckets[indexByDate.get(dateKeyForRecord(record))], record));
    const metrics = trendMetricDefinitions(mode);
    const values = Object.fromEntries(metrics.map((metric) => [metric.id, buckets.map((bucket) => trendMetricValue(bucket, metric))]));
    const rolling = Object.fromEntries(metrics.map((metric) => [metric.id, buckets.map((_, index) => {
      const window = buckets.slice(Math.max(0, index - 6), index + 1);
      const value = trendMetricValue(sumTrendBuckets(window), metric);
      return (metric.kind === 'count' || metric.kind === 'practice') ? value / window.length : value;
    })]));
    return { dates, buckets, filtered, metrics, values, rolling };
  }
  /* trend-core:end */
`;

const TREND_RENDER_SCRIPT = String.raw`
  function formatTrendValue(metric, value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    if (metric.kind === 'time') return (value / 1000).toFixed(value >= 10000 ? 1 : 2) + ' 秒';
    if (metric.kind === 'accuracy' || metric.kind === 'completion') return value.toFixed(1) + '%';
    if (metric.kind === 'count') return Math.round(value) + ' 次';
    if (metric.kind === 'span') return value.toFixed(1) + ' 轮';
    if (metric.kind === 'practice') {
      const seconds = Math.round(value / 1000);
      return seconds < 60 ? seconds + ' 秒' : Math.floor(seconds / 60) + ' 分' + (seconds % 60 ? seconds % 60 + ' 秒' : '钟');
    }
    return String(value);
  }

  function trendSvgNode(name, attributes = {}, value = '') {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, attributeValue]) => node.setAttribute(key, String(attributeValue)));
    if (value) node.textContent = value;
    return node;
  }

  function renderTrendSummary(series, metric) {
    const recent = trendMetricValue(sumTrendBuckets(series.buckets.slice(-7)), metric);
    const previous = trendMetricValue(sumTrendBuckets(series.buckets.slice(-14, -7)), metric);
    const delta = recent === null || previous === null ? null : recent - previous;
    const trainingDays = new Set(series.filtered.map(recordDateKey)).size;
    const items = [
      ['90 天练习次数', series.filtered.length + ' 次'],
      ['训练天数', trainingDays + ' 天'],
      ['近 7 日' + metric.label, formatTrendValue(metric, recent)],
      ['较前 7 日', delta === null ? '--' : (delta > 0 ? '+' : '') + formatTrendValue(metric, delta)]
    ];
    trendSummary.replaceChildren(...items.map(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      item.append(span, strong);
      return item;
    }));
  }

  function renderTrendChart(series, metric) {
    trendChart.replaceChildren();
    if (!series.filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = '近 90 天暂无' + labels[trendMode] + '成绩记录';
      trendChart.append(empty);
      return;
    }
    const values = series.values[metric.id];
    const rolling = series.rolling[metric.id];
    const allValues = [...values, ...rolling].filter((value) => value !== null && Number.isFinite(value));
    const width = 720;
    const height = 260;
    const padding = { top: 18, right: 16, bottom: 38, left: 54 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const max = Math.max(1, ...allValues);
    const x = (index) => padding.left + (innerWidth * index / (series.dates.length - 1));
    const y = (value) => padding.top + innerHeight - (Math.max(0, value) / max * innerHeight);
    const svg = trendSvgNode('svg', { class: 'trend-chart', viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': labels[trendMode] + metric.label + '近 90 天趋势图' });
    [0, 0.5, 1].forEach((ratio) => {
      const value = max * ratio;
      const lineY = y(value);
      svg.append(
        trendSvgNode('line', { x1: padding.left, y1: lineY, x2: width - padding.right, y2: lineY, stroke: '#e6e1d6', 'stroke-width': 1 }),
        trendSvgNode('text', { x: padding.left - 8, y: lineY + 4, fill: '#677176', 'font-size': 11, 'text-anchor': 'end' }, formatTrendValue(metric, value))
      );
    });
    [0, 44, 89].forEach((index) => {
      svg.append(trendSvgNode('text', { x: x(index), y: height - 14, fill: '#677176', 'font-size': 11, 'text-anchor': index === 0 ? 'start' : index === 89 ? 'end' : 'middle' }, series.dates[index].slice(5).replace('-', '/')));
    });
    if (metric.bar) {
      const barWidth = Math.max(2, innerWidth / series.dates.length * 0.66);
      values.forEach((value, index) => {
        if (!value) return;
        const bar = trendSvgNode('rect', { x: x(index) - barWidth / 2, y: y(value), width: barWidth, height: padding.top + innerHeight - y(value), rx: 1, fill: '#db6c43', tabindex: 0 });
        bar.append(trendSvgNode('title', {}, series.dates[index] + '：' + formatTrendValue(metric, value)));
        svg.append(bar);
      });
    } else {
      values.forEach((value, index) => {
        if (value === null || !Number.isFinite(value)) return;
        const point = trendSvgNode('circle', { cx: x(index), cy: y(value), r: 3, fill: '#db6c43', tabindex: 0 });
        point.append(trendSvgNode('title', {}, series.dates[index] + '：' + formatTrendValue(metric, value)));
        svg.append(point);
      });
    }
    let path = '';
    rolling.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) return;
      path += (path && rolling[index - 1] !== null && Number.isFinite(rolling[index - 1]) ? 'L' : 'M') + x(index) + ' ' + y(value) + ' ';
    });
    if (path) svg.append(trendSvgNode('path', { d: path.trim(), fill: 'none', stroke: '#177e89', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    trendChart.append(svg);
  }
`;

const TREND_BOOTSTRAP_SCRIPT = String.raw`
  function renderDailyTrends() {
    const modes = Object.keys(labels);
    trendModeTabs.replaceChildren(...modes.map((mode) => {
      const button = document.createElement('button');
      button.className = 'trend-tab' + (mode === trendMode ? ' active' : '');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(mode === trendMode));
      button.textContent = labels[mode];
      button.addEventListener('click', () => {
        trendMode = mode;
        renderDailyTrends();
      });
      return button;
    }));
    const startDate = shiftDateKey(data.endDate, -89);
    const modeRecords = records.filter((record) => {
      const date = recordDateKey(record);
      return (record.type || 'schulte') === trendMode && date >= startDate && date <= data.endDate;
    });
    const variants = [...new Map(modeRecords.map((record) => {
      const variant = trendVariant(record);
      return [variant.key, variant];
    })).values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
    const storedVariant = trendVariantByMode[trendMode] || '';
    const variantKey = variants.some((variant) => variant.key === storedVariant) ? storedVariant : '';
    trendVariantByMode[trendMode] = variantKey;
    trendVariantSelect.replaceChildren(new Option('全部配置', ''), ...variants.map((variant) => new Option(variant.label, variant.key)));
    trendVariantSelect.value = variantKey;
    trendVariantSelect.disabled = variants.length < 2;
    trendVariantSelect.onchange = () => {
      trendVariantByMode[trendMode] = trendVariantSelect.value;
      renderDailyTrends();
    };
    const series = buildTrendSeries(records, data.endDate, trendMode, variantKey, recordDateKey);
    const metricId = trendMetricByMode[trendMode] || series.metrics[0].id;
    const metric = series.metrics.find((item) => item.id === metricId) || series.metrics[0];
    trendMetricByMode[trendMode] = metric.id;
    trendMetricTabs.replaceChildren(...series.metrics.map((item) => {
      const button = document.createElement('button');
      button.className = 'trend-tab' + (item.id === metric.id ? ' active' : '');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(item.id === metric.id));
      button.textContent = item.label;
      button.addEventListener('click', () => {
        trendMetricByMode[trendMode] = item.id;
        renderDailyTrends();
      });
      return button;
    }));
    trendModeHint.textContent = !variantKey && variants.length > 1 ? '已合并不同配置；比较用时请筛选配置' : startDate + ' 至 ' + data.endDate;
    renderTrendSummary(series, metric);
    renderTrendChart(series, metric);
  }

  renderDailyTrends();
})();
`;

function renderPublicUserPage(stored, todayRecords, tasks, records, timeZone, audioNameForId) {
  const completedTasks = tasks.filter((task) => task.completed).length;
  const progressPercent = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const todayPracticeMs = totalPracticeMs(todayRecords);

  const taskSummary = tasks.length
    ? `<div class="progress-head"><strong>${completedTasks}/${tasks.length}</strong><span>${progressPercent}%</span></div>
      <div class="progress"><span style="width:${progressPercent}%"></span></div>
      <div class="practice-total">今日累计练习时长：${escapeHtml(formatPracticeMs(todayPracticeMs))}</div>
      <div class="task-list">${tasks.map((task) => `<article class="task ${task.completed ? "done" : "todo"}">
        <strong>${task.completed ? "已完成" : "进行中"}</strong>
        <span>${escapeHtml(cloudTaskText(task, audioNameForId))} · ${Math.min(task.completedCount, task.targetCount)}/${task.targetCount} 次</span>
      </article>`).join("")}</div>`
    : '<p class="empty">今日暂无任务</p>';

  const byDate = records.reduce((map, record) => {
    const date = recordDateKey(record, timeZone) || '未知日期';
    (map[date] ||= []).push(record);
    return map;
  }, {});

  const sections = Object.entries(byDate).slice(0, 30).map(([date, dayRecords]) => `
    <section class="panel">
      <h2>${escapeHtml(date)}</h2>
      <div class="practice-total">当日累计练习时长：${escapeHtml(formatPracticeMs(totalPracticeMs(dayRecords)))}</div>
      ${dayRecords.map((record) => {
        const rating = scoreCloudRecord(record, stored.birthDate);
        const label = trainingLabel(record);
        const rt = formatRecordTime(record.date, timeZone);
        const detail = (record.type || 'schulte') === 'mindfulness'
          ? `音频 ${escapeHtml(record.audioName || '引导音频')} · 练习 ${escapeHtml(formatPracticeMs(record.practiceMs || record.timeMs))} · ${record.audioCompleted ? '完整播放' : '提前结束'}`
          : `${formatSeconds(record.timeMs)}s · 练习 ${escapeHtml(formatPracticeMs(record.practiceMs || record.timeMs))} · 错 ${record.errors} · 正确率 ${record.accuracy}%${escapeHtml(memoryReplaySuffix(record).replace(/^，/, " · "))}${rating ? ` · 等第：${escapeHtml(rating)}（训练参考，非医学诊断）` : ""}`;
        return `<article class="record">
          <time>${rt || '--:--'}</time>
          <strong>${escapeHtml(label)}</strong>
          <span>${detail}</span>
        </article>`;
      }).join("")}
    </section>
  `).join("") || '<p class="empty">近 90 天暂无成绩记录</p>';
  const trendData = JSON.stringify({ records, timeZone, endDate: todayDateKey(timeZone) }).replace(/</g, '\\u003c');
  const trendPanel = '<section class="panel trend-panel" aria-labelledby="dailyTrendTitle"><div class="trend-head"><h2 id="dailyTrendTitle">近 90 天趋势</h2><span class="meta" id="trendModeHint"></span></div><div class="trend-tabs" id="trendModeTabs" role="tablist" aria-label="训练模式"></div><div class="trend-controls"><label>训练配置<select id="trendVariantSelect"></select></label><div class="trend-tabs" id="trendMetricTabs" role="tablist" aria-label="趋势指标"></div></div><div class="trend-summary" id="trendSummary"></div><div class="trend-chart-wrap" id="trendChart" aria-live="polite"></div><p class="trend-legend">圆点/柱形为每日值，深色线为 7 日趋势；没有训练的日期不会伪造成成绩。</p></section>';
  const trendScripts = '<script id="trendData" type="application/json">' + trendData + '</script><script>' + TREND_SCRIPT + TREND_RENDER_SCRIPT + TREND_BOOTSTRAP_SCRIPT + '</script>';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(stored.username || stored.identifier)} · 每日成绩</title>
  <style>
    body{margin:0;background:#f6f2ea;color:#1f2a2e;font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif}
    main{width:min(900px,calc(100% - 28px));margin:0 auto;padding:28px 0 40px}
    header{display:flex;justify-content:space-between;gap:16px;align-items:end;border-bottom:1px solid #e6e1d6;padding-bottom:16px;margin-bottom:18px}
    h1{margin:0;font-size:clamp(1.6rem,4vw,2.4rem)} h2{margin:0 0 10px;font-size:1.05rem}
    .meta{color:#677176}.panel{background:#fffdf8;border:1px solid #e6e1d6;border-radius:8px;padding:16px;margin:12px 0}
    .progress-head{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#177e89;font-size:1.15rem}
    .progress{height:12px;overflow:hidden;border-radius:999px;background:#e6e1d6;margin:12px 0 14px}.progress span{display:block;height:100%;border-radius:inherit;background:#177e89}
    .practice-total{color:#677176;margin:0 0 12px}
    .task-list{display:grid;gap:8px}.task{display:flex;justify-content:space-between;gap:12px;padding:10px;border:1px solid #e6e1d6;border-radius:8px;background:#fbf7ee}.task strong{color:#bf3f34}.task.done strong{color:#2f855a}
    .record{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:10px;border:1px solid #e6e1d6;border-radius:8px;background:#fbf7ee;margin:8px 0;align-items:baseline}
    .record time{color:#677176;font-size:0.9rem;white-space:nowrap}
    .record span{grid-column:1/-1;color:#677176}.empty{text-align:center;padding:28px}
    .trend-panel{display:grid;gap:12px}.trend-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.trend-head h2{margin:0}.trend-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}.trend-tab{min-height:36px;padding:0 12px;flex:0 0 auto;border:1px solid #e6e1d6;border-radius:999px;background:#fffdf8;color:#677176;font-weight:700;white-space:nowrap;cursor:pointer}.trend-tab.active{border-color:#177e89;background:#177e89;color:#fff}.trend-controls{display:grid;grid-template-columns:minmax(170px,1fr) minmax(0,2fr);gap:10px;align-items:end}.trend-controls label{display:grid;gap:6px;color:#677176;font-size:.9rem}.trend-controls select{min-height:36px;border:1px solid #e6e1d6;border-radius:8px;background:#fffdf8;color:#1f2a2e;padding:0 8px}.trend-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.summary-item{display:grid;gap:4px;padding:8px;border:1px solid #e6e1d6;border-radius:8px;background:#fbf7ee;color:#677176;font-size:.82rem}.summary-item strong{color:#1f2a2e;font-size:1rem}.trend-chart-wrap{min-height:240px;padding:8px;border:1px solid #e6e1d6;border-radius:8px;background:#fffdf8}.trend-chart{display:block;width:100%;height:auto}.trend-legend{margin:0;color:#677176;font-size:.78rem}
    @media (max-width: 560px){header,.task{display:grid}.task{justify-content:stretch}.trend-controls{grid-template-columns:1fr}.trend-summary{grid-template-columns:repeat(2,minmax(0,1fr)}.trend-head{align-items:flex-start;flex-direction:column}.trend-chart-wrap{min-height:210px;padding:4px}}
  </style>
</head>
<body>
  <main>
    <header><div><h1>${escapeHtml(stored.username || '未命名用户')}</h1><div class="meta">识别码：${escapeHtml(stored.identifier)}</div></div><div class="meta">每日成绩 · 仅保留近 90 天</div></header>
    <section class="panel">
      <h2>今日任务完成进度</h2>
      ${taskSummary}
    </section>
    ${trendPanel}
    ${sections}
  </main>
  ${trendScripts}
</body>
</html>`;
}

function formatRecordTime(iso, timeZone) {
  if (!iso) return '--:--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  const tz = timeZone || 'Asia/Shanghai';
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${value.hour}:${value.minute}`;
}

module.exports = {
  getIndexHtml,
  renderPublicUserPage
};
