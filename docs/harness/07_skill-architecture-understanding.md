# 스킬/에이전트 아키텍처 이해 — LLM 프롬프트 제어 관점

> 작성일: 2026-04-13
> 목적: Claude Code의 스킬/에이전트/Rules/CLAUDE.md가 LLM을 어떻게 제어하는지 이해. 범용 LLM 프롬프트와의 관계 및 크로스-LLM 이식성 분석

---

## 1. 용어 정의: System Prompt와 시스템 레벨 제어

### 1.1 System Prompt란

LLM API를 호출할 때 3가지 역할의 메시지가 있다:

```python
# OpenAI/Claude API 공통 구조
response = client.chat.completions.create(
    messages=[
        {"role": "system",    "content": "당신은 한국어로 답변하는 PM 전문가입니다."},
        {"role": "user",      "content": "프로젝트 일정이 지연되면 어떻게 해야 하나요?"},
        {"role": "assistant", "content": "지연 원인을 분석하고..."}
    ]
)
```

| 역할 | 누가 작성 | LLM이 보는 방식 | 사용자에게 보이는가 |
|------|----------|----------------|:------------------:|
| **system** | 개발자/플랫폼 | "나는 이런 존재이고, 이런 규칙을 따라야 한다" | ✗ |
| **user** | 사용자 | "이 사람이 나에게 요청한 것" | ✓ |
| **assistant** | LLM 자신 | "내가 이전에 답변한 것" | ✓ |

**System Prompt = `role: system`으로 전달되는 메시지**. LLM에게 "너는 누구이고, 어떻게 행동해야 하는지"를 정의한다. 사용자는 이 내용을 보지 못한다.

#### Claude Code에서 실제로 일어나는 일

사용자가 Claude Code를 시작하면, 사용자가 보기 전에 이미 다음이 LLM에 전달된다:

```
사용자가 보는 것:           실제 LLM에게 전달되는 것:
─────────────────          ─────────────────────────
                           [system] You are Claude Code, Anthropic's
                                    official CLI for Claude...
                                    (수천 줄의 내장 시스템 프롬프트)

                           [system] # CLAUDE.md
                                    한국어로 소통, Git 커밋 한글...
                                    (글로벌 + 프로젝트 CLAUDE.md)

                           [system] # Rules
                                    FW 파일 편집 시 동기화 전파...
                                    (해당되는 Rules만)

> "프로젝트 일정 관리      [user]  "프로젝트 일정 관리 방법 알려줘"
   방법 알려줘"
```

사용자는 자기 메시지만 입력했지만, LLM은 이미 수천 줄의 지시를 받은 상태에서 답변한다.

### 1.2 "시스템 레벨에서 제어한다"란

"시스템 레벨"은 **LLM 자체가 아니라, LLM을 감싸고 있는 런타임(Claude Code)이 제어한다**는 뜻이다.

#### 프롬프트 레벨 제어 vs 시스템 레벨 제어

| 제어 방식 | 구현 | 강제력 |
|----------|------|:------:|
| 프롬프트: "파일을 수정하지 마세요" | system 메시지에 텍스트로 전달 | △ LLM 준수도에 의존 |
| 시스템: `disallowed-tools: [Write, Edit]` | Claude Code 런타임이 도구 호출을 차단 | **◎ 물리적으로 불가능** |
| 프롬프트: "결과에 Root Cause를 포함하세요" | system 메시지에 텍스트로 전달 | △ LLM 준수도에 의존 |
| 시스템: `validate_prompt: "Must contain Root Cause"` | Claude Code 런타임이 출력을 검사, 미충족 시 거부 | **◎ 자동 검증** |
| 프롬프트: "매일 9시에 실행하세요" | 불가능 (LLM은 시간 개념 없음) | ✗ |
| 시스템: Hook (SessionStart → 스크립트 실행) | Claude Code 런타임이 이벤트 감지 후 실행 | **◎ LLM 관여 없이 실행** |

#### 시각적 구조

