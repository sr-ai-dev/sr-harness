# 설치 후 구성 점검 + 플러그인 아키텍처 이해

> 작성일: 2026-04-12
> 목적: hoyeon 설치 후 전체 스킬/에이전트 인벤토리 점검, 플러그인 시스템 아키텍처 이해, 추가 정리 결정

---

## 1. 플러그인 시스템 아키텍처

### 1.1 team-attention 3개 레포의 관계

team-attention GitHub 조직에는 3개 레포가 있다. **서로 독립 제품**이며, 스킬/에이전트를 공유하지 않는다.

```
team-attention/
├── hoyeon                         ← 설치한 것. 요구사항 중심 개발 자동화 플러그인
│   28 skills + 21 agents + CLI + Hooks
│
├── harness                        ← 미설치. AI-ready 프로젝트 환경 준비 도구
│   check-harness, scaffold, specify (별개 버전)
│
└── plugins-for-claude-natives     ← 미설치. 범용 플러그인 모음 (13+)
    multi-agent consensus, dev-scan 등 독립 플러그인
```

**핵심**: 현재 설치된 것은 `team-attention/hoyeon` 하나뿐이다. 나머지 두 레포는 관련 없다.

### 1.2 설치 과정: 무엇을 어디서 어디로

#### Step 1: 마켓플레이스 등록

`settings.json`에 GitHub 레포를 마켓플레이스로 등록한다:

```json
"extraKnownMarketplaces": {
  "team-attention-dev": {
    "source": { "source": "github", "repo": "team-attention/hoyeon" }
  }
}
```

이 설정은 Claude Code에게 "team-attention/hoyeon GitHub 레포를 플러그인 목록(마켓플레이스)으로 인식하라"고 알려준다.

#### Step 2: GitHub → 로컬 2곳에 복사

```
GitHub: team-attention/hoyeon (commit c631634)
         │
         ├──→ ~/.claude/plugins/marketplaces/team-attention-dev/
         │    마켓플레이스 전체 클론 (플러그인 목록 조회용)
         │
         └──→ ~/.claude/plugins/cache/team-attention-dev/hoyeon/1.5.4/
              실제 사용되는 플러그인 (동일한 내용의 복사본)
```

두 디렉토리의 내용은 동일하다. 같은 GitHub 레포의 같은 커밋을 2곳에 저장한 것이다.

#### Step 3: 플러그인 활성화

```json
"enabledPlugins": {
  "hoyeon@syscon-robotics-dev": true
}
```

### 1.3 플러그인 내부 구조

캐시에 저장된 내용은 GitHub 레포의 클론이다:

```
~/.claude/plugins/cache/team-attention-dev/hoyeon/1.5.4/
├── .claude-plugin/
│   ├── plugin.json          ← 플러그인 메타 (이름, 버전, 설명)
│   └── marketplace.json     ← 마켓플레이스 등록 정보
├── skills/                  ← 28개 스킬 (각 디렉토리에 SKILL.md)
├── agents/                  ← 21개 에이전트 (각 .md 파일)
├── hooks/                   ← Hook 스크립트
├── cli/                     ← sr-harness-cli 소스
├── .claude/
│   ├── settings.json        ← Hook 등록 + 권한 정의
│   └── skill-rules.json     ← 스킬 규칙
└── README.md, CONTRIBUTING.md 등
```

### 1.3.1 plugin.json → 이름 → 경로 매핑

plugin.json은 **메타데이터**(이름, 버전, 설명)만 담고 있다. skills/와 agents/를 어떻게 로드할지 지시하는 내용은 **여기 없다**. Claude Code가 플러그인 디렉토리 안에서 `.claude/skills/`, `.claude/agents/`, `.claude/settings.json`을 **관례적으로 탐색**하는 것이다. 일반 프로젝트에서 `.claude/` 디렉토리를 스캔하는 것과 동일한 메커니즘이다.

plugin.json의 `name`이 결정하는 것은 **캐시 하위 폴더명**과 **스킬/에이전트의 네임스페이스 접두사**다.

모든 곳에서 `{plugin}@{marketplace}` 패턴으로 참조한다:

```
marketplace.json의 name:  "team-attention-dev"     ← 마켓플레이스 이름
plugin.json의 name:       "hoyeon"                  ← 플러그인 이름
plugin.json의 version:    "1.5.4"                   ← 버전
```

이 3가지가 캐시 경로를 결정한다:

```
~/.claude/plugins/cache / team-attention-dev / hoyeon / 1.5.4 /
                          ↑ marketplace name   ↑ plugin name  ↑ version
```

전체 식별 체계:

