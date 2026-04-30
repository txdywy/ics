import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  extractCalendarTitle,
  inferCategory,
  parseIcsEvents,
  buildCalendarRecord,
  generateCalendarIndex,
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
  assert.equal(record.url, 'concert%231.ics');
  assert.equal(record.downloadUrl, 'https://example.com/ics/concert%231.ics');
  assert.equal(record.webcalUrl, 'webcal://example.com/ics/concert%231.ics');
});

test('generateCalendarIndex keeps failed calendar records with parse warnings', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'calendar-index-'));
  const validPath = path.join(tempDir, 'valid.ics');
  const unreadablePath = path.join(tempDir, 'broken#1.ics');

  try {
    await writeFile(validPath, maydayIcs, 'utf8');
    await writeFile(unreadablePath, maydayIcs, 'utf8');
    await chmod(unreadablePath, 0o000);

    const index = await generateCalendarIndex(tempDir, 'https://example.com/ics/');
    const validRecord = index.calendars.find((calendar) => calendar.fileName === 'valid.ics');
    const brokenRecord = index.calendars.find((calendar) => calendar.fileName === 'broken#1.ics');

    assert.equal(index.totalCalendars, 2);
    assert.equal(validRecord.eventCount, 1);
    assert.equal(brokenRecord.url, 'broken%231.ics');
    assert.equal(brokenRecord.downloadUrl, 'https://example.com/ics/broken%231.ics');
    assert.equal(brokenRecord.webcalUrl, 'webcal://example.com/ics/broken%231.ics');
    assert.equal(brokenRecord.category.id, 'other');
    assert.equal(brokenRecord.eventCount, 0);
    assert.deepEqual(brokenRecord.dateRange, { start: null, end: null });
    assert.deepEqual(brokenRecord.previewEvents, []);
    assert.deepEqual(brokenRecord.keywords, []);
    assert.match(brokenRecord.parseWarning, /EACCES|permission/i);
  } finally {
    await chmod(unreadablePath, 0o600).catch(() => {});
    await rm(tempDir, { recursive: true, force: true });
  }
});
