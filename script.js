// 공휴일 데이터는 holidays.js(globalThis.KR_HOLIDAYS)에서 읽습니다.
const holidayData = (globalThis.KR_HOLIDAYS && globalThis.KR_HOLIDAYS.years) || {};
const holidayNames = {};
Object.values(holidayData).forEach((list) => {
    list.forEach(({ date, name }) => {
        holidayNames[date] = name;
    });
});

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n) {
    return n.toString().padStart(2, '0');
}

// 날짜는 모두 로컬 자정 기준 Date 로 다룹니다.
// (toISOString/`new Date('YYYY-MM-DD')` 는 UTC 기준이라 한국 00~09시나 해외 시간대에서 하루가 밀립니다.)
function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!m) return null;
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // 2025-02-30 같은 존재하지 않는 날짜 거부
    return formatDate(date) === m[0] ? date : null;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// 공휴일 데이터가 없는 연도 목록 (해당 연도는 공휴일이 반영되지 않음)
function missingHolidayYears(startDate, endDate) {
    const missing = [];
    const yearStart = Math.min(startDate.getFullYear(), endDate.getFullYear());
    const yearEnd = Math.max(startDate.getFullYear(), endDate.getFullYear());
    for (let year = yearStart; year <= yearEnd; year++) {
        if (!holidayData[year]) missing.push(year);
    }
    return missing;
}

function missingYearsWarning(years) {
    if (!years.length) return '';
    return `⚠ ${years.join(', ')}년 공휴일 데이터가 아직 없어 해당 연도는 공휴일이 반영되지 않았습니다.`;
}

function collectHolidaySet(startDate, endDate, customText) {
    const set = new Set();
    const yearStart = Math.min(startDate.getFullYear(), endDate.getFullYear());
    const yearEnd = Math.max(startDate.getFullYear(), endDate.getFullYear());
    for (let year = yearStart; year <= yearEnd; year++) {
        const list = holidayData[year] || [];
        list.forEach(({ date }) => set.add(date));
    }
    parseCustomHolidays(customText).forEach((d) => set.add(d));
    return set;
}

// 커스텀 휴일 입력값 파싱
// - 화면에서는 JSON 배열 [{ date, name }] 로 저장합니다. (이름은 선택)
// - 쉼표/공백으로 구분한 날짜 목록("2025-01-07, 2025-01-08")도 받습니다.
function parseCustomHolidayEntries(text) {
    if (!text || !String(text).trim()) return [];
    const raw = String(text).trim();
    let entries;
    if (raw.startsWith('[')) {
        try {
            entries = JSON.parse(raw).map((e) =>
                typeof e === 'string' ? { date: e, name: '' } : { date: e.date, name: e.name || '' },
            );
        } catch {
            entries = [];
        }
    } else {
        entries = raw.split(/[\s,]+/).map((date) => ({ date, name: '' }));
    }
    return entries
        .filter((e) => parseDate(e.date))
        .map((e) => ({ date: e.date, name: String(e.name).trim() }));
}

function parseCustomHolidays(text) {
    return parseCustomHolidayEntries(text).map((e) => e.date);
}

function customHolidayNameMap(text) {
    const map = {};
    parseCustomHolidayEntries(text).forEach(({ date, name }) => {
        if (name) map[date] = name;
    });
    return map;
}

const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5]; // 월~금

// 근무 요일 Set (0=일 ~ 6=토). workdays 가 없으면 예전 includeSaturday 옵션으로 결정
function resolveWorkdays({ workdays, includeSaturday } = {}) {
    if (Array.isArray(workdays)) return new Set(workdays.map(Number));
    return new Set(includeSaturday ? [...DEFAULT_WORKDAYS, 6] : DEFAULT_WORKDAYS);
}

// 근무 요일이 아닌 날 (주말·쉬는 요일)
function isOffDay(date, workdaySet) {
    return !workdaySet.has(date.getDay());
}