```
settings.json        →  enabledPlugins: { "hoyeon@syscon-robotics-dev": true }
installed_plugins    →  plugins: { "hoyeon@syscon-robotics-dev": [...] }
캐시 경로             →  cache/team-attention-dev/hoyeon/1.5.4/
스킬 접두사           →  hoyeon:specify, hoyeon:execute, hoyeon:bugfix ...
에이전트 접두사       →  hoyeon:worker, hoyeon:debugger, hoyeon:code-reviewer ...
```

전체 흐름:

```
① settings.json
   extraKnownMarketplaces:
     "team-attention-dev" → repo: "team-attention/hoyeon"
                                    │
② GitHub 클론               ←──────┘
   marketplace.json 읽기
     name: "team-attention-dev"     → 마켓플레이스 폴더명
     plugins[0].name: "hoyeon"      → 플러그인 폴더명
     plugins[0].version: "1.5.4"   → 버전 폴더명
                                    │
③ 캐시 저장                  ←──────┘
   cache/team-attention-dev/hoyeon/1.5.4/
                                    │
④ plugin.json 읽기           ←──────┘
   name: "hoyeon" → 스킬/에이전트 접두사 "hoyeon:" 결정
                                    │
⑤ .claude/ 관례 탐색          ←──────┘
   skills/specify/SKILL.md  → "hoyeon:specify" 로 등록
   agents/worker.md         → "hoyeon:worker" 로 등록
```

하나의 마켓플레이스에 여러 플러그인이 있을 수도 있다. marketplace.json의 `plugins` 배열이 그 구조인데, 현재는 hoyeon 하나만 들어 있다.

### 1.4 "로드"의 정확한 의미

스킬과 에이전트는 **2단계로 로드**된다:

#### 세션 시작 시: 이름만 등록 (Lazy Loading)

```
skills/ 스캔 → 각 SKILL.md에서 frontmatter(name + description)만 추출
  └── 시스템 프롬프트에 "사용 가능한 스킬 목록" 주입

agents/ 스캔 → 각 .md에서 frontmatter(name + description + model)만 추출
  └── 시스템 프롬프트에 "사용 가능한 에이전트 타입" 주입
```

시스템 프롬프트에 들어가는 형태 (실제 예시):

```
- hoyeon:specify: Turn a goal into an implementation plan (spec.json v1)...
- hoyeon:execute: Spec-driven orchestrator that reads spec.json...
- hoyeon:worker: Implementation worker agent... (Tools: All tools)
- hoyeon:debugger: Root cause analysis specialist... (Tools: All tools)
```

이름 + 한줄설명만 표시되므로, 42개 스킬이 등록되어 있어도 토큰 부담은 크지 않다.

#### 호출 시: 전문 로드

사용자가 `/specify`를 입력하면 → Skill 도구가 해당 SKILL.md **전문**을 읽어서 Claude에게 전달한다.

```
사용자: /specify
  → Claude Code: Skill 도구 실행
  → SKILL.md 전문을 프롬프트에 주입
  → Claude가 SKILL.md의 지시를 따라 동작
```

에이전트도 동일: `Agent(subagent_type="hoyeon:worker")` 호출 시 worker.md 전문을 서브에이전트 프롬프트에 주입.

#### 정리

| 시점 | 로드 범위 | 목적 |
|------|----------|------|
| 세션 시작 | name + description (한 줄) | Claude가 "어떤 스킬/에이전트를 쓸 수 있는지" 인지 |
| 호출 시 | .md 파일 전문 | Claude가 "어떻게 동작해야 하는지" 지시 수령 |

### 1.5 Skill vs Agent — 구조적 차이

둘 다 마크다운 파일이지만 **역할이 완전히 다르다**.

#### Skill = 지시서 (메인 Claude가 직접 따르는 절차)

```yaml
# SKILL.md frontmatter 예시
name: specify
description: |
  Turn a goal into an implementation plan (spec.json v1)...
allowed-tools:
  - Read, Grep, Bash, Write, AskUserQuestion
```

본문은 **절차 지시**다:

```markdown
# /specify — Spec Generator
## Core Rules
1. CLI is the writer — spec init, spec merge, spec validate
## Layer Flow
### L0: Goal → L1: Context → L2: Decisions → ...
```

**사용자가 `/specify`를 입력하면** → SKILL.md 전문이 **현재 대화의 Claude에게** 주입됨 → Claude가 그 지시를 따라 직접 동작.

#### Agent = 역할 정의 (별도 프로세스로 실행되는 서브에이전트)

```yaml
# agent .md frontmatter 예시
name: worker
model: opus                   ← 사용할 모델 지정 (스킬에는 없음)
color: green                  ← 표시 색상 (스킬에는 없음)
allowed-tools:
  - Read, Write, Edit, Bash
disallowed-tools:             ← 금지 도구 (스킬에는 없음)
  - Task
validate_prompt: |            ← 출력 검증 규칙 (스킬에는 없음)
  Must contain ...
```

