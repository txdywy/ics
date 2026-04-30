# Month Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete monthly calendar overview and cute SVG favicon to the existing static ICS Calendar Shelf site.

**Architecture:** Extend the build-time generator so each calendar record includes full month-view event data while preserving capped `previewEvents` for cards. Extend the framework-free browser app with tested date-grid helpers, month navigation state, safe DOM rendering for month cells/details, and CSS that matches the existing cute calendar shelf visual system. Add `favicon.svg` and reference it from `index.html`.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node.js built-ins, GitHub Actions Pages deployment.

---

## File Structure

- Modify `scripts/generate-calendars.mjs`: add full `events` entries with parent calendar context.
- Modify `scripts/generate-calendars.test.mjs`: add generator tests for full events and capped previews.
- Modify `assets/app.js`: add month helper exports, month state, rendering, controls, selected-day panel, and fallback handling.
- Modify `assets/app.test.mjs`: add helper tests for month grid, event grouping, and year options.
- Modify `index.html`: add favicon link and month calendar section below the hero.
- Modify `assets/styles.css`: style month calendar controls, 6x7 grid, event pills, selected day details, and responsive behavior.
- Create `favicon.svg`: cute small calendar icon with star/heart accent.
- Regenerate `calendars.json`.

## Task 1: Generator Full Event Data

**Files:**
- Modify: `scripts/generate-calendars.test.mjs`
- Modify: `scripts/generate-calendars.mjs`
- Generated: `calendars.json`

- [ ] **Step 1: Add failing generator tests for full events**

Append these tests to `scripts/generate-calendars.test.mjs`:

```js
test('buildCalendarRecord includes full events with calendar context', () => {
  const ics = `BEGIN:VCALENDAR\nX-WR-CALNAME:Test Calendar\nBEGIN:VEVENT\nSUMMARY:First Event\nDTSTART;VALUE=DATE:20260101\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Second Event\nDTSTART;VALUE=DATE:20260102\nEND:VEVENT\nEND:VCALENDAR\n`;
  const record = buildCalendarRecord('test_calendar.ics', ics, 'https://example.com/');
  assert.equal(record.events.length, 2);
  assert.deepEqual(record.events[0], {
    summary: 'First Event',
    date: '2026-01-01',
    calendarId: record.id,
    calendarTitle: 'Test Calendar',
    category: record.category,
    visual: record.visual,
  });
});

test('previewEvents remains capped while events keeps all dated events', () => {
  const events = Array.from({ length: 7 }, (_, index) => `BEGIN:VEVENT\nSUMMARY:Event ${index + 1}\nDTSTART;VALUE=DATE:2026010${index + 1}\nEND:VEVENT`).join('\n');
  const record = buildCalendarRecord('many_events.ics', `BEGIN:VCALENDAR\nX-WR-CALNAME:Many Events\n${events}\nEND:VCALENDAR\n`, 'https://example.com/');
  assert.equal(record.previewEvents.length, 5);
  assert.equal(record.events.length, 7);
  assert.equal(record.events[6].summary, 'Event 7');
});
```

- [ ] **Step 2: Run generator tests and verify failure**

Run:

```bash
node --test scripts/generate-calendars.test.mjs
```

Expected: FAIL because `record.events` is undefined.

- [ ] **Step 3: Implement full event context in generator**

In `scripts/generate-calendars.mjs`, inside `buildCalendarRecord`, replace the current return preparation with a local `visual` object and `monthEvents` mapping:

```js
  const visual = {
    emoji: category.emoji,
    colors: category.colors,
  };
  const monthEvents = events.map((event) => ({
    ...event,
    calendarId: createCalendarId(fileName),
    calendarTitle: title,
    category,
    visual,
  }));
```

Then in the returned object:

```js
    id: createCalendarId(fileName),
    fileName,
    title,
    category,
    url,
    downloadUrl,
    webcalUrl: downloadUrl.replace(/^https?:\/\//, 'webcal://'),
    eventCount: events.length,
    dateRange: {
      start: dates[0] ?? null,
      end: dates.at(-1) ?? null,
    },
    previewEvents: events.slice(0, 5),
    events: monthEvents,
    keywords: collectKeywords(fileName, title, events, category),
    visual,
    generatedAt,
```

