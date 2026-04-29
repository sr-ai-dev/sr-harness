# 글로벌 CLAUDE.md 개편안

> 작성일: 2026-04-12
> 목적: hoyeon 전환에 맞춰 글로벌 CLAUDE.md를 개편. 기존 프로젝트 호환성 유지.

---

## 변경 요약

| 섹션 | 현재 | 개편 | 이유 |
|------|------|------|------|
| 소통 규칙 | 유지 | **변경 없음** | — |
| Git 커밋 규칙 | 유지 | **변경 없음** | — |
| 작업 유형별 접근법 | `development-workflow` 참조 | **hoyeon 우선, 폴백 규칙** | hoyeon 없는 프로젝트 호환 |
| 5단계 워크플로우 | 전체 섹션 | **제거** | hoyeon /specify → /execute로 대체 |
| reviewer 필수 규칙 | 절대 규칙 | **제거** | hoyeon verify depth로 위임 |
| tester 검증 범위 | 절대 규칙 | **제거** | hoyeon verify recipe로 위임 |
| 설계 문서 표준 | brainstorming 참조 | **수정** (SSoT 원칙 + 렌더러 역할) | spec.json 중심 체계 |
| Iron Law (신규) | 없음 | **추가** | verification + debugging 원칙 내재화 |
| 기능 사용 표시 | 유지 | **hoyeon 항목 추가** | — |
| 실패 처리 | 유지 | **변경 없음** | — |
| 나머지 | 유지 | **변경 없음** | — |

---

## 개편안 전문

아래가 새 `~/.claude/CLAUDE.md` 전문이다.