본문은 **역할과 미션**이다:

```markdown
# Worker Agent
## Mission
Complete the delegated Task accurately and report learnings.
## Rules
...
```

**메인 Claude가 `Agent(subagent_type="hoyeon:worker")`를 호출하면** → agent .md 전문이 **새로운 별도 Claude 프로세스**의 시스템 프롬프트에 주입됨 → 서브에이전트가 독립적으로 동작 → 결과만 메인 Claude에게 반환.

#### 핵심 차이 정리

| | Skill | Agent |
|--|-------|-------|
| **파일** | `skills/<name>/SKILL.md` | `agents/<name>.md` |
| **실행 주체** | 메인 Claude (현재 대화) | 별도 서브에이전트 (새 프로세스) |
| **컨텍스트** | 현재 대화 히스토리 전체 공유 | 대화 히스토리 없음. 프롬프트에 적힌 것만 앎 |
| **호출 방식** | `Skill("specify")` 또는 `/specify` | `Agent(subagent_type="hoyeon:worker", prompt="...")` |
| **고유 필드** | — | `model`, `color`, `validate_prompt`, `disallowed-tools` |
| **비유** | 매뉴얼을 읽고 내가 직접 수행 | 동료에게 업무 위임 |

### 1.6 Skill이 Agent를 사용하는 방식

에이전트가 스킬을 직접 호출하는 것이 아니라, **스킬이 Claude에게 에이전트를 호출하라고 지시**한다. 오케스트레이션의 주체는 항상 스킬(=메인 Claude)이다.

`/bugfix` 스킬이 좋은 예시다:

```
/bugfix "에러 설명"                     ← 사용자가 스킬 호출

Phase 1: DIAGNOSE ──────────────────────────────────────
  ├── Agent(debugger, "이 에러 분석해")  ← 스킬이 에이전트 3개를 병렬 실행
  ├── Agent(verification-planner, ...)
  └── Agent(gap-analyzer, ...)
  → 3개 결과 수집 → 사용자에게 보고

Phase 2: SPEC GENERATION ──────────────────────────────
  → 메인 Claude가 직접 spec.json 생성 (에이전트 안 씀)

Phase 3: EXECUTE ──────────────────────────────────────
  → Skill("execute")                    ← 스킬이 다른 스킬을 호출
    → execute 스킬 안에서 Agent(worker, "T1 구현해") 실행

Phase 4-5: 결과 처리 + 보고 ────────────────────────────
```

이 예시에서 드러나는 관계:

- **스킬 → 에이전트**: 스킬(bugfix)이 에이전트(debugger, gap-analyzer, worker)를 호출
- **스킬 → 스킬**: 스킬(bugfix)이 다른 스킬(execute)을 호출
- **에이전트 → 스킬**: 없음. 에이전트는 위임받은 작업만 수행하고 결과를 반환

```
Skill (지시서)
  ├── 직접 동작 (파일 읽기, CLI 실행, spec.json 작성 등)
  ├── Agent 호출 (병렬 또는 순차)
  │   └── Agent는 독립 실행 후 결과만 반환
  └── 다른 Skill 호출 (체인)
      └── 그 Skill도 Agent를 호출할 수 있음
```

### 1.7 수정 가능성

플러그인의 스킬/에이전트는 컴파일된 바이너리가 아니라 **마크다운 파일**이므로, 캐시 경로의 SKILL.md를 직접 편집하면 즉시 반영된다.

**리스크**: 플러그인 업데이트 시 캐시가 덮어씌워진다 (`plugins/cache/` 경로이므로).

| 대응 방안 | 설명 |
|-----------|------|
| 버전 고정 | 자동 업데이트하지 않으면 변경 유지됨 |
| diff 보관 | 변경 내용을 별도 기록해두고 업데이트 후 재적용 |
| fork | 자체 레포로 fork 후 자체 marketplace로 등록하면 영구 해결 |

---

## 2. 스킬/에이전트 소싱 구조

### 2.1 글로벌 스킬의 출처

현재 `~/.claude/skills/`에 있는 14개 스킬은 **심볼릭 링크**로 연결되어 있다.

```
~/.claude/skills/brainstorming → ../../.agents/skills/brainstorming
~/.claude/skills/actionbook    → ../../.agents/skills/actionbook
~/.claude/skills/init-project  → ../../.agents/skills/init-project
(... 14개 모두 동일 패턴)
```

#### 소스 디렉토리: `~/.agents/skills/`

이전에 설치한 커뮤니티 스킬 팩(23개)의 원본이다. 이 중 **14개만** `~/.claude/skills/`로 심링크하여 활성화했고, 나머지 9개는 심링크하지 않았다 (비활성).

