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
  scoreCloudRecord
} = require('./utils');

const INDEX_HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');

let indexHtml;

function getIndexHtml() {
  if (!indexHtml) {
    indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  }
  return indexHtml;
}

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
    const date = recordDateKey(record) || '未知日期';
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
    @media (max-width: 560px){header,.task{display:grid}.task{justify-content:stretch}}
  </style>
</head>
<body>
  <main>
    <header><div><h1>${escapeHtml(stored.username || '未命名用户')}</h1><div class="meta">识别码：${escapeHtml(stored.identifier)}</div></div><div class="meta">每日成绩 · 仅保留近 90 天</div></header>
    <section class="panel">
      <h2>今日任务完成进度</h2>
      ${taskSummary}
    </section>
    ${sections}
  </main>
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
