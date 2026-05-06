# Project Guidelines

## Experimentation

Use `.playground/` directory for experiments and testing. This directory is git-ignored.

## Agent/Skill Development

### validate_prompt

To automatically validate agent/skill output, add a `validate_prompt` field to the frontmatter.

**Agent example** (`.claude/agents/my-agent.md`):
```yaml
---
name: my-agent
description: My custom agent
validate_prompt: |
  Must contain X, Y, Z sections.
  Output should be in JSON format.
---
```

**Skill example** (`.claude/skills/my-skill/SKILL.md`):
```yaml
---
name: my-skill
description: My custom skill
validate_prompt: |
  Must produce valid output.
---
```

**How it works:**
1. `PostToolUse` hook detects Task/Skill completion
2. Extracts `subagent_type` or `skill` name from tool input
3. Finds agent/skill file and parses `validate_prompt` from frontmatter
4. Outputs validation reminder to Claude

### Implementation Files

- `.claude/scripts/validate-output.sh` - PostToolUse validation hook
- `.claude/settings.json` - registers PostToolUse hook for Task|Skill

## Hook System

Hooks are registered in `.claude/settings.json` and automate pipeline transitions and quality enforcement.

### Hook Types

| Type | When it fires | Use case |
|------|--------------|----------|
| `SessionStart` | Session begins | Initialize session-level state |
| `UserPromptSubmit` | User submits a prompt | Initialize state, intercept slash commands |
| `PreToolUse` | Before a tool executes | Block or modify tool calls |
| `PostToolUse` | After a tool completes | Validate output, trigger follow-up |
| `PostToolUseFailure` | After a tool fails | Error recovery, failure tracking |
| `Stop` | Session ends | Transition to next pipeline stage |

### Active Hooks

| Script | Type | Purpose |
|--------|------|---------|
| `cli-version-sync.sh` | SessionStart | Auto-sync sr-harness-cli npm version with plugin version |
| `session-compact-hook.sh` | SessionStart | Unified compact recovery — outputs skill name + state.json path |
| `ultrawork-init-hook.sh` | UserPromptSubmit | Initialize ultrawork pipeline state when `/ultrawork` is typed |
| `skill-session-init.sh` | UserPromptSubmit + PreToolUse[Skill] | Initialize session state for specify/execute/blueprint skills |
| `rv-detector.sh` | UserPromptSubmit | Detect `!rv` keyword to trigger re-validation loop |
| `rulph-init.sh` | PreToolUse[Skill] | Initialize rulph loop state on skill invocation |
| `skill-session-guard.sh` | PreToolUse[Edit\|Write] | Plan guard (specify) / orchestrator guard (execute) |
| `ralph-dod-guard.sh` | PreToolUse[Edit\|Write] | Enforce DoD before allowing writes in /ralph loop |
| `validate-output.sh` | PostToolUse[Task\|Skill] | Validate agent/skill output against `validate_prompt` frontmatter |
| `tool-output-truncator.sh` | PostToolUse[Grep\|Glob\|WebFetch\|Bash] | Truncate oversized tool output (50K/10K limits, stderr preserved) |
| `edit-error-recovery.sh` | PostToolUseFailure[Edit\|Write] | Detect Edit failures and inject recovery guidance (5 error patterns) |
| `large-file-recovery.sh` | PostToolUseFailure[Read] | Detect large/binary file Read failures, suggest chunked read, agent delegation, or Grep |
| `tool-failure-tracker.sh` | PostToolUseFailure[*] | Track repeated failures per tool, escalate at 3/5 failures in 60s window |
| `ultrawork-stop-hook.sh` | Stop | Advance ultrawork pipeline on session stop |
| `skill-session-stop.sh` | Stop | Block exit if execute has incomplete tasks (circuit breaker: 30 iter) |
| `rv-validator.sh` | Stop | Run re-validation pass on stop |
| `rulph-stop.sh` | Stop | Handle rulph loop termination |
| `ralph-stop.sh` | Stop | Ralph loop DoD verification + prompt re-injection |
| `skill-session-cleanup.sh` | SessionEnd | Clean up session dir (`rm -rf ~/.sr-harness/{session_id}/`) |

### Hook Development Notes

- Hook scripts live in `.claude/scripts/` (symlink to `scripts/`) and must be executable (`chmod +x`)
- **When adding a new hook script, you MUST update all three:**
  1. `hooks/hooks.json` — plugin-level registration (uses `${CLAUDE_PLUGIN_ROOT}/scripts/...`)
  2. `.claude/settings.json` — project-level registration (uses `.claude/scripts/...`)
  3. `CLAUDE.md` — add entry to the Active Hooks table above