function calculateRange({ startDate, endDate, workdays, includeSaturday, excludeHolidays, customHolidayText, includeEnd = true }) {
    const workdaySet = resolveWorkdays({ workdays, includeSaturday });
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
    const comparator = (c, e) => (includeEnd ? c <= e : c < e);
    while (comparator(current, endDate)) {
        const dateStr = formatDate(current);
        const weekend = isOffDay(current, workdaySet);
        const holiday = excludeHolidays && holidaySet.has(dateStr);
        stats.calendarDays += 1;
        stats.weekdayCounts[current.getDay()] += 1;

        // 각 날짜는 근무일 / 쉬는 요일 / 제외된 휴일 중 하나로만 셉니다.
        // (쉬는 요일과 공휴일이 겹치면 쉬는 요일로 셈 → 세 값의 합 = 총 달력일)
        if (weekend) {
            stats.weekendDays += 1;
            stats.weekendDates.push(dateStr);
        } else if (holiday) {
            stats.holidayDays += 1;
            stats.holidayDates.push(dateStr);
        } else {
            stats.businessDays += 1;
            stats.businessDates.push(dateStr);
        }

        current = addDays(current, 1);
    }

    return stats;
}

function findBusinessDate({ baseDate, offset, workdays, includeSaturday, excludeHolidays, customHolidayText }) {
    const workdaySet = resolveWorkdays({ workdays, includeSaturday });
    if (offset === 0 || workdaySet.size === 0) {
        return { targetDate: baseDate, steps: 0 };
    }

    const direction = offset > 0 ? 1 : -1;
    let remaining = Math.abs(offset);
    let current = new Date(baseDate);

    // 주 1일 근무여도 충분하도록 (근무일 수 × 7일 + 공휴일 여유 1년)
    const spanDays = Math.abs(offset) * 7 + 366;
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
        const weekend = isOffDay(current, workdaySet);
        const holiday = excludeHolidays && holidaySet.has(dateStr);
        if (!weekend && !holiday) {
            remaining -= 1;
        }
        // 안전장치: 휴일 집합을 만든 범위를 벗어나면 중단
        if (steps >= spanDays) break;
    }

    return { targetDate: current, steps };
}

