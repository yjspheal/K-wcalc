#!/usr/bin/env node
// 공공데이터포털 "한국천문연구원_특일 정보" API(getRestDeInfo)에서 공휴일을 받아 holidays.js 를 갱신합니다.
//
// 사용법:
//   HOLIDAY_API_KEY=<서비스키> node scripts/fetch-holidays.mjs [연도 ...]
//
// 연도를 생략하면 (올해-1) ~ (올해+1) 을 조회합니다.
// API가 아직 데이터를 공개하지 않은 연도(결과 0건)나 요청에 실패한 연도는 기존 데이터를 그대로 유지합니다.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'holidays.js');

function loadExisting() {
    if (!fs.existsSync(OUTPUT)) return { years: {} };
    const sandbox = { globalThis: {} };
    vm.runInNewContext(fs.readFileSync(OUTPUT, 'utf8'), sandbox);
    return sandbox.globalThis.KR_HOLIDAYS || { years: {} };
}

function normalizeKey(raw) {
    // 포털에서 발급하는 "인코딩" 키(%2B 등 포함)를 넣어도 동작하도록 디코딩 후 다시 인코딩합니다.
    const key = raw.trim();
    try {
        return key.includes('%') ? decodeURIComponent(key) : key;
    } catch {
        return key;
    }
}

async function fetchYear(year, serviceKey) {
    const params = new URLSearchParams({
        serviceKey,
        solYear: String(year),
        numOfRows: '100',
        pageNo: '1',
        _type: 'json',
    });
    const res = await fetch(`${ENDPOINT}?${params}`);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        // 인증 오류 등은 _type=json 이어도 XML 로 내려옵니다.
        throw new Error(`JSON 이 아닌 응답: ${text.slice(0, 200)}`);
    }

    const header = data?.response?.header;
    if (header?.resultCode !== '00') {
        throw new Error(`API 오류 ${header?.resultCode}: ${header?.resultMsg}`);
    }

    const rawItems = data.response.body?.items?.item;
    const items = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];

    // 같은 날짜에 여러 공휴일이 겹치면 이름을 합칩니다. (예: 어린이날·부처님오신날)
    const byDate = new Map();
    for (const item of items) {
        if (item.isHoliday !== 'Y') continue;
        const s = String(item.locdate);
        const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        const name = String(item.dateName).trim();
        const names = byDate.get(date) || [];
        if (!names.includes(name)) names.push(name);
        byDate.set(date, names);
    }

    return [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, names]) => ({ date, name: names.join('·') }));
}

function serialize(data) {
    const years = Object.keys(data.years).sort();
    const lines = [
        '// 한국 공휴일 데이터 (자동 생성 파일)',
        '// scripts/fetch-holidays.mjs 가 공공데이터포털 특일정보 API(getRestDeInfo)로 갱신합니다.',
        '// 수동 편집도 가능하지만, API 갱신 시 해당 연도는 API 응답으로 덮어씁니다.',
        'globalThis.KR_HOLIDAYS = {',
        `  "source": ${JSON.stringify(data.source)},`,
        `  "updatedAt": ${JSON.stringify(data.updatedAt)},`,
        '  "years": {',
    ];
    years.forEach((year, yi) => {
        lines.push(`    ${JSON.stringify(year)}: [`);
        const list = data.years[year];
        list.forEach((h, i) => {
            const comma = i < list.length - 1 ? ',' : '';
            lines.push(`      { "date": ${JSON.stringify(h.date)}, "name": ${JSON.stringify(h.name)} }${comma}`);
        });
        lines.push(`    ]${yi < years.length - 1 ? ',' : ''}`);
    });
    lines.push('  }', '};', '');
    return lines.join('\n');
}

async function main() {
    const rawKey = process.env.HOLIDAY_API_KEY;
    if (!rawKey) {
        console.error('HOLIDAY_API_KEY 환경변수가 필요합니다. (공공데이터포털 특일정보 서비스키)');
        process.exit(1);
    }
    const serviceKey = normalizeKey(rawKey);

    const thisYear = new Date().getFullYear();
    const years = process.argv.slice(2).length
        ? process.argv.slice(2).map(Number)
        : [thisYear - 1, thisYear, thisYear + 1];

    const existing = loadExisting();
    const next = { source: 'data.go.kr', updatedAt: existing.updatedAt, years: { ...existing.years } };
    let changed = false;
    let failures = 0;

    for (const year of years) {
        try {
            const list = await fetchYear(year, serviceKey);
            if (!list.length) {
                console.log(`${year}: API 데이터 없음 (아직 미공개) - 기존 데이터 유지`);
                continue;
            }
            if (JSON.stringify(existing.years[year]) !== JSON.stringify(list)) {
                changed = true;
                console.log(`${year}: ${list.length}건 갱신`);
            } else {
                console.log(`${year}: 변경 없음`);
            }
            next.years[year] = list;
        } catch (err) {
            failures += 1;
            console.error(`${year}: 조회 실패 - ${err.message}`);
        }
    }

    if (failures === years.length) {
        console.error('모든 연도 조회에 실패했습니다.');
        process.exit(1);
    }

    if (changed) {
        next.updatedAt = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(OUTPUT, serialize(next));
        console.log('holidays.js 를 갱신했습니다.');
    } else {
        console.log('변경 사항이 없습니다.');
    }
}

main();
