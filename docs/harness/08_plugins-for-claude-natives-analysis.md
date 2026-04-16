# plugins-for-claude-natives 분석 — clarify vs deep-interview vs specify 인터뷰 비교

> 작성일: 2026-04-14
> 목적: team-attention/plugins-for-claude-natives 플러그인 모음 조사, clarify 스킬의 인터뷰 방식을 hoyeon의 deep-interview/specify와 비교하여 도입 필요성 판단

---

## 1. plugins-for-claude-natives 개요

### 1.1 포지셔닝

`team-attention/plugins-for-claude-natives`는 Claude Code용 **범용 플러그인 마켓플레이스**. 현재 설치된 `hoyeon`(워크플로우 자동화)과 달리 **일상 생산성 확장**에 초점을 둔 13개 독립 플러그인 모음.

```
team-attention/
├── hoyeon                         ← 설치됨 (v1.5.4). 요구사항 중심 개발 자동화
│   28 skills + 21 agents + CLI + Hooks
│
├── harness                        ← 미설치. AI-ready 프로젝트 환경 준비 도구
│   check-harness, scaffold, specify (별개 버전)
│
└── plugins-for-claude-natives     ← 미설치. 범용 플러그인 모음 (13개)
    일상 도구 확장 (TTS, Gmail, 카카오톡, 팟캐스트 등)
```

세 제품은 **서로 독립적**이며 기술적 연결이 없다. 필요한 것만 골라서 설치 가능.

### 1.2 설치 방법

npm 패키지가 아니다. Claude Code 플러그인 시스템으로 설치한다.

```bash
# 마켓플레이스 등록
/plugin marketplace add team-attention/plugins-for-claude-natives

# 개별 플러그인 설치 (필요한 것만)
/plugin install <plugin-name>
```

### 1.3 전체 플러그인 목록 (13개)

#### AI 협업 / 의사결정

| 플러그인 | 기능 | 트리거 |
|---------|------|--------|
| **agent-council** | Gemini CLI, GPT, Codex를 병렬 호출 → 의견 합성 | "summon the council", "ask other AIs" |
| **team-assemble** | 코드베이스 분석 → 최적 에이전트 팀 동적 설계 → 6-Phase 실행 | "assemble a team to..." |
| **doubt** | 프롬프트에 `!rv` 포함 시 Stop hook으로 응답 재검증 강제 | `!rv` 키워드 |

#### 개발자 도구

| 플러그인 | 기능 | 트리거 |
|---------|------|--------|
| **dev** | `dev-scan` (Reddit/HN/Dev.to 여론 스캔) + `tech-decision` (4-에이전트 기술 비교) | "developer reactions to...", "A vs B" |
| **clarify** | 모호한 요구사항 → 구조화된 인터뷰 → 정밀 스펙 변환 | `/clarify` |
| **interactive-review** | 계획/문서를 브라우저 웹 UI에서 체크박스로 검토 → 구조화 피드백 반환 | `/review` |
| **session-wrap** | `/wrap` (세션 마무리 4-에이전트 분석) + `/history-insight` (패턴 분석) + `/session-analyzer` | `/wrap`, `/history-insight` |

#### 콘텐츠 / 미디어

| 플러그인 | 기능 | 트리거 |
|---------|------|--------|
| **youtube-digest** | YouTube URL → 요약 + 인사이트 + 한국어 번역 + 3단계 퀴즈(9문항) | YouTube URL |
| **podcast** | URL/문서 → 한국어 팟캐스트 스크립트 → OpenAI TTS 음성 → YouTube 업로드 | "팟캐스트 만들어" |
| **say-summary** | 모든 응답을 3~10단어로 요약 → macOS TTS로 낭독 (한/영 자동 감지) | 자동 (Stop hook) |

#### 커뮤니케이션

| 플러그인 | 기능 | 트리거 |
|---------|------|--------|
| **gmail** | 다중 계정 Gmail 읽기/검색/발송/레이블 관리 | "check my email" |
| **google-calendar** | 다중 계정 일정 CRUD + 계정 간 충돌 감지 | "show my schedule" |
| **kakaotalk** | macOS Accessibility API로 카카오톡 메시지 발송/읽기 | "카톡 보내줘" |

### 1.4 외부 의존성 요약

