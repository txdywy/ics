import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCalendars, sortCalendars, formatDateRange, createSubscriptionUrl, sanitizeDownloadUrl, sanitizeSubscriptionUrl, sanitizeCopyUrl } from './app.js';

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