In `buildCalendarErrorRecord`, add:

```js
    events: [],
```

- [ ] **Step 4: Run tests and regenerate index**

Run:

```bash
node --test scripts/generate-calendars.test.mjs
SITE_BASE_URL="https://ics.hackx64.eu.org/" node scripts/generate-calendars.mjs
```

Expected: generator tests pass and `calendars.json` includes `events` arrays.

- [ ] **Step 5: Commit generator changes**

```bash
git add scripts/generate-calendars.mjs scripts/generate-calendars.test.mjs calendars.json
git commit -m "feat: include full event data for month view"
```

## Task 2: Month Helper Tests and Implementation

**Files:**
- Modify: `assets/app.test.mjs`
- Modify: `assets/app.js`

- [ ] **Step 1: Add failing month helper tests**

Append these tests to `assets/app.test.mjs`:

```js
import {
  buildMonthGrid,
  groupEventsByDate,
  getYearOptions,
  toDateKey,
} from './app.js';

test('toDateKey formats local dates as YYYY-MM-DD', () => {
  assert.equal(toDateKey(new Date(2026, 3, 5)), '2026-04-05');
});

test('buildMonthGrid returns 42 cells and starts on Monday', () => {
  const grid = buildMonthGrid(2026, 4);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].date, '2026-03-30');
  assert.equal(grid[0].isCurrentMonth, false);
  assert.equal(grid.find((day) => day.date === '2026-04-01').weekday, 2);
});

test('groupEventsByDate merges events from multiple calendars', () => {
  const grouped = groupEventsByDate([
    { title: 'A', events: [{ summary: 'One', date: '2026-04-01', calendarTitle: 'A' }] },
    { title: 'B', previewEvents: [{ summary: 'Two', date: '2026-04-01' }] },
  ]);
  assert.equal(grouped.get('2026-04-01').length, 2);
});

test('getYearOptions derives event years and falls back around current year', () => {
  assert.deepEqual(getYearOptions([{ events: [{ date: '2024-01-01' }, { date: '2026-12-31' }] }], 2025), [2024, 2025, 2026]);
  assert.deepEqual(getYearOptions([], 2025), [2023, 2024, 2025, 2026, 2027]);
});
```

- [ ] **Step 2: Run frontend tests and verify failure**

Run:

```bash
node --test assets/app.test.mjs
```

Expected: FAIL because month helper exports do not exist.

- [ ] **Step 3: Implement month helper exports**

Add these exports near existing helper exports in `assets/app.js`:

```js
export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date: toDateKey(date),
      day: date.getDate(),
      weekday: (date.getDay() + 6) % 7,
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: toDateKey(date) === toDateKey(new Date()),
    };
  });
}

export function groupEventsByDate(calendars) {
  const grouped = new Map();
  for (const calendar of calendars) {
    const sourceEvents = Array.isArray(calendar.events) ? calendar.events : (calendar.previewEvents ?? []);
    for (const event of sourceEvents) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event.date ?? ''))) continue;
      const enrichedEvent = {
        ...event,
        calendarId: event.calendarId ?? calendar.id,
        calendarTitle: event.calendarTitle ?? calendar.title,
        category: event.category ?? calendar.category,
        visual: event.visual ?? calendar.visual,
        downloadUrl: calendar.downloadUrl,
        webcalUrl: calendar.webcalUrl,
      };
      if (!grouped.has(event.date)) grouped.set(event.date, []);
      grouped.get(event.date).push(enrichedEvent);
    }
  }
  for (const events of grouped.values()) {
    events.sort((a, b) => String(a.calendarTitle ?? '').localeCompare(String(b.calendarTitle ?? ''), 'zh-CN') || String(a.summary ?? '').localeCompare(String(b.summary ?? ''), 'zh-CN'));
  }
  return grouped;
}

export function getYearOptions(calendars, currentYear = new Date().getFullYear()) {
  const years = new Set();
  for (const events of groupEventsByDate(calendars).values()) {
    for (const event of events) years.add(Number(event.date.slice(0, 4)));
  }
  if (years.size === 0) return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const min = Math.min(...years, currentYear);
  const max = Math.max(...years, currentYear);
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}
```