| 플러그인 | 필요 조건 |
|---------|---------|
| agent-council | Gemini CLI + OpenAI API 키 |
| gmail / google-calendar | Google Cloud 프로젝트 + OAuth + `uv` |
| kakaotalk | macOS + KakaoTalk 앱 + Accessibility 권한 |
| podcast | OpenAI API 키 + Google OAuth + ffmpeg |
| say-summary | macOS + Python 3.10+ |
| dev (tech-decision) | Gemini CLI |
| 나머지 | 자체 충족 |

---

## 2. clarify 플러그인 상세

### 2.1 구성: 3개 독립 스킬

| 스킬 | 용도 | 산출물 | 산출물 포맷 |
|------|------|--------|-----------|
| **vague** | 모호한 요구사항 → 정밀 스펙 | Before/After 마크다운 요약 | `.md` |
| **unknown** | 전략의 숨겨진 가정 분석 | 4분면(Known/Unknown) 플레이북 | `.md` |
| **metamedium** | 콘텐츠 vs 형식 레버리지 분석 | Content/Form 분석 블록 | `.md` |

**최종 산출물은 모두 마크다운**. spec.json 같은 기계 처리 가능한 JSON을 생성하지 않는다.

### 2.2 vague 스킬 — 인터뷰 방법론

#### 핵심 원칙: Hypothesis-as-Options

오픈 질문을 금지하고, 모든 질문을 선택지 형태의 가설로 제시한다.

```
BAD:  "어떤 로그인 방식을 원하세요?"         ← 오픈 질문, 인지 부하 높음
GOOD: "OAuth / 이메일+패스워드 / SSO / Magic link" ← 하나 선택
```

#### Phase 구조 (4단계)

| Phase | 내용 | 질문 수 |
|-------|------|---------|
| 1. Capture and Diagnose | 원본 요구사항 기록 + 모호성 진단 | 0 |
| 2. Iterative Clarification | AskUserQuestion으로 가설형 질문 | 5~8개 (1회 최대 4개 배칭) |
| 3. Before/After Summary | 원본 → 명확화된 스펙 변환 표시 | 0 |
| 4. Save Option | `requirements/`에 저장 여부 확인 | 0 |

#### 모호성 카테고리 (6종)

| 카테고리 | 예시 가설들 |
|---------|-----------|
| Scope | 전체 사용자 / 어드민만 / 특정 역할 |
| Behavior | 조용히 실패 / 에러 표시 / 자동 재시도 |
| Interface | REST API / GraphQL / CLI |
| Data | JSON / CSV / 둘 다 |
| Constraints | `<100ms` / `<1s` / 없음 |
| Priority | Must-have / Nice-to-have / 미래 |

#### 산출물 형식

```markdown
## Requirement Clarification Summary

### Before (Original)
"{original request verbatim}"

### After (Clarified)
**Goal**: [precise description]
**Scope**: [included and excluded]
**Constraints**: [limitations, preferences]
**Success Criteria**: [how to know when done]

**Decisions Made**:
| Question | Decision |
|----------|----------|
| [ambiguity 1] | [chosen option] |
```

### 2.3 unknown 스킬 — 3-Round Depth Pattern

vague와 다른 구조: R1→R2→R3 3라운드 심층 탐색.

| 라운드 | 목적 | 질문 수 | 특징 |
|--------|------|---------|------|
| R1 | 초안 사분면 검증 | 3~4개 | 광범위, 전체 사분면 커버 |
| R2 | 약점 심층 드릴 | 2~3개 | R1 응답에서 파생, 타깃형 |
| R3 | 실행 세부 확정 | 2~3개 | 구체적, skip 가능 |

산출물: `{topic}-known-unknown.md` 형태의 4사분면 플레이북.

---

## 3. 인터뷰 방식 3자 비교: clarify vs deep-interview vs specify

### 3.1 질문 철학의 근본 차이

| 항목 | clarify (vague) | deep-interview | specify (L2) |
|------|----------------|----------------|--------------|
| **질문 형태** | 가설형 선택지 **only** | 소크라틱 오픈 질문 **only** | 시나리오형 선택지 **only** |
| **금지 사항** | 오픈 질문 금지 | 구현 제안 금지 | 추상적 질문 금지 |
| **질문 도구** | `AskUserQuestion` (구조화 UI) | 인터뷰어 에이전트 (대화형) | `AskUserQuestion` (구조화 UI) |