```markdown
# Claude Code 글로벌 지침

> 이 파일은 모든 프로젝트에 자동 적용됩니다.
> 프로젝트 고유 정보(기술 스택, 디렉토리 구조 등)는 각 프로젝트의 CLAUDE.md에 작성하세요.

## 소통 규칙

- 한국어로 소통 (코드/명령어/기술 용어는 영어 유지)
- 간결하고 직접적인 답변

## Git 커밋 규칙

- 커밋 메시지는 한글로 작성
- Co-Authored-By 라인 포함하지 않음
- 변경된 파일/기능 목록을 본문에 표시
- 예시:
  ```
  기능 추가: XXX 구현

  변경 사항:
  - src/foo.py: 새 함수 추가
  - config/bar.yaml: 파라미터 수정
  ```

## 작업 유형별 접근법

### 간단한 작업 (1-2 파일 수정)
- 바로 구현 진행
- 별도 설계 문서 불필요

### 복잡한 작업 (3+ 파일, 새 기능, 아키텍처 결정)
- 설계 문서 없이 복잡한 기능 구현 금지
- 사용자 승인 없이 구현 시작 금지
- **hoyeon 플러그인 설치 시**: `/specify` → `/execute` 파이프라인 사용
- **hoyeon 미설치 시**: 아래 폴백 워크플로우 적용

### 폴백 워크플로우 (hoyeon 미설치 환경)

hoyeon 플러그인이 없는 프로젝트에서 복잡한 작업 시:

1. 요구사항 정리 → `docs/plans/<topic>/requirements.md`
2. 설계 문서 작성 → `docs/plans/<topic>/design.md`
3. 태스크 분해 → `docs/plans/<topic>/tasks.md`
4. 사용자 승인 후 구현
5. 검증 후 완료 보고 → `docs/plans/<topic>/summary.md`

각 단계 간 사용자 승인 게이트를 거친다.

> **마이그레이션 참고**: 이전 글로벌 CLAUDE.md에 있던 "reviewer 매 태스크 필수"와 "tester 런타임 검증 필수" 규칙은 hoyeon verify depth로 이관되었다. hoyeon 미설치 프로젝트에서 해당 규칙이 필요하면 프로젝트 CLAUDE.md에 추가한다.

## Iron Law (절대 규칙)

모든 프로젝트, 모든 워크플로우에 적용되는 2가지 절대 원칙:

### 1. 증거 없이 완료 주장 금지

```
완료를 주장하려면 → 검증 명령 실행 → 출력 확인 → 그 다음에 주장
```

- "통과할 거예요", "아마 됐을 거예요" = 금지
- 테스트 결과, 빌드 출력, 실행 결과 등 **증거를 먼저 제시**한다
- 에이전트 성공 보고도 독립적으로 검증한다

### 2. 근본 원인 없이 수정 금지

```
버그 발견 → 근본 원인 조사 → 원인 파악 → 그 다음에 수정
```

- "일단 이거 바꿔보자" = 금지
- 에러 메시지를 끝까지 읽고, 재현하고, 데이터 흐름을 추적한다
- 3회 수정 실패 시 아키텍처를 의심하고 사용자에게 보고한다

## 설계 문서 표준

### hoyeon 사용 시

- **spec.json이 Single Source of Truth** — 모든 도출(결정→요구사항→태스크)은 spec.json에서 관리
- 마크다운 문서(requirements.md, design.md)는 **spec.json의 렌더링된 뷰**
- `brainstorming` 스킬은 spec.json → 마크다운 문서 생성 역할 (협업/평가용)
- spec.json 수정 → 문서 갱신. 문서 직접 수정 금지 (SSoT 위반)

### hoyeon 미사용 시

- design.md 9개 섹션 표준은 `brainstorming` 스킬에 내장 (스킬 호출 시 자동 적용)
- 프로젝트에 `docs/plans/_templates/`가 있으면 해당 템플릿을 우선 참조
- 새 프로젝트 초기화(`init-project`) 시 4종 템플릿이 자동 생성됨

## 컨텍스트 압축 시 보존 사항

긴 대화에서 컨텍스트가 압축될 때 반드시 보존:
- 현재 진행 중인 워크플로우 단계 및 작업 번호
- 수정/생성한 파일 목록과 각 파일의 변경 목적
- 도메인 모델 관련 설계 결정

## Auto Memory 활용

- `memory/MEMORY.md`에 프로젝트별 경험/패턴을 기록
- 글로벌 CLAUDE.md와 중복되는 내용은 MEMORY.md에 넣지 않음
- 프로젝트 CLAUDE.md에 있는 기술 스택/명령어 정보도 중복 금지

## 기능 사용 표시

작업 진행 중 다음 고급 기능을 사용할 때 **사용 시점에** 간단히 표시한다:

| 기능 | 표시 예시 |
|------|----------|
| Skill 호출 | `[Skill: specify]` |
| Subagent 실행 | `[Subagent: Explore/Plan/Bash]` |
| 병렬 실행 | `[Parallel: 3개 동시 실행]` |
| Rule 적용 | `[Rule: design-change-propagation]` |
| Hook 트리거 | `[Hook: PostToolUse → validate-output]` |
| TodoWrite 추적 | `[Todo: 5개 태스크 중 2번째 진행]` |
| EnterPlanMode | `[PlanMode: 진입]` |
| AskUserQuestion | `[승인 요청]` |
| MCP 도구 | `[MCP: actionbook]` |
| sr-harness-cli | `[CLI: spec merge]` |

목적: 사용자가 Claude Code의 고급 기능 활용 상황을 실시간으로 파악하고 학습할 수 있도록 한다.

## 실패 처리 프로토콜

### 빌드/테스트 실패
1. 에러 메시지 분석 → 근본 원인 파악
2. 단일 원인: 즉시 수정 → 재실행
3. 복합 원인: TodoWrite로 이슈 분리 후 순차 해결
4. 3회 연속 실패: 사용자에게 상황 보고 + 대안 제시

### 모호한 요구사항
1. 코드베이스에서 기존 패턴/컨벤션 검색
2. 기존 패턴 있음 → 따르고 보고
3. 기존 패턴 없음 → AskUserQuestion으로 확인

### 판단 불가 상황
- 동등한 대안 2개 이상 → 트레이드오프 제시 후 사용자 선택
- 보안/데이터 손실 위험 → 무조건 중단 + 사용자 확인

### 충돌하는 피드백
- 우선순위: 프로젝트 CLAUDE.md > 글로벌 CLAUDE.md > 대화 내 지시
- 동일 계층 충돌 → 최신 지시 따르되 충돌 사실 보고

## 웹 검색/리서치 우선순위

1. **WebSearch** — 단순 검색 (1회 호출, 최소 토큰)
2. **WebFetch** — 특정 URL 내용 조회 (1회 호출)
3. **actionbook** (MCP) — 로그인/폼 조작/브라우저 자동화가 필요할 때만 사용

> actionbook은 다단계 호출(3-4회)이 필요하여 단순 검색에서는 오히려 토큰 낭비.
> 로그인 필요 사이트, 복잡한 폼, E2E 테스트, 딥 리서치(active-research)에서만 유리.

## 설정 계층

```
~/.claude/CLAUDE.md          ← 글로벌 (이 파일, 모든 프로젝트 적용)
~/.claude/settings.json      ← 글로벌 권한 기본값 + hoyeon 훅 등록
~/.claude/skills/            ← 스킬 디스커버리
프로젝트/CLAUDE.md            ← 프로젝트 고유 정보
프로젝트/.claude/rules/       ← 프로젝트 도메인 규칙
프로젝트/.claude/settings.local.json ← 프로젝트 권한 오버라이드
```
```