// names: { 'YYYY-MM-DD': '이름' } — 이름이 있으면 "날짜 (이름)" 으로 표시
function renderChips(container, dates, emptyText, names = null) {
    container.innerHTML = '';
    if (!dates.length) {
        container.innerHTML = `<span class="chip chip--muted">${emptyText}</span>`;
        return;
    }
    dates.forEach((d) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = names && names[d] ? `${d} (${names[d]})` : d;
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

function escapeAttr(text) {
    return String(text).replace(/[&"<>]/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// ---------- business days calendar (carousel view) ----------
function renderBusinessCalendar(container, startDate, endDate, businessDates, customHolidayText = '') {
    const today = formatDate(new Date());
    const businessSet = new Set(businessDates);
    const customSet = new Set(parseCustomHolidays(customHolidayText));
    const customNames = customHolidayNameMap(customHolidayText);

    // collect all dates from start to end month-by-month
    const calendars = [];
    let current = new Date(startDate);
    current.setDate(1); // start of month

    while (current <= endDate) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const first = new Date(year, month, 1);
        const firstWeekday = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let html = '';
        html += `<div class="business-cal-month"><strong>${year}-${pad(month + 1)}</strong>`;
        html += '<div class="biz-cal-grid">';

        // weekday labels
        weekdayLabels.forEach((d, idx) => {
            const dayCls = idx === 0 ? ' sunday' : idx === 6 ? ' saturday' : '';
            html += `<div class="biz-cal-day disabled${dayCls}"><small>${d}</small></div>`;
        });

        // blank cells
        for (let i = 0; i < firstWeekday; i++) html += `<div class="biz-cal-day disabled"></div>`;

        // day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
            const weekday = (firstWeekday + d - 1) % 7;
            const holidayName =
                holidayNames[dateStr] || customNames[dateStr] || (customSet.has(dateStr) ? '커스텀 휴일' : '');
            let cls = 'biz-cal-day';

            if (businessSet.has(dateStr)) cls += ' business';
            // 공휴일(커스텀 포함)은 연한 빨간 배경. 공휴일 제외를 꺼서 근무일이면 근무일 배경 유지
            else if (holidayName) cls += ' holiday';
            // 일요일·공휴일은 빨간색, 토요일은 파란색
            if (holidayName || weekday === 0) cls += ' sunday';
            else if (weekday === 6) cls += ' saturday';
            if (dateStr === today) cls += ' today';

            const title = holidayName ? ` title="${escapeAttr(holidayName)}"` : '';
            html += `<div class="${cls}"${title}>${d}</div>`;
        }

        html += '</div></div>';
        calendars.push(html);

        current.setMonth(current.getMonth() + 1);
    }

    container.innerHTML = calendars.join('');
}

// ---------- mini calendar for selecting custom holidays ----------
function renderMiniCalendar(container, year, month, selectedSet) {
    // year, month (0-indexed)
    const first = new Date(year, month, 1);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';
    html += `<div class="cal-header"><button data-action="prev">‹</button><strong>${year}년 ${month + 1}월</strong><button data-action="next">›</button></div>`;
    html += '<div class="cal-grid">';
    // weekday labels
    weekdayLabels.forEach((d, idx) => {
        const dayCls = idx === 0 ? ' sunday' : idx === 6 ? ' saturday' : '';
        html += `<div class="cal-day disabled${dayCls}"><small>${d}</small></div>`;
    });

    // blank cells before first day
    for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day disabled"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
        const weekday = (firstWeekday + d - 1) % 7;
        let cls = 'cal-day';
        if (holidayNames[dateStr] || weekday === 0) cls += ' sunday';
        else if (weekday === 6) cls += ' saturday';
        if (holidayNames[dateStr]) cls += ' holiday';
        if (selectedSet.has(dateStr)) cls += ' selected';
        const title = holidayNames[dateStr] ? ` title="${escapeAttr(holidayNames[dateStr])}"` : '';
        html += `<div class="${cls}" data-date="${dateStr}"${title}>${d}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function initCustomCalendar(hiddenTextareaId, calendarContainerId, listContainerId, onChange) {
    const hidden = document.getElementById(hiddenTextareaId);
    const container = document.getElementById(calendarContainerId);
    const list = document.getElementById(listContainerId);
    if (!container) return;

    // date -> name (이름은 비워도 됨)
    const selected = new Map();
    (hidden ? parseCustomHolidayEntries(hidden.value) : []).forEach(({ date, name }) => selected.set(date, name));
    let view = new Date();
    view.setDate(1);

    function sortedDates() {
        return Array.from(selected.keys()).sort();
    }

    function updateHidden() {
        if (hidden) {
            hidden.value = JSON.stringify(sortedDates().map((date) => ({ date, name: selected.get(date) })));
        }
        if (typeof onChange === 'function') onChange();
    }

    function renderList() {
        if (!list) return;
        list.innerHTML = '';
        const dates = sortedDates();
        if (!dates.length) {
            list.innerHTML = '<span class="chip chip--muted">선택된 커스텀 휴일이 없습니다.</span>';
            return;
        }
        dates.forEach((date) => {
            const item = document.createElement('div');
            item.className = 'custom-item';
            item.dataset.date = date;

            const label = document.createElement('span');
            label.className = 'custom-item__date';
            label.textContent = `${date} (${weekdayLabels[parseDate(date).getDay()]})`;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'custom-item__name';
            input.placeholder = '이름 (선택)';
            input.maxLength = 30;
            input.value = selected.get(date) || '';
            input.setAttribute('aria-label', `${date} 휴일 이름`);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'custom-item__remove';
            remove.textContent = '×';
            remove.title = '삭제';
            remove.setAttribute('aria-label', `${date} 삭제`);

            item.append(label, input, remove);
            list.appendChild(item);
        });
    }

    function render() {
        renderMiniCalendar(container, view.getFullYear(), view.getMonth(), selected);
        renderList();
        updateHidden();
    }

    container.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-action], .cal-day');
        if (!t) return;
        const action = t.dataset.action;
        if (action === 'prev' || action === 'next') {
            view.setMonth(view.getMonth() + (action === 'prev' ? -1 : 1));
            render();
            return;
        }
        const date = t.dataset.date;
        if (date) {
            if (selected.has(date)) selected.delete(date);
            else selected.set(date, '');
            render();
            if (selected.has(date) && list) {
                // 새로 추가한 날짜의 이름 칸으로 바로 이동
                const input = list.querySelector(`.custom-item[data-date="${date}"] .custom-item__name`);
                if (input) input.focus();
            }
        }
    });

    if (list) {
        // 이름 입력: 목록을 다시 그리지 않아 입력 중 포커스가 유지됩니다.
        list.addEventListener('input', (ev) => {
            const item = ev.target.closest('.custom-item');
            if (!item || !ev.target.classList.contains('custom-item__name')) return;
            selected.set(item.dataset.date, ev.target.value);
            updateHidden();
        });
        list.addEventListener('click', (ev) => {
            const btn = ev.target.closest('.custom-item__remove');
            if (!btn) return;
            selected.delete(btn.closest('.custom-item').dataset.date);
            render();
        });
    }

    render();
    return {
        getSelected: () => sortedDates(),
        setSelected: (arr) => {
            selected.clear();
            (arr || []).forEach((d) => selected.set(d, ''));
            render();
        },
    };
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
    const iso = formatDate(today);
    // 기본: 시작일을 오늘로 설정 (요청사항)
    document.getElementById('startDate').value = iso;
    // 종료일은 기본값 없이 비워둠 (사용자 요청)
    const endEl = document.getElementById('endDate');
    if (endEl) endEl.value = '';
    document.getElementById('baseDate').value = iso;
}

function handleRangeCalculation() {
    const startValue = document.getElementById('startDate').value;
    const endValue = document.getElementById('endDate').value;
    const workdays = readWorkdays('workdaysRange');
    const excludeHolidays = document.getElementById('excludeHolidays').checked;
    const includeEnd = document.getElementById('includeEnd')?.checked ?? true;
    const customHolidayText = document.getElementById('customHolidays').value;
    const errorBox = document.getElementById('rangeError');

    // 입력값을 덮어쓰지 않고 안내만 합니다.
    const startDate = parseDate(startValue);
    const endDate = parseDate(endValue);
    if (!startDate || !endDate) {
        errorBox.textContent = '시작일과 종료일을 모두 입력해주세요.';
        return;
    }
    if (!workdays.length) {
        errorBox.textContent = '근무 요일을 하루 이상 선택해주세요.';
        return;
    }

    const messages = [];
    let from = startDate;
    let to = endDate;
    if (startDate > endDate) {
        [from, to] = [endDate, startDate];
        messages.push('시작일이 종료일보다 늦어 날짜를 교환했습니다.');
    }
    if (excludeHolidays) {
        const warning = missingYearsWarning(missingHolidayYears(from, to));
        if (warning) messages.push(warning);
    }
    errorBox.textContent = messages.join(' ');

    const stats = calculateRange({
        startDate: from,
        endDate: to,
        workdays,
        excludeHolidays,
        customHolidayText,
        includeEnd,
    });

    document.getElementById('rangeSummary').hidden = false;
    document.getElementById('calendarDays').textContent = stats.calendarDays;
    document.getElementById('businessDays').textContent = stats.businessDays;
    document.getElementById('weekendDays').textContent = stats.weekendDays;
    document.getElementById('holidayDays').textContent = stats.holidayDays;

    // render business calendar
    const calContainer = document.getElementById('businessCalendar');
    if (calContainer) {
        calContainer.hidden = false;
        renderBusinessCalendar(
            document.getElementById('businessCalendarGrid'),
            from,
            to,
            stats.businessDates,
            customHolidayText,
        );
    }

    // separate default holidays from custom holidays
    const customSet = new Set(parseCustomHolidays(customHolidayText));
    const defaultHolidayDates = stats.holidayDates.filter(d => !customSet.has(d));
    const customHolidayDates = stats.holidayDates.filter(d => customSet.has(d));

    // render holiday details
    const holidayDetails = document.getElementById('holidayDetails');
    if (holidayDetails) {
        holidayDetails.hidden = false;
        renderChips(
            document.getElementById('holidayList'),
            defaultHolidayDates,
            '제외된 공휴일 없음',
            holidayNames,
        );
        renderChips(
            document.getElementById('customHolidayDetailList'),
            customHolidayDates,
            '커스텀 휴일 없음',
            customHolidayNameMap(customHolidayText),
        );
    }
}

const MAX_OFFSET = 10000;

// 근무 요일 선택 영역에서 체크된 요일 (0=일 ~ 6=토)
function readWorkdays(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [...DEFAULT_WORKDAYS];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((el) => Number(el.value));
}

function renderWorkdayPicker(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    // 월요일부터 표시 (월 화 수 목 금 토 일)
    [1, 2, 3, 4, 5, 6, 0].forEach((day) => {
        const label = document.createElement('label');
        label.className = 'day-toggle' + (day === 0 ? ' sunday' : day === 6 ? ' saturday' : '');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = String(day);
        input.checked = DEFAULT_WORKDAYS.includes(day);
        input.setAttribute('aria-label', `${weekdayLabels[day]}요일 근무`);
        const text = document.createElement('span');
        text.textContent = weekdayLabels[day];
        label.append(input, text);
        container.appendChild(label);
    });
}

function handleOffsetCalculation() {
    const baseValue = document.getElementById('baseDate').value;
    const offsetRaw = document.getElementById('offsetDays').value.trim();
    const offsetValue = Number(offsetRaw);
    const workdays = readWorkdays('workdaysOffset');
    const excludeHolidays = document.getElementById('excludeHolidaysOffset').checked;
    const customHolidayText = document.getElementById('customHolidaysOffset').value;
    const errorBox = document.getElementById('offsetError');

    const baseDate = parseDate(baseValue);
    if (!baseDate || offsetRaw === '' || !Number.isInteger(offsetValue)) {
        errorBox.textContent = '기준일과 이동할 근무일 수(정수)를 올바르게 입력해주세요.';
        return;
    }
    if (Math.abs(offsetValue) > MAX_OFFSET) {
        errorBox.textContent = `이동할 근무일 수는 ±${MAX_OFFSET}일 이내로 입력해주세요.`;
        return;
    }
    if (!workdays.length) {
        errorBox.textContent = '근무 요일을 하루 이상 선택해주세요.';
        return;
    }

    errorBox.textContent = '';
    const result = findBusinessDate({
        baseDate,
        offset: offsetValue,
        workdays,
        excludeHolidays,
        customHolidayText,
    });

    errorBox.textContent = excludeHolidays
        ? missingYearsWarning(missingHolidayYears(baseDate, result.targetDate))
        : '';

    document.getElementById('offsetSummary').hidden = false;
    document.getElementById('offsetResult').textContent = formatDate(result.targetDate);
    const direction = offsetValue >= 0 ? '이동' : '역방향 이동';
    document.getElementById('offsetTrace').textContent = `${formatDate(baseDate)} 기준 ${offsetValue} 근무일 ${direction}`;
}

function bindEvents() {
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => switchTab(tab.dataset.target));
    });
    const swapBtn = document.getElementById('swapDatesBtn');
    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            [startInput.value, endInput.value] = [endInput.value, startInput.value];
        });
    }

    document
        .getElementById('calculateRange')
        .addEventListener('click', () => window.requestAnimationFrame(handleRangeCalculation));
    document
        .getElementById('calculateOffset')
        .addEventListener('click', () => window.requestAnimationFrame(handleOffsetCalculation));
}

function initApp() {
    setDefaultDates();
    renderWorkdayPicker('workdaysRange');
    renderWorkdayPicker('workdaysOffset');
    // initialize custom holiday calendars (range and offset)
    // note: calendar changes trigger calculation only when button is clicked
    initCustomCalendar('customHolidays', 'customHolidayCalendar', 'customHolidayChips', () => {
        // custom holidays updated but calculation only on button click
    });
    initCustomCalendar('customHolidaysOffset', 'customHolidayCalendarOffset', 'customHolidayChipsOffset', () => {
        // custom holidays updated but calculation only on button click
    });
    bindEvents();
    // Do NOT call handleRangeCalculation or handleOffsetCalculation here
    // Results only appear after button click
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}

// Node 테스트용 export (브라우저에서는 무시됨)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseDate,
        formatDate,
        calculateRange,
        findBusinessDate,
        missingHolidayYears,
        parseCustomHolidayEntries,
        resolveWorkdays,
        holidayNames,
    };
}