- [ ] **Step 4: Run frontend tests**

Run:

```bash
node --test assets/app.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit helpers**

```bash
git add assets/app.js assets/app.test.mjs
git commit -m "feat: add month calendar data helpers"
```

## Task 3: Month Calendar Markup and Rendering

**Files:**
- Modify: `index.html`
- Modify: `assets/app.js`

- [ ] **Step 1: Add month section markup**

In `index.html`, insert this section after the hero section and before the existing controls section:

```html
<section class="month-overview" aria-labelledby="month-title">
  <div class="month-overview__header">
    <div>
      <p class="section-kicker">Monthly View</p>
      <h2 id="month-title">当月日历总览</h2>
      <p class="month-overview__copy">所有日历事件会一起落到日期格里，适合快速看看这个月有什么可爱的事情。</p>
    </div>
    <div class="month-controls" aria-label="月份切换">
      <button id="month-prev" type="button">‹ 上月</button>
      <label>年份<select id="month-year"></select></label>
      <label>月份<select id="month-select"></select></label>
      <button id="month-today" type="button">今天</button>
      <button id="month-next" type="button">下月 ›</button>
    </div>
  </div>
  <div id="month-heading" class="month-heading" aria-live="polite"></div>
  <div class="month-weekdays" aria-hidden="true">
    <span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span>
  </div>
  <div id="month-grid" class="month-grid" aria-label="月历"></div>
  <div id="day-detail" class="day-detail" aria-live="polite"></div>
</section>
```

Also add favicon link in `<head>`:

```html
<link rel="icon" href="favicon.svg" type="image/svg+xml">
```

- [ ] **Step 2: Add month state and initialization in app.js**

Extend `state` in `assets/app.js`:

```js
  monthYear: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  selectedDate: toDateKey(new Date()),
  monthEvents: new Map(),
```

After calendars are loaded in `init`, add:

```js
    state.monthEvents = groupEventsByDate(state.calendars);
    initializeMonthControls();
    renderMonthCalendar();
```

- [ ] **Step 3: Implement month controls and rendering functions**

Add these functions to `assets/app.js`:

```js
function initializeMonthControls() {
  const yearSelect = document.getElementById('month-year');
  const monthSelect = document.getElementById('month-select');
  if (!yearSelect || !monthSelect) return;

  yearSelect.replaceChildren(...getYearOptions(state.calendars).map((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = `${year} 年`;
    return option;
  }));

  monthSelect.replaceChildren(...Array.from({ length: 12 }, (_, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = `${index + 1} 月`;
    return option;
  }));

  yearSelect.value = String(state.monthYear);
  monthSelect.value = String(state.month);
  yearSelect.addEventListener('change', () => {
    state.monthYear = Number(yearSelect.value);
    renderMonthCalendar();
  });
  monthSelect.addEventListener('change', () => {
    state.month = Number(monthSelect.value);
    renderMonthCalendar();
  });

  document.getElementById('month-prev')?.addEventListener('click', () => shiftMonth(-1));
  document.getElementById('month-next')?.addEventListener('click', () => shiftMonth(1));
  document.getElementById('month-today')?.addEventListener('click', () => {
    const today = new Date();
    state.monthYear = today.getFullYear();
    state.month = today.getMonth() + 1;
    state.selectedDate = toDateKey(today);
    renderMonthCalendar();
  });
}

function shiftMonth(delta) {
  const next = new Date(state.monthYear, state.month - 1 + delta, 1);
  state.monthYear = next.getFullYear();
  state.month = next.getMonth() + 1;
  renderMonthCalendar();
}

