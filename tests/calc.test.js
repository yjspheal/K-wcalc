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
    holidayNames,
} = require('../script.js');

const range = (start, end, opts = {}) =>
    calculateRange({
        startDate: parseDate(start),
        endDate: parseDate(end),
        includeSaturday: false,
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
            includeSaturday: false,
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

test('토요일 포함 시 토요일 공휴일은 근무일이 아니다', () => {
    const s = range('2026-08-15', '2026-08-15', { includeSaturday: true });
    assert.equal(s.businessDays, 0);
    assert.equal(s.holidayDays, 1);
    // 공휴일이 아닌 토요일은 근무일
    assert.equal(range('2026-08-22', '2026-08-22', { includeSaturday: true }).businessDays, 1);
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

test('사용자 지정 휴일', () => {
    assert.equal(range('2025-01-06', '2025-01-10', { customHolidayText: '2025-01-07, 2025-01-08' }).businessDays, 3);
});

test('N 근무일 이동 (앞/뒤)', () => {
    assert.equal(shift('2025-10-02', 1), '2025-10-10');
    assert.equal(shift('2025-10-10', -1), '2025-10-02');
    assert.equal(shift('2025-01-06', 0), '2025-01-06');
    assert.equal(shift('2025-01-10', 1), '2025-01-13'); // 금 → 월
    assert.equal(shift('2025-01-10', 1, { includeSaturday: true }), '2025-01-11');
});

test('공휴일 데이터가 없는 연도를 알려준다', () => {
    assert.deepEqual(missingHolidayYears(parseDate('2025-12-01'), parseDate('2026-01-31')), []);
    // 데이터가 생길 일이 없는 먼 미래 연도로 확인 (API 갱신으로 내년 데이터가 추가돼도 깨지지 않도록)
    assert.deepEqual(missingHolidayYears(parseDate('2098-12-01'), parseDate('2100-01-31')), [2098, 2099, 2100]);
});
