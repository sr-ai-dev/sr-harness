# 에이전트 동작 오버라이드

## 프로젝트 정보
- 프로젝트: sr-harness (Claude Code 플러그인 + hoyeon-cli)
- 언어: Node.js (ESM, JavaScript), Bash, Python (보조 스크립트), Markdown (스킬/에이전트 정의)
- 빌드: `cd cli && npm run build` (esbuild 단일 번들 → `cli/dist/cli.js`)
- 패키지 매니저: npm (lockfile 기준)
- 핵심 의존성: `ajv`, `ajv-formats` (JSON Schema 검증), `esbuild` (dev)

## coder 에이전트 추가 규칙
- CLI 변경 시 작업 후 반드시 `cd cli && npm run build` 실행하여 `dist/cli.js` 갱신
- ESM 사용 (`"type": "module"`) — `require` 금지, `import` 사용
- JSON 페이로드를 CLI에 전달할 때는 zsh glob 회피를 위해 파일 기반 전달 사용:
  ```bash
  cat > /tmp/spec-merge.json << 'EOF'
  { ... }
  EOF
  hoyeon-cli plan merge <spec_dir> --json "$(cat /tmp/spec-merge.json)"
  ```
- 훅 스크립트는 `chmod +x` 처리 + 3곳(`hooks/hooks.json`, `.claude/settings.json`, `CLAUDE.md` Active Hooks 표) 모두 등록 (design-change-propagation.md 트리거 2 참조)
- 한국어 커밋 메시지 작성, Co-Authored-By 라인 포함하지 않음 (글로벌 CLAUDE.md 규칙)

## reviewer 에이전트 추가 규칙
- JSON Schema 변경 시 `cli/schemas/`와 `cli/src/` 검증 로직 정합성 확인
- 스킬/에이전트 변경 시 SKILL.md/agent.md frontmatter 필드(name, description, validate_prompt 등) 누락 여부 확인
- 영문 README와 번역본(`README.{ko,zh,ja}.md`) 정합성 확인
- 새 슬래시 커맨드/스킬 추가 시 `.claude-plugin/marketplace.json` 동기화 확인

## tester 에이전트 추가 규칙
- 테스트 프레임워크: 내장 `node --test` (Node 20+)
- 테스트 실행: `cd cli && npm test`
- 테스트 파일 위치: `cli/tests/*.test.mjs`
- 테스트 작성 시 `node:test`/`node:assert` 사용 (외부 러너 금지)
- 훅/스크립트 동작 검증은 `hoyeon-cli session get/set` 또는 `.playground/` 임시 spec_dir로 진행

## architect 에이전트 추가 규칙
- 설계 문서 경로: `docs/plans/<topic>/` (kebab-case 토픽)
- 설계 문서 표준은 `docs/plans/_templates/design-document-standard.md` 9-section 구조 준수
- 파이프라인 v2 구조 유지: `/specify` (requirements.md) → `/blueprint` (plan.json + contracts.md + design.md) → `/execute` (worker dispatch)
- spec.json 시대(v1) 산출물 신규 생성 금지 — requirements.md + plan.json이 SSoT
- 새 스킬/에이전트 도입 결정은 design-change-propagation.md 트리거 3·4에 따른 전파 비용을 함께 산정
