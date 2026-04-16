# sr-harness-cli의 역할과 스킬 의존성

> 작성일: 2026-04-12
> 목적: hoyeon 생태계에서 sr-harness-cli의 정확한 역할과 스킬과의 의존 관계 정리

---

## 1. sr-harness-cli란

`sr-harness-cli`는 **npm으로 전역 설치하는 Node.js CLI 도구**이다. Claude Code 밖에서 독립 실행되는 프로세스로, spec.json 파일을 안전하게 조작하는 전용 도구이다.

```bash
npm install -g @syscon-robotics/sr-harness-cli
```

- **패키지명**: `@syscon-robotics/sr-harness-cli`
- **버전**: v1.5.4 (hoyeon 플러그인과 동기화)
- **의존성**: ajv (JSON Schema 검증), ajv-formats
- **빌드**: esbuild로 번들링

---

## 2. 제공하는 명령어

### spec 서브커맨드 (핵심)

| 명령어 | 기능 |
|--------|------|
| `spec init <name> --goal "..." <path>` | spec.json 생성 (최소 유효 스키마) |
| `spec merge <path> --json/--stdin` | JSON 조각을 spec.json에 deep-merge |
| `spec merge --append` | 기존 배열에 항목 추가 (덮어쓰기 방지) |
| `spec merge --patch` | ID 기반 매칭으로 기존 항목 업데이트 |
| `spec validate <path> [--layer]` | AJV 스키마 검증 + 커버리지 체크 |
| `spec plan <path> [--format]` | 태스크 DAG → 실행 계획 (라운드/병렬 그루핑) |
| `spec task <id> --status <status>` | 태스크 상태 변경 (pending → in_progress → done) |
| `spec status <path>` | 태스크 완료 현황 (exit 0=전체 완료, 1=미완료) |
| `spec check <path>` | 내부 일관성 검증 (fulfills 참조, depends_on 순환 등) |
| `spec derive-tasks <path>` | 요구사항 → 태스크 스텁 자동 생성 (fulfills 자동 연결) |
| `spec derive-requirements <path>` | 결정 → 요구사항 스텁 자동 생성 |
| `spec learning --task <id>` | 실행 중 교훈을 context/learnings.json에 기록 |
| `spec issue --task <id>` | 이슈를 context/issues.json에 기록 |
| `spec search "query"` | BM25로 모든 spec의 요구사항/교훈 검색 |
| `spec guide [section]` | 스키마 필드 가이드 출력 (merge 전 참조용) |
| `spec sub <id> --get` | 서브 요구사항 상세 조회 |
| `spec meta <path>` | 스펙 메타 정보 조회 |
| `spec drift <path>` | 계획 vs 실행 drift 분석 |
| `spec amend --reason <id>` | 피드백 기반 스펙 수정 |

### 기타 서브커맨드

| 명령어 | 기능 |
|--------|------|
| `session set/get --sid <id>` | 세션 상태 관리 (현재 스펙 경로 등) |
| `settings validate` | 훅 경로 정합성 검증 |

---

## 3. 왜 필요한가 — LLM의 JSON 직접 쓰기 문제 해결

| 문제 | sr-harness-cli 해법 |
|------|----------------|
| LLM이 JSON을 직접 쓰면 스키마 위반, 필드 누락, 타입 오류 발생 | CLI가 AJV로 **쓰기 시점에** 스키마 검증 |
| LLM이 기존 배열을 통째로 덮어쓸 수 있음 | `--append`(항목 추가), `--patch`(ID 매칭 업데이트)로 안전한 병합 |
| fulfills[] 커버리지 누락 | `validate --layer tasks`가 **누락된 요구사항 자동 검출** |
| 태스크 DAG 계산의 복잡성 | `spec plan`이 depends_on[] 분석 → 병렬 라운드 자동 생성 |
| 교훈/이슈의 구조화 저장 | `spec learning`, `spec issue`로 context/ 디렉토리에 구조화 저장 |

---

## 4. 스킬과의 의존 관계

### 호출 흐름