```
clarify:        "로그인 방식은? → [OAuth / Email+PW / Magic Link / SSO]"
deep-interview: "'빠르게'라고 했는데, 어떤 응답 시간을 목표로 하시나요?"
specify:        "사용자 토큰이 폼 작성 중 만료됨. Submit 클릭 시 어떻게 되어야 하나요?
                 → [Silent refresh + retry / Login redirect / Agent decides]"
```

### 3.2 인터뷰 깊이 비교

| 항목 | clarify (vague) | deep-interview | specify (L2) |
|---|---|---|---|
| **질문 수** | 5~8개 (hard cap) | 최대 10라운드 | 스코어 기반 (무한, 실질 5~10) |
| **배칭** | 1회에 최대 4개 묶음 | 1라운드 1질문 | 1라운드 2질문 |
| **실질 인터랙션** | 2~3회 호출 | 5~10회 대화 | 3~7회 호출 |
| **종료 조건** | 모든 critical 모호성 해소 | Ambiguity Score ≤ 0.2 | Composite ≥ 0.80 + 차원별 ≥ 0.60 |
| **스코어링** | 없음 (정성적 판단) | 3차원 가중치 (40/30/30) | 5차원 가중치 (25/20/20/15/20) |
| **후속 질문** | 없음 (배칭으로 커버) | 자동 (최저 차원 타겟) | 자동 (provisional → follow-up) |

### 3.3 스코어링 체계 비교

```
clarify:         스코어 없음. "충분히 명확해 보이면 종료"
                 → 주관적 판단, 빠지는 영역 가능

deep-interview:  3차원 × 0~1.0 (단순)
                 ┌─ Goal Clarity     (40%)
                 ├─ Constraint Clarity (30%)
                 └─ Success Criteria  (30%)
                 종료: weighted ≥ 0.8 (ambiguity ≤ 0.2)

specify (L2):    5차원 × 3-state (정밀)
                 ┌─ Core Behavior    (25%)
                 ├─ Scope Boundaries (20%)
                 ├─ Error/Edge Cases (20%)
                 ├─ Data Model       (15%)
                 └─ Implementation   (20%)
                 종료: composite ≥ 0.80 AND 차원별 ≥ 0.60 AND unknowns == 0
```

specify가 가장 엄격하다. 차원별 floor(0.60)이 있어서 한 영역만 깊고 나머지가 얕으면 통과 불가.

### 3.4 모호성 탐지 메커니즘

| 항목 | clarify | deep-interview | specify |
|------|---------|----------------|---------|
| **모호성 식별** | Phase 1에서 수동 진단 | 인터뷰어 에이전트 판단 | 3-Tier 자동 탐지 |
| **숨겨진 가정 발굴** | 없음 | Probe 유형 선택 (6종) | Unknown/Unknown Detection |
| **Actor 분석** | 없음 | 없음 | Tier 1: Actor Check |
| **결정 간 충돌** | 없음 | 없음 | Tier 3: Pair Tension Check |
| **Inversion Probe** | 없음 | 없음 | 있음 (0.80 도달 시 안전 검증) |
| **외부 리뷰** | 없음 | 없음 | L2-Reviewer 에이전트 (Steelman test) |

### 3.5 질문 유형 레퍼토리

| clarify | deep-interview | specify |
|---------|----------------|---------|
| 가설 검증형 (유일) | Clarifying (모호한 용어) | 시나리오형 (유일) |
| — | Challenging (가정 도전) | — |
| — | Consequential (함의 탐색) | — |
| — | Perspective (관점 전환) | — |
| — | Meta (본질 재질문) | — |
| — | Ontological (정의 질문) | — |

deep-interview의 질문 레퍼토리가 가장 넓다. 6종 프로브 유형으로 다각도 탐색.

### 3.6 산출물 비교

| 항목 | clarify | deep-interview | specify |
|------|---------|----------------|---------|
| **포맷** | 마크다운 (.md) | 마크다운 (insights.md) | JSON (spec.json) |
| **기계 처리** | 불가 | 불가 (사람용) | 가능 (/execute가 소비) |
| **후속 파이프라인** | 없음 (독립 완결) | `/specify --context`로 핸드오프 | /execute → 자동 구현 |
| **저장 위치** | `requirements/` (선택적) | `.sr-harness/deep-interview/` | `.sr-harness/specs/` |

---

## 4. clarify → specify → execute 파이프라인 검토

