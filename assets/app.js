const hasDocument = typeof document !== 'undefined';
const state = {
  calendars: [],
  categories: [],
  selectedCategory: 'all',
  query: '',
  sortMode: 'eventCount',
  viewMode: 'grid',
  showPreview: true,
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

export function createSubscriptionUrl(downloadUrl) {
  return String(downloadUrl ?? '').replace(/^https?:\/\//, 'webcal://');
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

function createActions(calendar) {
  const actions = document.createElement('div');
  actions.className = 'card__actions';

  const downloadLink = document.createElement('a');
  downloadLink.href = calendar.downloadUrl ?? calendar.url ?? '#';
  downloadLink.textContent = '下载 .ics';
  downloadLink.setAttribute('download', calendar.fileName ?? 'calendar.ics');
  actions.append(downloadLink);

  const subscribeLink = document.createElement('a');
  subscribeLink.href = calendar.webcalUrl ?? createSubscriptionUrl(calendar.downloadUrl);
  subscribeLink.textContent = 'Webcal 订阅';
  actions.append(subscribeLink);

  const copyButton = createButton('复制链接');
  copyButton.addEventListener('click', async () => {
    const url = calendar.downloadUrl ?? calendar.url ?? '';
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(url);
      copyButton.textContent = '已复制';
    } catch {
      copyButton.textContent = url || '复制失败';
      copyButton.setAttribute('aria-label', url ? `复制失败，请手动复制：${url}` : '复制失败');
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
    renderStats(index);
    renderCategoryFilters();
    renderCalendars();
  } catch (error) {
    state.calendars = [];
    state.categories = [];
    renderStats({ totalCalendars: 0, totalEvents: 0 });
    renderCategoryFilters();
    renderLoadError(error);
  }
}

if (hasDocument) {
  init();
}
