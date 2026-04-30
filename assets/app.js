const hasDocument = typeof document !== 'undefined';
const today = new Date();
const state = {
  calendars: [],
  categories: [],
  selectedCategory: 'all',
  query: '',
  sortMode: 'eventCount',
  viewMode: 'grid',
  showPreview: true,
  monthYear: today.getFullYear(),
  month: today.getMonth() + 1,
  selectedDate: toDateKey(today),
  monthEvents: new Map(),
};

function toSearchText(value) {
  return String(value ?? '').toLocaleLowerCase();
}

function appendText(parent, tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.append(element);
  return element;
}

function setStatus(message) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
  }
}

export function filterCalendars(calendars, { category = 'all', query = '' } = {}) {
  const normalizedQuery = toSearchText(query).trim();

  return calendars.filter((calendar) => {
    const categoryId = calendar.category?.id ?? 'other';
    if (category && category !== 'all' && categoryId !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchable = [
      calendar.title,
      calendar.category?.label,
      ...(calendar.keywords ?? []),
      ...(calendar.previewEvents ?? []).map((event) => event.summary),
    ].map(toSearchText);

    return searchable.some((value) => value.includes(normalizedQuery));
  });
}

export function sortCalendars(calendars, sortMode = 'eventCount') {
  const sorted = [...calendars];

  if (sortMode === 'name') {
    return sorted.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'zh-CN'));
  }

  if (sortMode === 'theme') {
    return sorted.sort((a, b) => {
      const categoryCompare = String(a.category?.label ?? '').localeCompare(String(b.category?.label ?? ''), 'zh-CN');
      return categoryCompare || String(a.title ?? '').localeCompare(String(b.title ?? ''), 'zh-CN');
    });
  }

  return sorted.sort((a, b) => {
    const countCompare = (b.eventCount ?? 0) - (a.eventCount ?? 0);
    return countCompare || String(a.title ?? '').localeCompare(String(b.title ?? ''), 'zh-CN');
  });
}

export function formatDateRange(dateRange) {
  if (!dateRange?.start && !dateRange?.end) {
    return '日期待整理';
  }

  if (dateRange.start && dateRange.end) {
    return `${dateRange.start} → ${dateRange.end}`;
  }

  return dateRange.start ?? dateRange.end;
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date: toDateKey(date),
      day: date.getDate(),
      weekday: (date.getDay() + 6) % 7,
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: toDateKey(date) === todayKey,
    };
  });
}

export function groupEventsByDate(calendars) {
  const grouped = new Map();

  for (const calendar of calendars) {
    const sourceEvents = Array.isArray(calendar.events) ? calendar.events : (calendar.previewEvents ?? []);
    for (const event of sourceEvents) {
      const date = String(event.date ?? '');
      if (!isValidDateKey(date)) {
        continue;
      }

      const enrichedEvent = {
        ...event,
        calendarId: event.calendarId ?? calendar.id,
        calendarTitle: event.calendarTitle ?? calendar.title,
        category: event.category ?? calendar.category,
        visual: event.visual ?? calendar.visual,
        downloadUrl: calendar.downloadUrl,
        webcalUrl: calendar.webcalUrl,
      };
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date).push(enrichedEvent);
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
    for (const event of events) {
      years.add(Number(event.date.slice(0, 4)));
    }
  }

  if (years.size === 0) {
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }

  const min = Math.min(...years, currentYear);
  const max = Math.max(...years, currentYear);
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ABSOLUTE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_DOWNLOAD_PROTOCOLS = new Set(['http:', 'https:']);
const SAFE_COPY_PROTOCOLS = new Set(['http:', 'https:', 'webcal:']);

function normalizeCalendarUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return '';
  }

  return value.trim();
}

