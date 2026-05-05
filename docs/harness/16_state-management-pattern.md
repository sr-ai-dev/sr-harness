# State Management Pattern — Cold Scan vs Warm State Lookup

> 작성일: 2026-05-05
> 대상: Claude Code 에이전트의 상태 관리 방식 일반론
> 목적: 토큰/시간/사용자 인지부담을 줄이는 state 관리 패턴 정리. specify의 Smart Router는 이 패턴의 한 사례.
> 관련 문서:
> - [`15_specify-redesign-living-spec.md`](./15_specify-redesign-living-spec.md) — Smart Router / spec_inbox 구체 사례
> - [`01-1_sr-harness-cli-role.md`](./01-1_sr-harness-cli-role.md) — sr-harness-cli의 state 관리 명령군

---

## 0. 한 줄 요약

> Claude Code의 stateless cold-start 모델 위에, **작은 structured state 파일** + **inbox/mailbox 패턴**을 얹어 토큰/시간을 한 자릿수~두 자릿수 배 절감하고 사용자 재질문을 0에 수렴시킨다.

---

## 1. 배경 — Claude Code의 cold-start 가정

Claude Code 에이전트의 기본 실행 모델:

- **Stateless 시작**: 매 세션은 이전 세션의 in-memory 상태를 모름
- **Conservative 탐색**: 안전을 위해 필요한 정보를 매번 다시 발견
- **Tool 결과 ≠ 영구 저장**: 도구 호출 결과는 컨텍스트에만 남음, 다음 세션에서 휘발

장점:
- 재현가능성 — 어떤 환경에서 시작해도 같은 절차
- 안전성 — stale cache로 인한 잘못된 결정 방지
- 단순성 — 별도 인프라 없이 동작

단점:
- 토큰 비용 — 같은 정보를 매번 다시 스캔
- Latency — `Glob` → `Read` → `Grep` 반복
- 사용자 재질문 — "어디까지 했지?" 매번 묻기
- 컨텍스트 일관성 — 두 세션이 같은 코드를 다르게 해석할 수 있음

---

## 2. Cold Scan 흐름 (현재 default)

전형적인 시나리오 — "어제 진행하던 spec 이어가기":

```
사용자: 어제 하던 거 마저 하자

[Claude]
  Glob "*.md" → 50개 파일 발견 (~500 토큰)
  Read README.md → 200줄 (~3K 토큰)
  Bash "git status" → 변경 목록 (~200 토큰)
  Bash "git log --oneline -20" → 최근 커밋 (~500 토큰)
  Glob ".sr-harness/specs/*/" → 3개 spec 발견 (~100 토큰)
  Read .sr-harness/specs/teleop-ui/requirements.md → 300줄 (~5K 토큰)
  Read .sr-harness/specs/teleop-ui/qa-log.md → 800줄 (~12K 토큰)
  Grep "TODO|FIXME" → 결과 (~500 토큰)
  사용자에게 질문: "Phase 1까지 했네요. 어떤 axis부터 이어갈까요?"

→ 총 ~22K 토큰 + 사용자 응답 대기 + 여전히 부정확한 추정
```

**왜 이렇게 비싼가**:
- 마크다운 본문을 통째로 읽음 (frontmatter 5줄로 충분한 결정인데 800줄 다 읽음)
- Tool 결과가 컨텍스트에 누적
- 같은 정보를 다음 세션에 또 스캔

---

## 3. Warm State Lookup 패턴

핵심 통찰: **검색을 매번 하지 말고, 발견된 사실을 작은 파일에 적어두고, 다음 호출은 그것만 읽는다.**

3가지 구성요소:

### 3.1 Index — 빠른 탐색 키

작은 frontmatter / JSON으로 "지금 어떤 상태인가"를 100바이트 안에 표현.

```yaml
# qa-log.md 첫 5줄
---
status: in_progress
last_phase: phase1
last_axis: tech
audit_counts: {business: 1, interaction: 1, tech: 0, final: 0}
where: {situation: brownfield-extension, sr_profile: ros-node, ...}
---
```

이 5줄만 Read로 읽으면 "Phase 1 Tech axis 진행 중" 즉시 결정. **~200 토큰**.

### 3.2 Pointer — 정확한 진행 지점

`last_phase: phase1`, `last_step: 0.4`, `last_task_id: T1.3` 같은 명시적 위치 마커. 사용자에게 "어디까지 했어?" 묻지 않아도 됨.

