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
    2026: [
        '2026-01-01',
        '2026-02-16',
        '2026-02-17',
        '2026-02-18',
        '2026-03-01',
        '2026-04-15',
        '2026-05-05',
        '2026-05-25',
        '2026-06-06',
        '2026-08-15',
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-10-03',
        '2026-10-09',
        '2026-12-25',
    ],
};

const holidayNames = {
    '2024-01-01': '신정',
    '2024-02-09': '설날',
    '2024-02-10': '설날',
    '2024-02-11': '설날',
    '2024-03-01': '삼일절',
    '2024-05-05': '어린이날',
    '2024-05-06': '어린이날 대체휴무',
    '2024-05-15': '부처님오신날',
    '2024-06-06': '현충일',
    '2024-08-15': '광복절',
    '2024-09-16': '추석',
    '2024-09-17': '추석',
    '2024-09-18': '추석',
    '2024-10-03': '개천절',
    '2024-10-09': '한글날',
    '2024-12-25': '크리스마스',
    '2025-01-01': '신정',
    '2025-01-28': '설날',
    '2025-01-29': '설날',
    '2025-01-30': '설날',
    '2025-03-01': '삼일절',
    '2025-05-05': '어린이날',
    '2025-05-06': '어린이날 대체휴무',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-05': '추석',
    '2025-10-06': '추석',
    '2025-10-07': '추석',
    '2025-12-25': '크리스마스',
    '2026-01-01': '신정',
    '2026-02-16': '설날',
    '2026-02-17': '설날',
    '2026-02-18': '설날',
    '2026-03-01': '삼일절',
    '2026-04-15': '국회의원선거일',
    '2026-05-05': '어린이날',
    '2026-05-25': '부처님오신날',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-09-07': '추석',
    '2026-09-08': '추석',
    '2026-09-09': '추석',
    '2026-10-03': '개천절',
    '2026-10-09': '한글날',
    '2026-12-25': '크리스마스',
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

function calculateRange({ startDate, endDate, includeSaturday, excludeHolidays, customHolidayText, includeEnd = true }) {
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

function renderChips(container, dates, emptyText, showNames = false) {
    container.innerHTML = '';
    if (!dates.length) {
        container.innerHTML = `<span class="chip chip--muted">${emptyText}</span>`;
        return;
    }
    dates.forEach((d) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        if (showNames && holidayNames[d]) {
            chip.textContent = `${d} (${holidayNames[d]})`;
        } else {
            chip.textContent = d;
        }
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

// ---------- business days calendar (carousel view) ----------
function renderBusinessCalendar(container, startDate, endDate, businessDates, includeSaturday, excludeHolidays, customText) {
    const today = formatDate(new Date());
    const businessSet = new Set(businessDates);

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
        ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => {
            html += `<div class="biz-cal-day disabled"><small>${d}</small></div>`;
        });

        // blank cells
        for (let i = 0; i < firstWeekday; i++) html += `<div class="biz-cal-day disabled"></div>`;

        // day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
            let cls = 'biz-cal-day';

            if (businessSet.has(dateStr)) cls += ' business';
            if (dateStr === today) cls += ' today';

            html += `<div class="${cls}">${d}</div>`;
        }

        html += '</div></div>';
        calendars.push(html);

        current.setMonth(current.getMonth() + 1);
    }

    container.innerHTML = calendars.join('');
}

// ---------- mini calendar for selecting custom holidays ----------
function pad(n) {
    return n.toString().padStart(2, '0');
}

function renderMiniCalendar(container, year, month, selectedSet) {
    // year, month (0-indexed)
    const first = new Date(year, month, 1);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';
    html += `<div class="cal-header"><button data-action="prev">‹</button><strong>${year}년 ${month + 1}월</strong><button data-action="next">›</button></div>`;
    html += '<div class="cal-grid">';
    // weekday labels
    ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => {
        html += `<div class="cal-day disabled"><small>${d}</small></div>`;
    });

    // blank cells before first day
    for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day disabled"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
        const selClass = selectedSet.has(dateStr) ? 'selected' : '';
        html += `<div class="cal-day ${selClass}" data-date="${dateStr}">${d}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function initCustomCalendar(hiddenTextareaId, calendarContainerId, chipsContainerId, onChange) {
    const hidden = document.getElementById(hiddenTextareaId);
    const container = document.getElementById(calendarContainerId);
    const chips = document.getElementById(chipsContainerId);
    if (!container) return;

    const initial = hidden ? parseCustomHolidays(hidden.value) : [];
    const selected = new Set(initial);
    let view = new Date();
    view.setDate(1);

    function updateHidden() {
        if (hidden) hidden.value = Array.from(selected).sort().join(',');
        renderChips(chips, Array.from(selected).sort(), '선택된 휴일이 없습니다.');
        if (typeof onChange === 'function') onChange();
    }

    function render() {
        renderMiniCalendar(container, view.getFullYear(), view.getMonth(), selected);
        updateHidden();
    }

    container.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-action], .cal-day');
        if (!t) return;
        const action = t.dataset.action;
        if (action === 'prev') {
            view.setMonth(view.getMonth() - 1);
            render();
            return;
        }
        if (action === 'next') {
            view.setMonth(view.getMonth() + 1);
            render();
            return;
        }
        const date = t.dataset.date;
        if (date) {
            if (selected.has(date)) selected.delete(date);
            else selected.add(date);
            render();
        }
    });

    // allow chips to remove items
    if (chips) {
        chips.addEventListener('click', (ev) => {
            const chip = ev.target.closest('.chip');
            if (!chip) return;
            const val = chip.textContent.trim();
            if (selected.has(val)) {
                selected.delete(val);
                render();
            }
        });
    }

    render();
    return {
        getSelected: () => Array.from(selected).sort(),
        setSelected: (arr) => {
            selected.clear();
            (arr || []).forEach((d) => selected.add(d));
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
    const includeSaturday = document.getElementById('includeSaturday').checked;
    const excludeHolidays = document.getElementById('excludeHolidays').checked;
    const includeEnd = document.getElementById('includeEnd')?.checked ?? true;
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
            includeSaturday,
            excludeHolidays,
            customHolidayText
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
            true
        );
        renderChips(
            document.getElementById('customHolidayDetailList'),
            customHolidayDates,
            '커스텀 휴일 없음',
            false  // custom holidays don't have preset names
        );
    }
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