function splitPath(url) {
  return url.split(/[?#]/, 1)[0];
}

function hasUnsafePathSegment(path) {
  return path.split('/').some((segment) => {
    if (!segment) {
      return false;
    }

    try {
      const decodedSegment = decodeURIComponent(segment);
      return decodedSegment === '.' || decodedSegment === '..' || decodedSegment.includes('/') || decodedSegment.includes('\\');
    } catch {
      return true;
    }
  });
}

function isSafeRelativeIcsPath(url) {
  if (!url || url.startsWith('//') || url.startsWith('?') || url.startsWith('#') || url.includes('\\') || ABSOLUTE_SCHEME_PATTERN.test(url)) {
    return false;
  }

  const path = splitPath(url);
  if (!path || !path.toLocaleLowerCase().endsWith('.ics')) {
    return false;
  }

  if (path.startsWith('./')) {
    const sameDirectoryPath = path.slice(2);
    return Boolean(sameDirectoryPath) && !sameDirectoryPath.includes('/') && !hasUnsafePathSegment(sameDirectoryPath);
  }

  if (!path.startsWith('/') && path.includes('/')) {
    return false;
  }

  return !hasUnsafePathSegment(path);
}

function sanitizeAbsoluteUrl(value, allowedProtocols) {
  try {
    const url = new URL(value);
    if (!allowedProtocols.has(url.protocol)) {
      return '';
    }
    if (url.protocol === 'webcal:' && !value.toLocaleLowerCase().startsWith('webcal://')) {
      return '';
    }
    return url.href;
  } catch {
    return '';
  }
}

export function sanitizeDownloadUrl(value) {
  const url = normalizeCalendarUrl(value);
  if (!url) {
    return '';
  }

  if (isSafeRelativeIcsPath(url)) {
    return url;
  }

  return sanitizeAbsoluteUrl(url, SAFE_DOWNLOAD_PROTOCOLS);
}

export function sanitizeCopyUrl(value) {
  const url = normalizeCalendarUrl(value);
  if (!url) {
    return '';
  }

  if (isSafeRelativeIcsPath(url)) {
    return url;
  }

  return sanitizeAbsoluteUrl(url, SAFE_COPY_PROTOCOLS);
}

function isSafeHttpUrl(value) {
  return Boolean(sanitizeAbsoluteUrl(value, SAFE_DOWNLOAD_PROTOCOLS));
}

export function createSubscriptionUrl(downloadUrl) {
  const safeDownloadUrl = sanitizeDownloadUrl(downloadUrl);
  if (!safeDownloadUrl || !isSafeHttpUrl(safeDownloadUrl)) {
    return '';
  }

  return safeDownloadUrl.replace(/^https?:\/\//i, 'webcal://');
}

export function sanitizeSubscriptionUrl(webcalUrl, downloadUrl) {
  const safeWebcalUrl = sanitizeCopyUrl(webcalUrl);
  if (safeWebcalUrl && safeWebcalUrl.toLocaleLowerCase().startsWith('webcal://')) {
    return safeWebcalUrl;
  }

  return createSubscriptionUrl(downloadUrl);
}

function createButton(label, type = 'button') {
  const button = document.createElement('button');
  button.type = type;
  button.textContent = label;
  return button;
}

function renderStats(index) {
  const statCalendars = document.getElementById('stat-calendars');
  const statEvents = document.getElementById('stat-events');
  const statUpdated = document.getElementById('stat-updated');

  if (statCalendars) {
    statCalendars.textContent = String(index.totalCalendars ?? state.calendars.length);
  }
  if (statEvents) {
    statEvents.textContent = String(index.totalEvents ?? state.calendars.reduce((sum, calendar) => sum + (calendar.eventCount ?? 0), 0));
  }
  if (statUpdated) {
    statUpdated.textContent = index.generatedAt ? new Date(index.generatedAt).toLocaleDateString('zh-CN') : '未知';
  }
}

function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  if (!container) {
    return;
  }

  const chips = [];
  const allButton = createButton(`全部 (${state.calendars.length})`);
  allButton.dataset.category = 'all';
  allButton.className = state.selectedCategory === 'all' ? 'chip is-active' : 'chip';
  allButton.setAttribute('aria-pressed', String(state.selectedCategory === 'all'));
  chips.push(allButton);

  for (const category of state.categories) {
    const count = state.calendars.filter((calendar) => calendar.category?.id === category.id).length;
    const button = createButton(`${category.emoji ?? ''} ${category.label} (${count})`.trim());
    button.dataset.category = category.id;
    button.className = state.selectedCategory === category.id ? 'chip is-active' : 'chip';
    button.setAttribute('aria-pressed', String(state.selectedCategory === category.id));
    chips.push(button);
  }

  container.replaceChildren(...chips);
}

function createCover(calendar) {
  const cover = document.createElement('div');
  cover.className = 'card__cover';

  if (calendar.visual?.image) {
    const image = document.createElement('img');
    image.src = calendar.visual.image;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove(), { once: true });
    cover.append(image);
  }

  appendText(cover, 'span', calendar.visual?.emoji ?? '🗓️', 'card__emoji');
  return cover;
}

function createDetail(term, description) {
  const fragment = document.createDocumentFragment();
  appendText(fragment, 'dt', term);
  appendText(fragment, 'dd', description);
  return fragment;
}

function createMonthEventActions(event) {
  const actions = document.createElement('div');
  actions.className = 'day-detail__actions';

  const downloadUrl = sanitizeDownloadUrl(event.downloadUrl);
  const subscriptionUrl = sanitizeSubscriptionUrl(event.webcalUrl, downloadUrl);

  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl || '#';
  downloadLink.textContent = downloadUrl ? '下载 .ics' : '下载不可用';
  if (!downloadUrl) {
    downloadLink.setAttribute('aria-disabled', 'true');
  }
  actions.append(downloadLink);

  const subscribeLink = document.createElement('a');
  subscribeLink.href = subscriptionUrl || '#';
  subscribeLink.textContent = subscriptionUrl ? 'Webcal 订阅' : '订阅不可用';
  if (!subscriptionUrl) {
    subscribeLink.setAttribute('aria-disabled', 'true');
  }
  actions.append(subscribeLink);

  return actions;
}

function shiftMonth(offset) {
  const date = new Date(state.monthYear, state.month - 1 + offset, 1);
  state.monthYear = date.getFullYear();
  state.month = date.getMonth() + 1;
  state.selectedDate = toDateKey(new Date(state.monthYear, state.month - 1, 1));
  syncMonthSelects();
  renderMonthCalendar();
}

function syncMonthSelects() {
  const yearSelect = document.getElementById('month-year');
  const monthSelect = document.getElementById('month-select');

  if (yearSelect) {
    const years = getYearOptions(state.calendars, state.monthYear);
    yearSelect.replaceChildren(...years.map((year) => {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = `${year}年`;
      return option;
    }));
    yearSelect.value = String(state.monthYear);
  }

  if (monthSelect) {
    monthSelect.value = String(state.month);
  }
}

function renderMonthEventPill(event) {
  const pill = document.createElement('span');
  pill.className = 'month-event-pill';
  pill.textContent = `${event.visual?.emoji ?? event.category?.emoji ?? '•'} ${event.summary ?? '未命名事件'}`;
  return pill;
}

function renderMonthDayCell(day) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'month-day';
  button.dataset.date = day.date;
  button.setAttribute('role', 'gridcell');

  if (!day.isCurrentMonth) {
    button.classList.add('is-outside-month');
  }
  if (day.isToday) {
    button.classList.add('is-today');
  }
  if (day.date === state.selectedDate) {
    button.classList.add('is-selected');
    button.setAttribute('aria-selected', 'true');
  }

  const events = state.monthEvents.get(day.date) ?? [];
  button.setAttribute('aria-label', `${day.date}，${events.length} 个事件`);
  appendText(button, 'span', String(day.day), 'month-day__number');

  for (const event of events.slice(0, 3)) {
    button.append(renderMonthEventPill(event));
  }

  if (events.length > 3) {
    appendText(button, 'span', `+${events.length - 3} 更多`, 'month-day__more');
  }

  button.addEventListener('click', () => {
    state.selectedDate = day.date;
    const selected = new Date(`${day.date}T00:00:00`);
    state.monthYear = selected.getFullYear();
    state.month = selected.getMonth() + 1;
    syncMonthSelects();
    renderMonthCalendar();
  });

  return button;
}