function syncMonthSelects() {
  const yearSelect = document.getElementById('month-year');
  const monthSelect = document.getElementById('month-select');
  if (yearSelect && ![...yearSelect.options].some((option) => Number(option.value) === state.monthYear)) {
    const option = document.createElement('option');
    option.value = String(state.monthYear);
    option.textContent = `${state.monthYear} 年`;
    yearSelect.append(option);
  }
  if (yearSelect) yearSelect.value = String(state.monthYear);
  if (monthSelect) monthSelect.value = String(state.month);
}

function renderMonthCalendar() {
  const grid = document.getElementById('month-grid');
  const heading = document.getElementById('month-heading');
  if (!grid || !heading) return;
  syncMonthSelects();
  heading.textContent = `${state.monthYear} 年 ${state.month} 月`;
  const cells = buildMonthGrid(state.monthYear, state.month).map(renderMonthDayCell);
  grid.replaceChildren(...cells);
  renderSelectedDayDetail();
}

function renderMonthDayCell(day) {
  const events = state.monthEvents.get(day.date) ?? [];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['month-day', day.isCurrentMonth ? '' : 'is-outside-month', day.isToday ? 'is-today' : '', state.selectedDate === day.date ? 'is-selected' : ''].filter(Boolean).join(' ');
  button.setAttribute('aria-label', `${day.date}，${events.length} 个事件`);
  button.addEventListener('click', () => {
    state.selectedDate = day.date;
    renderMonthCalendar();
  });

  appendText(button, 'span', String(day.day), 'month-day__number');
  const list = document.createElement('span');
  list.className = 'month-day__events';
  for (const event of events.slice(0, 3)) list.append(renderMonthEventPill(event));
  if (events.length > 3) appendText(list, 'span', `+${events.length - 3} 更多`, 'month-day__more');
  button.append(list);
  return button;
}

function renderMonthEventPill(event) {
  const pill = document.createElement('span');
  pill.className = 'month-event-pill';
  const color = event.visual?.colors?.[0] ?? '#ffd9e4';
  pill.style.setProperty('--event-color', color);
  appendText(pill, 'span', event.visual?.emoji ?? '•', 'month-event-pill__emoji');
  appendText(pill, 'span', event.summary ?? '未命名事件', 'month-event-pill__text');
  return pill;
}

function renderSelectedDayDetail() {
  const detail = document.getElementById('day-detail');
  if (!detail) return;
  const events = state.monthEvents.get(state.selectedDate) ?? [];
  const heading = appendText(document.createElement('div'), 'h3', `${state.selectedDate} 的事件`, 'day-detail__title');
  const body = document.createElement('div');
  body.className = 'day-detail__body';
  if (events.length === 0) {
    appendText(body, 'p', '这一天还没有事件，适合发呆和喝奶茶。', 'day-detail__empty');
  } else {
    body.replaceChildren(...events.map(renderDayDetailEvent));
  }
  detail.replaceChildren(heading, body);
}