### 3.3 Mailbox — 비동기 메시지 큐

발견자(blueprint, execute, qa)가 발견한 것을 큐에 적재 → 처리자(specify reflect)가 batch로 소비.

```json
// spec_inbox.json
{
  "items": [
    { "id": "INBOX-1", "source": "blueprint", "type": "missing_requirement", "description": "..." },
    { "id": "INBOX-2", "source": "execute",   "type": "ambiguity",           "description": "..." }
  ]
}
```

**검색 비용을 발견 시점에 분산** — 한 번 발견해 두면 다음 호출은 다시 안 찾음.

---

## 4. 효과 비교 (구체 사례)

"진행 중인 spec 이어가기" 시나리오:

| 단계 | Cold Scan | Warm State |
|---|---|---|
| 어떤 spec? | `find` + `Glob` + `ls` 결과 분석 | (frontmatter에 spec_dir 포인터) |
| 어디까지? | qa-log/requirements 통째로 Read | frontmatter 5줄 Read |
| 마지막 컨텍스트 | 본문 전체 + 사용자 재확인 | 마지막 axis 섹션만 Read |
| 토큰 합계 | **5~22K** | **300~500** |
| 도구 호출 수 | 6~10회 | 1~2회 |
| 사용자 질문 횟수 | 1~2회 | 0회 |

≈ **20~50배 절감** + 사용자 인지부담 0.

"무엇을 다음에 할까?" 시나리오 (inbox 활용):

| 단계 | Cold Scan | Warm State (inbox) |
|---|---|---|
| 발견 사항 수집 | blueprint/execute 결과 전체 다시 검토 (~30K) | spec_inbox.json Read (~1K) |
| 우선순위 결정 | 사용자 메모리 의존 | items의 type/severity 정렬 |
| 토큰 합계 | **30K+** | **1K** |

---

## 5. SR-Harness에 이미 적용된 사례

이 패턴은 신규 발명이 아니라 sr-harness 곳곳에 부분 적용되어 있다.

| 곳 | Index | Pointer | Mailbox |
|---|---|---|---|
| `sr-harness-cli session set/get` | session.json | sid + key | — |
| `sr-harness-cli learning` | — | task_id | learnings.json |
| `sr-harness-cli issue` | — | task_id | issues.json |
| specify `qa-log.md` frontmatter | status, depth_calibration | last_phase, last_axis | (sr.7에서 미구현) |
| execute `plan.json` | tasks[].status | task_id | (worker → issues.json 부분) |
| ralph `state.json` | iteration count | dod_pending | dod_failures |
| bugfix `state.json` | status | last_step | hypothesis_log |
| Living Spec (vision M1+) | spec.json | spec_version | spec_inbox.json |

핵심 메시지: **이미 패턴은 존재**, Living Spec은 specify 영역에 이를 일관되게 적용한 것.

---

## 6. 일반 적용 원리

다른 skill에 응용할 때 4가지 원칙:

### 원칙 1. SessionStart에 status 주입

`SessionStart` hook이 작은 status 요약을 stdout으로 출력 → Claude의 첫 컨텍스트에 자동 포함. 사용자가 입력하기 전에 이미 "현재 상태"를 안다.

### 원칙 2. Tool 결과를 컨텍스트 대신 파일에 적재

도구가 발견한 것을 그대로 컨텍스트에 남기지 말고 `<artifact>.json`에 atomic write. 다음 호출에서 컨텍스트가 휘발해도 파일은 남음.

### 원칙 3. 다음 호출은 inbox/index만 읽고 분기

stateful skill의 첫 동작은 항상:
```
1. status frontmatter / state.json 읽기 (~200 토큰)
2. spec_inbox / issues.json 읽기 (~1K)
3. 분기 결정
4. 필요한 본문만 lazy read
```

### 원칙 4. 본문은 lazy read

`requirements.md`, `design.md` 같은 마크다운을 **통째로 읽지 말고** 필요한 섹션만 `Read offset/limit`. 헤더 인덱스(섹션명 → 줄번호)를 frontmatter에 두면 더 빠름.

---

## 7. 한계와 trade-off

