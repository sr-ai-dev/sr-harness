# 에이전트 동작 오버라이드 (템플릿)

신규 도메인/스택 도입 시 `.claude/rules/agent-overrides.md`를 갱신할 때 참고할 템플릿.

## 프로젝트 정보
- 프로젝트: <name>
- 언어: <languages>
- 빌드: `<build command>`
- 패키지 매니저: <npm | pnpm | uv | pip | …>
- 핵심 의존성: <list>

## coder 에이전트 추가 규칙
- <언어/프레임워크 코딩 컨벤션 1줄 요약>
- <빌드 후처리 필요 여부>
- <CLI/스크립트 호출 시 인자 전달 주의사항>
- <커밋 메시지 컨벤션 — 글로벌 규칙과 다를 때만 명시>

## reviewer 에이전트 추가 규칙
- <정적 분석 도구 (lint/typecheck) 명령>
- <스키마/타입 정합성 검증 포인트>
- <문서 동기화 검증 포인트 (README 번역본 등)>

## tester 에이전트 추가 규칙
- 테스트 프레임워크: <vitest | jest | pytest | node:test | …>
- 테스트 실행: `<command>`
- 테스트 파일 위치: `<glob>`
- <격리 전략, fixture 정책>

## architect 에이전트 추가 규칙
- 설계 문서 경로: `docs/plans/<topic>/`
- 설계 문서 표준: `docs/plans/_templates/design-document-standard.md` 9-section
- <도메인 특화 아키텍처 패턴>
- <전파 비용 산정 시 참조할 design-change-propagation.md 트리거>