```
┌─────────────────────────────────────┐
│  Claude Code 런타임 (시스템 레벨)      │
│                                     │
│  ┌─ 도구 게이트 ──────────────────┐   │
│  │ allowed: [Read, Grep, Bash]   │   │ ← LLM이 Write 호출해도 여기서 차단
│  │ denied:  [Write, Edit]        │   │
│  └───────────────────────────────┘   │
│                                     │
│  ┌─ 출력 검증 ──────────────────┐    │
│  │ validate_prompt 체크          │    │ ← LLM 출력이 기준 미달이면 거부
│  └───────────────────────────────┘   │
│                                     │
│  ┌─ Hook 엔진 ──────────────────┐    │
│  │ PostToolUse → validate.sh    │    │ ← LLM 관여 없이 스크립트 실행
│  └───────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐     │
│  │  LLM (Claude)               │     │
│  │                             │     │
│  │  [system] CLAUDE.md + Rules │     │ ← 프롬프트 레벨 (부탁)
│  │  [system] SKILL.md          │     │
│  │  [user] 사용자 메시지         │     │
│  │                             │     │
│  │  → 응답 생성                  │     │
│  └─────────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

**CLAUDE.md, Rules, Skill 내용** = LLM에게 "이렇게 해달라"고 **부탁**하는 것 (프롬프트 레벨)

**allowed-tools, validate_prompt, Hook** = LLM과 무관하게 Claude Code 런타임이 **강제**하는 것 (시스템 레벨)

둘 다 사용되지만, 시스템 레벨 제어가 있기 때문에 프롬프트만으로는 불가능한 보장이 가능해진다.

---

## 2. 핵심 통찰: 모든 것은 프롬프트 주입이다

Claude Code의 CLAUDE.md, Rules, Skills, Agents는 **범용 LLM의 System Prompt 하나를 역할·시점·범위별로 분리한 것**이다. 본질은 모두 "프롬프트 주입"이지만, **언제 로드되고, 얼마나 오래 유지되며, 물리적으로 무엇을 할 수 있는지**를 프롬프트 레벨과 시스템 레벨 양쪽에서 제어한다.

### 2.1 세션 시작 시 프롬프트 구성

```
Claude Code 세션 시작
  │
  ├── System Prompt (Claude Code 내장)      ← Anthropic이 작성, 변경 불가
  │   "You are Claude Code..."
  │   "Use tools to assist the user..."
  │
  ├── CLAUDE.md                             ← 항상 로드됨
  │   글로벌 ~/.claude/CLAUDE.md
  │   프로젝트 ./CLAUDE.md
  │
  ├── Rules (.claude/rules/*.md)            ← 조건부 로드됨
  │
  ├── Agent 정의 (.md)                      ← 서브에이전트 생성 시 로드됨
  │
  ├── Skill 정의 (SKILL.md)                 ← 사용자 호출 시 로드됨
  │
  └── 사용자 메시지                          ← 매 턴마다
```

### 2.2 범용 LLM 프롬프트 구조와의 대응

```
범용 LLM 단일 호출
  │
  ├── System Prompt      = CLAUDE.md + Rules + System Prompt
  ├── Few-shot Examples  ≈ Skill의 "RIGHT/WRONG" 예시
  ├── Context Injection  ≈ L1 Research, Agent의 prompt 파라미터
  └── User Message       = 사용자 메시지
```

---

## 3. 각 구성 요소의 LLM 제어 방식

### 3.1 CLAUDE.md — 항상 적용되는 성격과 규칙

```
범용 LLM 대응: System Prompt의 "persona + global rules" 부분
```

| 특성 | CLAUDE.md | 범용 System Prompt |
|------|-----------|-------------------|
| 로드 시점 | 세션 시작 시 **항상** | API 호출 시 **항상** |
| 지속 기간 | 세션 전체 | 호출 전체 |
| 내용 | "한국어로 소통", "커밋 메시지는 한글", "Iron Law" | "You are a helpful assistant who speaks Korean" |
| 계층 | 글로벌 → 프로젝트 (프로젝트가 우선) | 단일 레벨 |

**CLAUDE.md가 범용 System Prompt보다 나은 점**: 계층 구조.

```
~/.claude/CLAUDE.md              ← 모든 프로젝트: "한국어, 간결한 답변"
  └── 프로젝트/CLAUDE.md          ← 이 프로젝트만: "문서 작성 중심, 빌드/테스트 없음"
      └── 충돌 시 프로젝트가 우선
```

범용 LLM에서는 하나의 System Prompt 안에서 섹션으로 구분해야 한다:

```
## Global Rules
- 한국어로 소통

## Project-Specific Rules (override global if conflict)
- 이 프로젝트는 문서 작성 중심
- 빌드/테스트 명령 없음
```

### 3.2 Rules — 파일 기반 조건부 규칙

```
범용 LLM 대응: System Prompt 내 조건문 (if/when)
```

#### 트리거 시점: 2가지 모드

Rules는 frontmatter의 `paths` 필드 유무에 따라 **로드 시점이 완전히 다르다**:

| `paths` 유무 | 로드 시점 | 조건 판단 주체 | 강제력 |
|:------------:|----------|:-------------:|:-----:|
| **없음** | 세션 시작 시 **항상** 로드 | LLM이 본문을 읽고 스스로 판단 | △ 프롬프트 레벨 |
| **있음** | 파일 접근 시 **자동** 로드 (Lazy) | Claude Code 런타임이 glob 매칭 | ◎ 시스템 레벨 |

**`paths` 없는 Rule** — 세션 시작 시 무조건 프롬프트에 주입됨:

```yaml
---
# paths 필드 없음 → 항상 로드
---
# FW 파일 편집 시 동기화 전파... (본문)
```

이 경우 "FW 편집 시 적용"이라는 조건은 Rule 본문에 텍스트로만 적혀 있다. **시스템이 아닌 LLM이 읽고 자기 판단으로 적용**한다. 즉 CLAUDE.md와 동일하게 **항상 컨텍스트에 존재**한다.

**`paths` 있는 Rule** — 파일 접근 시에만 자동 로드됨:

```yaml
---
paths:
  - "sr-project-framework/docs/0_workflow-problems/PRJ-framework-FULL.md"
  - "sr-project-framework/docs/folder-standard/std-folder-architecture.md"
  - "sr-project-framework/docs/1_clickup-framework/clickup-template.md"
---
# FW/FS/CU 동기화 규칙 (본문)
```

이 경우 Claude가 해당 파일을 Read/Edit하면 → Claude Code 런타임이 glob 패턴 매칭 → 일치하면 Rule을 프롬프트에 주입. **LLM의 판단이 아닌 시스템이 강제**한다. 해당 파일을 접근하지 않으면 Rule은 로드되지 않아 **토큰을 절약**한다.

#### 이 프로젝트의 Rules 현황

```
.claude/rules/
├── doc-sync-propagation.md    ← paths 없음 → 항상 로드 (프롬프트 레벨 조건)
└── doc-workflow-gates.md      ← paths 없음 → 항상 로드 (프롬프트 레벨 조건)
```

두 Rule 모두 `paths` frontmatter가 없으므로 **매 세션 항상 로드**된다. 본문 안에 적힌 "트리거 조건"은 LLM이 읽고 스스로 판단하는 것이다.

> **개선 가능**: doc-sync-propagation.md에 `paths:` frontmatter를 추가하면, 3개 파일(FW/FS/CU) 접근 시에만 로드되어 토큰을 절약할 수 있다.

#### 범용 LLM 비교

| 특성 | Rules (paths 없음) | Rules (paths 있음) | 범용 System Prompt |
|------|:-----------------:|:-----------------:|:-----------------:|
| 로드 시점 | 항상 | 파일 접근 시 | 항상 |
| 조건 판단 | LLM (프롬프트) | 런타임 (시스템) | LLM (프롬프트) |
| 토큰 절약 | ✗ | ✓ | ✗ |

#### 조건부 로딩의 동작 주체: Claude Code 런타임

`paths`가 있는 Rule의 조건부 로딩은 **LLM이 아닌 Claude Code 런타임**이 처리한다:

```
Claude (LLM)          Claude Code 런타임              파일 시스템
────────────          ──────────────────              ──────────
Read("src/api/       → 도구 호출 가로채기
  handler.ts")         │
                       ├── glob 매칭 체크:
                       │   "src/api/handler.ts"
                       │   vs "src/**/*.ts" → 일치!
                       │
                       ├── Rule 내용 로드
                       │   → [system] 메시지에 추가
                       │
                       └── 파일 읽기 실행 ──────→ handler.ts 내용 반환
                                                 │
  ← 파일 내용 + Rule 주입 ←─────────────────────┘
```

**LLM은 이 과정을 모른다.** Claude 입장에서는 파일을 읽었더니 갑자기 새로운 지시(Rule)가 컨텍스트에 나타난 것이다. glob 매칭, 로드 시점 결정, 프롬프트 주입 — 전부 런타임의 일이다.

#### 조건부 로딩 실용 예시

**핵심 개념**: `paths`는 Rule 자체의 경로가 아니라, **"이 파일들을 건드릴 때 이 Rule을 로드하라"는 트리거 조건**이다.

**예시 1: 프레임워크 문서 동기화** — 특정 문서 편집 시에만 동기화 규칙 적용

```yaml
---
paths:
  - "sr-project-framework/docs/0_workflow-problems/PRJ-framework-FULL.md"
  - "sr-project-framework/docs/folder-standard/std-folder-architecture.md"
  - "sr-project-framework/docs/1_clickup-framework/clickup-template.md"
---
# 프레임워크 문서 동기화 전파 규칙
# FW를 편집할 때 → FS, CU에 전파 필수
# FS 또는 CU 변경 → FW와 일치 여부 검증 필수
```

→ `PRJ-framework-FULL.md`를 Read/Edit하면 이 Rule이 자동 주입. 다른 파일 작업 중에는 로드 안 됨.

**예시 2: ROS Launch 파일 편집 규칙** — launch 파일 수정 시에만 파라미터 일치 확인

```yaml
---
paths:
  - "**/*.launch.py"
  - "**/*.launch.xml"
  - "**/*.launch"
---
# ROS Launch 파일 편집 규칙
# 1. 참조하는 파라미터 yaml 파일이 존재하는지 확인
# 2. 노드 이름이 다른 launch 파일과 중복되지 않는지 확인
# 3. remapping이 실제 토픽명과 일치하는지 확인
# 4. 하드코딩된 절대 경로 금지 → FindPackageShare 사용
```

→ `navigation.launch.py`를 Edit하면 이 Rule이 자동 주입. Python 소스 편집 중에는 로드 안 됨.

**예시 3: API Controller 변경 시 문서 갱신** — Controller 파일 수정 시에만 API 문서 갱신 규칙

```yaml
---
paths:
  - "src/main/java/**/controller/**/*.java"
  - "src/main/java/**/api/**/*.java"
---
# API Controller 변경 시 규칙
# 1. 엔드포인트 URL 변경 시 → docs/api/openapi.yaml 갱신
# 2. 새 엔드포인트 추가 시 → @PreAuthorize 인증 어노테이션 필수 확인
# 3. 기존 엔드포인트 삭제 시 → 프론트엔드 호출 여부 Grep 확인
```

→ `RobotController.java`를 Edit하면 이 Rule이 자동 주입. Service/Repository 수정 시에는 로드 안 됨.

**패턴 요약**:

| 사용 시점 | `paths` 사용 | `paths` 미사용 |
|---------|:---:|:---:|
| 특정 파일/영역 편집 시에만 필요한 규칙 | ✅ | |
| 프로젝트 전반에 항상 적용되는 규칙 | | ✅ |
| 조건이 많아질수록 (10개, 50개 규칙) | ✅ (토큰 절약) | ❌ (프롬프트 비대) |

#### 범용 LLM에서 불가능한 이유

범용 LLM API에는 **도구 호출을 가로채고 조건에 따라 프롬프트를 주입하는 런타임**이 없다. 모든 지시를 System Prompt에 미리 넣어놓고 LLM이 스스로 판단하는 수밖에 없다:

```
When you edit PRJ-framework-FULL.md:
  - Check std-folder-architecture.md for sync
  - Check clickup-template.md for sync
  - Report mismatches to user
```

이 방식은 조건이 10개, 50개, 100개로 늘어나면 **System Prompt가 비대**해지고, LLM이 모든 조건을 기억하고 판단해야 하므로 **준수도도 떨어진다**.

**Rules의 `paths`가 제공하는 것**: 런타임이 조건을 판단하므로 LLM은 **해당 시점에 필요한 규칙만** 받는다. 조건이 많아져도 프롬프트가 비대해지지 않고, 관련 없는 규칙이 LLM의 판단을 흐리지 않는다.

### 3.3 Skill — 특정 시점에 주입되는 절차 지시서

```
범용 LLM 대응: System Prompt의 "procedure/workflow" 부분, 또는 "프롬프트 체이닝"
```

| 특성 | Skill (SKILL.md) | 범용 프롬프트 |
|------|-----------------|-------------|
| 로드 시점 | **사용자 호출 시** (`/specify`) | 항상 또는 수동 복붙 |
| 지속 기간 | 해당 스킬 실행 중만 | 호출 전체 |
| 크기 | 수백~수천 줄 가능 | 컨텍스트 윈도우 제약 |
| 중첩 | 스킬이 다른 스킬 호출 가능 | 불가능 |

**Skill의 본질은 "필요할 때만 꺼내는 두꺼운 매뉴얼"**이다.

#### 스킬이 다른 스킬을 호출하는 방법

SKILL.md 본문에 `Skill()` 호출을 텍스트로 지시하면, LLM이 읽고 Claude Code의 `Skill` 도구를 호출한다. 코드가 아닌 **프롬프트 지시**이다.

**문법:**

```
Skill("specify", args="{name}")
```

**실제 예시: `/ultrawork` → `/specify` → `/execute`**

`/ultrawork`는 specify와 execute를 자동 연결하는 파이프라인 스킬이다:

```markdown
# ultrawork SKILL.md (발췌)

## 실행 순서
1. 사용자 요청에서 feature name 추출
2. ultrawork 상태 초기화
3. Skill("specify", args="{name}")     ← /specify 호출
4. specify 완료 후 → Hook이 자동으로 /execute 트리거
```

**두 가지 연계 방식:**

| 방식 | 문법 | 동작 주체 | 예시 |
|------|------|---------|------|
| **스킬 직접 호출** | `Skill("specify", args="...")` | LLM이 Skill 도구 호출 | ultrawork → specify |
| **Hook 자동 트리거** | Hook 스크립트에서 다음 스킬 주입 | 런타임 (Shell) | specify 완료 → Hook → execute |

**호출 흐름:**

```
/ultrawork 스킬 로드
    ↓
SKILL.md에 Skill("specify", ...) 지시가 있음
    ↓
LLM이 Skill 도구를 호출
    ↓
Claude Code 런타임이 /specify SKILL.md를 로드
    ↓
/specify가 실행됨 (새로운 스킬 컨텍스트)
    ↓
완료 후 → Hook(ultrawork-stop-hook.sh)이 /execute 트리거
```

`/ultrawork`는 **직접 호출**(specify)과 **Hook 자동 트리거**(execute)를 조합한다.
직접 호출은 LLM 판단에 의존하고, Hook 트리거는 런타임이 강제한다.

#### 토큰 효율성 비교

범용 LLM에서 specify의 L2 인터뷰를 재현하려면:

```
범용 LLM:
  System Prompt에 인터뷰 절차 전체를 넣어야 함 (330줄)
    + L3 절차 (120줄)
    + L4 절차 (170줄)
    = 620줄이 첫 메시지부터 항상 컨텍스트를 차지

Claude Code:
  /specify 호출 시 SKILL.md(112줄) 로드
    → L2 진입 시 +L2-decisions.md(330줄) 로드
    → L3 진입 시 +L3-requirements.md(120줄) 로드
    → L4 진입 시 +L4-tasks.md(170줄) 로드
    = 점진적으로 증가 (112 → 442 → 562 → 732줄)
```

**주의: 한번 로드된 내용은 컨텍스트에서 제거되지 않는다.** "필요할 때만 로드하고 끝나면 제거"가 아니라 **"한 번에 전부 vs 점진적 증가"**의 차이다. L2 단계에서는 L3/L4 내용이 아직 없으므로 그 시점의 컨텍스트는 더 가볍지만, L4에 도달하면 결국 전부 누적되어 있다.

이 누적 문제가 **GSD가 해결하려는 context rot**이다. GSD는 태스크마다 새 세션(fresh 200K context)을 만들어 0부터 시작한다. hoyeon은 하나의 세션 안에서 계속 쌓이므로 장기 세션에서 context rot에 취약하다.

#### 컨텍스트 압축(Compaction)

컨텍스트 윈도우가 한계에 가까워지면 Claude Code 런타임이 자동으로 **컨텍스트 압축(compaction)**을 실행한다:

| 구분 | 압축 시 동작 | 결과 |
|------|------------|------|
| CLAUDE.md | 디스크에서 **재로드** | 보존 (손실 없음) |
| Rules | 디스크에서 **재로드** | 보존 (손실 없음) |
| 스킬 내용 (SKILL.md, references) | **요약/압축** 대상 | 상세 지시 손실 가능 |
| 사용자 메시지 | **요약/압축** 대상 | 이전 대화 요약으로 대체 |
| 도구 호출 결과 | **요약/압축** 대상 | 이전 결과 손실 가능 |

```
압축 전:                              압축 후:
─────────                            ─────────
SKILL.md (112줄)                      CLAUDE.md (재로드 — 보존)
L2-decisions.md (330줄)               Rules (재로드 — 보존)
L3-requirements.md (120줄)            [이전 대화 요약]
L4-tasks.md (170줄)                   최근 메시지들만 유지
사용자 메시지 50개
도구 결과 100개
─────────                            ─────────
= 컨텍스트 거의 가득참                  = 여유 확보
                                       하지만 스킬 상세 지시 손실 가능
                                       → L2 인터뷰 규칙, 점수 체계 등이
                                         요약되어 정밀도 저하
```

**압축의 실질적 영향**: /specify 같은 복잡한 스킬의 경우, L2 인터뷰 330줄의 상세 규칙(3-State Resolution, Unknown/Unknown Detection, Inversion Probe 등)이 압축 후 요약되면 LLM이 더 이상 정밀한 절차를 따르지 못할 수 있다. CLAUDE.md와 Rules는 재로드되어 안전하지만, **스킬의 정밀한 지시는 압축에 취약**하다.

이것은 context rot과 다른 문제이다:
- **Context rot**: 컨텍스트가 차면서 품질이 점진적으로 저하 (GSD가 해결)
- **Compaction 손실**: 컨텍스트 한계 도달 시 이전 지시가 요약되어 정밀도 손실 (별도 문제)

#### 스킬이 LLM에 배치하는 3가지

| 요소 | 역할 | 예시 (specify) |
|------|------|---------------|
| **알아야 할 것** (Knowledge) | 도메인 지식, 기준, 형식 | "GWT 형식으로 작성", "composite ≥ 0.80이 종료 조건" |
| **할 수 있는 것** (Tools) | 사용 가능한 도구 제한/허용 | `allowed-tools: [Read, Bash, Write]` — Edit 없음 = 코드 수정 불가 |
| **해야 할 순서** (Flow) | 단계, 게이트, 분기 | L0→L1→L2(루프)→L3→L4, 각 게이트에서 승인 |

#### 구체적 예시: 하나의 지시가 LLM을 어떻게 제어하는가

**스킬에 적힌 지시:**
```markdown
**Question format — RIGHT (scenario):**
"A user's token expires while filling a form. They click Submit. What should happen?"

**Question format — WRONG (abstract):**
"How should authentication work?"
```

**이 지시가 하는 일:**
- LLM이 "인증 어떻게 할까요?" 같은 추상 질문을 **못 하게** 함
- 대신 구체적 시나리오를 제시하도록 **강제**
- 결과: 사용자로부터 더 정확한 답변 → 더 좋은 requirements

**또 다른 예시:**
```markdown
### 3-State Checkpoint Resolution
| State | Score | When |
|-------|-------|------|
| resolved | 1.0 | 답변에 discriminator(숫자, 임계값, 명시적 행동) 포함 |
| provisional | 0.5 | 답변이 모호 (짧거나, 단일 옵션, 디테일 없음) |
| unresolved | 0.0 | 답변 없음 |
```

**이 지시가 하는 일:**
- LLM이 "네 알겠습니다"로 넘어가는 것을 **방지**
- 모호한 답변을 0.5점 처리 → score가 0.80 미달 → **추가 질문 강제**
- 결과: "대충 넘어가기"가 구조적으로 불가능

#### 스킬의 흐름 제어 — 마크다운 패턴 문법

스킬 안에서 순차 실행, 조건 분기, 에이전트 디스패치 등을 제어하는 **공식 프로그래밍 문법은 없다.** LLM이 마크다운을 읽고 자연어로 해석하여 지시를 따르는 것이므로, "문법"은 **LLM이 잘 이해하는 마크다운 패턴**이다.

/bugfix 스킬을 기준으로 8가지 패턴을 정리한다:

**패턴 1: ASCII 흐름도 — 전체 구조 선언**

```markdown
## Architecture
Phase 1: DIAGNOSE ─────────────────────
  debugger + gap-analyzer (all parallel)
  → User confirmation
Phase 2: SPEC GENERATION ──────────────
  Diagnosis results → spec.json
Phase 3: EXECUTE ──────────────────────
  Skill("execute") → Success: Phase 5 / HALT: Phase 4
```

LLM에게 "전체 그림"을 먼저 보여준다. 이후 상세 지시의 위치를 파악하는 데 사용.

**패턴 2: 단계 번호 — 순차 실행**

```markdown
### Step 1.1: Parse Input
### Step 1.2: Parallel Investigation
### Step 1.3: Gap Analysis
### Step 1.4: User Confirmation
```

`###` 헤딩의 번호 순서가 실행 순서를 암시. 1.1 → 1.2 → 1.3 → 1.4 순서로 진행.

**패턴 3: 조건 분기 — 의사 코드**

```markdown
IF execute completed successfully:
  → Phase 5
IF execute HALTED:
  → Phase 4
```

`→ Phase N`은 "해당 Phase 헤딩으로 이동하여 지시를 따르라"는 뜻.

**패턴 4: Agent 디스패치 — Task() 표기**

```markdown
Task(debugger):
  "Bug Description: {user input}
   Investigate this bug."

Task(verification-planner):
  "User's Goal: Fix the bug
   Focus on Auto items only."
```

`Task(에이전트명):` 다음 인용문이 프롬프트. LLM이 `Agent(subagent_type=..., prompt=...)` 도구 호출로 변환. "parallel"이라고 적으면 동시 호출.

```
스킬에 적힌 것:        LLM이 실제로 호출하는 도구:
Task(debugger):       Agent(subagent_type="hoyeon:debugger",
  "에러 분석해"             prompt="에러 분석해")
```

Task()는 스킬 문서의 **표기 관례**이고, Agent()는 런타임의 **실제 도구**다.

**패턴 5: Skill 호출 — 스킬 체인**

```markdown
Skill("execute", args="${SPEC_PATH}")
```

다른 스킬을 호출. 런타임이 execute SKILL.md를 로드하여 메인 Claude에게 주입.

**패턴 6: 사용자 게이트 — AskUserQuestion**

```markdown
AskUserQuestion:
  question: "Is the Root Cause analysis correct?"
  options:
  - "Correct, proceed" → Phase 2
  - "Root cause is different" → Re-run Step 1.2
  - "Not sure" → exit
```

사용자 응답에 따라 `→` 이후 지시를 따름.

**패턴 7: CLI 명령 — bash 코드 블록**

````markdown
```bash
hoyeon-cli spec init fix-{slug} --goal "Fix: {description}" ${SPEC_PATH}
```
````

LLM이 `Bash()` 도구로 실행. `{slug}` 같은 변수는 이전 단계에서 파악한 값으로 치환.

**패턴 8: 표(Table) — 설정/분기 참조**

```markdown
| dispatch | verify | Phase 1 | Retry |
|---------|--------|---------|-------|
| agent | standard | debugger + gap-analyzer | max 3 |
```

설정값이나 분기 조건을 표로 정리하여 한 눈에 파악하게 함.

**8가지 패턴 요약표:**

| 패턴 | 마크다운 형태 | LLM 해석 | 실제 동작 |
|------|------------|---------|----------|
| ASCII 흐름도 | 코드 블록 내 화살표 | 전체 구조 파악 | 없음 (개요용) |
| 단계 번호 | `### Step 1.1:` | 순차 실행 | 번호 순서대로 진행 |
| 조건 분기 | `IF ... → Phase N` | if/else 해석 | 조건 평가 후 해당 섹션으로 이동 |
| Agent 디스패치 | `Task(에이전트명):` | 서브에이전트 호출 | `Agent()` 도구 호출 |
| Skill 호출 | `Skill("name")` | 다른 스킬 체인 | `Skill()` 도구 호출 |
| 사용자 게이트 | `AskUserQuestion:` | 사용자 입력 대기 | `AskUserQuestion()` 도구 호출 |
| CLI 명령 | `` ```bash ... ``` `` | 쉘 실행 | `Bash()` 도구 호출 |
| 표 | `\| ... \| ... \|` | 설정/분기 참조 | 없음 (참조용) |

**핵심: 왜 "문법"이 아니라 "패턴"인가**

```
프로그래밍 언어:
  if (attempt >= 3) { circuitBreaker(); }
  → 파서가 문법 오류를 검출. 한 글자라도 틀리면 에러.

스킬 마크다운:
  IF attempt >= MAX_ATTEMPTS:
    → Step 4.5 (Circuit Breaker)
  → LLM이 자연어로 해석. "대략 이런 뜻이구나" 추론.
  → "3번 실패하면"이라고 적어도 동작할 수 있음.
```

- **장점**: 유연하다. 정확한 문법이 아니어도 LLM이 의도를 파악한다.
- **단점**: 보장이 없다. LLM의 instruction following 능력에 의존한다.

이 단점을 보완하는 것이 §1.2에서 설명한 **시스템 레벨 제어**(`validate_prompt`, `allowed-tools`)다. 프롬프트 패턴으로 "이렇게 해달라"고 지시하고, 시스템 제어로 "이것만 할 수 있다/결과가 이 형식이어야 한다"고 강제하는 **이중 구조**다.

#### 정적 질의 vs 동적 질의 — 스킬이 질문을 만드는 두 가지 방식

위 8가지 패턴은 **스킬에 미리 적힌 지시를 LLM이 따르는** 구조다. 하지만 /specify나 /deep-interview처럼 **주제에 따라 다른 질문을 해야 하는** 스킬은 어떻게 동작하는가?

**정적 질의** (/bugfix) — 질문이 스킬에 하드코딩됨:

```markdown
AskUserQuestion:
  question: "Is the Root Cause analysis correct?"
  options:
  - "Correct, proceed" → Phase 2
  - "Root cause is different" → Re-run Step 1.2
```

주제가 바뀌어도 항상 같은 질문을 한다.

**동적 질의** (/specify L2) — 질문 생성 규칙만 스킬에 적혀 있음:

```markdown
### Interview Loop (score-driven)
Each round:
1. Score — compute coverage per dimension
2. Target — pick lowest-scoring dimension(s)
3. Ask — 2 scenario questions targeting those checkpoints

Question format — RIGHT (scenario):
  "A user's token expires while filling a form.
   They click Submit. What should happen?"

Question format — WRONG (abstract):
  "How should authentication work?"
```

질문의 구체적 텍스트는 **LLM이 프로젝트 컨텍스트(L1 research)를 기반으로 실시간 생성**한다.

```
스킬이 정적으로 제공하는 것:           LLM이 동적으로 생성하는 것:
──────────────────────              ──────────────────────
5개 차원 정의                        "이 프로젝트에서 Core Behavior란?"
점수 계산 공식                        현재 점수 기반 다음 질문 대상 결정
질문 형식 규칙 (시나리오 필수)          구체적 시나리오 질문 텍스트 생성
3-State Resolution 기준              답변이 resolved/provisional 판정
종료 조건 (composite ≥ 0.80)         언제 종료할지 판단
RIGHT/WRONG 예시                     예시 패턴을 따라 새 질문 생성
```

실제 동작 과정:

```
1. LLM이 L2-decisions.md를 읽는다
   → "5개 차원에 대해 시나리오 질문을 해야 하는구나"

2. LLM이 L1 research를 읽는다
   → "이 프로젝트는 ClickUp API + Teams 연동 + 지연 감지"

3. 현재 점수를 계산한다
   → "Core Behavior: 0.33, Error/Edge: 0.00 ← 가장 낮음"

4. 가장 낮은 차원에 대해 질문을 생성한다
   규칙: "concrete situation, not abstract"
   규칙: "RIGHT 예시처럼 시나리오로"
   → "ClickUp API가 3분간 무응답인 상황에서,
      오전 9시 정기 스캔이 실행됩니다.
      에이전트는 어떻게 해야 합니까?"

5. 사용자 답변: "보고서 건너뛰고 API 장애 메시지만 Teams에 보내"

6. 3-State Resolution 판정
   discriminator 있음 ("건너뛰고", "메시지만") → resolved (1.0)

7. 점수 재계산 → 다음 라운드 반복
```

**비유**:
- 정적 = 시험 문제지를 미리 인쇄해서 나눠줌. 모든 학생이 같은 문제를 받음.
- 동적 = 출제 규칙서를 시험관에게 줌. "이 학생 수준에 맞춰, 시나리오 형태로 문제를 만들어라." 학생마다 다른 문제를 받지만 모든 문제가 동일한 품질 기준을 충족.

| | 정적 질의 (/bugfix) | 동적 질의 (/specify) |
|--|:------------------:|:------------------:|
| **질문 텍스트** | SKILL.md에 하드코딩 | LLM이 실시간 생성 |
| **스킬이 제공** | 질문 자체 | **질문 생성 규칙** (차원, 형식, 예시, 점수) |
| **주제 의존성** | 없음 (항상 동일) | 있음 (L1 research 기반) |
| **품질 보장** | 스킬 작성자가 보장 | 규칙 + RIGHT/WRONG 예시로 보장 |

### 3.4 Agent — 별도 컨텍스트에서 실행되는 역할 제한 프롬프트

```
범용 LLM 대응: 정확한 대응 없음. 가장 가까운 것은 "역할 전환 지시"
```

| 특성 | Agent (.md) | 범용 "역할 전환" |
|------|-----------|---------------|
| 실행 주체 | **별도 프로세스** (새 LLM 인스턴스) | 같은 프로세스 (자기 자신) |
| 컨텍스트 | 대화 히스토리 **없음** | 대화 히스토리 **전부 있음** |
| 도구 제한 | `disallowed-tools: [Write, Edit]` **강제** | "수정하지 마세요" (지시일 뿐, 강제 아님) |
| 출력 검증 | `validate_prompt` 자동 체크 | 없음 |

**이것이 가장 큰 차이다.**

```
Claude Code의 debugger 에이전트:
  - 별도 프로세스로 실행됨
  - Write/Edit 도구가 물리적으로 없음 → 코드 수정이 불가능
  - 진단 결과에 "Root Cause with file:line" 없으면 출력 거부
  → 역할 이탈이 구조적으로 불가능

범용 LLM의 "디버거 역할":
  "당신은 디버거입니다. 코드를 수정하지 말고 원인만 분석하세요."
  → LLM이 "이왕 찾은 김에 수정도 해드리겠습니다" 할 수 있음
  → 역할 이탈이 프롬프트 준수도에 의존
```

#### Agent()의 동작 메커니즘

Agent()는 프로그래밍 언어의 함수가 아니다. Claude Code 런타임이 LLM에게 제공하는 **도구(Tool)** 중 하나다.

```
Claude Code 런타임이 세션 시작 시 LLM에게 알려주는 도구 목록:

  Read(file_path)           ← 파일 읽기
  Write(file_path, content) ← 파일 쓰기
  Bash(command)             ← 쉘 명령 실행
  Agent(description, prompt, subagent_type)  ← 서브에이전트 생성
  Skill(skill_name)         ← 스킬 호출
  ...
```

LLM은 이 도구들 중 하나를 "호출하겠다"고 **텍스트로 선언**하면, 런타임이 실제 실행한다.

#### "debugger"가 특정화되는 과정

**1단계: 세션 시작 — 이름만 등록**

```
런타임이 agents/ 디렉토리를 스캔:
  agents/debugger.md      → frontmatter에서 name: "debugger" 추출
  agents/worker.md        → frontmatter에서 name: "worker" 추출
  agents/code-reviewer.md → frontmatter에서 name: "code-reviewer" 추출

시스템 프롬프트에 주입 (이름 + 한줄설명만):
  "Available agent types:
   - hoyeon:debugger: Root cause analysis specialist...
   - hoyeon:worker: Implementation worker agent...
   - hoyeon:code-reviewer: Independent code review..."
```

LLM은 이 목록을 보고 **어떤 에이전트가 있는지** 안다. 하지만 아직 debugger.md의 상세 내용은 모른다.

**2단계: LLM이 Agent() 호출 — 런타임이 프로세스 생성**

```
LLM의 응답 (텍스트):                    런타임이 실제로 하는 일:
────────────────────                   ──────────────────────
Agent(                                 1. agents/debugger.md 파일 전문 읽기
  subagent_type="hoyeon:debugger",     2. frontmatter 파싱:
  prompt="이 에러 분석해: ..."              model: sonnet
)                                          allowed-tools: [Read, Grep, Glob, Bash]
                                           disallowed-tools: [Write, Edit]
                                           validate_prompt: "Must contain Root Cause..."
                                       3. 새 Claude 프로세스 생성 (model: sonnet)
                                       4. debugger.md 본문 → system prompt로 주입
                                       5. prompt → user message로 전달
                                       6. 도구 목록에서 Write, Edit 제외
                                       7. 서브에이전트가 독립적으로 작업 수행
                                       8. 결과를 validate_prompt로 검증
                                       9. 검증 통과 → 결과를 메인 Claude에게 반환
```

**3단계: 서브에이전트의 세계 — 격리된 컨텍스트**

서브에이전트(debugger)가 보는 것:

```
[system] # Debugger Agent
         You are a root-cause analysis specialist.
         Your mission is to trace bugs to their root cause.
         You investigate only — you do NOT write code.

         사용 가능 도구: Read, Grep, Glob, Bash
         (Write, Edit는 목록에 아예 없음 — 존재 자체를 모름)

[user]   src/api/handler.ts에서 500 에러 발생. 원인 분석해.
```

서브에이전트가 **모르는 것**:
- 메인 Claude와의 대화 히스토리
- /specify나 /bugfix 스킬이 실행 중이라는 사실
- 다른 에이전트(gap-analyzer 등)가 병렬로 실행 중이라는 사실
- 자기가 "debugger"라는 이름의 에이전트라는 사실

서브에이전트가 **아는 것**: system prompt에 적힌 미션 + user message에 적힌 구체적 요청. 이것만으로 작업한다.

#### 전체 흐름: 스킬이 에이전트를 사용하는 방식

에이전트가 스킬을 호출하는 것이 아니라, **스킬이 Claude에게 에이전트를 호출하라고 지시**한다. Agent()는 LLM이 "이 작업을 별도 전문가에게 위임해달라"고 런타임에 요청하는 것이다.

```
┌─ 메인 Claude ─────────────────────────────────┐
│                                               │
│  /bugfix 스킬 실행 중                           │
│  "Phase 1: 진단 → 3개 에이전트 병렬 실행"        │
│                                               │
│  Agent(debugger, "에러 분석해")  ──────────┐    │
│  Agent(gap-analyzer, "빈틈 찾아")  ────┐   │    │
│  Agent(verifier, "검증 계획 세워")  ─┐  │   │    │
│                                    │  │   │    │
└────────────────────────────────────│──│───│────┘
          런타임이 3개 프로세스 생성    │  │   │
                                    ▼  ▼   ▼
┌─ debugger ──┐  ┌─ gap-analyzer ┐  ┌─ verifier ─┐
│ model:sonnet│  │ model:sonnet  │  │ model:sonnet│
│ tools:      │  │ tools:        │  │ tools:      │
│  Read, Grep │  │  Read, Grep   │  │  Read, Grep │
│  (no Write) │  │  (no Write)   │  │  (no Write) │
│             │  │               │  │             │
│ [독립 작업]  │  │ [독립 작업]    │  │ [독립 작업]  │
│ 결과 반환 ──│→ │ 결과 반환 ────│→ │ 결과 반환 ──│→
└─────────────┘  └───────────────┘  └─────────────┘
                                           │
          ← 3개 결과 수집 ─────────────────┘
┌─ 메인 Claude ─────────────────────────────────┐
│  3개 결과를 종합하여 다음 단계 진행               │
│  (Phase 2: spec.json 생성 → Phase 3: /execute) │
└───────────────────────────────────────────────┘
```

런타임이 .md 파일에서 역할 정의를 읽고, 새 프로세스를 만들고, 도구를 제한하고, 결과를 검증한다. **메인 Claude는 결과만 받을 뿐, 서브에이전트의 내부 동작을 제어하지 않는다.**

### 3.5 Hook — 대응 없음 (시스템 레벨 이벤트)

```
범용 LLM 대응: 없음
```

Hook은 LLM 프롬프트가 아니다. 파일 저장, 도구 호출 등 **시스템 이벤트에 반응하는 쉘 스크립트**다. LLM이 아닌 Claude Code 런타임이 실행한다.

```
예: PostToolUse hook
  사용자가 Edit 도구 사용 → Claude Code 런타임이 감지
  → validate-output.sh 자동 실행 → 결과를 Claude에게 전달
```

이것은 프롬프트 엔지니어링이 아니라 **런타임 자동화**이므로, 범용 LLM에는 대응하는 개념이 없다.

---

## 4. 전체 대응표

| Claude Code | 범용 LLM 프롬프트 | 핵심 차이 |
|-------------|-----------------|----------|
| **System Prompt** | System Prompt | 동일 |
| **CLAUDE.md** | System Prompt 상단 (persona + global rules) | 계층 구조 (글로벌→프로젝트) |
| **Rules** | System Prompt 내 조건문 | 조건부 로드로 토큰 절약 |
| **Skill** | System Prompt 내 절차 섹션 또는 프롬프트 체이닝 | Lazy loading + 중첩 호출 |
| **Agent** | "역할 전환" 지시 | **별도 프로세스** + 도구 제한 강제 |
| **Hook** | 대응 없음 | 런타임 자동화 (프롬프트 아님) |

---

## 5. 크로스-LLM 이식성 분석

### 5.1 직접 적용 (변경 없이)

**불가능하다.** 이유:

| 요소 | Claude Code 전용 | 범용 |
|------|:---------------:|:----:|
| SKILL.md frontmatter (`allowed-tools`, `name`) | ✓ | ✗ |
| `Agent()` 도구 호출 (서브에이전트 생성) | ✓ | ✗ |
| `AskUserQuestion()` 도구 | ✓ | ✗ |
| `hoyeon-cli` (spec.json 관리) | ✓ | ✗ |
| `.claude/` 디렉토리 관례 | ✓ | ✗ |
| **마크다운 본문의 지시 내용** | ✗ | **✓** |

**인프라**(도구 호출, 에이전트 시스템, 파일 구조)는 Claude Code 전용이다. 하지만 **마크다운 본문에 적힌 지시 내용**은 어떤 LLM이든 이해할 수 있다.

### 5.2 3-Layer 이식 모델

스킬의 본질은 3개 레이어로 분리된다:

```
Layer 3: 인프라 (Platform-specific) — 다시 구현해야 함
─────────────────────────────────
  Claude Code: SKILL.md, Agent(), allowed-tools, Hook
  OpenAI:      GPT Actions, function calling, Assistants API
  Cursor:      .cursor/rules, @commands
  Gemini:      Google AI Studio system instructions

Layer 2: 구조 (Transferable with adaptation) — 각 플랫폼 방식으로 재구현
─────────────────────────────────
  레이어 체인: Goal → Context → Decisions → Requirements → Tasks
  게이트 패턴: 각 단계 완료 시 승인 요청
  점수 기반 종료: composite ≥ 0.80
  역할 분리: 진단자 / 실행자 / 검증자

Layer 1: 지식 (Fully portable) — 그대로 사용 가능
─────────────────────────────────
  "GWT 형식으로 요구사항을 작성하라"
  "추상 질문 금지, 시나리오 질문만"
  "3-State Resolution: resolved/provisional/unresolved"
  "설계 문서 9섹션 표준"
```

### 5.3 각 레이어의 이식 방법

#### Layer 1 (지식) — 완전 이식 가능

어떤 LLM이든 마크다운 지시를 이해한다:

```markdown
## 요구사항 작성 규칙
- 각 요구사항은 Given/When/Then 형식으로 작성
- "correctly", "properly", "as expected" 등 모호한 표현 금지
- 하나의 요구사항에 하나의 트리거, 하나의 결과
```

이 내용은 Claude, GPT-4, Gemini, Llama 어디에든 동일하게 동작한다.

#### Layer 2 (구조) — 개념 유지, 구현 방식만 변경

| 개념 | Claude Code | OpenAI GPTs | Cursor |
|------|------------|-------------|--------|
| 단계 흐름 제어 | SKILL.md에 순서 명시 | System Prompt에 순서 명시 | .cursor/rules에 순서 명시 |
| 사용자 승인 게이트 | `AskUserQuestion()` | GPT의 대화 중 확인 질문 | 대화 중 확인 질문 |
| 서브에이전트 | `Agent(subagent_type=...)` | 없음 (단일 프로세스) | 없음 |
| 도구 제한 | `allowed-tools` | GPT Actions 설정 | 설정 불가 |
| 외부 CLI | `hoyeon-cli` | Custom Actions | Terminal |

#### Layer 3 (인프라) — 완전 재구현 필요

각 플랫폼의 도구 호출 방식, 파일 시스템 접근, 에이전트 생성 API에 맞춰 다시 작성한다.

### 5.4 실제 이식 예시

specify의 L2 인터뷰 로직을 OpenAI GPT로 옮기는 경우:

```
Claude Code 스킬 (원본):
  "hoyeon-cli spec merge --stdin --append << 'EOF'"     ← Layer 3 (재구현)
  "AskUserQuestion(question: '...', options: [...])"     ← Layer 3 (재구현)
  "Task(subagent_type='general-purpose', prompt=...)"    ← Layer 3 (재구현)
  "composite score ≥ 0.80이 종료 조건"                    ← Layer 2 (유지)
  "시나리오 질문만, 추상 질문 금지"                         ← Layer 1 (그대로)

  ↓ 이식

OpenAI GPT System Prompt:
  "결정 사항을 JSON 형식으로 내부 추적하라"               ← Layer 3 대체
  "사용자에게 시나리오 질문을 하라 (추상 질문 금지)"       ← Layer 1 (그대로)
  "composite score ≥ 0.80이 종료 조건"                    ← Layer 2 (유지)
  "L2-reviewer 역할로 자체 검토 후 PASS/NEEDS_FIX 판단"  ← Layer 3 대체
```

서브에이전트가 없으므로 L2-reviewer를 **자체 역할 전환**으로 대체. CLI가 없으므로 JSON을 **대화 내부에서 추적**. 구조(인터뷰→점수→종료 조건)와 지식(시나리오 질문, GWT)은 동일하게 유지.

### 5.5 이식 가능성 요약

| 이식 방식 | 가능 여부 | 보존되는 것 | 손실되는 것 |
|-----------|:--------:|-----------|-----------|
| 직접 적용 (변경 없이) | ✗ | — | — |
| Layer 1만 이식 (지식) | ✓ | 도메인 규칙, 품질 기준, 형식 표준 | 자동화, 흐름 제어, 역할 강제 |
| Layer 1+2 이식 (지식+구조) | ✓ | + 단계별 흐름, 게이트, 점수 체계 | 물리적 도구 제한, 병렬 에이전트 |
| Layer 1+2+3 이식 (전체) | ✓ | 전체 기능 | 개발 비용 (플랫폼별 재구현) |

---

## 6. 프레임워크 3자 비교: superpowers vs GSD vs hoyeon

### 6.1 각각이 해결하려는 핵심 문제

| | superpowers | GSD (Get Shit Done) | hoyeon |
|--|-----------|-----|--------|
| **핵심 문제** | 프로세스 부재 | Context rot (50%+ 품질 저하) | 요구사항 빈틈 |
| **해결 방식** | 스킬별 절차 가이드 | 태스크마다 fresh context | 증거 기반 인터뷰 + 기계 검증 |
| **철학** | "체계적으로 일하자" | "컨텍스트를 깨끗하게 유지하자" | "요구사항을 빈틈없이 도출하자" |
| **대상** | 모든 개발자 | 솔로 개발자 | 팀/체계적 개발 |
| **출처** | [obra/superpowers](https://github.com/obra/superpowers) ~94K★ | [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) ~48K★ | [team-attention/hoyeon](https://github.com/team-attention/hoyeon) (플러그인 마켓) |

```
superpowers:  "LLM이 체계 없이 코딩한다" → 프로세스 가이드라인을 제공하자
GSD:          "긴 세션에서 LLM이 망가진다" → context rot를 해결하자
hoyeon:       "요구사항이 부실하다"        → 빈틈 없는 도출 체계를 만들자
```

### 6.2 아키텍처 비교

```
superpowers:
  SKILL.md 14개 (개별 파일)
  └── 사용자가 순서대로 수동 호출
      brainstorming → writing-plans → executing-plans → verification

GSD v1:
  CLAUDE.md에 메타 프롬프트 주입
  └── spec.md → tasks.md → 태스크별 fresh subagent 실행
      각 subagent가 깨끗한 200K 컨텍스트로 시작

GSD v2:
  독립 CLI (Pi SDK 기반)
  └── spec → plan → 태스크별 fresh agent 디스패치
      CLI가 컨텍스트 주입/git 관리/비용 추적/복구 직접 수행

hoyeon:
  플러그인 (26 skills + 21 agents + CLI + Hooks)
  └── /specify (L0→L4 인터뷰 체인) → spec.json
      → /execute (에이전트 디스패치 + 검증)
      CLI가 스키마 검증, Hook이 전환 자동화
```

### 6.3 상세 비교표

| | superpowers | GSD | hoyeon |
|--|-----------|-----|--------|
| **스킬 수** | 14개 | 슬래시 커맨드 수개 | 26개 |
| **에이전트** | 0개 | LLM/CLI가 생성 | 21개 (사전 정의) |
| **Hook** | 없음 | 없음 (v2는 CLI가 대체) | 있음 (hooks.json) |
| **CLI 도구** | 없음 | v2: `npx gsd` | `hoyeon-cli` |
| **설치** | SKILL.md 개별 다운로드 | v1: CLAUDE.md 복붙 / v2: npx | `claude plugin install` |
| **스펙 형식** | 마크다운 (md) | 마크다운 (md) | **JSON (spec.json)** |
| **검증** | 사람이 눈으로 | 사람이 눈으로 | `spec validate` (자동) |
| **추적성** | 없음 | 태스크→스펙 참조 (텍스트) | `fulfills[]` 자동 매핑 |
| **빈틈 검출** | 수동 | 수동 | 자동 |
| **런타임** | Claude Code만 | **12개** (Claude, Cursor, Codex, Gemini 등) | Claude Code만 |
| **무게** | 경량 (14 파일) | v1: 초경량 / v2: 중량 | 중량 (플러그인 패키지) |

### 6.4 Context Rot 대응 비교

GSD가 해결하려는 핵심 문제인 **context rot** — LLM 컨텍스트 윈도우가 50% 이상 차면 품질이 급격히 떨어지는 현상 — 에 대한 각각의 대응:

| | superpowers | GSD | hoyeon |
|--|-----------|-----|--------|
| **대응** | 없음 | **핵심 설계 목표** | 부분 대응 |
| **방식** | — | 태스크마다 fresh 200K context | 서브에이전트가 별도 프로세스 (clean context) |
| **상태 외부화** | 파일 (md) | 파일 (md) | 파일 (spec.json) + CLI |
| **장기 자율 실행** | 불가 (수동 호출) | **v2 핵심** (auto-advance, 복구, 비용 추적) | /ultrawork + Hook 체인 |

GSD의 핵심 통찰: 태스크마다 새로운 에이전트를 생성하여 깨끗한 컨텍스트에서 시작하면 **50번째 태스크의 품질이 1번째와 동일**하다.

hoyeon도 서브에이전트(worker, debugger 등)가 별도 프로세스로 실행되므로 clean context를 사용하지만, 이것이 핵심 설계 목표는 아니다.

### 6.5 멀티-런타임 지원

| 런타임 | superpowers | GSD v2 | hoyeon |
|--------|:-----------:|:------:|:------:|
| Claude Code | ✓ | ✓ | ✓ |
| Cursor | ✗ | ✓ | ✗ |
| Codex | ✗ | ✓ | ✗ |
| Gemini CLI | ✗ | ✓ | ✗ |
| Windsurf | ✗ | ✓ | ✗ |
| 기타 7개 | ✗ | ✓ | ✗ |

GSD v2는 독립 CLI(Pi SDK 기반)이므로 Claude Code에 종속되지 않는다. §5의 3-Layer 모델로 보면, GSD v2는 **Layer 3(인프라)를 자체 CLI로 해결**하여 플랫폼 독립성을 확보했다.

### 6.6 세 프레임워크의 관계

```
superpowers = "어떻게 일해야 하는지" 알려주는 매뉴얼 모음 (프로세스)
GSD         = "컨텍스트가 썩지 않게" 환경을 관리하는 시스템 (실행 환경)
hoyeon      = "무엇을 만들어야 하는지" 빈틈없이 도출하는 시스템 (요구사항)
```

**세 가지는 경쟁이 아니라 다른 레이어의 문제를 해결한다.** 이론적으로 조합 가능:

```
hoyeon /specify  → 요구사항을 빈틈없이 도출 (what)
superpowers      → 설계 문서를 9섹션 표준으로 작성 (how)
GSD              → 태스크별 fresh context로 품질 저하 없이 실행 (execute)
```

참고: [Superpowers, GSD, and gstack 비교 분석](https://medium.com/@tentenco/superpowers-gsd-and-gstack-what-each-claude-code-framework-actually-constrains-12a1560960ad)에서는 "gstack handles thinking, Superpowers handles doing, GSD keeps long context honest"로 요약한다.

---

## 7. hoyeon의 강점과 약점 — 하네스 엔지니어링 관점

### 7.1 2026년 하네스 엔지니어링의 핵심 원칙

업계에서 합의된 하네스 엔지니어링 원칙과 hoyeon의 부합도:

> "Agent = Model + Harness" — 하네스는 AI 에이전트에서 **모델 자체를 제외한 모든 것**이다.
> — [Martin Fowler, Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)

> "AI의 결과물은 입력(스펙)의 품질에 비례한다. 스펙이 검증될 때까지 코딩하지 마라."
> — [Addy Osmani, How to write a good spec for AI agents](https://addyosmani.com/blog/good-spec/)

> "에이전트의 행동을 관찰(observability)하고 제약(guardrail)하는 시스템을 먼저 설계하라."
> — [Datadog, Closing the verification loop](https://www.datadoghq.com/blog/ai/harness-first-agents/)

| 원칙 | 업계 합의 | hoyeon | GSD | superpowers |
|------|----------|:------:|:---:|:-----------:|
| **스펙이 구현을 주도** | [Thoughtworks](https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices): 스펙 검증 전 코딩 금지 | ✓ spec.json SSoT | ✓ spec.md | △ 가이드만 |
| **결정론적 검증** | [Fowler](https://martinfowler.com/articles/harness-engineering.html): CPU가 실행하는 빠른 검증 | ✓ CLI validate | ✗ 수동 | ✗ 수동 |
| **환경이 행동을 제약** | [Red Hat](https://developers.redhat.com/articles/2026/04/07/harness-engineering-structured-workflows-ai-assisted-development): AI 작업 환경 설계 | ✓ allowed-tools, validate_prompt | ✓ fresh context | △ 프롬프트만 |
| **Context rot 방지** | [NxCode](https://www.nxcode.io/resources/news/harness-engineering-complete-guide-ai-agent-codex-2026): 컨텍스트 품질 유지 | △ 서브에이전트 | **✓ 핵심 설계** | ✗ |
| **관찰 가능성** | [Datadog](https://www.datadoghq.com/blog/ai/harness-first-agents/): 에이전트 행동 관찰+제약 | △ Hook | ✗ | ✗ |
| **레포가 진실의 원천** | [Fowler](https://martinfowler.com/articles/harness-engineering.html): 컨벤션을 레포에 | ✓ spec.json + CLAUDE.md | ✓ spec.md | ✓ SKILL.md |
| **멀티-런타임** | 점점 중요해지는 추세 | ✗ Claude 전용 | **✓ 12개** | ✗ Claude 전용 |

### 7.2 hoyeon의 강점 (업계 흐름과 일치)

**1. 요구사항 도출의 결정론성(Determinism)**

대부분의 하네스가 "좋은 스펙을 작성하라"고 **권고**하는 데 반해, hoyeon은 **도출 과정 자체를 구조화**했다:

```
일반적 접근:                          hoyeon:
─────────────                        ──────
"스펙을 잘 쓰세요"                     L2 인터뷰 → 5차원 체크포인트
                                       → 3-State Resolution
                                       → composite ≥ 0.80 될 때까지 진행 불가
                                       → Unknown/Unknown 3-tier 검출
                                       → Inversion Probe (역질문)
```

**2. 기계 검증 가능한 추적성**

```
GSD:         spec.md → tasks.md → 사람이 눈으로 확인
superpowers: requirements.md → design.md → 사람이 눈으로 확인
hoyeon:      spec.json → hoyeon-cli spec validate → 자동 검증
               decisions[] → requirements[].sub[] → tasks[].fulfills[]
               "R2.3을 충족하는 태스크 없음" → 자동 검출
```

Fowler가 말하는 **computational guides** — 결정론적이고 빠른, CPU가 실행하는 검증 — 에 정확히 해당한다. LLM에게 "빠진 거 없어?"라고 묻는 것이 아니라 CLI가 구조적으로 검증한다.

**3. 역할 격리의 엄격함**

```
일반적 접근:                          hoyeon:
─────────────                        ──────
"이 에이전트는 분석만 하세요"           debugger: disallowed-tools: [Write, Edit]
(프롬프트 지시 = 부탁)                    → 물리적으로 코드 수정 불가 (강제)
                                      validate_prompt: "Must contain Root Cause"
                                        → 출력 형식 자동 검증 (강제)
```

**4. 레이어 체인의 파생 추적**

L0(목표) → L1(컨텍스트) → L2(결정) → L3(요구사항) → L4(태스크)의 체인에서, 각 레이어가 이전 레이어에서 **파생**되고 그 관계가 `fulfills[]`, `depends_on[]`으로 추적된다. "이 태스크는 왜 존재하는가?"에 대한 답이 항상 있다.

| 강점 요약 | 왜 중요한가 |
|----------|-----------|
| 요구사항 도출 구조화 | AI 결과물은 입력(스펙) 품질에 비례. hoyeon은 입력 품질을 시스템으로 보장 |
| JSON + CLI 자동 검증 | 마크다운은 사람이 읽기 좋지만 기계가 검증 불가. JSON + CLI = 빈틈 자동 검출 |
| 에이전트 역할 격리 | "디버거가 갑자기 코드 수정"을 프롬프트가 아닌 시스템이 방지 |
| 레이어 체인 추적 | 목표→결정→요구사항→태스크 전체 derivation이 추적 가능 |

### 7.3 hoyeon의 약점 (업계 흐름과 차이)

| 약점 | 왜 문제인가 | 업계 대안 |
|------|-----------|----------|
| **Claude Code 전용** | GSD가 12개 런타임 지원하는 시대에 단일 플랫폼 종속. 팀원이 Cursor 쓰면 사용 불가 | GSD v2: 독립 CLI로 플랫폼 독립 |
| **Context rot 비대응** | 장기 세션 품질 저하에 대한 체계적 대응 없음. 서브에이전트가 부분 해결하지만 핵심 설계가 아님 | GSD: 태스크마다 fresh 200K context |
| **학습 곡선** | 26개 스킬 + 21개 에이전트 + CLI + Hook. 진입 장벽 높음 | GSD v1: CLAUDE.md 하나로 시작 |
| **마크다운 문서 부재** | spec.json은 기계에 좋지만 팀원이 읽기 어려움 | 이 프로젝트에서 문서 렌더링 patch로 보완 |

### 7.4 결론: 긍정적 방향인가?

**방향은 맞다.** 2026년 하네스 엔지니어링의 핵심 원칙들 — spec-driven, 결정론적 검증, 환경 제약, 추적성 — 을 hoyeon은 상당 부분 구현하고 있다.

```
업계가 요구하는 것:                    hoyeon이 제공하는 것:
─────────────────                    ──────────────────
스펙 주도 개발            ✓            spec.json 레이어 체인
결정론적 검증             ✓            hoyeon-cli validate
환경 제약                ✓            allowed-tools, validate_prompt
Context rot 방지         △            서브에이전트 (부분)
관찰 가능성              △            Hook (부분)
멀티-런타임              ✗            Claude Code 전용
팀 협업 가독성           ✗ → ✓        spec.json만 → 문서 렌더링 patch로 보완
```

하네스 엔지니어링의 진화 단계로 보면:

```
Vibe Coding (2025)     → 직감 기반, 제약 없음
Spec Coding (2025+)    → 스펙 주도, 논리적 제약
Harness Engineering (2026) → 환경 주도, 런타임 제약
```

hoyeon은 **Spec Coding과 Harness Engineering의 경계**에 위치한다. 스펙 주도(spec.json)와 런타임 제약(allowed-tools, validate_prompt)을 모두 갖추고 있지만, context rot 대응과 멀티-런타임이라는 Harness Engineering의 최신 요구에는 미달한다.

우리가 추가한 **문서 렌더링 patch**(spec.json → design.md 9섹션)는 "기계가 검증하되, 사람이 읽을 수 있어야 한다"는 원칙을 보완한 것이다.

---

## 8. 이 프로젝트에 대한 시사점

### 8.1 specify 문서 렌더링 patch의 이식성

이번에 추가한 specify 문서 렌더링 기능의 이식성:

| 레이어 | 내용 | 이식성 |
|--------|------|:------:|
| Layer 1 | design.md 9섹션 표준, 작성 원칙 (3관점, 실제 파일명, JSON 예시) | **완전 이식** |
| Layer 2 | 각 게이트에서 문서 생성 → 리뷰 → 수정 루프, ID 가시성 규칙 | **구조 이식** |
| Layer 3 | hoyeon-cli merge/patch, Write 도구로 파일 생성, AskUserQuestion | **재구현 필요** |

### 8.2 문서 프로젝트(sr-mngt-ws) 특이사항

이 프로젝트는 코드가 아닌 문서를 다루므로, 스킬/에이전트의 **Layer 1 (지식)**이 특히 중요하다:

- 프로젝트 에이전트(architect/coder/reviewer/tester)는 **문서 도메인 지식**을 담고 있음
- 이 지식은 Claude Code 전용이 아님 → 어떤 LLM에든 적용 가능
- 예: reviewer의 5축 리뷰 기준 (정확성/완전성/일관성/가독성/실행가능성)은 범용 LLM에서도 동일하게 유효

---

## 참조 문서

### 프로젝트 내부

| 문서 | 내용 |
|------|------|
| `06_post-install-config-review.md` | 플러그인 아키텍처 기술 상세 (설치, 로딩, 네임스페이스) |
| **07_skill-architecture-understanding.md** | **이 문서 (LLM 제어 방식 + 이식성 + 프레임워크 비교 + 업계 분석)** |

### 외부 참조

| 출처 | 내용 |
|------|------|
| [Martin Fowler - Harness engineering](https://martinfowler.com/articles/harness-engineering.html) | 하네스 엔지니어링 정의, computational guides, 레포 SSoT |
| [Addy Osmani - Good spec for AI agents](https://addyosmani.com/blog/good-spec/) | AI 에이전트를 위한 스펙 작성법 |
| [Red Hat - Structured workflows](https://developers.redhat.com/articles/2026/04/07/harness-engineering-structured-workflows-ai-assisted-development) | 구조화된 워크플로우 설계 |
| [Datadog - Verification loop](https://www.datadoghq.com/blog/ai/harness-first-agents/) | Harness-first 접근, 관찰 가능성 |
| [Thoughtworks - Spec-driven development](https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices) | Spec-driven 개발 방법론 |
| [arXiv - AI Coding Agents for Terminal](https://arxiv.org/html/2603.05344v1) | 터미널 기반 AI 코딩 에이전트 아키텍처 |
| [Superpowers, GSD, gstack 비교](https://medium.com/@tentenco/superpowers-gsd-and-gstack-what-each-claude-code-framework-actually-constrains-12a1560960ad) | 세 프레임워크의 제약 방식 비교 |
| [GSD GitHub](https://github.com/gsd-build/get-shit-done) | GSD v1 소스 |
| [GSD-2 GitHub](https://github.com/gsd-build/gsd-2) | GSD v2 소스 (독립 CLI) |
