import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCalendars, sortCalendars, formatDateRange, createSubscriptionUrl } from './app.js';

const calendars = [
  { title: 'Chiikawa 小可爱主题日历', category: { id: 'cute', label: '角色 / 萌系' }, eventCount: 3, keywords: ['Chiikawa', '生日'], previewEvents: [{ summary: 'Chiikawa 生日', date: '2026-05-01' }], dateRange: { start: '2026-05-01', end: '2026-06-01' }, downloadUrl: 'https://example.com/Chiikawa.ics' },
  { title: 'Mayday Calendar', category: { id: 'music', label: '音乐 / 演出' }, eventCount: 9, keywords: ['五月天', '演唱会'], previewEvents: [{ summary: '五月天 演唱会纪念日', date: '2026-05-20' }], dateRange: { start: '2026-05-20', end: '2026-12-31' }, downloadUrl: 'https://example.com/mayday.ics' },
];

test('filterCalendars filters by category', () => {
  assert.equal(filterCalendars(calendars, { category: 'music', query: '' })[0].title, 'Mayday Calendar');
});

test('filterCalendars searches titles, keywords, and event summaries', () => {
  assert.equal(filterCalendars(calendars, { category: 'all', query: '小可爱' })[0].title, 'Chiikawa 小可爱主题日历');
  assert.equal(filterCalendars(calendars, { category: 'all', query: '演唱会' })[0].title, 'Mayday Calendar');
});

test('sortCalendars sorts by event count descending', () => {
  assert.equal(sortCalendars(calendars, 'eventCount')[0].title, 'Mayday Calendar');
});

test('formatDateRange handles populated and empty ranges', () => {
  assert.equal(formatDateRange({ start: '2026-05-01', end: '2026-06-01' }), '2026-05-01 → 2026-06-01');
  assert.equal(formatDateRange({ start: null, end: null }), '日期待整理');
});

test('createSubscriptionUrl converts https links to webcal links', () => {
  assert.equal(createSubscriptionUrl('https://example.com/mayday.ics'), 'webcal://example.com/mayday.ics');
});
