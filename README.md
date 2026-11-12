# K-wcalc: 근무일 계산기

[**https://yjspheal.github.io/K-wcalc/**](https://yjspheal.github.io/K-wcalc/)

간단한 웹 기반 근무일 계산기입니다.

## 주요 기능

-   두 날짜 사이의 근무일, 공휴일, 주말 일수 계산
-   특정 날짜로부터 몇 근무일 전후의 날짜 계산
-   토요일을 근무일에 포함하거나 제외하는 옵션
-   공휴일 제외 기능
-   커스텀 휴일 추가 기능 (이름 지정 가능)

## 사용법

1.  `index.html` 파일을 웹 브라우저에서 엽니다.
2.  원하는 기능을 선택하고 날짜와 옵션을 입력합니다.
3.  '계산하기' 버튼을 클릭하여 결과를 확인합니다.

## 공휴일 데이터

공휴일은 `holidays.js`에 연도별로 들어 있으며, [공공데이터포털 한국천문연구원 특일 정보 API](https://www.data.go.kr/data/15012690/openapi.do)(`getRestDeInfo`)로 갱신합니다.
대체공휴일·임시공휴일·선거일 등도 API 기준으로 반영됩니다.

API 키를 브라우저에 노출하지 않도록, 페이지가 API를 직접 호출하지 않고 GitHub Actions가 매월 1일 데이터를 받아 `holidays.js`를 커밋하는 방식입니다.

### 자동 갱신 설정

1.  공공데이터포털에서 위 API 활용 신청 후 서비스키(일반 인증키)를 발급받습니다.
2.  저장소 **Settings → Secrets and variables → Actions**에 `HOLIDAY_API_KEY` 이름으로 등록합니다.
3.  **Actions → Update holidays → Run workflow**로 바로 실행할 수도 있습니다. (연도 지정 가능)

키가 없으면 워크플로는 건너뛰며, `holidays.js`를 직접 수정해도 됩니다.
데이터가 없는 연도가 계산 범위에 포함되면 화면에 경고가 표시됩니다.

### 로컬에서 갱신

```bash
HOLIDAY_API_KEY=<서비스키> npm run update-holidays          # 작년~내년
HOLIDAY_API_KEY=<서비스키> npm run update-holidays 2027 2028 # 연도 지정
```

## 개발

```bash
npm install
npm test   # 서울/뉴욕 두 시간대에서 계산·UI 테스트 실행
```