```
~/.agents/skills/ (원본, 23개)         ~/.claude/skills/ (활성, 14개)
─────────────────────────────         ─────────────────────────────
actionbook                    ───→    actionbook (symlink)
active-research               ───→    active-research (symlink)
brainstorming                 ───→    brainstorming (symlink)
development-workflow          ✗       (심링크 없음 — 비활성)
dispatching-parallel-agents   ───→    dispatching-parallel-agents (symlink)
executing-plans               ✗       (심링크 없음 — 비활성)
find-skills                   ───→    find-skills (symlink)
finishing-a-development-branch ──→    finishing-a-development-branch (symlink)
humanizer                     ───→    humanizer (symlink)
init-project                  ───→    init-project (symlink)
receiving-code-review         ───→    receiving-code-review (symlink)
requesting-code-review        ✗       (심링크 없음 — 비활성)
subagent-driven-development   ✗       (심링크 없음 — 비활성)
systematic-debugging          ✗       (심링크 없음 — 비활성)
test-driven-development       ───→    test-driven-development (symlink)
ui-ux-pro-max                 ───→    ui-ux-pro-max (symlink)
using-git-worktrees           ───→    using-git-worktrees (symlink)
using-superpowers             ───→    using-superpowers (symlink)
verification-before-completion ✗      (심링크 없음 — 비활성)
writing-plans                 ✗       (심링크 없음 — 비활성)
writing-skills                ───→    writing-skills (symlink)
                                      _removed_20260412/ (orchestrate 아카이브)
```

비활성 7개 + 아카이브 1개 = **이전 대화에서 결정한 "8개 제거"**.

### 2.2 프로젝트 스킬/에이전트

이 프로젝트(sr-mngt-ws) 전용으로 정의된 것들이다. `~/.claude/skills/`가 아닌 **프로젝트 디렉토리**에 있으므로 이 프로젝트에서만 활성화된다.

```
sr-mngt-ws/.claude/
├── skills/
│   ├── doc-brainstorming/SKILL.md    ← 문서 구조 설계 (9섹션)
│   ├── doc-writing-plans/SKILL.md    ← design.md → tasks.md 분해
│   └── doc-verification/SKILL.md     ← 5축 문서 QA
└── agents/
    ├── architect.md                   ← 편집 기획자 (구조 설계)
    ├── coder.md                       ← 작가 (콘텐츠 작성)
    ├── reviewer.md                    ← 편집자 (5축 리뷰)
    └── tester.md                      ← QA 검증자 (5축 검증)
```

### 2.3 hoyeon 플러그인 스킬/에이전트

`~/.claude/plugins/cache/`에서 **발견/등록**된다. user scope이므로 모든 프로젝트에서 활성화된다.

- **28개 스킬**: specify, execute, ultrawork, bugfix, ralph, tribunal 등
- **21개 에이전트**: worker, debugger, code-reviewer, gap-analyzer 등

다만 "로드"는 2단계다.

- **세션 시작 시**: 각 스킬/에이전트의 `name + description`만 등록된다. SKILL.md/agent 문서 전문이 전부 자동 주입되는 것은 아니다.
- **호출 시**: `/specify`, `/execute` 같은 슬래시 명령 또는 Skill/Agent 호출이 일어날 때 해당 문서 전문이 현재 세션 컨텍스트에 들어온다.
- **compact 후**: CLAUDE.md와 Rules는 재로드되지만, 이미 주입된 SKILL.md 전문은 요약 대상이다. 따라서 세부 절차 기억은 약해질 수 있다.
- **hoyeon의 보완 장치**: `session-compact-hook.sh`가 `~/.sr-harness/{session_id}/state.json`을 읽어 "어떤 스킬을 하던 중이었는지"와 상태 파일 경로를 다시 알려준다. 즉 워크플로우 복구는 가능하지만, 스킬 본문 전체가 무손실로 살아남는다고 보기는 어렵다.

실무적으로는 `/specify` 뒤에 compact가 일어나도 **이미 spec.json / design.md / requirements.md / tasks.md까지 저장된 뒤라면 손해가 크지 않다.** hoyeon이 `spec.json`을 compact와 handoff를 버티는 공유 메모리로 설계했기 때문이다. 반대로 **L2-L4 인터뷰/수정 루프 도중 compact가 나면**, 질문 맥락이나 세부 규칙 기억이 일부 옅어져 다음 단계의 정밀도가 조금 떨어질 수 있다.

### 2.4 현재 세션의 전체 로딩 상태