function renderDayDetailEvent(event) {
  const item = document.createElement('article');
  item.className = 'day-event';
  appendText(item, 'h4', `${event.visual?.emoji ?? '🗓️'} ${event.summary ?? '未命名事件'}`);
  appendText(item, 'p', event.calendarTitle ?? '未知日历', 'day-event__calendar');
  const actions = document.createElement('div');
  actions.className = 'day-event__actions';
  const downloadUrl = sanitizeDownloadUrl(event.downloadUrl);
  const webcalUrl = sanitizeSubscriptionUrl(event.webcalUrl, event.downloadUrl);
  if (downloadUrl) {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.textContent = '下载';
    actions.append(link);
  }
  if (webcalUrl) {
    const link = document.createElement('a');
    link.href = webcalUrl;
    link.textContent = '订阅';
    actions.append(link);
  }
  item.append(actions);
  return item;
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
node --test scripts/generate-calendars.test.mjs assets/app.test.mjs
```

Expected: PASS.

```bash
git add index.html assets/app.js
git commit -m "feat: render monthly calendar overview"
```

## Task 4: Month Calendar Styling and Favicon

**Files:**
- Modify: `assets/styles.css`
- Create: `favicon.svg`

- [ ] **Step 1: Add favicon SVG**

Create `favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFD9E4"/>
      <stop offset="0.55" stop-color="#FFE890"/>
      <stop offset="1" stop-color="#BFE5FF"/>
    </linearGradient>
  </defs>
  <rect x="8" y="10" width="48" height="46" rx="14" fill="url(#bg)"/>
  <rect x="8" y="10" width="48" height="14" rx="10" fill="#C7486C"/>
  <circle cx="22" cy="17" r="3" fill="#FFF9EC"/>
  <circle cx="42" cy="17" r="3" fill="#FFF9EC"/>
  <rect x="17" y="31" width="9" height="8" rx="3" fill="#FFFDF7"/>
  <rect x="30" y="31" width="9" height="8" rx="3" fill="#FFFDF7"/>
  <rect x="17" y="43" width="9" height="8" rx="3" fill="#FFFDF7"/>
  <path d="M45 35l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7L45 35z" fill="#C7486C"/>
</svg>
```

- [ ] **Step 2: Add month CSS**

Append to `assets/styles.css`:

```css
.month-overview {
  width: min(calc(100% - 32px), var(--max-width));
  margin: 1.4rem auto 1.6rem;
  padding: clamp(1rem, 3vw, 1.6rem);
  border: 1px solid rgba(123, 75, 47, 0.14);
  border-radius: var(--radius-xl);
  background: rgba(255, 253, 247, 0.86);
  box-shadow: var(--shadow);
}

.month-overview__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
}

.section-kicker {
  margin: 0 0 0.35rem;
  color: var(--berry);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.month-overview h2 {
  margin: 0;
  color: var(--tea);
  font-family: var(--display-font);
  font-size: clamp(1.8rem, 4vw, 3rem);
}

.month-overview__copy {
  max-width: 42rem;
  margin: 0.55rem 0 0;
  color: var(--ink-soft);
}

.month-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: flex-end;
  align-items: end;
}

.month-controls label {
  display: grid;
  gap: 0.25rem;
  color: var(--ink-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.month-controls button,
.month-controls select {
  min-height: 2.55rem;
  border: 1px solid rgba(123, 75, 47, 0.16);
  border-radius: 999px;
  padding: 0.55rem 0.8rem;
  color: var(--ink);
  background: #fffdf7;
  box-shadow: 0 8px 18px rgba(105, 69, 43, 0.08);
}

.month-heading {
  margin: 1rem 0 0.75rem;
  color: var(--caramel);
  font-weight: 900;
  text-align: center;
}

.month-weekdays,
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.45rem;
}

.month-weekdays span {
  color: var(--ink-muted);
  font-size: 0.78rem;
  font-weight: 900;
  text-align: center;
}

.month-day {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 8rem;
  border: 1px solid rgba(123, 75, 47, 0.12);
  border-radius: 18px;
  padding: 0.55rem;
  color: var(--ink);
  background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,249,236,0.72));
  text-align: left;
}

.month-day.is-outside-month {
  opacity: 0.46;
}

.month-day.is-today {
  border-color: rgba(199, 72, 108, 0.45);
  box-shadow: inset 0 0 0 2px rgba(199, 72, 108, 0.18);
}

.month-day.is-selected {
  outline: 3px solid rgba(199, 72, 108, 0.28);
}

.month-day__number {
  width: fit-content;
  min-width: 1.8rem;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
  color: var(--tea);
  background: rgba(255, 232, 144, 0.52);
  font-weight: 900;
}

.month-day__events {
  display: grid;
  align-content: start;
  gap: 0.3rem;
  margin-top: 0.45rem;
}

.month-event-pill,
.month-day__more {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding: 0.22rem 0.45rem;
  background: color-mix(in srgb, var(--event-color, var(--blush)) 32%, white);
  font-size: 0.76rem;
  font-weight: 800;
}

.month-event-pill__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-day__more {
  color: var(--berry);
  background: rgba(255, 217, 228, 0.58);
}

.day-detail {
  margin-top: 1rem;
  border-radius: var(--radius-lg);
  padding: 1rem;
  background: rgba(255, 242, 212, 0.68);
}

.day-detail__title {
  margin: 0 0 0.7rem;
  color: var(--tea);
}

