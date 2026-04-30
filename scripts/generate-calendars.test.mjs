import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCalendarTitle,
  inferCategory,
  parseIcsEvents,
  buildCalendarRecord,
} from './generate-calendars.mjs';

const chiikawaIcs = `BEGIN:VCALENDAR\nX-WR-CALNAME:Chiikawa 小可爱主题日历\nBEGIN:VEVENT\nSUMMARY:Chiikawa 生日\nDTSTART;VALUE=DATE:20260501\nEND:VEVENT\nEND:VCALENDAR\n`;
const hpIcs = `BEGIN:VCALENDAR\nX-WR-CALNAME:HP Birthdays\nBEGIN:VEVENT\nSUMMARY:Harry Potter Birthday\nDTSTART;VALUE=DATE:20260731\nEND:VEVENT\nEND:VCALENDAR\n`;
const maydayIcs = `BEGIN:VCALENDAR\nX-WR-CALNAME:Mayday Calendar\nBEGIN:VEVENT\nSUMMARY:五月天 演唱会纪念日\nDTSTART;VALUE=DATE:20260520\nEND:VEVENT\nEND:VCALENDAR\n`;

test('extractCalendarTitle prefers X-WR-CALNAME over filename', () => {
  assert.equal(extractCalendarTitle('fallback-name.ics', chiikawaIcs), 'Chiikawa 小可爱主题日历');
});

test('inferCategory classifies cute character calendars', () => {
  assert.deepEqual(inferCategory('Chiikawa小可爱主题日历_中文版_Apple兼容.ics', chiikawaIcs), {
    id: 'cute', label: '角色 / 萌系', emoji: '🌸', colors: ['#ffd6e7', '#fff0b8'],
  });
});

test('inferCategory classifies Harry Potter calendars as fantasy before birthday', () => {
  assert.equal(inferCategory('hp_birthdays_cn_ios_strict.ics', hpIcs).id, 'fantasy');
});

test('inferCategory classifies Mayday calendars as music', () => {
  assert.equal(inferCategory('mayday_ios_icloud_named_calendar.ics', maydayIcs).id, 'music');
});

test('parseIcsEvents extracts summary and date from VEVENT blocks', () => {
  assert.deepEqual(parseIcsEvents(maydayIcs), [
    { summary: '五月天 演唱会纪念日', date: '2026-05-20' },
  ]);
});

test('buildCalendarRecord creates stable links and visual data', () => {
  const record = buildCalendarRecord('mayday_ios_icloud_named_calendar.ics', maydayIcs, 'https://example.com/ics/');
  assert.equal(record.fileName, 'mayday_ios_icloud_named_calendar.ics');
  assert.equal(record.url, 'mayday_ios_icloud_named_calendar.ics');
  assert.equal(record.downloadUrl, 'https://example.com/ics/mayday_ios_icloud_named_calendar.ics');
  assert.equal(record.webcalUrl, 'webcal://example.com/ics/mayday_ios_icloud_named_calendar.ics');
  assert.equal(record.eventCount, 1);
  assert.deepEqual(record.dateRange, { start: '2026-05-20', end: '2026-05-20' });
  assert.equal(record.visual.emoji, '🎵');
});

test('buildCalendarRecord encodes filenames as URL path segments', () => {
  const record = buildCalendarRecord('concert#1.ics', maydayIcs, 'https://example.com/ics/');
  assert.equal(record.downloadUrl, 'https://example.com/ics/concert%231.ics');
  assert.equal(record.webcalUrl, 'webcal://example.com/ics/concert%231.ics');
});