| 소스 | 경로 | 스코프 | 수량 |
|------|------|--------|------|
| 글로벌 스킬 | `~/.claude/skills/` (symlink → `~/.agents/skills/`) | 모든 프로젝트 | 14개 |
| 프로젝트 스킬 | `sr-mngt-ws/.claude/skills/` | 이 프로젝트만 | 3개 |
| hoyeon 스킬 | `~/.claude/plugins/cache/.../skills/` | 모든 프로젝트 | 28개 |
| **스킬 합계** | | | **45개** |
| 프로젝트 에이전트 | `sr-mngt-ws/.claude/agents/` | 이 프로젝트만 | 4개 |
| hoyeon 에이전트 | `~/.claude/plugins/cache/.../agents/` | 모든 프로젝트 | 21개 |
| 빌트인 에이전트 | Claude Code 내장 | 모든 프로젝트 | 5개 |
| **에이전트 합계** | | | **30개** |

---

## 3. 전체 인벤토리 + hoyeon 대응 분석

### 3.1 글로벌 스킬 (14개 활성)

| # | 스킬 | hoyeon 대응 | 핵심 차이 |
|---|------|------------|----------|
| 1 | brainstorming | /specify | 기존: 인터뷰→마크다운 설계문서. hoyeon: 레이어체인→spec.json |
| 2 | dispatching-parallel-agents | /execute Team + /quick-plan | 기존: 병렬 실행 가이드라인. hoyeon: claim-based 실제 디스패치 |
| 3 | find-skills | 없음 | 스킬 탐색 유틸리티 |
| 4 | finishing-a-development-branch | 없음 | 브랜치 완료 가이드 |
| 5 | humanizer | 없음 | AI 문체 제거 |
| 6 | init-project | /scaffold | 기존: CLAUDE.md+디렉토리 생성. hoyeon: 인터뷰 기반 풀 스캐폴딩 |
| 7 | receiving-code-review | /tribunal | 기존: 리뷰 피드백 수용 절차. hoyeon: 3관점 adversarial 리뷰 |
| 8 | test-driven-development | /execute TDD 모드 | 기존: TDD 절차 가이드. hoyeon: spec→test→impl 자동 파이프라인 |
| 9 | ui-ux-pro-max | ux-reviewer (부분) | 기존: 50스타일/21팔레트 포함 풀 UI/UX 도구. hoyeon: 리뷰만 |
| 10 | using-git-worktrees | /execute worktree | 기존: worktree 생성 가이드. hoyeon: 자동 isolation+cleanup |
| 11 | using-superpowers | 없음 | 메타 스킬 (스킬 탐색/사용법 안내) |
| 12 | writing-skills | 없음 | 스킬 작성 도우미 |
| 13 | actionbook (MCP) | /browser-work | 레이어 다름: MCP 서버 vs chromux CDP. 공존 가능 |
| 14 | active-research | 없음 | HTML 리포트 기반 딥 리서치 |

### 3.2 프로젝트 스킬 (3개)

| # | 스킬 | hoyeon 대응 | 판단 |
|---|------|------------|------|
| 15 | doc-brainstorming | /specify 체인 | spec.json→마크다운 렌더러로 재정의 가능 |
| 16 | doc-writing-plans | /specify L4 | 기존: design.md→tasks.md. hoyeon: decisions→requirements→tasks (fulfills[]) |
| 17 | doc-verification | /qa + /check | 기존: 문서 5축 QA. hoyeon: 코드 앱 중심. **문서 QA는 hoyeon에 없음** |

### 3.3 프로젝트 에이전트 (4개)

| # | 에이전트 | hoyeon 대응 | 판단 |
|---|---------|------------|------|
| 18 | architect (편집 기획자) | gap-analyzer + tradeoff-analyzer | 문서 구조 설계 전문성은 hoyeon에 없음 |
| 19 | coder (작가) | worker | 문서 작성(톤, 게이트 기준)은 hoyeon worker에 없음 |
| 20 | reviewer (편집자) | code-reviewer | 문서 5축 리뷰는 hoyeon에 없음 |
| 21 | tester (QA) | qa-verifier | 문서 5축 QA는 hoyeon에 없음 |

**프로젝트 에이전트 4개는 "문서 프로젝트" 전용으로 역할이 다르다.** hoyeon 에이전트는 코드 중심이므로 대체 불가.

---

## 4. 추가 정리 대상 결정

### 4.1 결정 매트릭스

Step 2(이전 대화)에서 8개를 제거했다. 이번 점검에서 추가 정리 대상 5개를 식별했다.

| # | 스킬 | 결정 | 근거 |
|---|------|------|------|
| 1 | dispatching-parallel-agents | **제거 후보** | hoyeon /execute Team이 실제 구현 제공. 가이드라인만 있는 기존 스킬 불필요 |
| 2 | test-driven-development | **제거 후보** | hoyeon /execute가 TDD 모드 내장 |
| 3 | using-git-worktrees | **제거 후보** | hoyeon /execute가 worktree isolation 내장 |
| 4 | receiving-code-review | **제거 후보** | hoyeon /tribunal이 3관점 adversarial로 더 체계적 |
| 5 | using-superpowers | **제거 후보** | hoyeon 환경에서 스킬이 자동 로드되므로 메타 가이드 불필요 |

