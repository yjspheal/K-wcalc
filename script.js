const defaultHolidays = {
  2024: [
    '2024-01-01',
    '2024-02-09',
    '2024-02-10',
    '2024-02-11',
    '2024-03-01',
    '2024-05-05',
    '2024-05-06',
    '2024-05-15',
    '2024-06-06',
    '2024-08-15',
    '2024-09-16',
    '2024-09-17',
    '2024-09-18',
    '2024-10-03',
    '2024-10-09',
    '2024-12-25',
  ],
  2025: [
    '2025-01-01',
    '2025-01-28',
    '2025-01-29',
    '2025-01-30',
    '2025-03-01',
    '2025-05-05',
    '2025-05-06',
    '2025-06-06',
    '2025-08-15',
    '2025-10-03',
    '2025-10-05',
    '2025-10-06',
    '2025-10-07',
    '2025-12-25',
  ],
};

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function collectHolidaySet(startDate, endDate, customText) {
  const set = new Set();
  const yearStart = Math.min(startDate.getFullYear(), endDate.getFullYear());
  const yearEnd = Math.max(startDate.getFullYear(), endDate.getFullYear());
  for (let year = yearStart; year <= yearEnd; year++) {
    const list = defaultHolidays[year] || [];
    list.forEach((d) => set.add(d));
  }
  parseCustomHolidays(customText).forEach((d) => set.add(d));
  return set;
}

function parseCustomHolidays(text) {
  if (!text) return [];
  return text
    .split(/\s|,/) // split by comma or whitespace
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t));
}

function isWeekend(date, includeSaturday) {
  const day = date.getDay();
  if (includeSaturday) {
    return day === 0; // only Sunday
  }
  return day === 0 || day === 6;
}

function calculateRange({ startDate, endDate, includeSaturday, excludeHolidays, customHolidayText }) {
  const holidaySet = excludeHolidays
    ? collectHolidaySet(startDate, endDate, customHolidayText)
    : new Set();

  const stats = {
    calendarDays: 0,
    businessDays: 0,
    weekendDays: 0,
    holidayDays: 0,
    businessDates: [],
    weekendDates: [],
    holidayDates: [],
    weekdayCounts: Array(7).fill(0),
  };

  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatDate(current);
    const weekend = isWeekend(current, includeSaturday);
    const holiday = excludeHolidays && holidaySet.has(dateStr);
    stats.calendarDays += 1;
    stats.weekdayCounts[current.getDay()] += 1;

    if (!weekend && !holiday) {
      stats.businessDays += 1;
      stats.businessDates.push(dateStr);
    } else {
      if (weekend) stats.weekendDays += 1, stats.weekendDates.push(dateStr);
      if (holiday) stats.holidayDays += 1, stats.holidayDates.push(dateStr);
    }

    current = addDays(current, 1);
  }

  return stats;
}

function findBusinessDate({ baseDate, offset, includeSaturday, excludeHolidays, customHolidayText }) {
  if (offset === 0) {
    return { targetDate: baseDate, steps: 0 };
  }

  const direction = offset > 0 ? 1 : -1;
  let remaining = Math.abs(offset);
  let current = new Date(baseDate);

  const spanDays = Math.abs(offset) * 3 + 366;
  const boundaryDate = addDays(baseDate, offset > 0 ? spanDays : -spanDays);
  const holidaySet = excludeHolidays
    ? collectHolidaySet(
        offset > 0 ? baseDate : boundaryDate,
        offset > 0 ? boundaryDate : baseDate,
        customHolidayText,
      )
    : new Set();

  let steps = 0;
  while (remaining > 0) {
    current = addDays(current, direction);
    steps += 1;
    const dateStr = formatDate(current);
    const weekend = isWeekend(current, includeSaturday);
    const holiday = excludeHolidays && holidaySet.has(dateStr);
    if (!weekend && !holiday) {
      remaining -= 1;
    }
    // guardrail for extreme loops
    if (steps > 5000) break;
  }

  return { targetDate: current, steps };
}

function renderChips(container, dates, emptyText) {
  container.innerHTML = '';
  if (!dates.length) {
    container.innerHTML = `<span class="chip chip--muted">${emptyText}</span>`;
    return;
  }
  dates.forEach((d) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = d;
    container.appendChild(chip);
  });
}

