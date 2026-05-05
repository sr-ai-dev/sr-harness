# 설계 변경 전파 규칙

설계 결정이나 핵심 데이터 구조를 변경할 때, 관련된 모든 레이어를 함께 갱신해야 한다. 한 곳만 고치고 다른 곳을 방치하면 sr-harness의 specify/blueprint/execute 파이프라인이 어긋난다.

## 검색 대상 레이어 (sr-harness 본체 기준)

| 레이어 | 경로 | 설명 |
|--------|------|------|
| CLI 스키마 | `cli/schemas/` | plan.json / requirements 등 JSON Schema |
| CLI 소스 | `cli/src/` | sr-harness-cli 명령 구현 (req/plan/learning/issue/session) |
| CLI 테스트 | `cli/tests/` | `node --test` 기반 테스트 |
| 에이전트 | `agents/*.md` | Subagent 프롬프트 (interviewer, tech-extractor, …) |
| 스킬 | `skills/*/SKILL.md` | 사용자 진입점 (specify, blueprint, execute, …) |
| 스킬 자원 | `skills/*/templates/`, `skills/*/agents/` | 스킬 내장 템플릿/서브에이전트 |
| 훅 스크립트 | `scripts/*.sh`, `scripts/*.py` | 라이프사이클 훅 |
| 훅 등록 | `.claude/settings.json`, `hooks/hooks.json` | 훅 매처/명령 등록 |
| 플러그인 메타 | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | 버전/메타데이터 |
| 문서 | `CLAUDE.md`, `README.md`, `README.{ko,zh,ja}.md`, `docs/harness/*.md` | 사용자/개발자 문서 |

## 전파 트리거와 체크리스트

### 트리거 1 — plan.json / requirements 스키마 변경
1. `cli/schemas/` 갱신
2. `cli/src/` 명령 구현 갱신 (req/plan/validate)
3. `cli/tests/` 테스트 추가/수정
4. `cli/package.json` 버전 범프 (sr 시리즈)
5. `agents/{contract-deriver,taskgraph-planner,verify-planner,worker}.md` 등 plan.json을 읽는 에이전트 프롬프트 갱신
6. `skills/{specify,blueprint,execute}/SKILL.md` 사용 예시 갱신
7. `CLAUDE.md` Recent Changes + CLI Reference 갱신

### 트리거 2 — 새 훅 스크립트 추가
1. `scripts/<hook>.sh` 작성 + `chmod +x`
2. `hooks/hooks.json`에 등록 (플러그인 레벨, `${CLAUDE_PLUGIN_ROOT}/scripts/...`)
3. `.claude/settings.json`에 등록 (프로젝트 레벨, `.claude/scripts/...`)
4. `CLAUDE.md`의 Active Hooks 표에 추가
5. (선택) 관련 스킬 SKILL.md에서 훅 동작 문서화

> 셋 중 하나라도 누락되면 훅이 발화하지 않거나 이중 발화한다. 본 규칙의 대표 위반 사례.

### 트리거 3 — 스킬 추가/이름 변경
1. `skills/<skill>/SKILL.md` 작성
2. `.claude-plugin/marketplace.json`의 skill 목록 동기화
3. `README.md`(영문) + 번역본 3개 (`README.ko.md`, `README.zh.md`, `README.ja.md`) 갱신
4. 관련 슬래시 커맨드 또는 에이전트 description 동기화
5. `CLAUDE.md` Recent Changes 항목 추가

### 트리거 4 — 에이전트 프롬프트 변경
1. `agents/<agent>.md` 갱신
2. 해당 에이전트를 dispatch하는 스킬(`skills/*/SKILL.md`) 호출부 갱신
3. validate_prompt 변경 시 출력 검증 케이스 재확인

### 트리거 5 — 플러그인/CLI 버전 범프 (릴리즈)
1. `.claude-plugin/plugin.json`
2. `.claude-plugin/marketplace.json`
3. `cli/package.json`
4. `CLAUDE.md` Recent Changes 섹션
5. `README.md` + 번역본 (필요 시)
6. `cd cli && npm run build && npm publish`
7. main 브랜치 머지 + 태그 + GitHub Release

> CLAUDE.md의 "Pre-Release Checklist"와 "Release Flow" 섹션이 정식 절차. 본 규칙은 그 의존성 그래프를 사람이 빠르게 훑기 위한 목록이다.

## 작업 진행 시 자기 점검

설계 변경을 시작하기 전에 아래를 묻는다:

- [ ] 이 변경은 위 5개 트리거 중 어디에 해당하는가?
- [ ] 해당 트리거의 체크리스트 항목을 모두 갱신하는가?
- [ ] 빠뜨린 레이어가 있는가? (`/sr-harness:check` 또는 `grep`으로 확인)
- [ ] 번역본 README가 영문과 어긋나지 않는가?

3개 이상 항목이 한 번에 영향받는다면 `docs/plans/<topic>/design.md`로 변경 범위를 먼저 문서화한다.