function renderDayDetailEvent(event) {
  const item = document.createElement('article');
  item.className = 'day-detail__event';
  appendText(item, 'h4', event.summary ?? '未命名事件');
  appendText(item, 'p', event.calendarTitle ?? '未知日历', 'day-detail__calendar');
  item.append(createMonthEventActions(event));
  return item;
}

function renderSelectedDayDetail() {
  const detail = document.getElementById('day-detail');
  if (!detail) {
    return;
  }

  const events = state.monthEvents.get(state.selectedDate) ?? [];
  appendText(detail, 'h3', `${state.selectedDate} · ${events.length} 个事件`);

  if (events.length === 0) {
    appendText(detail, 'p', '这一天还没有事件，适合发呆和喝奶茶。', 'day-detail__empty');
    return;
  }

  const list = document.createElement('div');
  list.className = 'day-detail__list';
  for (const event of events) {
    list.append(renderDayDetailEvent(event));
  }
  detail.append(list);
}

function renderMonthCalendar() {
  const heading = document.getElementById('month-heading');
  const grid = document.getElementById('month-grid');
  if (!grid) {
    renderSelectedDayDetail();
    return;
  }

  if (heading) {
    heading.textContent = `${state.monthYear}年${state.month}月`;
  }

  const cells = buildMonthGrid(state.monthYear, state.month).map(renderMonthDayCell);
  grid.replaceChildren(...cells);

  const detail = document.getElementById('day-detail');
  if (detail) {
    detail.replaceChildren();
  }
  renderSelectedDayDetail();
}