---

## 변경 상세 해설

### 제거된 섹션과 이유

| 제거 섹션 | 줄 수 | 이유 | 대체 |
|-----------|:-----:|------|------|
| 5단계 워크플로우 | 8줄 | hoyeon /specify → /execute 체계로 대체 | 폴백 워크플로우 (4줄) |
| reviewer 필수 규칙 | 18줄 | hoyeon verify depth (Light/Standard/Thorough/Ralph)가 관리 | — |
| tester 검증 범위 | 14줄 | hoyeon verify recipe (4-tier)가 관리 | — |

**총 40줄 제거, 대신 Iron Law 13줄 + 폴백 워크플로우 8줄 추가.**

### 기존 프로젝트 호환성

| 상황 | 동작 |
|------|------|
| hoyeon 설치된 프로젝트 | `/specify` → `/execute` 사용. spec.json SSoT 원칙 적용 |
| hoyeon 미설치 프로젝트 | 폴백 워크플로우 적용 (requirements.md → design.md → tasks.md → 구현) |
| brainstorming 스킬 호출 | hoyeon 있으면 렌더러 역할, 없으면 기존 9섹션 설계 (변경 없음) |

### reviewer/tester 규칙 제거의 영향

**기존 동작**: 모든 프로젝트에서 매 태스크 후 reviewer 필수, tester 런타임 검증 필수

**개편 후 동작**:
- **hoyeon 프로젝트**: verify depth 선택에 따라 자동 조정 (Light=빌드만, Standard=시맨틱+CR, Thorough=전체, Ralph=DoD 루프)
- **hoyeon 미설치 프로젝트**: 글로벌 규칙이 사라지므로, **필요한 프로젝트는 프로젝트 CLAUDE.md에 자체 규칙 추가 필요**

> **주의**: reviewer/tester 필수 규칙을 사용하던 프로젝트가 있다면, 해당 프로젝트의 CLAUDE.md에 동일 규칙을 추가해야 한다.
> **마이그레이션 정책**: 일괄 변경하지 않고, 각 프로젝트 작업 시 필요에 따라 개별 적용한다.

### Iron Law 추가 근거

verification-before-completion과 systematic-debugging에서 추출한 핵심 원칙 2건. 이 2가지는 hoyeon 유무와 무관하게 **모든 작업에 적용되어야 하는 범용 원칙**이다.