### 4.2 유지 확정 (9개)

| # | 스킬 | 유지 이유 |
|---|------|----------|
| 1 | brainstorming | 역할 재정의 예정 (spec.json → 마크다운 렌더러) |
| 2 | init-project | /scaffold는 코드 프로젝트용. init-project는 CLAUDE.md+디렉토리 생성으로 범용 |
| 3 | ui-ux-pro-max | hoyeon ux-reviewer는 리뷰만. 디자인/빌드/팔레트 등 풀 도구 |
| 4 | actionbook (MCP) | MCP 서버로 레이어가 다름. browser-work와 공존 |
| 5 | find-skills | hoyeon에 대응 없음 |
| 6 | humanizer | hoyeon에 대응 없음 |
| 7 | writing-skills | hoyeon에 대응 없음 |
| 8 | active-research | hoyeon에 대응 없음 |
| 9 | finishing-a-development-branch | hoyeon에 대응 없음 |

### 4.3 프로젝트 스킬/에이전트 (7개 모두 유지)

문서 프로젝트 전용 역할이며 hoyeon에 대응하는 기능이 없으므로 전부 유지.

| 유형 | 이름 | 비고 |
|------|------|------|
| 스킬 | doc-brainstorming | 재정의 대상 (spec.json→마크다운 렌더러) |
| 스킬 | doc-writing-plans | 재정의 대상 (spec.json L4→tasks.md 렌더러) |
| 스킬 | doc-verification | 유지 (문서 5축 QA, hoyeon에 없음) |
| 에이전트 | architect | 유지 (문서 구조 설계) |
| 에이전트 | coder | 유지 (문서 작성) |
| 에이전트 | reviewer | 유지 (문서 리뷰) |
| 에이전트 | tester | 유지 (문서 QA) |

### 4.4 요약 수량

| 카테고리 | Step 2 이후 | 이번 추가 제거 | 최종 |
|----------|:-----------:|:-------------:|:----:|
| 글로벌 스킬 (활성) | 14개 | -5개 | 9개 |
| 프로젝트 스킬 | 3개 | 0 | 3개 |
| 프로젝트 에이전트 | 4개 | 0 | 4개 |
| hoyeon 스킬 | 28개 | 0 | 28개 |
| hoyeon 에이전트 | 21개 | 0 | 21개 |
| **총 스킬** | **45개** | **-5개** | **40개** |
| **총 에이전트** | **30개** | **0** | **30개** |

---

## 5. brainstorming 트리거 메커니즘 분석

### 5.1 현재 상태: 연결 고리 없음

| 스킬 | 트리거 방식 | 동작 | 종료 시점 |
|------|------------|------|----------|
| `/specify` | 명시적 호출 | L0→L1→L2→L3→L4 | spec.json 완성 후 종료 |
| `brainstorming` | 자동 감지 ("창작 작업 전 MUST use") | 인터뷰 → requirements.md + design.md | 문서 생성 후 종료 |

/specify가 끝나도 brainstorming을 호출하지 않고, brainstorming은 spec.json을 읽지 않는다.

### 5.2 "spec.json → 마크다운 렌더러" 구현 선택지

#### 선택지 A: 수동 호출

brainstorming SKILL.md를 재작성하여 spec.json을 읽고 마크다운을 생성하게 한다. 사용자가 `/brainstorming`을 명시적으로 호출해야 한다.

```
사용자: /specify "디지털 PM 에이전트"
  → L0→L1→L2→L3→L4 → spec.json 완성 → [종료]

사용자: /brainstorming                    ← 사용자가 직접 호출
  → spec.json 읽기 → requirements.md + design.md 생성 → [종료]
```

- 장점: 단순. 기존 스킬 재작성만 필요
- 단점: 매번 기억해서 호출해야 함

#### 선택지 B: /specify SKILL.md에 마크다운 생성 단계 추가

/specify의 L4 완료 후 마크다운 생성 단계를 SKILL.md에 직접 추가한다.

```
사용자: /specify "디지털 PM 에이전트"
  → L0→L1→L2→L3→L4 → spec.json 완성
  → [추가 단계] spec.json → requirements.md + design.md 생성 → [종료]
```

- 장점: 한 번 호출로 완결. 가장 자연스러운 흐름
- 단점: 플러그인 업데이트 시 수정 내용이 덮어씌워짐
- 대응: 버전 고정 / diff 보관 / fork

**수정 가능한 이유**: hoyeon 플러그인의 스킬은 마크다운 파일(SKILL.md)이다. `~/.claude/plugins/cache/.../skills/specify/SKILL.md`를 직접 편집하면 즉시 반영된다.