| 한계 | 완화책 |
|---|---|
| state 관리 부담 (누가 갱신?) | hook + skill 두 층의 자동 갱신 안전장치 |
| 정확성이 핵심 — 부정확하면 wrong branch | AJV schema 검증 (cli validator) |
| atomicity / race | atomic write (`tmp file` + `rename`) |
| compaction 후 복구 | 파일이 truth — in-memory보다 강함 (session-compact-hook 활용) |
| 부정확한 frontmatter 해석 | YAML 스키마 + cli `session get/validate` |
| 부정확한 inbox 적재 | type/source enum 강제, validator |
| 사용자가 직접 수정 시 깨질 위험 | "직접 수정 금지 — cli 사용" 가이드 + 렌더링 view |

---

## 8. 이미 있는 안전장치

- **AJV schema validation** — `cli/src/commands/plan.js` 등에서 plan.json/spec.json 형식 검증
- **Atomic write** — `cli/src/commands/session.js`의 set 동작이 임시 파일 + rename
- **Hook 다층 갱신** — SessionStart, UserPromptSubmit, Stop hook이 각각 갱신 시점 담당
- **session-compact-hook** — compaction 후 state 복원
- **validate-output.sh** — agent/skill 출력 형식 강제

---

## 9. 다음 적용 후보

이 패턴을 추가 도입할 만한 영역:

| Skill / 영역 | 추가할 inbox / index | 효과 |
|---|---|---|
| blueprint | contract-deriver discoveries (모호한 R-X 발견) | spec_inbox 적재 |
| execute | worker ambiguity log (자동 적재) | 이미 issues.json 일부 있음 — spec_inbox로 미러링 |
| qa | violation log (테스트 실패에서 도출된 신규 요구사항) | spec_inbox 적재 |
| bugfix | hypothesis_log (시도한 가설/원인) | 이미 부분 있음 — index 표준화 |
| ralph | DoD failure pattern log | 반복 학습 가능 |
| compound | session learning index | 누적 효과 |

각각 1주 단위 작업.

---

## 10. 핵심 요약

| 축 | Cold Scan | Warm State Lookup |
|---|---|---|
| 정보 출처 | 매번 탐색 | 미리 적재된 작은 파일 |
| 토큰 비용 | 5~50K | 0.3~1K |
| 사용자 재질문 | 1~2회 | 0회 |
| 재현성 | 매우 높음 | 높음 (state validator 보장) |
| 인프라 비용 | 없음 | hook + cli + 스키마 |
| 적용 난이도 | 0 (default) | 1~2주/skill |

**결론**: long-lived stateful 작업(`/specify`, `/execute`, `/blueprint` 등)은 Cold Scan에서 Warm State Lookup으로 전환할 가치가 충분. one-shot 단발 작업은 Cold Scan으로 충분.

specify v1.6.0-sr.7의 Smart Router는 frontmatter index 활용까지만 도달. spec_inbox(M1+) 도입 시 mailbox 효과까지 합쳐져 종합 절감 효과가 더 커진다.

---

## 부록 A. OS/DB 고전 패턴 매핑

이 패턴은 새로운 발명이 아니라 OS/DB의 고전 기법:

| 영역 | 고전 기법 | sr-harness 대응 |
|---|---|---|
| Filesystem | inode + directory entry | spec.json + 마크다운 view |
| Database | index page | frontmatter |
| Distributed System | message queue | spec_inbox.json |
| OS | process state (running/sleeping/zombie) | qa-log.md status |
| Caching | write-through cache | atomic write hook |
| RPC | mailbox / IPC | inbox 패턴 |

LLM 에이전트 시대에 다시 등장한 같은 문제 (stateless agent ↔ stateful workflow)에 같은 해법이 적용된다는 것이 흥미로운 지점.

## 부록 B. 결정 비유 — "사무실에 출근한 직원"

Cold Scan을 사람으로 비유:

> 매일 아침 출근하면 모든 서랍, 모든 파일, 모든 메모를 다 뒤져서 "내가 어제 뭐 했지?"를 재구성하는 직원.
> 정확하지만 매일 오전 11시까지 어제 일 정리만 함.

Warm State Lookup:

> 책상 앞에 작은 To-Do 노트 (frontmatter index) + 받은 메일함 (inbox)이 있는 직원.
> 출근하면 노트와 메일함만 보고 즉시 오늘 일 시작. 어제 누가 뭐 발견했는지는 메일에 다 적혀 있음.

후자가 일을 더 잘하는 게 아니라 **다른 사람들이 미리 정리해 둔 것을 활용**하는 사람.