- A hook script that is not registered in settings will **not fire** — creating the file alone is not enough
- Run `sr-harness-cli session get --sid <id>` to verify session state after changes
- Hook behavior gotchas are documented in commit history and session learnings

## Git Branching & Release

- **`main`** — release only. Do not commit directly.
- **`develop`** — integration branch. Feature branches merge here.
- **Feature branches** — `feat/xxx` from `develop`, merge back to `develop` via `--no-ff`.

### Pre-Release Checklist

- [ ] All content must be written in English (SKILL.md, agent .md, CLAUDE.md, README.md, commit messages, comments)
- [ ] When `README.md` is updated, sync all translations: `README.ko.md`, `README.zh.md`, `README.ja.md`

### Release Flow

```
1. All features merged to develop
2. Version bump commit on develop (plugin.json + marketplace.json + cli/package.json)
3. Update CLAUDE.md (Recent Changes) and README.md (if new skills/agents added)
4. cd cli && npm run build && npm publish --access public
5. git checkout main && git merge develop --no-ff -m "Release X.Y.Z"
6. git tag vX.Y.Z && git push origin main --tags && git push origin develop
7. gh release create vX.Y.Z --title "vX.Y.Z" --notes "## What's New in X.Y.Z ..."
```

## Versioning

- Plugin version is in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `cli/package.json`
- **Bump all three files** in a single commit on `develop` before merging to `main`
- CLI version (`@syscon-robotics/sr-harness-cli`) is always synced with plugin version

## Recent Changes (v1.6.0-sr.10)

- fix(hooks): `.sr-harness/` → `.sr-harness/` path 마이그레이션 잔재 정리 (4파일) — sr.9 핫픽스
  - `scripts/skill-session-guard.sh` — guard allowlist에 `.sr-harness/` 추가, deny 메시지 업데이트. **specify/execute 진행 중 spec_dir(`.sr-harness/specs/`)에 대한 Write/Edit 차단 버그 해결**. legacy `.sr-harness/` 도 backward-compat로 계속 허용.
  - `scripts/ultrawork-init-hook.sh` — `$CWD/.sr-harness/state.local.json` 으로 이동 + 기존 `.sr-harness/state.local.json` 자동 마이그레이션 fallback 추가
  - `scripts/ultrawork-stop-hook.sh` — STATE_FILE/SPECS_ROOT를 `.sr-harness/`로 변경, `.sr-harness/` fallback 유지
  - `cli/src/commands/session.js` — help 예시 주석을 `.sr-harness/specs/foo`로 갱신 (CLI 재빌드 완료, dist/cli.js 갱신)
  - `scripts/spec-verify-docs.sh` — 예시 주석 갱신 + v1 legacy helper임을 명시
  - **검증**: 시뮬레이션 hook input 3건(allow `.sr-harness/`, allow legacy `.sr-harness/`, deny `cli/src/`)으로 동작 확인. cli 테스트 12/12 pass.
- 코드 변경 외 항목 없음 — 패치 릴리즈 (sr.9 사용자에게 hook 버그 fix 전달이 목적)

## Previous Changes (v1.6.0-sr.9)

- chore(upstream): upstream 1.6.1-prep 부분 동기화 (체리픽 2건 + 1건 스킵)
  - `93737e7` refactor(blueprint): ask-only-when-owned — 승인 게이트 3개(Phase 2.3/4.3/5.2) 축소, coverage gate가 task-graph 정합성 강제, 5.2는 informational 요약(`--no-summary`로 skip)
  - `ef0ac59` feat(qa,execute): evidence_dir 배선 + verifier 모델 업그레이드 (worker는 제외)
    - qa-verifier에 `evidence_dir` 인자 추가 (없으면 `.qa-reports/verify-evidence/` default)
    - execute verify가 `{spec_dir}/verify-evidence`를 주입 — per-spec 증거가 spec 디렉토리 아래 적재
    - **모델 업그레이드 (sonnet→opus)**: qa-verifier, taskgraph-planner, verify-planner
    - **모델 다운그레이드 (opus→sonnet) 제외**: agents/worker.md (sr-harness 정책상 보류 — `docs/plans/worker-model-policy/notes.md` 참조)
  - upstream `5f8154a` (1.6.1 버전 범프) 스킵 — sr.x 라인 진행