.day-detail__body {
  display: grid;
  gap: 0.65rem;
}

.day-detail__empty {
  margin: 0;
  color: var(--ink-soft);
}

.day-event {
  border: 1px solid rgba(123, 75, 47, 0.12);
  border-radius: 18px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.72);
}

.day-event h4 {
  margin: 0;
}

.day-event__calendar {
  margin: 0.25rem 0 0;
  color: var(--ink-muted);
}

.day-event__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.55rem;
}

.day-event__actions a {
  border-radius: 999px;
  padding: 0.32rem 0.65rem;
  color: var(--berry);
  background: rgba(255, 255, 255, 0.82);
  font-weight: 900;
  text-decoration: none;
}

@media (max-width: 760px) {
  .month-overview__header {
    grid-template-columns: 1fr;
  }
  .month-controls {
    justify-content: stretch;
  }
  .month-controls button,
  .month-controls label {
    flex: 1 1 8rem;
  }
  .month-weekdays,
  .month-grid {
    gap: 0.28rem;
  }
  .month-day {
    min-height: 6.6rem;
    padding: 0.38rem;
    border-radius: 14px;
  }
  .month-event-pill {
    font-size: 0.68rem;
  }
}
```

- [ ] **Step 3: Run tests and commit**

Run:

```bash
node --test scripts/generate-calendars.test.mjs assets/app.test.mjs
```

Expected: PASS.

```bash
git add assets/styles.css favicon.svg
git commit -m "style: add month calendar and favicon visuals"
```

## Task 5: Browser Verification and Deployment Readiness

**Files:**
- May modify: `assets/app.js`, `assets/styles.css`, `index.html`, `scripts/generate-calendars.mjs`, `calendars.json`, `favicon.svg` only if verification exposes defects.

- [ ] **Step 1: Run all tests**

Run:

```bash
node --test scripts/generate-calendars.test.mjs assets/app.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Regenerate calendar index**

Run:

```bash
SITE_BASE_URL="https://ics.hackx64.eu.org/" node scripts/generate-calendars.mjs
```

Expected: `calendars.json` updates with full `events` arrays and canonical links.

- [ ] **Step 3: Start local server**

Run:

```bash
python3 -m http.server 4173
```

Expected: site serves at `http://localhost:4173`.

- [ ] **Step 4: Browser QA**

Open `http://localhost:4173` and verify:

- favicon loads with no `favicon.ico` 404
- month calendar appears below hero and above filters
- grid has 42 day cells
- year/month dropdowns change heading and grid
- previous and next buttons change month
- Today button returns to the current month and selected date
- dates show no more than three visible event pills plus `+N 更多` when applicable
- clicking a date changes the detail panel
- empty dates show the cute empty state
- existing card search for `Chiikawa`, `五月天`, and `HP` still works
- download links remain `https://ics.hackx64.eu.org/...`
- webcal links remain `webcal://ics.hackx64.eu.org/...`
- console has no errors or warnings

- [ ] **Step 5: Commit verification fixes if needed**

If fixes were required:

```bash
git add index.html assets/app.js assets/styles.css scripts/generate-calendars.mjs calendars.json favicon.svg
git commit -m "fix: polish month calendar verification issues"
```

If no fixes were required, do not create an empty commit.

## Self-Review

Spec coverage:

- Full `events` data: Task 1.
- `previewEvents` preserved for cards: Task 1.
- Month helper functions and tests: Task 2.
- Month section below hero and above controls: Task 3.
- Year/month/prev/next/today controls: Task 3.
- 6x7 Monday-start grid and selected-day panel: Tasks 2 and 3.
- Existing filters affect only card gallery: Task 3 keeps current filter path separate.
- Cute month styling and favicon: Task 4.
- Browser verification including favicon and existing behavior: Task 5.

Placeholder scan: no `TBD`, `TODO`, unspecified implementation, or “similar to” steps remain.

Type consistency: generator event fields (`summary`, `date`, `calendarId`, `calendarTitle`, `category`, `visual`) match frontend grouping/rendering code and test expectations.