function initializeMonthControls() {
  const prevButton = document.getElementById('month-prev');
  const nextButton = document.getElementById('month-next');
  const todayButton = document.getElementById('month-today');
  const yearSelect = document.getElementById('month-year');
  const monthSelect = document.getElementById('month-select');

  syncMonthSelects();

  prevButton?.addEventListener('click', () => shiftMonth(-1));
  nextButton?.addEventListener('click', () => shiftMonth(1));
  todayButton?.addEventListener('click', () => {
    const now = new Date();
    state.monthYear = now.getFullYear();
    state.month = now.getMonth() + 1;
    state.selectedDate = toDateKey(now);
    syncMonthSelects();
    renderMonthCalendar();
  });
  yearSelect?.addEventListener('change', (event) => {
    state.monthYear = Number(event.currentTarget.value);
    state.selectedDate = toDateKey(new Date(state.monthYear, state.month - 1, 1));
    renderMonthCalendar();
  });
  monthSelect?.addEventListener('change', (event) => {
    state.month = Number(event.currentTarget.value);
    state.selectedDate = toDateKey(new Date(state.monthYear, state.month - 1, 1));
    renderMonthCalendar();
  });
}

function createActions(calendar) {
  const actions = document.createElement('div');
  actions.className = 'card__actions';

  const downloadUrl = sanitizeDownloadUrl(calendar.downloadUrl) || sanitizeDownloadUrl(calendar.url);
  const subscriptionUrl = sanitizeSubscriptionUrl(calendar.webcalUrl, downloadUrl);
  const copyUrl = sanitizeCopyUrl(downloadUrl || subscriptionUrl);

  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl || '#';
  downloadLink.textContent = downloadUrl ? '下载 .ics' : '下载不可用';
  if (!downloadUrl) {
    downloadLink.setAttribute('aria-disabled', 'true');
  }
  downloadLink.setAttribute('download', calendar.fileName ?? 'calendar.ics');
  actions.append(downloadLink);

  const subscribeLink = document.createElement('a');
  subscribeLink.href = subscriptionUrl || '#';
  subscribeLink.textContent = subscriptionUrl ? 'Webcal 订阅' : '订阅不可用';
  if (!subscriptionUrl) {
    subscribeLink.setAttribute('aria-disabled', 'true');
  }
  actions.append(subscribeLink);

  const copyButton = createButton(copyUrl ? '复制链接' : '链接不可用');
  copyButton.disabled = !copyUrl;
  copyButton.addEventListener('click', async () => {
    if (!copyUrl) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(copyUrl);
      copyButton.textContent = '已复制';
    } catch {
      copyButton.textContent = copyUrl;
      copyButton.setAttribute('aria-label', `复制失败，请手动复制：${copyUrl}`);
    }
  });
  actions.append(copyButton);

  return actions;
}