function renderWeekdayStats(container, counts) {
  container.innerHTML = '';
  counts.forEach((count, idx) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<strong>${weekdayLabels[idx]}</strong><div>${count}일</div>`;
    container.appendChild(card);
  });
}

function switchTab(targetId) {
  document.querySelectorAll('.tab').forEach((tab) => {
    const isTarget = tab.dataset.target === targetId;
    tab.classList.toggle('tab--active', isTarget);
    tab.setAttribute('aria-selected', String(isTarget));
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('tab-panel--active', panel.id === targetId);
  });
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function setDefaultDates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 7);
  const end = new Date(today);
  document.getElementById('startDate').value = formatDate(start);
  document.getElementById('endDate').value = formatDate(end);
  document.getElementById('baseDate').value = formatDate(end);
}

function handleRangeCalculation() {
  const startValue = document.getElementById('startDate').value;
  const endValue = document.getElementById('endDate').value;
  const includeSaturday = document.getElementById('includeSaturday').checked;
  const excludeHolidays = document.getElementById('excludeHolidays').checked;
  const customHolidayText = document.getElementById('customHolidays').value;
  const errorBox = document.getElementById('rangeError');

  if (!startValue || !endValue) {
    setDefaultDates();
  }

  const startDate = parseDate(document.getElementById('startDate').value);
  const endDate = parseDate(document.getElementById('endDate').value);
  if (!startDate || !endDate) {
    errorBox.textContent = '시작일과 종료일을 모두 입력해주세요.';
    return;
  }

  errorBox.textContent = '';
  let from = startDate;
  let to = endDate;
  if (startDate > endDate) {
    [from, to] = [endDate, startDate];
    errorBox.textContent = '시작일이 종료일보다 늦어 날짜를 교환했습니다.';
  }

  const stats = calculateRange({
    startDate: from,
    endDate: to,
    includeSaturday,
    excludeHolidays,
    customHolidayText,
  });

  document.getElementById('rangeSummary').hidden = false;
  const details = document.getElementById('rangeDetails');
  details.hidden = false;
  details.open = true;
  document.getElementById('calendarDays').textContent = stats.calendarDays;
  document.getElementById('businessDays').textContent = stats.businessDays;
  document.getElementById('weekendDays').textContent = stats.weekendDays;
  document.getElementById('holidayDays').textContent = stats.holidayDays;

  renderChips(
    document.getElementById('businessDayList'),
    stats.businessDates,
    '근무일에 포함된 날짜가 없습니다.',
  );
  renderChips(document.getElementById('weekendList'), stats.weekendDates, '제외된 주말 없음');
  renderChips(
    document.getElementById('holidayList'),
    stats.holidayDates,
    '제외된 공휴일/커스텀 휴일 없음',
  );
  renderWeekdayStats(document.getElementById('weekdayStats'), stats.weekdayCounts);
}

function handleOffsetCalculation() {
  const baseValue = document.getElementById('baseDate').value;
  const offsetValue = Number(document.getElementById('offsetDays').value);
  const includeSaturday = document.getElementById('includeSaturdayOffset').checked;
  const excludeHolidays = document.getElementById('excludeHolidaysOffset').checked;
  const customHolidayText = document.getElementById('customHolidaysOffset').value;
  const errorBox = document.getElementById('offsetError');

  if (!baseValue) {
    setDefaultDates();
  }

  const baseDate = parseDate(document.getElementById('baseDate').value);
  if (!baseDate || Number.isNaN(offsetValue)) {
    errorBox.textContent = '기준일과 이동할 근무일 수를 올바르게 입력해주세요.';
    return;
  }

  errorBox.textContent = '';
  const result = findBusinessDate({
    baseDate,
    offset: offsetValue,
    includeSaturday,
    excludeHolidays,
    customHolidayText,
  });

  document.getElementById('offsetSummary').hidden = false;
  document.getElementById('offsetResult').textContent = formatDate(result.targetDate);
  const direction = offsetValue >= 0 ? '이동' : '역방향 이동';
  document.getElementById('offsetTrace').textContent = `${formatDate(baseDate)} 기준 ${offsetValue} 근무일 ${direction}`;
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
  });
  document.getElementById('swapDates').addEventListener('click', () => {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    [startInput.value, endInput.value] = [endInput.value, startInput.value];
  });
  document
    .getElementById('calculateRange')
    .addEventListener('click', () => window.requestAnimationFrame(handleRangeCalculation));
  document
    .getElementById('calculateOffset')
    .addEventListener('click', () => window.requestAnimationFrame(handleOffsetCalculation));

  const debouncedRange = debounce(handleRangeCalculation, 250);
  ['startDate', 'endDate', 'includeSaturday', 'excludeHolidays'].forEach((id) => {
    document.getElementById(id).addEventListener('input', debouncedRange);
    document.getElementById(id).addEventListener('change', debouncedRange);
  });
  document.getElementById('customHolidays').addEventListener('input', debounce(handleRangeCalculation, 400));

  const debouncedOffset = debounce(handleOffsetCalculation, 250);
  ['baseDate', 'offsetDays', 'includeSaturdayOffset', 'excludeHolidaysOffset'].forEach((id) => {
    document.getElementById(id).addEventListener('input', debouncedOffset);
    document.getElementById(id).addEventListener('change', debouncedOffset);
  });
  document
    .getElementById('customHolidaysOffset')
    .addEventListener('input', debounce(handleOffsetCalculation, 400));
}

function initApp() {
  setDefaultDates();
  bindEvents();
  handleRangeCalculation();
  handleOffsetCalculation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
