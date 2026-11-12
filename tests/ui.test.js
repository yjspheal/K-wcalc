const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function isoToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

(async () => {
    const root = path.join(__dirname, '..');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const holidaysContent = fs.readFileSync(path.join(root, 'holidays.js'), 'utf8');
    const scriptContent = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

    // 외부 리소스(광고/폰트)는 불러오지 않고 스크립트만 직접 실행합니다.
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'file://' + root + '/' });
    const { window } = dom;
    // provide console to window
    window.console = console;

    // evaluate the scripts in the window (holidays.js 먼저)
    window.eval(holidaysContent);
    window.eval(scriptContent);

    // ensure initApp exists and call it
    if (typeof window.initApp === 'function') {
        window.initApp();
        console.log('initApp invoked');
    } else {
        console.error('initApp not found');
        process.exit(2);
    }

    const doc = window.document;
    const today = isoToday();

    // Test 1: check results are hidden initially before any calculation
    const summaryBefore = doc.getElementById('rangeSummary');
    if (!summaryBefore || !summaryBefore.hidden) {
        console.error('rangeSummary should be hidden initially (no auto-calculation)');
        process.exit(12);
    }
    console.log('results hidden initially: ✓');

    // Test 2: default dates
    const startVal = doc.getElementById('startDate').value;
    const endVal = doc.getElementById('endDate').value;
    const baseVal = doc.getElementById('baseDate').value;
    console.log('defaults:', { startVal, endVal, baseVal });
    // startDate and baseDate should be today; endDate should be empty by default
    if (startVal !== today || endVal !== '' || baseVal !== today) {
        console.error('Default date values not as expected (start/today, end/empty, base/today)');
        process.exit(3);
    }

    // Test 2: includeEnd default checked
    const includeEnd = doc.getElementById('includeEnd');
    if (!includeEnd) {
        console.error('includeEnd checkbox missing');
        process.exit(4);
    }
    if (!includeEnd.checked) {
        console.error('includeEnd is not checked by default');
        process.exit(5);
    }
    console.log('includeEnd present and checked');

    // Test 3: swap button swaps values
    const s = doc.getElementById('startDate');
    const e = doc.getElementById('endDate');
    s.value = '2025-01-02';
    e.value = '2025-01-05';
    const swap = doc.getElementById('swapDatesBtn');
    if (!swap) {
        console.error('swap button missing');
        process.exit(6);
    }
    swap.click();
    if (s.value !== '2025-01-05' || e.value !== '2025-01-02') {
        console.error('swap button did not swap values', s.value, e.value);
        process.exit(7);
    }
    console.log('swap button works');

    // Test 4: manual calculation shows results (but initially they should be hidden)
    const summaryManual = doc.getElementById('rangeSummary');
    const calendarManual = doc.getElementById('businessCalendar');

    // Before calculation: should be hidden
    if (!summaryManual.hidden) {
        console.error('rangeSummary should be hidden before any calculation');
        process.exit(8);
    }
    console.log('summary hidden before calculation: ✓');

    // Trigger manual calculation
    s.value = today;
    e.value = today;
    includeEnd.checked = true;
    window.handleRangeCalculation();

    // After calculation: should be visible
    if (summaryManual.hidden) {
        console.error('rangeSummary should show after handleRangeCalculation');
        process.exit(9);
    }
    console.log('summary shown after manual calculation: ✓');

    // Test 5: calendar selection adds chip and updates hidden textarea
    const calContainer = doc.getElementById('customHolidayCalendar');
    const hidden = doc.getElementById('customHolidays');
    const chips = doc.getElementById('customHolidayChips');
    if (!calContainer || !hidden || !chips) {
        console.error('calendar elements missing');
        process.exit(10);
    }

    // find a clickable day element
    // 공휴일이 아닌 평일(월~금)을 고릅니다. 주말·공휴일은 '제외된 커스텀 휴일'로 세지 않기 때문
    const day = Array.from(calContainer.querySelectorAll('.cal-day[data-date]')).find((el) => {
        const [y, m, d] = el.dataset.date.split('-').map(Number);
        const wd = new Date(y, m - 1, d).getDay();
        return wd >= 1 && wd <= 5 && !el.classList.contains('holiday');
    });
    if (!day) {
        console.error('no clickable day found in mini calendar');
        process.exit(11);
    }
    const dateStr = day.getAttribute('data-date');
    day.click();

    // after click, hidden value should include the date and a list item should appear
    const item = chips.querySelector(`.custom-item[data-date="${dateStr}"]`);
    if (!hidden.value.includes(dateStr) || !item) {
        console.error('calendar selection did not update hidden value or list', hidden.value);
        process.exit(12);
    }
    console.log('calendar selection works', dateStr);

    // Test 6: custom holiday name appears in results
    const nameInput = item.querySelector('.custom-item__name');
    nameInput.value = '여름 휴가';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    if (!hidden.value.includes('여름 휴가')) {
        console.error('name input did not update hidden value', hidden.value);
        process.exit(13);
    }
    s.value = dateStr;
    e.value = dateStr;
    window.handleRangeCalculation();
    const detail = doc.getElementById('customHolidayDetailList').textContent;
    if (!detail.includes(`${dateStr} (여름 휴가)`)) {
        console.error('custom holiday name not shown in results', detail);
        process.exit(14);
    }
    console.log('custom holiday name shown: ✓');

    // Test 7: remove button deletes the item
    item.querySelector('.custom-item__remove').click();
    if (hidden.value.includes(dateStr) || chips.querySelector('.custom-item')) {
        console.error('remove button did not delete custom holiday', hidden.value);
        process.exit(15);
    }
    console.log('custom holiday remove works: ✓');

    // Test 8: workday picker (default 월~금) and 화·목·토 selection
    const picker = doc.getElementById('workdaysRange');
    const boxes = Array.from(picker.querySelectorAll('input[type="checkbox"]'));
    const checked = boxes.filter((b) => b.checked).map((b) => b.value).sort().join(',');
    if (boxes.length !== 7 || checked !== '1,2,3,4,5') {
        console.error('workday picker default not 월~금', boxes.length, checked);
        process.exit(16);
    }
    boxes.forEach((b) => { b.checked = ['2', '4', '6'].includes(b.value); });
    s.value = '2026-11-01';
    e.value = '2026-11-14';
    window.handleRangeCalculation();
    if (doc.getElementById('businessDays').textContent !== '6') {
        console.error('화·목·토 근무 계산 오류', doc.getElementById('businessDays').textContent);
        process.exit(17);
    }
    boxes.forEach((b) => { b.checked = false; });
    window.handleRangeCalculation();
    if (!doc.getElementById('rangeError').textContent.includes('근무 요일')) {
        console.error('no workday selected error not shown');
        process.exit(18);
    }
    console.log('workday picker works: ✓');

    console.log('ALL TESTS PASSED');
    console.log('- Initialization: No auto-calculation ✓');
    console.log('- Default dates: start=today, end=empty, base=today ✓');
    console.log('- Manual calculation: Results appear only after button click ✓');
    process.exit(0);
})();