#### 선택지 C: CLAUDE.md 규칙으로 자동 체인

글로벌 CLAUDE.md에 절차 규칙을 추가하여, Claude가 /specify 완료 시 자동으로 brainstorming을 호출하게 한다.

```markdown
# 설계 문서 표준
/specify 완료 후 → brainstorming 자동 실행 (사용자 호출 불필요)
```

- 장점: 플러그인 파일을 수정하지 않음
- 단점: Claude의 지시 준수에 의존 (Hook처럼 강제가 아님)

#### 선택지 D: 보류 — hoyeon 학습 후 결정

/specify를 실제 사용해본 후 마크다운 문서 필요성과 최적 시점을 판단한다.

### 5.3 비교 표

| | A. 수동 호출 | B. specify 수정 | C. CLAUDE.md 규칙 | D. 보류 |
|--|:----------:|:-------------:|:----------------:|:------:|
| 즉시 구현 가능 | O | O | O | — |
| 자동 실행 | X | O | △ (지시 의존) | — |
| 업데이트 안전 | O | X (캐시 덮어쓰기) | O | — |
| 플러그인 수정 필요 | X | O | X | — |
| 스킬 재작성 필요 | O | X | X | — |

---

## 6. brainstorming 트리거 — 결정 완료

### 6.1 선택: B. specify SKILL.md 직접 수정

4개 선택지 중 **B (specify 직접 수정)**을 선택하고 구현 완료했다.

**선택 이유**: wrapper 스킬(A)로는 각 게이트(L2, L3, L4)에서 중간 문서 리뷰를 끼워넣을 수 없다. /specify가 끝난 후에야 동작하므로 중간 승인 루프가 불가능하다. 통합 흐름이 되려면 SKILL.md 자체를 수정해야 한다.

### 6.2 구현 내용

/specify의 각 게이트에 **문서 렌더링 + 문서 기반 리뷰** 단계를 삽입했다.

**수정된 흐름**:

```
L2 완료 → CLI validate
       → design.md 생성 (§1 시스템 개요, §2 아키텍처 초안, §6 핵심 설계 결정)
       → requirements.md 초안 생성 (배경/목표/비목표)
       → 사용자가 문서 리뷰 → 수정 요청 시 spec.json 수정 → 문서 재생성
       → [승인] → L3

L3 완료 → CLI validate
       → requirements.md 갱신 (요구사항 + GWT)
       → design.md 갱신 (§2 보강, §3 엔티티, §4 기능 상세)
       → 사용자가 문서 리뷰 → 수정 → spec.json 수정 → 문서 재생성
       → [승인] → L4

L4 완료 → CLI validate
       → tasks.md 생성 (DAG + 커버리지 매트릭스)
       → design.md 완성 (§5 시퀀스, §7 API, §8 테스트, §9 확장)
       → 사용자가 전체 문서 최종 리뷰
       → [승인] → /execute
```

**핵심 설계 결정**:

| 결정 | 내용 |
|------|------|
| 렌더링 ≠ 복사 | spec.json은 뼈대만 제공. 문서는 brainstorming 9섹션 표준으로 **생성** |
| ID 가시성 | 모든 문서에 D1, R1.1, T1 등 spec.json ID를 표시하여 역방향 매핑 |
| 수정 루프 | 사용자가 문서 지적 → spec.json --patch/--append → 문서 재생성 |
| 문서 위치 | `.sr-harness/specs/{name}/` (spec.json과 동일 디렉토리) |
| 9섹션 표준 | brainstorming 스킬의 작성 원칙 그대로 적용 (3관점 아키텍처, 실제 파일명, JSON 예시 등) |

### 6.3 수정된 파일

| 파일 | 변경 내용 | 추가 줄 수 |
|------|----------|:---------:|
| `SKILL.md` | Document Rendering Protocol 섹션 추가, User Approval Protocol 수정, Checklist 업데이트 | +70줄 |
| `references/L2-decisions.md` | L2 Gate 후 L2 Document Rendering 단계 추가 | +40줄 |
| `references/L3-requirements.md` | L3 Gate 후 L3 Document Rendering 단계 추가 | +55줄 |
| `references/L4-tasks.md` | L4 Gate 후 L4 Document Rendering 단계 추가 | +55줄 |

### 6.4 백업 및 patch 파일

플러그인 업데이트 시 복구를 위해 원본과 patch를 보관한다:

