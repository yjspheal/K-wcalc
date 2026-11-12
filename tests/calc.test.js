// 날짜 계산/공휴일 로직 테스트. 여러 시간대에서 실행합니다: npm test
const test = require('node:test');
const assert = require('node:assert/strict');

require('../holidays.js');
const {
    parseDate,
    formatDate,
    calculateRange,
    findBusinessDate,
    missingHolidayYears,
    parseCustomHolidayEntries,
    resolveWorkdays,
    holidayNames,
} = require('../script.js');

const range = (start, end, opts = {}) =>
    calculateRange({
        startDate: parseDate(start),
        endDate: parseDate(end),
        workdays: [1, 2, 3, 4, 5],
        excludeHolidays: true,
        customHolidayText: '',
        includeEnd: true,
        ...opts,
    });

const shift = (base, offset, opts = {}) =>
    formatDate(
        findBusinessDate({
            baseDate: parseDate(base),
            offset,
            workdays: [1, 2, 3, 4, 5],
            excludeHolidays: true,
            customHolidayText: '',
            ...opts,
        }).targetDate,
    );

test(`parseDate/formatDate 는 시간대와 무관하게 같은 날짜를 유지한다 (TZ=${process.env.TZ || 'system'})`, () => {
    assert.equal(parseDate('2025-01-06').getDay(), 1); // 월요일
    assert.equal(formatDate(parseDate('2025-01-06')), '2025-01-06');
    // 새벽 3시(한국 기준 UTC 전날)에도 오늘 날짜가 나와야 한다
    assert.equal(formatDate(new Date(2025, 0, 6, 3, 0)), '2025-01-06');
    assert.equal(formatDate(new Date(2025, 0, 6, 23, 59)), '2025-01-06');
});

test('parseDate 는 잘못된 날짜를 거부한다', () => {
    assert.equal(parseDate(''), null);
    assert.equal(parseDate('2025-02-30'), null);
    assert.equal(parseDate('2025/01/01'), null);
});

test('2025 추석·한글날 연휴 구간', () => {
    const s = range('2025-10-01', '2025-10-10');
    assert.equal(s.calendarDays, 10);
    assert.deepEqual(s.businessDates, ['2025-10-01', '2025-10-02', '2025-10-10']);
    assert.equal(s.weekendDays, 2);
    assert.equal(s.holidayDays, 6); // 10/3, 10/5(일), 10/6~10/9
});

test('종료일 미포함', () => {
    assert.equal(range('2025-01-06', '2025-01-10', { includeEnd: false }).businessDays, 4);
    assert.equal(range('2025-01-06', '2025-01-10').businessDays, 5);
});

test('공휴일 제외 끄기', () => {
    assert.equal(range('2025-10-01', '2025-10-10', { excludeHolidays: false }).businessDays, 8);
});

test('월~토 근무 시 토요일 공휴일은 근무일이 아니다', () => {
    const s = range('2026-08-15', '2026-08-15', { workdays: [1, 2, 3, 4, 5, 6] });
    assert.equal(s.businessDays, 0);
    assert.equal(s.holidayDays, 1);
    // 공휴일이 아닌 토요일은 근무일
    assert.equal(range('2026-08-22', '2026-08-22', { workdays: [1, 2, 3, 4, 5, 6] }).businessDays, 1);
});

test('2026 추석은 9/24~26 이며 9/23 은 근무일', () => {
    assert.deepEqual(range('2026-09-21', '2026-09-28').businessDates, [
        '2026-09-21',
        '2026-09-22',
        '2026-09-23',
        '2026-09-28',
    ]);
});

test('누락됐던 공휴일들이 반영된다', () => {
    for (const d of [
        '2024-02-12', '2024-04-10', '2024-10-01',
        '2025-01-27', '2025-03-03', '2025-06-03', '2025-10-08', '2025-10-09',
    ]) {
        assert.ok(holidayNames[d], `${d} 누락`);
        assert.equal(range(d, d).businessDays, 0, `${d} 가 근무일로 계산됨`);
    }
});

test('커스텀 휴일', () => {
    assert.equal(range('2025-01-06', '2025-01-10', { customHolidayText: '2025-01-07, 2025-01-08' }).businessDays, 3);
});

test('이름이 있는 커스텀 휴일 (JSON 형식)', () => {
    const text = JSON.stringify([
        { date: '2025-01-07', name: '여름 휴가, "1일차"' },
        { date: '2025-01-08', name: '' },
        { date: '2025-02-30', name: '잘못된 날짜' },
    ]);
    assert.deepEqual(parseCustomHolidayEntries(text), [
        { date: '2025-01-07', name: '여름 휴가, "1일차"' },
        { date: '2025-01-08', name: '' },
    ]);
    assert.equal(range('2025-01-06', '2025-01-10', { customHolidayText: text }).businessDays, 3);
    assert.deepEqual(parseCustomHolidayEntries('[broken'), []);
});

test('N 근무일 이동 (앞/뒤)', () => {
    assert.equal(shift('2025-10-02', 1), '2025-10-10');
    assert.equal(shift('2025-10-10', -1), '2025-10-02');
    assert.equal(shift('2025-01-06', 0), '2025-01-06');
    assert.equal(shift('2025-01-10', 1), '2025-01-13'); // 금 → 월
    assert.equal(shift('2025-01-10', 1, { workdays: [1, 2, 3, 4, 5, 6] }), '2025-01-11');
});

test('근무 요일 지정: 화·목·토 근무', () => {
    const tts = { workdays: [2, 4, 6] };
    const s = range('2026-11-01', '2026-11-14', tts);
    assert.deepEqual(s.businessDates, ['2026-11-03', '2026-11-05', '2026-11-07', '2026-11-10', '2026-11-12', '2026-11-14']);
    assert.equal(s.weekendDays, 8); // 쉬는 요일
    // 추석(9/24 목, 9/26 토)과 겹치면 그 주 근무일은 화요일 하루
    assert.deepEqual(range('2026-09-21', '2026-09-27', tts).businessDates, ['2026-09-22']);
    assert.equal(shift('2026-11-05', 1, tts), '2026-11-07');
    assert.equal(shift('2026-11-05', 2, tts), '2026-11-10');
    assert.equal(shift('2026-11-10', -1, tts), '2026-11-07');
});

test('근무 요일 지정: 주 1일 근무도 먼 날짜까지 계산된다', () => {
    // 매주 수요일만 근무, 100 근무일 뒤 (공휴일 제외 끔)
    assert.equal(shift('2026-01-07', 100, { workdays: [3], excludeHolidays: false }), '2027-12-08');
});

test('예전 includeSaturday 옵션도 계속 동작한다', () => {
    assert.deepEqual([...resolveWorkdays({ includeSaturday: true })].sort(), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual([...resolveWorkdays({})].sort(), [1, 2, 3, 4, 5]);
});

test('공휴일 데이터가 없는 연도를 알려준다', () => {
    assert.deepEqual(missingHolidayYears(parseDate('2025-12-01'), parseDate('2026-01-31')), []);
    // 데이터가 생길 일이 없는 먼 미래 연도로 확인 (API 갱신으로 내년 데이터가 추가돼도 깨지지 않도록)
    assert.deepEqual(missingHolidayYears(parseDate('2098-12-01'), parseDate('2100-01-31')), [2098, 2099, 2100]);
});
