import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCalendars, sortCalendars, formatDateRange, createSubscriptionUrl, sanitizeDownloadUrl, sanitizeSubscriptionUrl, sanitizeCopyUrl, buildMonthGrid, groupEventsByDate, getYearOptions, toDateKey } from './app.js';

const calendars = [
  { title: 'Chiikawa 小可爱主题日历', category: { id: 'cute', label: '角色 / 萌系' }, eventCount: 3, keywords: ['Chiikawa', '生日'], previewEvents: [{ summary: 'Chiikawa 生日', date: '2026-05-01' }], dateRange: { start: '2026-05-01', end: '2026-06-01' }, downloadUrl: 'https://example.com/Chiikawa.ics' },
  { title: 'Mayday Calendar', category: { id: 'music', label: '音乐 / 演出' }, eventCount: 9, keywords: ['五月天', '摇滚乐队'], previewEvents: [{ summary: '蓝色信号纪念日', date: '2026-05-20' }], dateRange: { start: '2026-05-20', end: '2026-12-31' }, downloadUrl: 'https://example.com/mayday.ics' },
];

test('filterCalendars filters by category', () => {
  assert.equal(filterCalendars(calendars, { category: 'music', query: '' })[0].title, 'Mayday Calendar');
});

test('filterCalendars searches titles, keywords, and event summaries', () => {
  assert.equal(filterCalendars(calendars, { category: 'all', query: '小可爱' })[0].title, 'Chiikawa 小可爱主题日历');
  assert.equal(filterCalendars(calendars, { category: 'all', query: '摇滚乐队' })[0].title, 'Mayday Calendar');
  assert.equal(filterCalendars(calendars, { category: 'all', query: '蓝色信号' })[0].title, 'Mayday Calendar');
});

test('sortCalendars sorts by event count descending', () => {
  assert.equal(sortCalendars(calendars, 'eventCount')[0].title, 'Mayday Calendar');
});

test('formatDateRange handles populated and empty ranges', () => {
  assert.equal(formatDateRange({ start: '2026-05-01', end: '2026-06-01' }), '2026-05-01 → 2026-06-01');
  assert.equal(formatDateRange({ start: null, end: null }), '日期待整理');
});

test('sanitizeDownloadUrl allows safe .ics download links', () => {
  assert.equal(sanitizeDownloadUrl('https://example.com/mayday.ics'), 'https://example.com/mayday.ics');
  assert.equal(sanitizeDownloadUrl('/calendars/mayday.ics'), '/calendars/mayday.ics');
  assert.equal(sanitizeDownloadUrl('mayday.ics'), 'mayday.ics');
  assert.equal(sanitizeDownloadUrl('./mayday.ics'), './mayday.ics');
});

test('sanitizeDownloadUrl rejects unsafe and malformed links', () => {
  assert.equal(sanitizeDownloadUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeDownloadUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(sanitizeDownloadUrl('vbscript:msgbox(1)'), '');
  assert.equal(sanitizeDownloadUrl('java\nscript:alert(1)'), '');
  assert.equal(sanitizeDownloadUrl('//example.com/mayday.ics'), '');
  assert.equal(sanitizeDownloadUrl('../mayday.ics'), '');
  assert.equal(sanitizeDownloadUrl('/calendars/../mayday.ics'), '');
});

test('createSubscriptionUrl converts validated http links to webcal links', () => {
  assert.equal(createSubscriptionUrl('https://example.com/mayday.ics'), 'webcal://example.com/mayday.ics');
  assert.equal(createSubscriptionUrl('http://example.com/mayday.ics'), 'webcal://example.com/mayday.ics');
});

test('sanitizeSubscriptionUrl allows webcal and rejects unsafe schemes', () => {
  assert.equal(sanitizeSubscriptionUrl('webcal://example.com/mayday.ics', ''), 'webcal://example.com/mayday.ics');
  assert.equal(sanitizeSubscriptionUrl('javascript:alert(1)', 'https://example.com/mayday.ics'), 'webcal://example.com/mayday.ics');
  assert.equal(sanitizeSubscriptionUrl('data:text/html,<script>alert(1)</script>', 'javascript:alert(1)'), '');
});

test('sanitizeCopyUrl returns only copyable safe URLs', () => {
  assert.equal(sanitizeCopyUrl('webcal://example.com/mayday.ics'), 'webcal://example.com/mayday.ics');
  assert.equal(sanitizeCopyUrl('/calendars/mayday.ics'), '/calendars/mayday.ics');
  assert.equal(sanitizeCopyUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeCopyUrl('data:text/html,<script>alert(1)</script>'), '');
});

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
    { id: 'a', title: 'A', category: { id: 'cute' }, visual: { emoji: 'A' }, downloadUrl: 'a.ics', webcalUrl: 'webcal://example.com/a.ics', events: [{ summary: 'One', date: '2026-04-01' }] },
    { id: 'b', title: 'B', previewEvents: [{ summary: 'Two', date: '2026-04-01' }] },
  ]);
  const events = grouped.get('2026-04-01');
  assert.equal(events.length, 2);
  assert.equal(events[0].calendarId, 'a');
  assert.equal(events[0].calendarTitle, 'A');
  assert.deepEqual(events[0].category, { id: 'cute' });
  assert.deepEqual(events[0].visual, { emoji: 'A' });
  assert.equal(events[0].downloadUrl, 'a.ics');
  assert.equal(events[0].webcalUrl, 'webcal://example.com/a.ics');
  assert.equal(events[1].summary, 'Two');
});

test('groupEventsByDate skips impossible dates', () => {
  const grouped = groupEventsByDate([
    {
      id: 'dates',
      title: 'Dates',
      events: [
        { summary: 'Impossible day', date: '2026-02-31' },
        { summary: 'Impossible month', date: '2026-13-01' },
        { summary: 'Valid', date: '2026-02-28' },
      ],
    },
  ]);

  assert.deepEqual([...grouped.keys()], ['2026-02-28']);
  assert.equal(grouped.get('2026-02-28')[0].summary, 'Valid');
});

test('getYearOptions derives event years and falls back around current year', () => {
  assert.deepEqual(getYearOptions([{ events: [{ date: '2024-01-01' }, { date: '2026-12-31' }] }], 2025), [2024, 2025, 2026]);
  assert.deepEqual(getYearOptions([], 2025), [2023, 2024, 2025, 2026, 2027]);
});
