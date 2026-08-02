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
npm run extension:install   # 최초 1회
npm run extension:build     # → extension/dist
```

개발 중 감시:

```shell
npm run extension:watch
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
2. 상단 배지가 **확장 연결됨** 이면 연결 성공
3. 브라우저에 Slack 로그인된 워크스페이스가 있으면 팀 드롭다운 표시 (↻ 새로고침)
4. 변환기: 등록된 글자는 Slack 실이미지, 미등록은 점선 로컬 미리보기
5. 생성기: 미등록 글자는 **Slack에 등록** 버튼으로 바로 추가

프로토콜 공유 코드: `shared/protocol.ts`

## 포함된 글꼴

- [조선궁서체](https://event.chosun.com/100/100font.html)
- [궁서체](https://github.com/googlefonts/batang)
- 궁서체 
