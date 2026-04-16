# 하네스 엔지니어링 조사 보고서

> 조사일: 2026-04-13
> 목적: hoyeon과 유사한 AI 에이전트 오케스트레이션/하네스 접근법 현황 파악

---

## 1. 용어 정의 및 계층 구조

### 1-1. 3단계 계층 (업계 컨센서스, 2026)

```
Harness Engineering  ← 가장 넓은 범위
  └─ Context Engineering  ← 컨텍스트 창 동적 조립
       └─ Prompt Engineering  ← 단일 쿼리 최적화
```

### 1-2. 핵심 정의

| 용어 | 정의 | 명명자 |
|------|------|--------|
| **Harness Engineering** | AI 모델을 감싸는 실행 환경 전체 — 도구 오케스트레이션, 상태 관리, 검증 루프, 스킬 시스템, 메모리, 승인 게이트 — 를 설계하는 공학 분야 | Mitchell Hashimoto / OpenAI (2025) |
| **Context Engineering** | 전체 컨텍스트 창의 내용을 동적으로 조립하는 시스템 설계 | Andrej Karpathy (2023-2025) |
| **Prompt Engineering** | 단일 쿼리에 대한 프롬프트 최적화 | 업계 공통 (2020-2023) |

> "Agent = Model + Harness" — Martin Fowler

### 1-3. 주요 출처별 정의

