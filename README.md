# 글자티콘 생성기

> **Char**acter + Emot**icon** = Charicon

## 개발 환경

- Node.js 22.12.0
- npm 10.9.0
- TypeScript 5.6.3
- React 19.1.0

## 실행

```shell
npm run dev
```

## 빌드

```shell
npm run build
```

## Slack 브라우저 확장 (MVP)

백엔드 없이 Slack 워크스페이스에 이모지를 등록·미리보기하려면 확장이 필요합니다.
Chrome / Firefox (MV3) 를 지원합니다.

### 빌드

```shell
npm run extension:install      # 최초 1회
npm run extension:build        # dev → localhost + web origin
npm run extension:build:prod   # prod → web origin + Slack
npm run extension:zip          # prod zip → extension/release/
```

웹 앱 주소는 빌드 시 **필수** 주입 (하드코딩 없음). 없으면 빌드 실패.

```shell
cp extension/config.example.json extension/config.json
# webOrigin 을 실제 사이트로 수정한 뒤
npm run extension:zip
# 또는
CHARICON_WEB_ORIGIN=https://your.domain.example npm run extension:zip
```

개발 중 감시:

```shell
npm run extension:watch
```

아이콘(16/32/48/128): 생성기 스타일 `글` PNG

```shell
npm run extension:icons
```

### 로드

**Chrome**

1. `chrome://extensions`
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램을 로드합니다" → `extension/dist` 선택

**Firefox**

1. `about:debugging#/runtime/this-firefox`
2. "임시 부가 기능 로드" → `extension/dist/manifest.json` 선택

### 확인

1. `npm run dev` 로 웹 실행
2. 우측 하단 Slack 도크 칩이 연결 상태를 표시
3. 브라우저에 Slack 로그인된 워크스페이스가 있으면 팀 선택 가능
4. 변환기: 등록된 글자는 Slack 실이미지, 미등록은 점선 로컬 미리보기
5. 생성기: 미등록 글자는 **Slack에 등록** 버튼으로 바로 추가

프로토콜 공유 코드: `shared/protocol.ts` · 확장 상세: `extension/README.md`

## 포함된 글꼴

- [조선궁서체](https://event.chosun.com/100/100font.html)
- [궁서체](https://github.com/googlefonts/batang)
- 궁서체 