- docs(harness): 분석 자료 4건
  - `docs/harness/14_skills-improvement-rollup.md` — `12_specify-pipeline-review` 결과를 27개 스킬 전체에 mapping
  - `docs/harness/16_state-management-pattern.md` — Cold Scan vs Warm State Lookup 일반론 (Smart Router/spec_inbox 패턴 토큰/시간 절감 관점)
  - `docs/harness/15_specify-redesign-living-spec.md` §0.5에 16_ cross-reference 1줄
  - `docs/harness/18_superpowers-coexistence.md` — obra superpowers ↔ sr-harness 공존 설정 종합 문서화 (격리 8개 / 활성 14개 / using-superpowers 커스터마이즈 / 트리거 분리 룰 / 신규 스킬 추가 결정 트리 / 롤백 절차)
- docs(plans): `worker-model-policy/notes.md` 신설 — worker model_class 정책 검토 노트(보류). sr_profile→model_class propagation 옵션, 영향 범위, 강제성 옵션, 다음 실험 설계 정리
- chore(standards): 프로젝트 표준 추가
  - `.claude/rules/agent-overrides.md`: sr-harness 본체용 coder/reviewer/tester/architect 추가 규칙
  - `.claude/rules/design-change-propagation.md`: 5가지 트리거(스키마/훅/스킬/에이전트/릴리즈) 별 전파 체크리스트
  - `docs/plans/_templates/`: init-project skill 표준 템플릿 5종
- docs(meta): `AGENTS.md` 추가 — OpenAI Codex CLI 등 'AGENTS.md' 호환 도구용 alias 가이드 (sr.2 시점 CLAUDE.md 베이스, 후속 동기화 필요)

## Previous Changes (v1.6.0-sr.8)

- docs(specify): `15_specify-redesign-living-spec.md` §0.5 신설 — sr.7 구현 현황 분리
  - vision(§1+) vs reality(§0.5) 명시적 분리: `/specify init/expand/reflect` 등 sub-command는 미구현, M1+에 도입 예정
  - sr.7에서 항상 적용되는 변경(Default-First / 단일 audit / Smart Router) vs opt-in 플래그(`--quick`/`--strict`/`-context`) 구분 표
  - 호출 패턴 동작 매트릭스 (sr.6 vs sr.7 / `--quick` / `--strict` / `-context`)
  - vision 섹션과의 매핑 (구현 / 부분 / 미구현)
  - 사용자 가이드 — 의도별 호출 형태
- 코드 변경 없음 (문서 패치 릴리즈)

## Previous Changes (v1.6.0-sr.7)

- feat(specify): Living Spec M-Lite — UX 4건 (v1.6.0-sr.7)
  - **`--quick` 플래그**: Phase 1을 노드당 max 2 질문으로 cap, inline drill 비활성, gap-auditor 단일 호출, final audit skip. 토큰/시간 50% 이상 단축 추정.
  - **`-context @file` 플래그**: 사전 정리 문서를 Mirror + Phase 1 default 답변 소스로 주입. context-bundle.md 작성, qa-log.md frontmatter에 `source: from-context-doc` + `lineage: <file>:<lines>` 기록.
  - **바 `/specify` Smart Router**: 인자 없는 호출 시 spec_dir/spec_inbox 상태 기반 자동 라우팅 (init/resume/status/reflect 추천). `--strict` 옵션은 legacy multi-loop 회로차단기 유지.
  - **Default-First Question Construction**: Phase 1 질문 작성 가이드에 "Recall → Recognition + Verification" 패턴 추가. 4-way 옵션 (Confirm/Modify/Skip/Other) + 출처 표기 `[from <file>:<lines>]`. context-bundle / Phase 0.5 research / KB / WHERE / engineering default 우선순위.
  - **Gap-auditor 단일 호출 default**: 축당 1회 audit, CONTINUE 시 자동으로 AMBIGUOUS → Open Items 승격. legacy multi-loop은 `--strict` opt-in.
- docs: `15_specify-redesign-living-spec.md` (신규) — Living Spec System 전체 재설계 비전 (M1-M6 마이그레이션, spec.json SSoT, spec_inbox, SpecQuery API, Smart Router, Context-First Ingestion). 본 sr.7은 그중 M-Lite phase 구현.

## Previous Changes (v1.6.0-sr.4)

- feat(specify): 파이프라인 후속 보강 6건 (v1.6.0-sr.4)
  - Step 0.3: 재실행 시 type rerun 검증 (N-12)
  - Phase 0.5 KB-first lookup: 모듈별 → batched MISMATCH AskUserQuestion (N-7)
  - Phase 1: Late SR Profile Surface — mid-interview에 sr_profile 갱신 시 Step D 재실행 + Tech axis gap-auditor 일찍 dispatch (N-6)
  - Phase 4.1: Data sources 3-bullet 명시 (cross-check.md / reqs-*.md / qa-log non_goals) (N-5)
  - Phase 4.2: 결정 발생 시 qa-log Resolutions에 1줄 append + Resume rule 4-step 명시 (N-4 lightweight)
  - Step 4.4: Open Items → Open Decisions promotion 매핑 명시 (N-9)
  - templates/qa-log.md: Open Items promotion 코멘트 + Resolutions 섹션 anchor 추가
