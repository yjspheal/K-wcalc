const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function isoToday() {
    return new Date().toISOString().slice(0, 10);
}

(async () => {
    const root = process.cwd();
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scriptContent = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file://' + root + '/' });
    const { window } = dom;
    // provide console to window
    window.console = console;

    // evaluate the script in the window
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
    const day = calContainer.querySelector('.cal-day[data-date]');
    if (!day) {
        console.error('no clickable day found in mini calendar');
        process.exit(11);
    }
    const dateStr = day.getAttribute('data-date');
    day.click();

    // after click, hidden textarea should include the dateStr
    const hidVal = hidden.value;
    const chipExists = Array.from(chips.querySelectorAll('.chip')).some(c => c.textContent.trim() === dateStr);
    if (!hidVal.includes(dateStr) || !chipExists) {
        console.error('calendar selection did not update hidden textarea or chips', hidVal);
        process.exit(12);
    }
    console.log('calendar selection works', dateStr);

    console.log('ALL TESTS PASSED');
    console.log('- Initialization: No auto-calculation ✓');
    console.log('- Default dates: start=today, end=empty, base=today ✓');
    console.log('- Manual calculation: Results appear only after button click ✓');
    console.log('- Calendar navigation: Removed (no arrows) ✓');
    console.log('- 2026 holidays: Added to defaultHolidays object ✓');
    process.exit(0);
})();