```
┌─────────────────────────────────────────────────────┐
│  Claude Code 세션                                    │
│                                                     │
│  /specify (SKILL.md)                                │
│    │                                                │
│    ├─ "L2 결정을 도출했다. spec.json에 기록하자"       │
│    │                                                │
│    └─ Bash("sr-harness-cli spec merge ... --stdin << EOF │
│         {\"context\": {\"decisions\": [...]}}         │
│         EOF")                                       │
│         ↓                                           │
│    ┌────────────────────────┐                       │
│    │ sr-harness-cli (외부 프로세스) │                     │
│    │  1. JSON 파싱            │                     │
│    │  2. AJV 스키마 검증       │                     │
│    │  3. deep merge + 저장    │                     │
│    │  4. history.json 기록    │                     │
│    └────────────────────────┘                       │
│         ↓                                           │
│    spec.json 업데이트 완료                            │
│    │                                                │
│    ├─ "L3 요구사항을 도출하자"                         │
│    └─ Bash("sr-harness-cli spec derive-requirements ...") │
│         ↓                                           │
│    └─ Bash("sr-harness-cli spec derive-tasks ...")       │
│                                                     │
│  /execute (SKILL.md)                                │
│    │                                                │
│    ├─ Bash("sr-harness-cli spec plan ...")  → 실행 계획   │
│    ├─ Bash("sr-harness-cli spec task T1 --status done")  │
│    └─ Bash("sr-harness-cli spec check ...")  → 일관성 검증│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 관계 요약

- **스킬(SKILL.md)** = "무엇을 할지"를 지시하는 프롬프트 (마크다운)
- **sr-harness-cli** = "spec.json을 안전하게 조작하는 도구" (JavaScript)
- 스킬이 **Bash 도구를 통해** sr-harness-cli를 호출한다
- **sr-harness-cli 없이 스킬이 동작할 수 없다** — 필수 의존성

### 의존성 체인

```
/specify, /execute, /ultrawork (스킬)
    ↓ Bash() 호출
sr-harness-cli (npm 전역 설치)
    ↓ 읽기/쓰기
spec.json + context/ (로컬 파일)
    ↓ 검증
dev-spec-v1.schema.json (AJV 스키마)
```

### 설치 요구사항

| 컴포넌트 | 설치 방법 | 필수 여부 |
|----------|---------|-----------|
| hoyeon 플러그인 (스킬/에이전트/훅) | `claude plugin install` | 필수 |
| sr-harness-cli (npm 패키지) | `npm install -g @syscon-robotics/sr-harness-cli` | **필수** — 없으면 스킬 동작 불가 |
| Node.js | 시스템 설치 | 필수 (sr-harness-cli 실행 환경) |

---

## 5. 데이터 흐름

```
사용자 요청
    ↓
/specify 스킬 (Claude Code 내)
    ↓ Bash("sr-harness-cli spec init ...")
.sr-harness/specs/<name>/spec.json  ← 생성
    ↓ Bash("sr-harness-cli spec merge ... --stdin")
spec.json  ← decisions, requirements, tasks 병합
    ↓ Bash("sr-harness-cli spec validate ...")
스키마 검증 + 커버리지 체크
    ↓ Bash("sr-harness-cli spec plan ...")
실행 계획 (라운드별 병렬 그루핑) 출력
    ↓
/execute 스킬 (Claude Code 내)
    ↓ Worker 에이전트 디스패치
    ↓ Bash("sr-harness-cli spec task T1 --status done")
spec.json  ← 태스크 상태 업데이트
    ↓ Bash("sr-harness-cli spec learning --task T1 ...")
context/learnings.json  ← 교훈 기록
    ↓ Bash("sr-harness-cli spec check ...")
최종 일관성 검증
```

---

## 6. 기존 환경과의 차이

현재 글로벌 스킬(brainstorming, writing-plans 등)은 **CLI 도구에 의존하지 않는다**. 모든 산출물을 LLM이 마크다운으로 직접 작성한다.

| 관점 | 현재 (글로벌 스킬) | hoyeon |
|------|-------------------|--------|
| **산출물 작성** | LLM이 직접 마크다운 작성 | LLM이 sr-harness-cli를 통해 JSON 작성 |
| **검증** | 사람이 읽고 판단 | AJV 스키마 자동 검증 |
| **외부 도구 의존** | 없음 | sr-harness-cli (npm) 필수 |
| **설치 복잡도** | 스킬 파일만 배치 | 플러그인 + npm 전역 설치 |
| **오프라인 동작** | 완전 가능 | Node.js + npm 필요 |