```
harness-research/patches/specify-doc-rendering/
├── SKILL.md.orig              ← 원본 백업
├── L0-L1-context.md.orig      ← 원본 (변경 없음)
├── L2-decisions.md.orig       ← 원본 백업
├── L3-requirements.md.orig    ← 원본 백업
├── L4-tasks.md.orig           ← 원본 백업
├── SKILL.md.patch             ← diff (127줄)
├── L2-decisions.md.patch      ← diff (51줄)
├── L3-requirements.md.patch   ← diff (70줄)
└── L4-tasks.md.patch          ← diff (70줄)
```

**복구 방법** (플러그인 업데이트 후):
```bash
cd ~/.claude/plugins/cache/team-attention-dev/hoyeon/{version}/skills/specify
patch -p0 < ~/dev-ws/.../patches/specify-doc-rendering/SKILL.md.patch
patch -p0 < ~/dev-ws/.../patches/specify-doc-rendering/L2-decisions.md.patch
# ... (각 파일)
```

---

## 7. 미결정 사항 (업데이트)

| # | 항목 | 이전 상태 | 현재 상태 |
|---|------|----------|----------|
| 1 | 추가 5개 스킬 제거 실행 | 미결정 | 미결정 (Step 4 이후) |
| 2 | brainstorming 트리거 방식 | 미결정 | **결정 완료: B (specify 직접 수정)** |
| 3 | doc-brainstorming 재정의 | 미결정 | 미결정 (문서 프로젝트 향후 별도 진행) |
| 4 | doc-writing-plans 재정의 | 미결정 | 미결정 (문서 프로젝트 향후 별도 진행) |

---

## 8. 글로벌 스킬 소싱 구조 (추가 발견)

### 8.1 글로벌 스킬은 플러그인이 아니다

`.skill-lock.json` 확인 결과, `~/.claude/skills/`의 14개 글로벌 스킬은 **플러그인 시스템이 아닌 개별 GitHub 레포에서 다운로드한 SKILL.md 파일**이다.

| 출처 레포 | 스킬 수 | 해당 스킬 |
|----------|:-------:|----------|
| **obra/superpowers** | 14개 | brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills |
| **blader/humanizer** | 1개 | humanizer |
| **nextlevelbuilder/ui-ux-pro-max-skill** | 1개 | ui-ux-pro-max |
| **vercel-labs/skills** | 1개 | find-skills |

actionbook과 active-research는 lock 파일에 없음 — 별도 경로로 수동 추가된 것으로 추정.

### 8.2 플러그인 vs 글로벌 스킬 — 설치 방식 비교

| | 글로벌 스킬 | hoyeon 플러그인 |
|--|-----------|---------------|
| **설치 방식** | GitHub에서 SKILL.md 파일 다운로드 | 플러그인 시스템 (`claude plugin install`) |
| **저장 위치** | `~/.agents/skills/` → `~/.claude/skills/` symlink | `~/.claude/plugins/cache/.../` |
| **출처 추적** | `.skill-lock.json` | `installed_plugins.json` |
| **접두사** | 없음 (이름 그대로) | `hoyeon:` |
| **포함 내용** | SKILL.md만 | skills + agents + hooks + CLI + settings |
| **버전 관리** | 수동 (hash 기록) | 자동 (version + gitCommitSha) |

---

## 9. 마이그레이션 실행 로그 업데이트

```
Step 1: 글로벌 CLAUDE.md 개편 ✅
Step 2: 기존 스킬 8개 제거 ✅
Step 3: hoyeon 플러그인 + CLI 설치 ✅
Step 3.5: 설치 후 구성 점검 ✅ (이 문서)
  - 플러그인 아키텍처 이해 완료
  - 추가 정리 대상 5개 식별
  - 글로벌 스킬 소싱 구조 파악 (obra/superpowers 등)
Step 3.6: specify 문서 렌더링 기능 추가 ✅
  - specify SKILL.md + 3개 reference 파일 수정
  - 각 게이트(L2/L3/L4)에 문서 생성 + 리뷰 단계 삽입
  - brainstorming 9섹션 표준 적용
  - 원본 백업 + patch 파일 보관
Step 4: 검증 + 학습 ⬚
Step 5: 문서 레이어 추가 (Phase 3) ⬚
```

---

## 참조 문서

| 문서 | 내용 |
|------|------|
| `01_priority1-comparison.md` | 핵심 워크플로우 비교 |
| `01-1_sr-harness-cli-role.md` | sr-harness-cli 역할 |
| `02_priority2-comparison.md` | 실행/검증 비교 |
| `03_priority3-comparison.md` | 보조 스킬 비교 + 종합 |
| `04_global-claude-md-draft.md` | 글로벌 CLAUDE.md 개편안 |
| `05_migration-execution-log.md` | 마이그레이션 실행 로그 |
| **06_post-install-config-review.md** | **이 문서 (설치 후 구성 점검 + specify 수정)** |
| `patches/specify-doc-rendering/` | specify 수정 원본 + patch 파일 |
