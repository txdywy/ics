import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BASE_URL = 'https://calendar.rollyourown.xyz/';

export const CATEGORIES = {
  cute: { id: 'cute', label: '角色 / 萌系', emoji: '🌸', colors: ['#ffd6e7', '#fff0b8'] },
  fantasy: { id: 'fantasy', label: '影视 / 魔法', emoji: '✨', colors: ['#d9ccff', '#b8e6ff'] },
  music: { id: 'music', label: '音乐 / 演出', emoji: '🎵', colors: ['#ffd1ba', '#ffe680'] },
  birthday: { id: 'birthday', label: '生日 / 纪念日', emoji: '🎂', colors: ['#ffe2f2', '#d8f8e1'] },
  other: { id: 'other', label: '其他', emoji: '🗓️', colors: ['#dce8ff', '#f4e4ff'] },
};

function unfoldIcsLines(icsContent) {
  const lines = String(icsContent).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded = [];

  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded;
}

function parsePropertyLine(line) {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const key = line.slice(0, separatorIndex).split(';')[0].toUpperCase();
  const value = line.slice(separatorIndex + 1);
  return { key, value };
}

function unescapeIcsValue(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function normalizeDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T.*)?$/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function encodeCalendarFileName(fileName) {
  return encodeURIComponent(fileName);
}

function createCalendarId(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const id = baseName
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return id || 'calendar';
}

function deriveTitleFromFileName(fileName) {
  return path.basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectKeywords(fileName, title, events, category) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const filenameKeywords = [
    baseName,
    baseName.replace(/[_-]+/g, ' '),
    ...(baseName.match(/[A-Za-z0-9]+/g) ?? []),
  ];
  const words = [
    ...filenameKeywords,
    title,
    category.label,
    ...events.slice(0, 10).map((event) => event.summary),
  ]
    .join(' ')
    .split(/[\s,，、|｜/\\]+/u)
    .map((word) => word.trim())
    .filter(Boolean);

  return [...new Set(words)].slice(0, 24);
}

export function extractCalendarTitle(fileName, icsContent) {
  for (const line of unfoldIcsLines(icsContent)) {
    const property = parsePropertyLine(line);
    if (property?.key === 'X-WR-CALNAME') {
      const title = unescapeIcsValue(property.value);
      if (title) {
        return title;
      }
    }
  }

  return deriveTitleFromFileName(fileName);
}

export function inferCategory(fileName, icsContent) {
  const title = extractCalendarTitle(fileName, icsContent);
  const haystack = `${fileName} ${title} ${icsContent}`.toLowerCase();

  if (haystack.includes('chiikawa') || haystack.includes('小可爱')) {
    return CATEGORIES.cute;
  }

  if (/(^|[^a-z0-9])hp([^a-z0-9]|$)/i.test(haystack) || haystack.includes('harry') || haystack.includes('potter') || haystack.includes('hogwarts') || haystack.includes('魔法')) {
    return CATEGORIES.fantasy;
  }

  if (haystack.includes('mayday') || haystack.includes('五月天') || haystack.includes('concert') || haystack.includes('演唱') || haystack.includes('music') || haystack.includes('音乐')) {
    return CATEGORIES.music;
  }

  if (haystack.includes('birthday') || haystack.includes('生日') || haystack.includes('anniversary') || haystack.includes('纪念')) {
    return CATEGORIES.birthday;
  }

  return CATEGORIES.other;
}

export function parseIcsEvents(icsContent) {
  const events = [];
  let currentEvent = null;

  for (const line of unfoldIcsLines(icsContent)) {
    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      currentEvent = [];
      continue;
    }

    if (line.toUpperCase() === 'END:VEVENT') {
      if (currentEvent) {
        let summary = '';
        let date = null;

        for (const eventLine of currentEvent) {
          const property = parsePropertyLine(eventLine);
          if (!property) {
            continue;
          }

          if (property.key === 'SUMMARY') {
            summary = unescapeIcsValue(property.value);
          } else if (property.key === 'DTSTART') {
            date = normalizeDate(property.value);
          }
        }

        if (date) {
          events.push({ summary, date });
        }
      }

      currentEvent = null;
      continue;
    }

    if (currentEvent) {
      currentEvent.push(line);
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.summary.localeCompare(b.summary));
}

export function buildCalendarRecord(fileName, icsContent, baseUrl = DEFAULT_BASE_URL, generatedAt = new Date().toISOString()) {
  const title = extractCalendarTitle(fileName, icsContent);
  const category = inferCategory(fileName, icsContent);
  const events = parseIcsEvents(icsContent);
  const dates = events.map((event) => event.date);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const url = encodeCalendarFileName(fileName);
  const downloadUrl = `${normalizedBaseUrl}${url}`;

  return {
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
    keywords: collectKeywords(fileName, title, events, category),
    visual: {
      emoji: category.emoji,
      colors: category.colors,
    },
    generatedAt,
  };
}

function buildCalendarErrorRecord(fileName, baseUrl, generatedAt, error) {
  const title = deriveTitleFromFileName(fileName);
  const category = CATEGORIES.other;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const url = encodeCalendarFileName(fileName);
  const downloadUrl = `${normalizedBaseUrl}${url}`;

  return {
    id: createCalendarId(fileName),
    fileName,
    title,
    category,
    url,
    downloadUrl,
    webcalUrl: downloadUrl.replace(/^https?:\/\//, 'webcal://'),
    eventCount: 0,
    dateRange: {
      start: null,
      end: null,
    },
    previewEvents: [],
    keywords: [],
    visual: {
      emoji: category.emoji,
      colors: category.colors,
    },
    parseWarning: error instanceof Error ? error.message : String(error),
    generatedAt,
  };
}

export async function generateCalendarIndex(rootDir = process.cwd(), baseUrl = DEFAULT_BASE_URL) {
  const generatedAt = new Date().toISOString();
  const entries = await readdir(rootDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.ics'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const calendars = [];
  for (const fileName of fileNames) {
    try {
      const icsContent = await readFile(path.join(rootDir, fileName), 'utf8');
      calendars.push(buildCalendarRecord(fileName, icsContent, baseUrl, generatedAt));
    } catch (error) {
      calendars.push(buildCalendarErrorRecord(fileName, baseUrl, generatedAt, error));
    }
  }

  return {
    generatedAt,
    totalCalendars: calendars.length,
    totalEvents: calendars.reduce((total, calendar) => total + calendar.eventCount, 0),
    categories: Object.values(CATEGORIES),
    calendars,
  };
}

async function runCli() {
  const rootDir = process.cwd();
  const baseUrl = process.env.SITE_BASE_URL || DEFAULT_BASE_URL;
  const index = await generateCalendarIndex(rootDir, baseUrl);
  await writeFile(path.join(rootDir, 'calendars.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