### 4.1 제안 파이프라인

```
clarify (vague)  →  specify  →  execute
   ↑ 변경 감지         ↑ 자동 재실행    ↑ 자동 재실행
   │                  │              │
requirements/*.md  spec.json     구현 코드
(마크다운)          (JSON)        
```

### 4.2 장점

| 항목 | 설명 |
|------|------|
| 역할 분리 | clarify = "무엇을 만들지" 명확화, specify = "어떻게 만들지" 구조화 |
| 요구사항 품질 향상 | clarify의 인터랙티브 Q&A가 모호함을 제거한 후 specify에 진입 |
| 변경 추적 가능 | requirements/*.md → spec.json → 코드, 3계층 이력 관리 |

### 4.3 문제점

#### 문제 1: 포맷 단절 — 가장 큰 장벽

```
clarify 출력:  마크다운 (비구조화, 사람용)
specify 입력:  대화 기반 Goal 텍스트 → 내부에서 L0→L4 도출
```

specify는 마크다운 파일을 읽어서 자동으로 spec.json을 생성하는 기능이 **없다**. specify 자체가 인터랙티브하게 질문하면서 L0→L1→L2→L3→L4를 도출하는 스킬이므로, clarify 산출물을 입력으로 넣으면 **중복 질문**이 발생한다.

#### 문제 2: 자동 재실행의 위험

```
requirements/auth.md 한 줄 수정
  → specify 전체 재실행 (인터뷰 포함, 5~10분)
  → execute 전체 재실행 (구현 전체 재작성?)
```

- specify는 **인터랙티브** — 자동 트리거 시 질문 응답을 누가 하는가?
- execute는 **파괴적** — 기존 구현을 덮어쓸 수 있음
- 사소한 문구 수정에도 전체 파이프라인이 돌아감

#### 문제 3: clarify와 specify의 기능 중복

| 단계 | clarify (vague) | specify (L1~L2) |
|------|----------------|-----------------|
| 모호함 식별 | O | O |
| 인터랙티브 질문 | O (5~8개) | O (L1 Context, L2 Decisions) |
| 스코프 정의 | O | O |
| 제약조건 도출 | O | O |

둘 다 "요구사항 명확화"를 한다. 직렬로 연결하면 사용자가 비슷한 질문을 두 번 받게 된다.

### 4.4 대안 검토

#### A안: clarify를 specify의 "프리히팅"으로 사용

```
clarify → requirements.md 저장
                ↓ (사용자가 수동으로)
specify --context requirements/auth.md  ← 기존 문서를 참조 컨텍스트로 전달
                ↓
execute
```

- specify가 clarify 산출물을 **읽되**, 자체 인터뷰에서 이미 답변된 항목은 건너뛰는 방식
- 현재 specify에 `--context` 같은 옵션은 없으므로 **스킬 수정이 필요**

#### B안: clarify 대신 specify의 L1~L2를 강화

```
specify (강화된 인터뷰)  →  execute
```

- specify 자체가 clarify 수준의 명확화를 수행하도록 스킬 프롬프트를 조정
- 도구 하나로 통일, 포맷 단절 없음
- **가장 현실적인 접근**

#### C안: 변경 감지는 Hook으로, 재실행은 수동 승인

```
clarify → requirements.md
              ↓ (Hook: 파일 변경 감지)
[알림] "requirements/auth.md가 변경됨. specify 재실행할까요?"
              ↓ (사용자 승인)
specify → execute
```

- 자동 감지 + 수동 승인으로 위험 통제
- Hook 구현은 가능하지만, specify 재실행 시 기존 spec.json과의 diff/merge가 미해결

### 4.5 파이프라인 평가

| 평가 항목 | 판정 |
|----------|------|
| 개념적 가치 | **높음** — 명확화와 구조화의 분리는 좋은 원칙 |
| 기술적 실현성 | **낮음** — 포맷 단절 + 인터랙티브 스킬 자동화 + 중복 질문 문제 |
| 비용 대비 효과 | **낮음** — clarify와 specify의 역할이 70% 이상 겹침 |

---

## 5. deep-interview는 clarify를 대체 가능한가

### 5.1 축별 비교

| 비교 축 | clarify | deep-interview | 판정 |
|---------|---------|----------------|------|
| 모호성 해소 능력 | 가설형 선택지로 빠르게 확정 | 오픈 질문으로 깊게 탐색 | **deep-interview 우위** |
| 질문 깊이 | 얕음 (5~8개, 배칭) | 깊음 (10라운드, 개별) | **deep-interview 우위** |
| 스코어링 | 없음 | 3차원 정량 | **deep-interview 우위** |
| 사용자 인지 부하 | 낮음 (선택만 하면 됨) | 높음 (매번 서술 답변) | **clarify 우위** |
| 소요 시간 | 짧음 (2~3분) | 김 (10~20분) | **clarify 우위** |
| specify 핸드오프 | 없음 (마크다운 독립) | 있음 (`/specify --context`) | **deep-interview 우위** |

### 5.2 판정

**deep-interview는 clarify의 상위 호환**이다. clarify가 하는 모든 것(모호성 식별 → 질문 → 명확화)을 더 깊게, 더 체계적으로 수행하며, specify로의 핸드오프까지 내장되어 있다.

clarify가 우위인 2개 축(인지 부하, 소요 시간)은 **편의성 차이**이지 **역할 차이**가 아니다.

### 5.3 specify L2와의 관계

specify의 L2는 deep-interview보다 **더 깊지만, 다른 것을 묻는다**:

| 항목 | deep-interview | specify L2 |
|------|----------------|------------|
| **관심사** | "무엇을 만들지" (What) | "어떻게 동작해야 하는지" (How) |
| **질문 예시** | "이 CLI가 성공하면 어떻게 알 수 있나요?" | "사용자 토큰이 폼 작성 중 만료되면?" |
| **답변 검증** | Ambiguity Score (정성+정량) | 3-state 판별 (discriminator 유무) |
| **안전장치** | 없음 | Inversion Probe + L2-Reviewer + Steelman |

**deep-interview = 광의적 "왜/무엇" 탐색**
**specify L2 = 구체적 "동작/엣지케이스" 확정**

둘은 겹치는 게 아니라 **직렬로 보완**하는 관계.

---

## 6. 3개 스킬의 포지션 정리

```
탐색 깊이 →

clarify          deep-interview              specify L2
  │                    │                         │
  ├─ 가설 선택 ─────────├─ 소크라틱 탐색 ──────────├─ 시나리오 확정 ──────
  │  "이거? 저거?"     │  "왜? 정말? 만약?"      │  "이 상황에서 어떻게?"
  │                    │                         │
  │  5~8개 질문        │  ~10라운드              │  스코어 기반 (무한)
  │  스코어 없음        │  3차원 스코어           │  5차원 + 3-state + floor
  │  마크다운 출력      │  insights.md 출력       │  spec.json 출력
  │                    │                         │
  └── 2~3분 ───────────└── 10~20분 ──────────────└── 15~30분 ──────────
```

---

## 7. 결론 및 권장

### 7.1 clarify 설치 필요성

**불필요하다.** hoyeon에 이미 deep-interview 스킬이 있고, 이것이 clarify의 상위 호환이다. 추가로:
- deep-interview → specify 핸드오프가 내장되어 있어 파이프라인이 끊기지 않음
- clarify를 설치하면 specify와 70% 이상 중복되는 인터뷰를 2회 거쳐야 함
- 포맷 단절(마크다운 → JSON) 문제가 해결되지 않음

### 7.2 권장 파이프라인

요구사항이 모호할 때:

```
deep-interview → insights.md 저장 → /specify --context insights.md → /execute
```

요구사항이 비교적 명확할 때:

```
/specify → /execute
```

specify 자체가 L0(Goal Mirror) + L1(Context Research) + L2(Score-driven Interview)에서 충분한 명확화를 수행하므로, 대부분의 경우 deep-interview를 거치지 않아도 된다.

### 7.3 plugins-for-claude-natives에서 검토할 만한 플러그인

clarify는 불필요하지만, 다른 플러그인 중 이 프로젝트에서 유용할 수 있는 것:

| 플러그인 | 활용 시나리오 | 우선순위 |
|---------|-------------|---------|
| **interactive-review** | 문서하네스로 작성한 문서를 브라우저 UI에서 검토 | 중 |
| **session-wrap** | 긴 문서 작성 세션 종료 시 작업 요약/패턴 분석 | 낮 |
| **youtube-digest** | 프로젝트 관리/AMR 관련 영상 학습 요약 | 낮 |