function createCard(calendar) {
  const card = document.createElement('article');
  card.className = 'calendar-card';
  const colors = calendar.visual?.colors ?? calendar.category?.colors ?? [];
  if (colors[0]) {
    card.style.setProperty('--card-a', colors[0]);
  }
  if (colors[1]) {
    card.style.setProperty('--card-b', colors[1]);
  }

  card.append(createCover(calendar));

  const body = document.createElement('div');
  body.className = 'card__body';

  const header = document.createElement('div');
  header.className = 'card__header';
  appendText(header, 'h2', calendar.title ?? calendar.fileName ?? '未命名日历');
  appendText(header, 'p', calendar.category?.label ?? '其他', 'card__tag');
  body.append(header);

  appendText(body, 'p', `${calendar.eventCount ?? 0} 个事件 · ${formatDateRange(calendar.dateRange)}`, 'card__meta');

  if (calendar.parseWarning) {
    appendText(body, 'p', `解析提示：${calendar.parseWarning}`, 'card__warning');
  }

  if (state.showPreview && calendar.previewEvents?.length) {
    const list = document.createElement('ul');
    list.className = 'card__events';
    for (const event of calendar.previewEvents) {
      const item = document.createElement('li');
      appendText(item, 'time', event.date ?? '日期待整理');
      appendText(item, 'span', event.summary ?? '未命名事件');
      list.append(item);
    }
    body.append(list);
  }

  const details = document.createElement('dl');
  details.className = 'card__details';
  details.append(createDetail('文件', calendar.fileName ?? '未知文件'));
  details.append(createDetail('下载地址', calendar.downloadUrl ?? calendar.url ?? '暂无链接'));
  body.append(details);

  body.append(createActions(calendar));
  card.append(body);
  return card;
}

function renderCalendars() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) {
    return;
  }

  const calendars = sortCalendars(filterCalendars(state.calendars, {
    category: state.selectedCategory,
    query: state.query,
  }), state.sortMode);

  document.body?.classList.toggle('is-compact-view', state.viewMode === 'compact');

  if (calendars.length === 0) {
    const empty = document.createElement('article');
    empty.className = 'empty-card';
    appendText(empty, 'h2', '没有找到匹配的日历');
    appendText(empty, 'p', '请尝试清空搜索词或切换分类。');
    grid.replaceChildren(empty);
    setStatus('没有找到匹配的日历。');
    return;
  }

  grid.replaceChildren(...calendars.map(createCard));
  setStatus(`已显示 ${calendars.length} 个日历。`);
}

function bindControls() {
  const searchInput = document.getElementById('search-input');
  const categoryFilters = document.getElementById('category-filters');
  const sortSelect = document.getElementById('sort-select');
  const viewSelect = document.getElementById('view-select');
  const previewToggle = document.getElementById('preview-toggle');

  searchInput?.addEventListener('input', (event) => {
    state.query = event.currentTarget.value;
    renderCalendars();
  });

  categoryFilters?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button) {
      return;
    }
    state.selectedCategory = button.dataset.category ?? 'all';
    renderCategoryFilters();
    renderCalendars();
  });

  sortSelect?.addEventListener('change', (event) => {
    state.sortMode = event.currentTarget.value;
    renderCalendars();
  });

  viewSelect?.addEventListener('change', (event) => {
    state.viewMode = event.currentTarget.value;
    renderCalendars();
  });

  previewToggle?.addEventListener('change', (event) => {
    state.showPreview = event.currentTarget.checked;
    renderCalendars();
  });
}

function renderLoadError(error) {
  setStatus('暂时无法加载 calendars.json，请稍后刷新页面。');
  const grid = document.getElementById('calendar-grid');
  if (!grid) {
    return;
  }

  const empty = document.createElement('article');
  empty.className = 'empty-card';
  appendText(empty, 'h2', '日历数据加载失败');
  appendText(empty, 'p', '请检查网络连接，或直接下载仓库中的 .ics 文件。');
  if (error) {
    appendText(empty, 'p', `错误信息：${error.message ?? error}`, 'card__warning');
  }
  grid.replaceChildren(empty);
}

async function init() {
  bindControls();

  try {
    const response = await fetch('calendars.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const index = await response.json();
    state.calendars = Array.isArray(index.calendars) ? index.calendars : [];
    state.categories = Array.isArray(index.categories) ? index.categories : [];
    state.monthEvents = groupEventsByDate(state.calendars);
    initializeMonthControls();
    renderMonthCalendar();
    renderStats(index);
    renderCategoryFilters();
    renderCalendars();
  } catch (error) {
    state.calendars = [];
    state.categories = [];
    state.monthEvents = new Map();
    initializeMonthControls();
    renderMonthCalendar();
    renderStats({ totalCalendars: 0, totalEvents: 0 });
    renderCategoryFilters();
    renderLoadError(error);
  }
}

if (hasDocument) {
  init();
}