- feat(specify): 파이프라인 추가 보강 7건 (v1.6.0-sr.3)
  - agents/interaction-extractor.md: 축 코드 R-I → R-U 통일 (specify/blueprint 동기화)
  - agents/gap-auditor.md: depth 판정 기준을 specify와 동일한 질문 수 + drill 의무 표로 동기화
  - SKILL.md Step 0.1: sr_modules 추출 토큰→정규화명 매핑 표 추가
  - SKILL.md Phase 2/3: cross-check.md 2-section 구조 (Dedup Log + Cross-Check Report) 고정
  - SKILL.md Step 0.3: Resume mismatch check + 3-옵션 AskUserQuestion 게이트
  - SKILL.md 상단: Path Conventions 섹션 (baseDir / spec_dir 정의)
  - templates/qa-log.md: SR 필드 5개 + research_done + audit_counts 기본값
- docs: 12_specify-pipeline-review.md
  - 기존 C-1~M-5 (10건) 각 섹션에 (해결됨) 헤더 + "현재 동작" 1줄 요약
  - "## v1.6.0-sr.3 추가 보강" 섹션 (N-1~N-7 + 영향 매트릭스)
  - "## v1.6.0-sr.4 후속 보강" 섹션 (N-12, N-7, N-6, N-5, N-4, N-9 + Reject/Defer + 영향 매트릭스)
- docs: 13_sr-profile-reference.md (신규) — sr_profile 종합 레퍼런스 (값/감지/저장/파이프라인 영향/예시)

## Previous Changes (v1.6.0-sr.2)

- feat(knowledge): full Knowledge System integration into specify/execute/bugfix pipeline
  - knowledge/SKILL.md — section-name anchors, re-scan learning preservation, regex DOTALL pitfall warning, schema validation, commit_sha/source.path semantics, de-dup policy, cross-product schema, --compact option
  - specify/SKILL.md — Phase 0.5 KB-first lookup (commit_sha match → skip agent scan), partial-load agent prompt guidance, Step 4.5 KB Save
  - execute/SKILL.md — Generic Rule #9 (worker appends learning to KB on task completion)
  - bugfix/SKILL.md — Step 5.1b (Error Handling table + Accumulated Learnings)
- feat(scripts): kb-compact.py helper — moves oldest half of Accumulated Learnings to Archived Learnings (threshold/keep-ratio/dry-run options, line-based heading match)
- chore(.gitignore): add .sr-harness/ (machine-bound KB runtime data)
- docs: 12_specify-pipeline-review.md — post-implementation review of v1.6.0-sr.1 pipeline (Critical 2 / High 3 / Medium 5, all resolved)
- docs: 09_specify-customization-design.md — SoT pointer header (current implementation lives in SKILL.md files)

## Previous Changes (v1.6.0-sr.1)

- feat(specify): SR Context Detection integrated into Step 0.1 Mirror — keyword-based auto-detection of sr_product/sr_modules/sr_ros_version/sr_profile without dropdown prompts
- feat(specify): SR Profile depth calibration (Step 0.4D) — driver/ros-node/cross-product profiles adjust research axis weights
- feat(specify): tech-extractor boundary pattern injection per sr_profile (Phase 2 system prompt)
- feat(blueprint): Phase 4.5 Design Document Generation — 9-section design.md produced after plan approval (§1 시스템개요…§9 확장포인트), with SR Profile section overrides
- feat(spec-review): v2 pipeline sync — requirements.md direct Edit, plan.json via sr-harness-cli plan merge, design.md/contracts.md direct Edit with cascading sync rules
- feat(knowledge): description update — Phase 0.5 Context Research integration, brownfield qa-log.md sr_modules pattern

## Previous Changes (v1.6.0)

### CLI Rename (sr-harness-cli2 → sr-harness-cli)
- **BREAKING**: npm package renamed `@syscon-robotics/sr-harness-cli2` → `@syscon-robotics/sr-harness-cli` (v1 slot reclaimed now that v1 CLI is retired)
- Directory: `cli2/` → `cli/`, binary: `sr-harness-cli2` → `sr-harness-cli`
- Users must `npm uninstall -g @syscon-robotics/sr-harness-cli2 && npm install -g @syscon-robotics/sr-harness-cli` (or rely on SessionStart `cli-version-sync.sh`)
- Fixed long-standing broken refs in `.github/workflows/ci.yml`, `publish.yml`, and `scripts/pre-commit-cli-build.sh` that pointed at `cli/` while directory was `cli2/`
- Fixed `sr-harness-cli plan status` stale command references in agents and docs → correct form is `sr-harness-cli plan task <spec_dir> --status <id>=<state>`