**Martin Fowler** ([martinfowler.com/articles/harness-engineering.html](https://martinfowler.com/articles/harness-engineering.html)):
- Guides(사전 제어)와 Sensors(사후 제어)로 구분
- Computational(결정론적, ms 단위) vs. Inferential(AI 판단, 고비용) 두 가지 실행 유형
- Maintainability / Architecture / Behaviour 3개 regulation category

**Anthropic 공식** ([anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)):
- 6대 핵심 컴포넌트: Human-in-the-loop 제어, 파일시스템 접근 관리, 툴 호출 오케스트레이션, 서브에이전트 조율, 프롬프트 프리셋 관리, 라이프사이클 훅

**OpenAI** ([openai.com/index/harness-engineering/](https://openai.com/index/harness-engineering/)):
- "에이전트가 실수를 하면, 그 실수를 다시는 하지 않도록 해결책을 엔지니어링하라"

**HumanLayer** ([humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)):
- 6개 설정 레버: CLAUDE.md/AGENTS.md, MCP Servers, Skills, Sub-Agents, Hooks, Back-Pressure Mechanisms

---

## 2. 유사 프레임워크 비교

### 2-1. 기능 매트릭스

| 프레임워크 | 플랫폼 | Spec-Driven | 스킬 시스템 | 멀티에이전트 | Gate 승인 | 자율 루프 | 메모리 |
|-----------|--------|:-----------:|:----------:|:----------:|:---------:|:--------:|:-----:|
| **hoyeon** | Claude Code | ✅ spec.json | ✅ | ✅ | ✅ | ✅ ralph | ✅ |
| **oh-my-openagent** | OpenCode+CC | 부분적 | ✅ | ✅ | ❌ | ✅ | ❌ |
| **wshobson/agents** | Claude Code | ❌ | ✅ 149개 | ✅ 182개 | ❌ | ❌ | ❌ |
| **GitHub Spec Kit** | 에이전트 독립 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Spec-Kitty** | 멀티에이전트 | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **revfactory/harness** | Claude Code | ❌ | ✅ 메타스킬 | ✅ 6패턴 | ❌ | ❌ | ❌ |
| **AWS Kiro** | 독립 IDE | ✅ EARS | ❌ | ❌ | ✅ 네이티브 | ❌ | ❌ |
| **barkain/workflow** | Claude Code | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

### 2-2. 개별 프레임워크 상세

#### oh-my-openagent (가장 유사)

- **GitHub**: [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
- OpenCode용 플러그인이지만 Claude Code 호환 레이어 제공
- **핵심 컴포넌트**:
  - Sisyphus: 메인 오케스트레이터 (Opus 4.6 / Kimi K2.5 라우팅)
  - Hephaestus: 자율 실행 심층 워커
  - Prometheus: 실행 전 인터뷰 모드 전략 플래너
  - Hashline Edit System: content hash 기반 편집 충돌 방지
  - IntentGate: 실행 전 의도 분석
  - Ralph Loop: Todo Enforcer 내장 자율 반복 루프
- **멀티모델 라우팅**: category 기반 위임 (visual-engineering, deep, quick, ultrabrain)
- **설계 철학**: 벤더 종속 거부, opinionated defaults

#### wshobson/agents (최대 규모)

- **GitHub**: [wshobson/agents](https://github.com/wshobson/agents)
- 77개 플러그인, 182개 에이전트, 149개 스킬, 96개 커맨드
- **4-tier 모델 라우팅**:
  - Tier 1 (Opus): 아키텍처, 보안 리뷰, 프로덕션 코딩 (42개)
  - Tier 2 (Flexible): 사용자 선택 (42개)
  - Tier 3 (Sonnet): 문서화, 테스팅, 디버깅 (51개)
  - Tier 4 (Haiku): SEO, 배포, 검색 (18개)
- **PluginEval**: Static analysis + LLM judge + Monte Carlo simulation 3중 품질 평가
- **Progressive Skill Activation**: 메타데이터(항상) → 지침(활성화 시) → 리소스(온디맨드)

#### GitHub Spec Kit

- **GitHub**: [github/spec-kit](https://github.com/github/spec-kit)
- 워크플로우: Specify → Plan → Tasks → Implement
- CLI 커맨드: `/specify`, `/plan`, `/tasks`
- 호환: GitHub Copilot, Claude Code, Gemini CLI
- 원칙: "stable 'what'과 flexible 'how' 분리"

#### AWS Kiro

- **URL**: [kiro.dev](https://kiro.dev)
- SDD를 IDE 레벨에서 네이티브 구현
- EARS 표기법: `When [condition], the system shall [action]`
- Agent hooks 및 autonomous agent 지원
- GA: 2025년 11월

#### revfactory/harness

- **GitHub**: [revfactory/harness](https://github.com/revfactory/harness)
- "메타-스킬" — 도메인 특화 에이전트 팀 설계 프레임워크
- 6가지 아키텍처 패턴: Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, Hierarchical Delegation

#### Spec-Kitty

- **GitHub**: [Priivacy-ai/spec-kitty](https://github.com/Priivacy-ai/spec-kitty)
- spec → plan → tasks → agent loop → review → merge 파이프라인
- live Kanban 대시보드로 실시간 에이전트 작업 추적

---

## 3. AI IDE별 하네스 레이어 비교

### 3-1. 커스터마이제이션 스택 비교

| IDE/도구 | 설정 파일 | 스킬/커맨드 | 메모리 | 훅 | 멀티에이전트 |
|---------|---------|-----------|--------|----|-----------| 
| **Claude Code** | CLAUDE.md, AGENTS.md | Skills (SKILL.md) | memory/ 디렉토리 | Hooks (lifecycle) | SubAgents |
| **Cursor** | .cursor/rules/*.mdc | — | Memories (자동) | — | Agent Mode |
| **Windsurf** | .windsurfrules | Workflows | Memories (자동/수동) | — | Cascade |
| **Aider** | CONVENTIONS.md | — | — | — | — |
| **GitHub Copilot** | copilot-instructions.md | VS Code 확장 | — | — | — |
| **OpenCode** | AGENTS.md | Skills | — | Hooks | SubAgents |

### 3-2. Claude Code 아키텍처 4계층

| 계층 | 기술 | 역할 | 로딩 타이밍 |
|------|------|------|------------|
| L1: 컨텍스트 메모리 | CLAUDE.md | 정적 지식, 컨벤션, 아키텍처 결정 | 세션 시작 시 항상 |
| L2: 재사용 가능 절차 | Skills (SKILL.md) | 반복 워크플로우, 체크리스트 | 호출 시에만 (lazy load) |
| L3: 이벤트 반응 | Hooks | 라이프사이클 자동화 | 이벤트 발생 시 |
| L4: 외부 연결 | MCP Servers | API/도구 통합 | 요청 시 (deferred schema) |

> 핵심 설계 철학: CLAUDE.md는 "사실"(facts)이고, Skills는 "절차"(procedures)다.

### 3-3. AGENTS.md 통합 표준

Google, OpenAI, Factory, Sourcegraph, Cursor가 공동 발의한 오픈 표준. 도구별 분산된 지시 파일을 단일 표준으로 통합하려는 시도.

| 도구 | 현재 지시 파일 |
|------|--------------|
| Claude Code | CLAUDE.md |
| Cursor | .cursor/rules/*.mdc |
| Windsurf | .windsurf/rules/ |
| GitHub Copilot | .github/copilot-instructions.md |
| Cline | .clinerules |
| OpenAI Codex | AGENTS.md |
| Aider | CONVENTIONS.md |

> README.md가 인간 개발자를 위한 문서라면, AGENTS.md는 코딩 에이전트를 위한 운영 지시서.

---

## 4. 핵심 설계 패턴

### 4-1. Spec-Driven Development (SDD)

"vibe coding"의 한계가 명확해지면서 부상한 2025년의 지배적 패턴.

**표준 파일 삼각형** (모든 SDD 구현체에서 공통):

```
requirements.md  ← 무엇을(What) + 왜(Why). 사용자 스토리, 수용 기준
design.md        ← 어떻게(How). 아키텍처, 컴포넌트, 데이터 모델
tasks.md         ← 작업 분해. 순차/병렬 실행 태스크 체크리스트
```

**Gate 패턴** (SDD의 핵심 제어 메커니즘):

```
Specify → [Gate A: 명세 승인] → Plan → [Gate B: 설계 승인] → Tasks → [Gate C: 구현 승인] → Implement
```

채택 도구: GitHub Spec Kit, AWS Kiro, hoyeon, ThoughtWorks 기술 레이더 등재.

> ⚠️ "스펙 드리프트와 환각은 본질적으로 피하기 어렵다. 여전히 고도로 결정론적인 CI/CD 관행이 필요하다." — ThoughtWorks

### 4-2. Progressive Skill Disclosure

컨텍스트 창 팽창 방지를 위해 필요할 때만 로드하는 3단계 패턴:

```
메타데이터 (항상 로드)  →  지침 (활성화 시)  →  리소스 (온디맨드)
```

wshobson/agents의 3단계, oh-my-openagent의 on-demand MCP 스코핑이 동일한 원칙 적용.

### 4-3. Context Firewalls (서브에이전트 격리)

- 서브에이전트 = 독립 컨텍스트 창에서 이산 태스크 실행
- "Context rot" 방지 — 긴 세션에서 초기 지침이 퇴색하는 현상 차단
- 2026년 추가: Worktree isolation으로 병렬 에이전트 동시 편집 충돌 방지

### 4-4. Ralph Wiggum 자율 루프

- **원본**: [ghuntley/how-to-ralph-wiggum](https://github.com/ghuntley/how-to-ralph-wiggum)
- Claude Code Stop hook으로 exit code 2 차단 → 원본 프롬프트 재주입 → 자기교정 루프
- Anthropic 공식 플러그인으로 흡수
- 6개 이상의 독립적 커뮤니티 구현체 존재

### 4-5. Verification Pipeline (Back-Pressure)

Martin Fowler의 분류:

| 유형 | 특성 | 예시 |
|------|------|------|
| **Computational Sensors** | 결정론적, ms 단위 | 타입체커, 린터, 테스트 |
| **Inferential Sensors** | AI 판단, 고비용 | LLM-as-judge 코드 리뷰 |

> Anthropic 연구: feature list JSON이 Markdown보다 모델 변조에 강함.

### 4-6. 멀티에이전트 표준 패턴

가장 많이 인용되는 계층 구조:

```
Planner Agent     → 코드베이스 탐색, 태스크 생성
    ↓
Worker Agent(s)   → 태스크 실행 (병렬 가능)
    ↓
Judge Agent       → 사이클 종료 시 계속/중단 판단
```

---

## 5. 멀티에이전트 오케스트레이션 프레임워크

| 프레임워크 | 핵심 패턴 | 최적 사용 사례 | 현재 상태 |
|-----------|---------|-------------|----------|
| **LangGraph** | 상태 기반 그래프 (DAG + 사이클) | 복잡한 조건 분기, 상태 관리 | v1.0 stable (2025.10) |
| **CrewAI** | 역할 기반 팀 오케스트레이션 | 명확한 R&R의 에이전트 협업 | 초보자 친화적 |
| **AutoGen/AG2** | 대화형 멀티에이전트 | 코드 실행 포함 에이전트 대화 | v0.4 이벤트 드리브 재설계 |
| **MetaGPT** | 소프트웨어 개발 워크플로우 | 설계문서→코드 프로토타입 | 사전 정의 역할 (기획/개발/리뷰) |
| **OpenHands** | CodeAct + 이벤트스트림 | 실제 코딩 태스크 자동화 | SWE-Bench 77.6% |

**수렴 트렌드**: LangGraph가 그래프 기반 오케스트레이션을 개척 → CrewAI·AutoGen 등이 그래프/워크플로우 모델 채택.

---

## 6. 핵심 인사이트

### 6-1. "모델은 상품, 하네스가 해자(moat)"

| 사례 | 증거 |
|------|------|
| Manus | 동일 모델 유지, 하네스 5회 재작성 → 신뢰성 대폭 향상 |
| LangChain Deep Research | 모델 변경 없이 4회 아키텍처 재설계 |
| Vercel | 툴 80% 제거 → 더 나은 결과 |

### 6-2. 실용 규칙 (Spotify 엔지니어링 검증)

- Claude Code는 단계별 지시보다 **최종 상태 설명(end-state description)**에서 더 나은 성능
- 전제 조건 명시 — 에이전트가 **행동하지 말아야** 하는 조건 포함
- 구체적 코드 예시 > 자연어 설명
- 도구 접근을 의도적으로 제한하면 예측가능성 향상

### 6-3. 컨텍스트 관리 안티패턴

| 안티패턴 | 설명 |
|---------|------|
| Black Box Memory | 검사/diff/버전 관리 불가능한 임베딩 = 통제력 상실 |
| 오래된 컨텍스트 파일 | 3개월 누적 노트 = 노이즈. 150줄 이내 현재 상태만 기술 |
| 과도한 MCP 연결 | 도구가 많을수록 예측 불가능성 증가 |

### 6-4. Skills 설명 최적화 (200+ 실험 기반)

| 접근법 | 자동 활성화 성공률 |
|--------|:----------------:|
| 최적화 없음 | 20% |
| 단순 설명 추가 | 20% |
| 최적화된 설명 | 50% |
| LLM pre-eval 훅 | 80% |
| Forced eval 훅 | 84% |

효과적인 설명 템플릿:
```
[핵심 기능 설명]. Use when [조건 1], [조건 2], or [조건 3].
Handles [구체적 키워드 5개 이상]. [파일 타입이나 도메인 명시].
```

골든 룰: 설명은 반드시 **3인칭**으로 작성. "I can help" 패턴이 자동 발견을 방해.

---

## 7. 학술 논문

| 논문 | 핵심 내용 |
|------|---------|
| Natural-Language Agent Harnesses (arXiv:2603.25723) | 프롬프트와 LLM 호출을 프로그래밍 가능한 객체로 취급 |
| AutoHarness (arXiv:2603.03329) | Gemini로 code harness 자동 합성, 금지 행동 제어 |
| Building AI Coding Agents for the Terminal (arXiv:2603.05344) | 6단계 ReAct, Dual-Memory, 5중 Defense-in-Depth |
| Meta-Harness (2603.28052) | Harness code 자체를 outer-loop로 최적화 |
| ALMAS (arXiv:2510.03463) | 다중 에이전트 소프트웨어 엔지니어링 프레임워크 |

---

## 8. 커뮤니티 리소스

### 8-1. 큐레이션 저장소

| 저장소 | 내용 |
|--------|------|
| [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Skills, Hooks, Orchestrators, Plugins 카테고리 |
| [claude-code-plugins-plus-skills](https://github.com/jeremylongshore/claude-code-plugins-plus-skills) | 340 플러그인 + 1367 에이전트 스킬 |
| [awesome-claude-plugins](https://github.com/ComposioHQ/awesome-claude-plugins) | Composio 연동 플러그인 |
| [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) | 200+ 구성 파일 |
| [cascade-customizations-catalog](https://github.com/Windsurf-Samples/cascade-customizations-catalog) | Windsurf 공식 카탈로그 |
| [claude-skills](https://github.com/alirezarezvani/claude-skills) | 232+ 스킬 (8개 에이전트 호환) |

### 8-2. 주요 블로그/아티클

| 제목 | URL |
|------|-----|
| Anthropic: Effective Harnesses for Long-Running Agents | [anthropic.com/engineering/...](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) |
| Martin Fowler: Harness Engineering | [martinfowler.com/articles/...](https://martinfowler.com/articles/harness-engineering.html) |
| HumanLayer: Skill Issue | [humanlayer.dev/blog/...](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents) |
| Spotify: Context Engineering for Coding Agents | [engineering.atspotify.com/...](https://engineering.atspotify.com/2025/11/context-engineering-background-coding-agents-part-2/) |
| 2026 is Agent Harnesses (Aakash Gupta) | [medium.com/...](https://aakashgupta.medium.com/2025-was-agents-2026-is-agent-harnesses-heres-why-that-changes-everything-073e9877655e) |
| WaveSpeed: Claude Code Agent Harness Architecture | [wavespeed.ai/blog/...](https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/) |
| Claude Code Full Stack 설명 | [alexop.dev/posts/...](https://alexop.dev/posts/understanding-claude-code-full-stack/) |
| Skills 최적화 가이드 | [gist.github.com/mellanon/...](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d) |
| GitHub: Spec-Driven Development with AI | [github.blog/...](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) |
| Addy Osmani: LLM Coding Workflow 2026 | [addyosmani.com/blog/...](https://addyosmani.com/blog/ai-coding-workflow/) |

---

## 9. hoyeon 포지셔닝 분석

### 9-1. 차별화 요소

hoyeon의 **독보적 조합**: spec.json SSoT + Gate 승인 워크플로우 + Ralph 자율 루프. 이 세 가지가 결합된 오픈소스 프레임워크는 현재 다른 곳에 존재하지 않음.

### 9-2. 비교 위치

```
                    Spec-Driven ───────────────────▶
                    │
                    │  GitHub Spec Kit     AWS Kiro
                    │       ●                 ●
                    │
 Multi-Agent        │              hoyeon
 Orchestration      │                ★
                    │
                    │  oh-my-openagent    revfactory/harness
                    │       ●                 ●
                    │
                    │         wshobson/agents
                    │              ●
                    ▼
```

### 9-3. 개선 기회

| 영역 | 타 프레임워크 강점 | hoyeon 현황 | 기회 |
|------|------------------|------------|------|
| 모델 라우팅 | wshobson: 4-tier, oh-my-openagent: category 기반 | 스킬별 model 필드 | 자동 라우팅 레이어 |
| 스킬 수량 | wshobson: 149개, alirezarezvani: 232개 | 소규모 내부 | 커뮤니티 기여 구조 |
| IDE 독립성 | GitHub Spec Kit: 에이전트 독립 | Claude Code 전용 | AGENTS.md 표준 호환 |
| 편집 충돌 방지 | oh-my-openagent: Hashline Edit | worktree isolation | 보완적 접근 가능 |

---

## 10. 결론 및 시사점

1. **하네스 엔지니어링은 2026년의 핵심 경쟁 우위**다. 모델 성능이 상향 평준화되면서 "모델은 상품, 하네스가 해자"로 패러다임 전환.

2. **Spec-Driven Development 3파일 패턴이 사실상 표준**이 되었다. GitHub, AWS, ThoughtWorks 모두 동일 패턴 수렴.

3. **AGENTS.md 통합 표준**이 부상 중이다. 멀티 도구 환경에서 단일 지시 파일 유지의 이점이 크며, 모니터링 필요.

4. **"Less is more" 원칙**이 반복 검증됨. Spotify(도구 제한), Vercel(80% 제거), Anthropic(단일 피처 순차 처리) 모두 동일한 결론.

5. **hoyeon의 spec.json + Gate + Ralph 조합**은 현재 유일한 구현이며, Digital PM Agent의 기반 설계에 직접 활용 가능.