### Pipeline v2 Migration
- **BREAKING**: Removed old specify (v1), execute (v1), quick-plan skills and sr-harness-cli (v1)
- **Renamed**: specify2 → specify, execute2 → execute (clean names)
- New pipeline: `/specify` (requirements.md) → `/blueprint` (plan.json + contracts.md) → `/execute` (dispatch workers)
- New CLI: `sr-harness-cli` with groups: req, plan, learning, issue, session
- Rewired `/bugfix` from spec.json → requirements.md pipeline
- Updated all hooks, agents, and downstream skills for v2
- Codebase reconnaissance added to `/blueprint` (Phase 0.5, non-greenfield)
- Preview gates added to `/specify` (requirements preview) and `/blueprint` (task graph + verify plan)
- Inline planning fallback in `/execute` when no blueprint exists

### Execute (plan-driven orchestrator)
- 3-axis config: dispatch (direct/agent/team) × work (worktree/branch/no-commit) × verify (light/standard/thorough)
- 6 dispatch/verify reference recipes: direct.md, agent.md, team.md, worker-charter.md, verify.md, contracts-patch.md
- Pre-work gate, inline planning fallback, resume behavior with idempotent done-skip

### CLI (`sr-harness-cli`)
- `req init` — requirements.md scaffolding
- `plan init/merge/get/list/task/validate` — plan.json operations
- `learning` — structured learnings to context/learnings.json
- `issue` — structured issues to context/issues.json
- `session set/get` — session state management

## CLI Reference (sr-harness-cli)

| Group | Command | Description |
|-------|---------|-------------|
| `req` | `sr-harness-cli req init <spec_dir> --type <type> [--goal "..."]` | Create spec_dir + requirements.md template |
| `plan` | `sr-harness-cli plan init <spec_dir> --type <type>` | Create empty plan.json stub |
| `plan` | `sr-harness-cli plan merge <spec_dir> --json '<payload>' [--patch\|--append]` | Merge payload into plan.json |
| `plan` | `sr-harness-cli plan get <spec_dir> --path <dotted.path>` | Read field by dot notation |
| `plan` | `sr-harness-cli plan list <spec_dir> [--status <state>] [--json]` | List tasks with optional filter |
| `plan` | `sr-harness-cli plan task <spec_dir> --status <id>=<state>` | Update task status (monotonic done-lock) |
| `plan` | `sr-harness-cli plan validate <spec_dir>` | Schema + cross-ref integrity check |
| `learning` | `sr-harness-cli learning --task <id> --json '{...}' <spec_dir>` | Add learning to context/learnings.json |
| `issue` | `sr-harness-cli issue --task <id> --json '{...}' <spec_dir>` | Add issue to context/issues.json |
| `session` | `sr-harness-cli session set --sid <id> [--key k --value v] [--json '{...}']` | Update session state |
| `session` | `sr-harness-cli session get --sid <id>` | Read session state |

**Key conventions:**
- **File-based JSON passing** — write JSON to `/tmp/spec-merge.json` via heredoc (`<< 'EOF'`), pass via `--json "$(cat /tmp/spec-merge.json)"`. Never pass JSON directly as CLI argument (zsh glob expansion corrupts `[`, `{`, `$`)
- **One merge per section** — call `plan merge` once per top-level key
- **`--append` for arrays** — use when adding to existing arrays
- **`--patch` for nested updates** — use when updating specific items within arrays
- **`--stdin` for subagents** — learning and issue commands support `--stdin` to read JSON from stdin

**Learning & Issue examples:**
```bash
sr-harness-cli learning --task T1 --stdin <spec_dir> << 'EOF'
{"problem": "...", "cause": "...", "rule": "...", "tags": [...]}
EOF

sr-harness-cli issue --task T1 --stdin <spec_dir> << 'EOF'
{"type": "failed_approach|out_of_scope|blocker", "description": "..."}
EOF
```

## Testing Strategy

See [VERIFICATION.md](VERIFICATION.md) for the 4-Tier Testing Model (Unit → Integration → E2E → Agent Sandbox). Verification agents use this as their framework.

## Lessons Learned

Hook/tool behavior gotchas are documented in commit history and session learnings.
