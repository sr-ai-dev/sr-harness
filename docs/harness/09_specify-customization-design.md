# specify L0~L4 커스터마이즈 설계

> 작성일: 2026-04-14
> 최종 수정: 2026-04-14
> 목적: hoyeon specify 파이프라인을 시스콘 AMR 개발 도메인에 맞게 커스터마이즈

---

## 1. 시스콘 개발 범위 (Domain Map)

### 1-1. 제품/모듈 체계

```
SARICS-NX (관제 시스템)               SPX (로봇 플랫폼)
├── Backend (API, DB, 서비스)        ├── core-driver (HW 인터페이스)
│                                    │   ├── Wheel Controller
│                                    │   ├── BMS Driver
│                                    │   ├── LED Driver
│                                    │   ├── IO Manager
│                                    │   ├── Sensor Manager
│                                    │   ├── Lift/Turn Controller
│                                    │   └── 기타 드라이버
└── Frontend (UI, 대시보드)          ├── core-localization (위치추정)
                                     ├── core-task (태스크 스케줄러)
                                     ├── core-navigation (경로/주행)
                                     │   ├── move_base
                                     │   ├── nav2 controller
                                     │   └── planner
                                     ├── core-docking (도킹)
                                     │   ├── 도킹 알고리즘
                                     │   └── 도킹 프레임워크
                                     └── 기타 (시뮬레이션, 품질테스트)
```

### 1-2. 모듈별 기술 특성

각 SPX 모듈은 **ROS1 또는 ROS2 중 하나**를 사용한다 (혼재 아님, 택1).

| 모듈 | 기술 스택 | ROS | 인터페이스 | 경계 유형 |
|------|----------|-----|-----------|----------|
| SARICS-NX BE | Java, Spring Boot, Akka Cluster Sharding | — | REST API, WebSocket | API↔Client |
| SARICS-NX FE | TypeScript, Svelte 5, SvelteFlow | — | HTTP, WS | UI↔API |
| SPX core-driver | C/C++, 시리얼 통신 | **택1** | UART/CAN/SPI → ROS topic | HW↔Driver↔ROS |
| SPX core-localization | C++/Python | **택1** | ROS topic/service | Node↔Node |
| SPX core-task | Python | **택1** | ROS action/service, REST | ROS↔SARICS API |
| SPX core-navigation | C++ | **택1** | ROS action/topic | ROS Nav Stack |
| SPX core-docking | C++/Python | **택1** | ROS action, 센서 데이터 | ROS↔HW센서 |

> **ROS1↔ROS2 차이**: 토픽/서비스/액션 API, 빌드 시스템(catkin vs colcon), QoS(ROS2 전용), lifecycle(ROS2 전용) 등이 달라진다. 모듈의 ROS 버전에 따라 L1 리서치, L2 체크포인트, L3 경계 패턴이 분기된다.

### 1-3. 모듈 간 의존 관계

```
SARICS-NX BE ←──REST/WS──→ SPX core-task
                              ↕ ROS2 action
                          core-navigation ←→ core-localization
                              ↕ ROS2 topic        ↕ ROS2 topic
                          core-docking        core-driver
                              ↕ 센서                ↕ HW
                          [물리 센서]          [모터/BMS/IO]
```

---

## 2. 설계 원칙

### 2-1. 커스터마이즈 방침

| 원칙 | 설명 |
|------|------|
| **확장 우선, 수정 최소** | 기존 로직 수정보다 새 섹션/블록 추가 (upstream 머지 충돌 최소화) |
| **실제 제품/모듈 기반** | 범용 "SW/FW" 분류 대신 SARICS-NX/SPX 실제 모듈 체계 사용 |
| **점진적 적용** | 한꺼번에 전부 변경하지 않고, 단계별로 검증하며 확장 |

### 2-2. 변경 범위 분류

| 레이어 | 변경 수준 | 내용 |
|--------|---------|------|
| L0 Goal | **확장** | 제품/모듈 선택 + ROS 버전 (SPX ROS 모듈 시에만) |
| L1 Context | **확장** | 모듈별 리서치 가이드 |
| L2 Decisions | **확장** | 모듈별 체크포인트 프리셋 + 추가 차원 |
| ~~L2.5~~ | ~~추가~~ | ~~팀 배분 + 마일스톤 매핑~~ → **제외** |
| L3 Requirements | **확장** | 모듈별 경계 분해 패턴 |
| L4 Tasks | 변경 없음 | 기존 hoyeon L4 유지 |

### 2-3. specify 스킬과 커스터마이즈 파일의 관계

#### 스킬 실행 구조

```
/specify 호출
    ↓
SKILL.md 로드 (전체가 LLM 컨텍스트에 주입)
    ↓
LLM이 SKILL.md의 Layer Flow에 따라 순차 실행:
    ↓
L0 → Read("references/L0-L1-context.md")   ← just-in-time 읽기
L1 → (같은 파일)
L2 → Read("references/L2-decisions.md")     ← just-in-time 읽기
L3 → Read("references/L3-requirements.md")  ← just-in-time 읽기
L4 → Read("references/L4-tasks.md")         ← just-in-time 읽기
```

#### 파일별 역할

| 파일 | 역할 | 로드 시점 |
|------|------|---------|
| `SKILL.md` | 전체 흐름, Core Rules, 승인 프로토콜 | **스킬 호출 시** (전문 주입) |
| `references/L0-L1-context.md` | L0 Mirror + L1 Research 상세 지시 | L0 진입 시 Read |
| `references/L2-decisions.md` | L2 체크포인트/인터뷰 상세 지시 | L2 진입 시 Read |
| `references/L3-requirements.md` | L3 GWT/경계 분해 상세 지시 | L3 진입 시 Read |
| `references/L4-tasks.md` | L4 태스크/DAG 상세 지시 | L4 진입 시 Read |

#### 핵심: 전부 프롬프트 (코드 아님)

모든 .md 파일은 LLM에게 주는 **지시문(프롬프트)**이다. 유일한 코드 실행은 `sr-harness-cli` 호출:

| 구분 | 예시 | 실행 방식 |
|------|------|---------|
| CLI (코드) | `spec init`, `spec merge`, `spec validate` | 실제 프로그램 실행 |
| 프롬프트 (지시) | "체크포인트를 6차원으로 구성하라", "HW↔Driver 경계로 분해하라" | LLM이 읽고 따름 |

#### 커스터마이즈 배치 방식

각 reference 파일 **끝에** `## Syscon Robotics Extension` 섹션을 추가:

```
L0-L1-context.md
├── (기존 hoyeon L0/L1 지시)       ← upstream 영역 (수정 안 함)
└── ## Syscon Robotics Extension   ← 커스터마이즈 추가
    ├── 제품/모듈/ROS 선택
    ├── Knowledge DB 로드
    └── 멀티레포 대응

L2-decisions.md
├── (기존 hoyeon L2 지시)           ← upstream 영역
└── ## Syscon Robotics Extension
    ├── 프로파일별 차원 구성
    ├── Knowledge DB 자동 해결
    └── Tier 4~5 검출 + 도메인 질문

L3-requirements.md
├── (기존 hoyeon L3 지시)           ← upstream 영역
└── ## Syscon Robotics Extension
    ├── driver 경계 패턴 (HW↔Driver↔ROS)
    ├── ros-node 경계 패턴 (Node↔Node)
    └── cross-product 경계 패턴 (REST↔ROS)
```

**끝에 추가**하므로 upstream 변경과 충돌이 최소화된다. LLM은 파일 전체를 읽으므로 기존 지시 + 확장 지시를 모두 따른다.

#### 산출물 흐름 (변경 없음)

커스터마이즈는 **각 단계의 내용**을 확장할 뿐, 산출물 흐름은 hoyeon 원본과 동일:

```
L0: spec.json ← goal (+ product/module/ROS)
L1: spec.json ← + research (+ Knowledge DB 로드)
L2: spec.json ← + decisions, constraints
    → design.md 생성 (§1, §2초안, §6)
    → requirements.md 초안

L3: spec.json ← + requirements[]
    → requirements.md 완성
    → design.md 보강 (§2확정, §3, §4)

L4: spec.json ← + tasks[] ← 100% 완성
    → tasks.md 생성
    → design.md 완성 (§5, §7~§9)
```

| 단계 | hoyeon 원본 | 시스콘 커스텀 (내용 차이) |
|------|-----------|----------------------|
| L0 | goal만 | + **제품/모듈/ROS 선택** (프로파일 결정) |
| L1 | 코드 탐색만 | + **Knowledge DB 우선 로드**, 멀티레포 대응 |
| L2 | 5차원 체크포인트 | + **도메인 차원** (HW Interface, ROS Interface 등) |
| L3 | API↔UI 경계 패턴 | + **HW↔Driver↔ROS, Node↔Node** 경계 패턴 |
| L4 | 변경 없음 | 변경 없음 |

---

## 3. L0 커스터마이즈: 제품/모듈 선택 (+ ROS 조건부)

### 현재

Mirror Protocol로 목표만 확인. 프로젝트 유형 구분 없음.

### 추가: 제품 → 모듈 2단계 선택

Mirror 후, 대상 제품과 모듈을 선택한다. 이후 레이어의 동작이 모듈에 따라 분기된다.

**Step 1: 제품 선택**

```
AskUserQuestion(
  question: "대상 제품을 선택해주세요.",
  options: [
    { label: "SARICS-NX", description: "관제 시스템 (Backend/Frontend)" },
    { label: "SPX", description: "로봇 플랫폼 (core-driver, navigation, localization 등)" },
    { label: "Cross-product", description: "SARICS↔SPX 연동 (관제-로봇 통합)" },
    { label: "기타", description: "시뮬레이션, 품질테스트, 문서, 도구 등" }
  ]
)
```

**Step 2: 모듈 선택** (제품에 따라 분기)

SARICS-NX 선택 시:
```
AskUserQuestion(
  question: "대상 모듈을 선택해주세요. (복수 선택 가능)",
  multiSelect: true,
  options: [
    { label: "Backend", description: "API, 서비스, DB" },
    { label: "Frontend", description: "UI, 대시보드" },
    { label: "BE+FE 통합", description: "Backend + Frontend end-to-end" }
  ]
)
```

SPX 선택 시:
```
AskUserQuestion(
  question: "대상 모듈을 선택해주세요. (복수 선택 가능)",
  multiSelect: true,
  options: [
    { label: "core-driver", description: "HW 드라이버 (Wheel, BMS, LED, IO, Sensor, Lift/Turn)" },
    { label: "core-localization", description: "위치추정 (AMCL, EKF, 센서 퓨전)" },
    { label: "core-task", description: "태스크 스케줄러 (미션 관리, 상태 머신)" },
    { label: "core-navigation", description: "경로 계획/주행 (move_base, nav2, planner)" }
  ]
)
```
> 4개 초과 시 추가 질문으로 core-docking 등 선택.

**Step 3: ROS 버전 선택** (SPX 모듈 중 ROS 사용 모듈 선택 시에만)

ROS를 사용하는 모듈(core-driver, core-localization, core-navigation, core-task, core-docking) 선택 시에만 질문. SARICS-NX나 기타 모듈에서는 이 단계를 건너뛴다.

```
AskUserQuestion(
  question: "이 모듈의 ROS 버전을 선택해주세요.",
  options: [
    { label: "ROS1", description: "ROS Noetic (catkin, rospy/roscpp, rostopic)" },
    { label: "ROS2", description: "ROS2 Humble/Iron (colcon, rclpy/rclcpp, lifecycle)" }
  ]
)
```

> ROS 버전에 따라 L1 리서치 항목, L2 체크포인트, L3 경계 패턴이 분기된다.

**spec.json 저장:**

```json
{
  "meta": {
    "product": "spx",
    "modules": ["core-driver", "core-navigation"],
    "ros_version": "ros2",
    "teams": []
  }
}
```

### 모듈별 파이프라인 프로파일

| 프로파일 | 대상 모듈 | L2 체크포인트 | L3 경계 | L4 슬라이싱 |
|---------|----------|-------------|--------|-----------|
| **web** | SARICS BE, FE, BE+FE | 기본 5차원 | API↔UI | Vertical Slice |
| **driver** | core-driver | 5차원 + HW Interface | HW↔Driver↔ROS2 | Module 계층 |
| **ros-node** | core-localization, core-navigation, core-task, core-docking | 5차원 + ROS Interface | Node↔Node (topic/service/action) | Node 단위 |
| **cross-product** | SARICS↔SPX 연동 | 5차원 + Integration | REST↔ROS2 | Interface 중심 |
| **infra** | 시뮬, 테스트, 도구 | 축소 3차원 | 없음 | 기능 단위 |

---

## 4. L1 커스터마이즈: Knowledge DB + 리서치 가이드

### 4-1. 리서치 전략: Method A → 점진적 Knowledge DB 구축

#### 기본 방식 (Method A)

현재 hoyeon L1과 동일. 로컬 워크스페이스에서 Glob/Grep/Read로 코드베이스 탐색.

#### 점진적 Knowledge DB

Method A 스캔 결과를 **표준 포맷**으로 저장하여 지식 DB를 점진적으로 구축한다. 한번 구축된 DB가 있으면 풀 스캔을 생략하고 DB에서 로드한다.

```
L1 시작
  ↓
Knowledge DB (.sr-harness/knowledge/) 존재?
  ├── YES → 해당 모듈의 DB 파일 존재?
  │           ├── YES → DB 파일 Read (풀 스캔 생략)
  │           │         → 필요 시 부분 보강 (Glob/Grep 보조)
  │           └── NO  → 풀 스캔 (Method A) → 결과를 DB 파일로 저장
  └── NO  → index.yaml 생성 + 풀 스캔 → DB 파일 저장
```

### 4-2. Knowledge DB 파일/폴더 규약

#### 디렉토리 구조

```
.sr-harness/knowledge/
├── index.yaml                              ← 전체 인덱스 (필수)
├── sarics-nx/
│   ├── backend.md                          ← {product}/{module}.md
│   └── frontend.md
├── spx/
│   ├── core-driver.md                      ← 공통 지식
│   ├── core-driver.ros1.md                 ← ROS1 전용 (선택)
│   ├── core-driver.ros2.md                 ← ROS2 전용 (선택)
│   ├── core-localization.md
│   ├── core-localization.ros2.md
│   ├── core-navigation.md
│   ├── core-navigation.ros2.md
│   ├── core-task.md
│   └── core-docking.md
└── cross/
    └── sarics-spx.md                       ← cross-product 연동
```

#### 네이밍 규약

| 규칙 | 패턴 | 예시 |
|------|------|------|
| 제품 폴더 | `{product}/` (kebab-case) | `sarics-nx/`, `spx/` |
| 모듈 파일 | `{module}.md` | `core-driver.md` |
| ROS 분기 | `{module}.{ros-version}.md` | `core-driver.ros1.md`, `core-driver.ros2.md` |
| Cross-product | `cross/{product-a}-{product-b}.md` | `cross/sarics-spx.md` |
| 인덱스 | `index.yaml` (루트에 1개) | — |

#### index.yaml 스키마

```yaml
version: 1
last_updated: "2026-04-14"
modules:
  core-driver:
    product: spx
    files:
      common: spx/core-driver.md              # 공통 지식
      ros1: spx/core-driver.ros1.md            # ROS1 전용 (있으면)
      ros2: spx/core-driver.ros2.md            # ROS2 전용 (있으면)
    source:
      path: /Users/jedaichoi/dev-ws/spx-core-driver   # 로컬 경로
      github: https://github.com/sr-amr-spx-dev/spx-core-driver
    ros: ros2                                  # 이 모듈의 ROS 버전
    scanned_at: "2026-04-14T10:30:00"
    commit_sha: "a1b2c3d"                      # 스캔 시점 커밋
  backend:
    product: sarics-nx
    files:
      common: sarics-nx/backend.md
    source:
      path: /Users/jedaichoi/dev-ws/sarics-nx-backend
      github: https://github.com/sr-amr-acs-dev/sarics-nx-backend
    ros: null                                  # ROS 미사용
    scanned_at: "2026-04-14T11:00:00"
    commit_sha: "e5f6g7h"
```

> `commit_sha` 기록으로 "변경 있을 때만 업데이트" 판단 가능.

#### L1 로딩 흐름

```
L0: 모듈=core-driver, ROS=ros2
    ↓
L1: index.yaml 읽기 → core-driver 항목 조회
    → Read("spx/core-driver.md")          ← 공통 지식
    → Read("spx/core-driver.ros2.md")     ← ROS2 전용만 로드
    → (core-driver.ros1.md는 무시)
    → context.research에 반영
```

### 4-3. Knowledge DB CRUD 명령

| 명령 | 동작 | 비고 |
|------|------|------|
| `/knowledge scan {module}` | 현재 워크스페이스를 풀 스캔 → DB 파일 생성/갱신 | 수동 또는 L1 자동 |
| `/knowledge update {module}` | commit_sha 비교 → 변경 있으면 재스캔 | 효율적 갱신 |
| `/knowledge delete {module}` | DB 파일 삭제 + index.yaml에서 제거 | 수동 |
| `/knowledge list` | 등록된 모듈 목록 + 최종 스캔 시각 표시 | 상태 확인 |
| `/knowledge status` | 각 모듈의 현재 commit vs 스캔 시점 commit 비교 | 변경 감지 |

실행 예시:
```bash
# core-driver 레포에서 지식 DB 생성
cd ~/dev-ws/spx-core-driver
claude "/knowledge scan core-driver"
# ✅ core-driver 스캔 완료. 저장: .sr-harness/knowledge/spx/core-driver.md
#    ROS2 전용: .sr-harness/knowledge/spx/core-driver.ros2.md

# 상태 확인
claude "/knowledge list"
# core-driver    spx    ros2    scanned: 2026-04-14    commit: a1b2c3d
# backend        sarics-nx  —   scanned: 2026-04-14    commit: e5f6g7h

# 레포에 변경이 있을 때 업데이트
claude "/knowledge update core-driver"
# commit 변경 감지: a1b2c3d → x9y0z1. 재스캔합니다...

# 삭제
claude "/knowledge delete core-driver"
```

### 4-4. 멀티레포 워크스페이스 대응

워크스페이스에 여러 프로젝트 폴더가 있는 경우, L1에서 리서치 대상을 질문으로 확인한다.

#### 감지 흐름

```
L1 시작
  ↓
워크스페이스 루트에서 프로젝트 폴더 감지
  (package.xml, CMakeLists.txt, package.json 등으로 판단)
  ↓
1개 → 그대로 스캔/DB 로드
2개+ → 질문으로 대상 선택
```

#### 질문 예시

```
AskUserQuestion(
  question: "워크스페이스에 여러 프로젝트가 있습니다. 리서치 대상을 선택해주세요.",
  multiSelect: true,
  options: [
    { label: "spx-core-driver/", description: "ROS2 패키지 — Wheel, BMS, Sensor 드라이버" },
    { label: "spx-core-navigation/", description: "ROS2 패키지 — nav2, planner" },
    { label: "spx-core-localization/", description: "ROS2 패키지 — AMCL, EKF" },
    { label: "전체", description: "모든 프로젝트 스캔" }
  ]
)
```

#### Knowledge DB 연계

```
멀티레포 + Knowledge DB 있음:
  → 선택된 프로젝트에 대응하는 DB 파일 로드
  → DB 없는 프로젝트만 스캔 → DB 저장

멀티레포 + Knowledge DB 없음:
  → 선택된 프로젝트들 순차 스캔 → 각각 DB 저장
```

> index.yaml에 `source.path`가 있으므로, 워크스페이스 내 폴더와 모듈을 자동 매칭 가능.

### 4-5. Knowledge DB 파일 표준 포맷

DB 파일은 L1 풀 스캔 결과를 아래 표준 포맷으로 저장한다. 수동 보강도 이 포맷을 따른다.

#### 공통 섹션 (모든 모듈)

```markdown
# {모듈명} Knowledge Base

## 1. Overview
- 목적: (1-2문장)
- GitHub: (레포 URL)
- 기술 스택: (언어, 프레임워크, 빌드 시스템)
- ROS 버전: ROS1 / ROS2

## 2. Architecture
- 패키지/디렉토리 구조 (트리)
- 핵심 클래스/노드 목록 (이름 + 역할 1줄)
- 의존 패키지 (package.xml 또는 requirements.txt 요약)

## 3. Interfaces (외부 연동)
- 입력: (어디서 데이터를 받는지)
  | 이름 | 타입 | 소스 | 주기 |
- 출력: (어디로 데이터를 보내는지)
  | 이름 | 타입 | 수신자 | 주기 |
- 설정: (파라미터 파일, launch 인자)

## 4. Patterns & Conventions
- 네이밍 규칙
- 에러 처리 패턴
- 테스트 구조 및 방법
- 코딩 컨벤션 특이사항

## 5. Known Constraints
- HW 제약 (해당 시)
- 성능 요구사항
- 호환성 제약

## 6. Common Changes (자주 발생하는 변경 유형)
- 새 드라이버/노드 추가 시 절차
- 파라미터 변경 시 영향 범위
```

#### driver 전용 추가 섹션

```markdown
## 7. Hardware Interfaces
| 장치 | 프로토콜 | 포트/버스 | 데이터 레이트 | 드라이버 노드 |
|------|---------|----------|-------------|-------------|

## 8. Error Handling
| 에러 유형 | 감지 방법 | 복구 동작 | 안전 영향 |
|----------|---------|---------|---------|
```

#### ROS 분기 파일 포맷 (.ros1.md / .ros2.md)

```markdown
# {모듈명} — ROS{1|2} Specific

## ROS Interface Map
### Published Topics
| Topic | Message Type | Hz | 설명 |

### Subscribed Topics
| Topic | Message Type | 설명 |

### Services
| Service | Type | 설명 |

### Actions (ROS2 전용)
| Action | Type | 설명 |

## Build System
- ROS1: catkin workspace, catkin_make/catkin build, roslaunch
- ROS2: colcon workspace, colcon build, ros2 launch

## ROS1↔ROS2 차이점 (해당 모듈에서의)
| 항목 | ROS1 | ROS2 | 비고 |
|------|------|------|------|
```

### 4-6. 프로파일별 리서치 항목

기존 리서치(코드 탐색, 내부 문서)는 모든 프로파일에서 유지. 아래는 프로파일별 **추가** 리서치 항목.
Knowledge DB에 이미 해당 정보가 있으면 DB에서 로드, 없으면 스캔으로 수집.

#### web 프로파일 (SARICS-NX)

```
- API 엔드포인트 목록 (기존 라우터/컨트롤러 스캔)
- DB 스키마 및 마이그레이션 현황
- 인증/인가 미들웨어 패턴
- 프론트엔드 상태 관리 패턴 (Redux, Zustand 등)
- WebSocket 사용 현황 (실시간 데이터)
- CI/CD 파이프라인
```

#### driver 프로파일 (SPX core-driver)

```
- 타겟 보드/MCU 사양 (Jetson, STM32 등)
- 기존 드라이버 목록 및 인터페이스 패턴
- 통신 프로토콜별 구현 (CAN, UART, SPI, I2C, EtherCAT)
- ROS 노드/토픽/서비스 목록
- launch 파일 구조
- HW 에러 핸들링 패턴 (timeout, retry, fallback)
```

#### ros-node 프로파일 (SPX core-*)

ROS1:
```
- catkin 패키지 구조 (package.xml, CMakeLists.txt)
- 기존 노드 목록 및 pub/sub 인터페이스
- 파라미터 파일 (yaml config, dynamic_reconfigure)
- roslaunch 구성
- 메시지/서비스 타입 정의 (msg/, srv/)
- 테스트 구조 (rostest, gtest, unittest)
```

ROS2:
```
- colcon 패키지 구조 (package.xml, CMakeLists.txt / setup.py)
- 기존 노드 목록 및 pub/sub/action 인터페이스
- 파라미터 파일 (yaml config)
- launch 구성 (composition, lifecycle 사용 여부)
- 메시지/서비스/액션 타입 정의 (msg/, srv/, action/)
- QoS 설정 패턴
- 테스트 구조 (gtest, pytest, launch_testing)
```

#### cross-product 프로파일 (SARICS↔SPX)

```
- SARICS↔SPX 통신 인터페이스 (REST API, WebSocket, ROS bridge)
- 로봇 상태 데이터 포맷 (JSON, protobuf, ROS msg)
- 미션 명령 프로토콜
- 에러/장애 전파 경로
```

#### infra 프로파일 (시뮬/테스트/도구)

```
- 시뮬레이션 환경 (Gazebo, Isaac Sim 등)
- 테스트 프레임워크 및 기존 테스트 구조
- 빌드 시스템 (colcon, CMake, catkin)
```

---

## 5. L2 커스터마이즈: 모듈별 체크포인트 프리셋

### 현재 5차원

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Core Behavior | 25% |
| 2 | Scope Boundaries | 20% |
| 3 | Error/Edge Cases | 20% |
| 4 | Data Model | 15% |
| 5 | Implementation | 20% |

### 프로파일별 차원 구성

#### web 프로파일 — 기본 5차원 유지

기존 hoyeon과 동일. 추가 차원 없음.

```
Core 25% | Scope 20% | Error 20% | Data 15% | Impl 20%
```

#### driver 프로파일 — +1 차원 (HW Interface)

| # | Dimension | Weight | 체크포인트 예시 |
|---|-----------|--------|--------------|
| 1 | Core Behavior | 20% | 드라이버 초기화, 데이터 수집 주기, 명령 응답 |
| 2 | Scope Boundaries | 15% | 지원 HW 범위, 미지원 프로토콜 |
| 3 | Error/Edge Cases | 20% | HW 무응답, 데이터 범위 초과, 통신 타임아웃 |
| 4 | Data Model | 10% | ROS2 메시지 타입, 시리얼 패킷 포맷 |
| 5 | Implementation | 15% | 빌드 환경, 크로스 컴파일, 타겟 보드 |
| **6** | **HW Interface** | **20%** | **통신 프로토콜 선택, 데이터 레이트, 핀 할당, 전원 시퀀스, FW 업데이트** |

체크포인트 예시 (HW Interface):
```
- [ ] 통신 프로토콜 및 데이터 포맷 결정 (CAN frame ID, UART baud rate 등)
- [ ] 데이터 수집 주기 및 레이턴시 요구사항
- [ ] HW 초기화 시퀀스 (전원 인가 → 레지스터 설정 → 통신 확인)
- [ ] HW 에러 감지 및 복구 전략 (watchdog, heartbeat)
- [ ] 드라이버↔ROS2 노드 인터페이스 (topic/service 정의)
```

#### ros-node 프로파일 — +1 차원 (ROS Interface)

| # | Dimension | Weight | 체크포인트 예시 |
|---|-----------|--------|--------------|
| 1 | Core Behavior | 20% | 노드 주요 기능, 알고리즘 동작 |
| 2 | Scope Boundaries | 15% | 처리 범위, 미지원 시나리오 |
| 3 | Error/Edge Cases | 20% | 센서 데이터 손실, 노드 크래시 복구, 타임아웃 |
| 4 | Data Model | 15% | 커스텀 메시지 타입, 파라미터 구조 |
| 5 | Implementation | 10% | C++ vs Python, ROS 버전별 빌드/런타임 |
| **6** | **ROS Interface** | **20%** | **토픽/서비스/액션 설계, 노드 간 의존** |

체크포인트 예시 (ROS Interface — ROS 버전에 따라 분기):

ROS1:
```
- [ ] Pub/Sub 토픽 목록 및 메시지 타입
- [ ] Service 서버/클라이언트 정의
- [ ] 파라미터 구조 (rosparam, dynamic_reconfigure)
- [ ] roslaunch 구성 및 노드 그래프
- [ ] 다른 core-* 모듈과의 인터페이스 계약
```

ROS2:
```
- [ ] Pub/Sub 토픽 목록 및 메시지 타입
- [ ] Service/Action 서버/클라이언트 정의
- [ ] QoS 프로파일 (reliable vs best-effort, history depth)
- [ ] 노드 lifecycle 관리 (configure/activate/deactivate)
- [ ] composition 사용 여부 (component container)
- [ ] 다른 core-* 모듈과의 인터페이스 계약
```

#### cross-product 프로파일 — +2 차원 (Integration + Safety)

| # | Dimension | Weight | 체크포인트 예시 |
|---|-----------|--------|--------------|
| 1 | Core Behavior | 15% | 통합 시나리오, end-to-end 흐름 |
| 2 | Scope Boundaries | 15% | 통합 범위, 독립 동작 범위 |
| 3 | Error/Edge Cases | 15% | 통신 단절, 상태 불일치, 복구 |
| 4 | Data Model | 10% | 데이터 변환 매핑 (JSON↔ROS2 msg) |
| 5 | Implementation | 10% | Bridge 기술, 프로토콜 선택 |
| **6** | **Integration** | **20%** | **SARICS↔SPX 인터페이스, 데이터 흐름, 상태 동기화** |
| **7** | **Safety** | **15%** | **E-Stop 전파, 센서 이상 시 동작, 안전 모드 전환** |

#### infra 프로파일 — 축소 3차원

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Core Behavior | 35% |
| 2 | Scope Boundaries | 30% |
| 3 | Implementation | 35% |

### Knowledge DB 기반 L2 강화

Knowledge DB가 구축되어 있으면 L2에서 다음이 자동으로 동작한다.

#### 체크포인트 자동 해결

Knowledge DB의 Architecture, Interfaces, Patterns 정보로 체크포인트를 사전에 resolve:

```
L2 시작 → Knowledge DB 로드됨
  core-driver의 기존 패턴 확인:
  - 통신 프로토콜: DB에 기존 UART 드라이버 패턴 있음 → Implementation 체크포인트 auto-resolve
  - E-Stop 연동: DB에 기존 패턴 있음 → Error/Edge 체크포인트 auto-resolve
  - 에러 핸들링: DB에 watchdog 500ms 패턴 있음 → Error/Edge auto-resolve

결과: 체크포인트 자동 해결률 ↑ → 인터뷰 라운드 수 ↓
```

#### ROS 버전 분기 체크포인트

선택된 ROS 버전에 따라 Implementation 차원에 체크포인트 자동 추가:

ROS1 선택 시:
```
- [ ] catkin 빌드 호환성 (기존 workspace와의 의존)
- [ ] dynamic_reconfigure 사용 여부
- [ ] rostopic/rosservice 인터페이스 설계
```

ROS2 선택 시:
```
- [ ] QoS 프로파일 결정 (reliable vs best-effort)
- [ ] lifecycle 노드 사용 여부 (managed vs unmanaged)
- [ ] composition 사용 여부 (component container)
- [ ] ROS2 action 사용 여부 (장시간 작업)
```

#### 도메인 시나리오 질문

인터뷰 질문을 시스콘 도메인 용어와 실제 시나리오로 생성:

```
기존 (범용):
  "A user's token expires while filling a form. What should happen?"

시스콘 (driver 프로파일):
  "로봇이 주행 중 Wheel Controller의 UART 응답이 500ms 이상 없습니다.
   즉시 E-Stop을 발행할까요, 재연결을 시도할까요, 아니면 감속 후 정지할까요?"

시스콘 (ros-node 프로파일):
  "core-localization의 위치추정 covariance가 임계값을 초과했습니다.
   navigation을 일시 정지할까요, 마지막 신뢰 위치로 복귀할까요?"
```

Knowledge DB의 Error Handling / Common Changes 섹션이 풍부할수록 더 구체적인 시나리오 질문 생성 가능.

#### 모듈 간 영향도 자동 검출

Knowledge DB의 Interfaces 정보로 다른 모듈에 미치는 영향을 자동 감지:

```
core-driver에서 결정:
  D3: "IMU 데이터를 sensor_msgs/Imu로 100Hz publish"

Knowledge DB 조회:
  core-localization.md § Interfaces: /imu/data subscriber 존재

자동 검출:
  "D3의 토픽명/메시지타입/주기가 core-localization의 기대와 일치하는가?"
  → 불일치 시 체크포인트 추가
```

### Unknown/Unknown Detection 확장

기존 3-tier에 프로파일별 추가 tier:

#### Tier 4: 모듈 간 인터페이스 Check (driver, ros-node, cross-product)

```
모든 결정에 대해:
  "이 결정이 다른 core-* 모듈에 영향을 주는가?"
  → 영향이 있는데 해당 모듈의 인터페이스가 미정의 → 체크포인트 추가

예:
  D3: "core-driver에서 IMU 데이터를 sensor_msgs/Imu로 publish"
  → core-localization이 이 토픽을 subscribe할 예정인가?
  → 미정의면 ROS2 Interface 차원에 체크포인트 추가
```

#### Tier 5: Safety Implication Check (cross-product, driver)

```
모든 결정에 대해:
  "이 결정이 실패했을 때 로봇/사람 안전에 영향이 있는가?"
  → E-Stop 전파, 긴급 정지, fallback 동작 정의 여부 확인
  → 미정의면 Safety 차원에 체크포인트 추가
```

---

## 6. L2.5 커스터마이즈: 팀 배분 + 마일스톤 매핑 *(신규 레이어)*

### 활성 조건

| 조건 | L2.5 |
|------|------|
| 선택된 모듈이 2개 이상 | **활성** (멀티모듈 → 팀 간 협업 필요) |
| cross-product 프로파일 | **필수** |
| 단일 모듈 | **비활성** (Skip) |

### 시스콘 팀-모듈 매핑

| 팀 | 약칭 | 주 담당 모듈 |
|----|------|-------------|
| 자율주행팀 | NAV | core-localization, core-navigation, core-docking |
| 관제팀 | CTL | SARICS-NX BE, FE |
| FA제어팀 | FAC | core-driver, core-task |
| 전장설계팀 | ELE | core-driver (HW 사양) |
| 기구설계팀 | MEC | (기구 사양 제공) |
| 생산품질팀 | QA | 테스트, 품질 검증 |
| PM팀 | PM | 프로젝트 관리 |
| 구매팀 | PUR | 부품 조달 |
| 영업팀 | BIZ | 고객 요구사항 |

### 실행 흐름

```
Step 1: 선택된 모듈 → 관련 팀 자동 제안
  (예: core-driver + core-navigation 선택 → FAC, NAV, ELE 제안)

Step 2: 사용자 확인/수정 + RACI 배분

Step 3: 해당 마일스톤 식별
  (프로젝트 Phase/Stage 매핑)

Step 4: 모듈 간 인터페이스 포인트 명시
  (예: core-driver → core-navigation: /odom topic, sensor_msgs/Imu)
```

### spec.json 확장

```json
{
  "meta": {
    "product": "spx",
    "modules": ["core-driver", "core-navigation"],
    "teams": [
      {"id": "FAC", "role": "R", "modules": ["core-driver"]},
      {"id": "NAV", "role": "R", "modules": ["core-navigation"]},
      {"id": "ELE", "role": "C", "modules": ["core-driver"]}
    ],
    "milestone": {"stage": "S8", "sub_ms": "S8-1", "phase": "개발제작"},
    "module_interfaces": [
      {
        "from": "core-driver",
        "to": "core-navigation",
        "type": "ROS2 topic",
        "topics": ["/odom", "/imu/data"],
        "msg_types": ["nav_msgs/Odometry", "sensor_msgs/Imu"]
      }
    ]
  }
}
```

### 게이트

```
AskUserQuestion(
  question: "팀 배분과 모듈 인터페이스를 검토해주세요.",
  options: [
    { label: "Approve", description: "L3 요구사항 도출로 진행" },
    { label: "Revise", description: "팀/인터페이스 수정" },
    { label: "Skip", description: "팀 배분 없이 L3로 진행" }
  ]
)
```

---

## 7. L3 커스터마이즈: 모듈별 경계 분해 패턴

### 현재

경계 분해 패턴: API↔UI, Service↔Consumer, Producer↔Subscriber, SDK↔CLI

### 프로파일별 경계 패턴 추가

#### web: API↔UI (기존 유지)

기존 hoyeon 패턴 그대로 사용.

#### driver: HW↔Driver↔ROS2

```json
{"id": "R1", "behavior": "Wheel 속도 제어", "sub": [
  {"id": "R1.1", "behavior": "UART로 속도 명령 전송",
   "given": "Wheel Controller가 UART(/dev/ttyUSB0, 115200bps)에 연결됨",
   "when": "WheelDriver 노드가 /cmd_vel (geometry_msgs/Twist) 수신",
   "then": "선속도/각속도를 좌우 바퀴 RPM으로 변환하여 UART 패킷 전송"},
  {"id": "R1.2", "behavior": "Wheel 엔코더 피드백 수신",
   "given": "Wheel Controller가 100Hz로 엔코더 데이터 전송 중",
   "when": "UART 수신 버퍼에 엔코더 패킷 도착",
   "then": "/odom (nav_msgs/Odometry) 계산 후 publish"},
  {"id": "R1.3", "behavior": "통신 타임아웃 처리",
   "given": "UART 연결 정상",
   "when": "500ms 이상 응답 없음",
   "then": "E-Stop 명령 발행 + /diagnostics에 ERROR 상태 publish"}
]}
```

#### ros-node: Node↔Node (topic/service/action)

```json
{"id": "R2", "behavior": "자율주행 경로 추종", "sub": [
  {"id": "R2.1", "behavior": "경로 생성 요청",
   "given": "맵 로드 완료 + localization 수렴 (covariance < threshold)",
   "when": "/navigate_to_pose (nav2_msgs/NavigateToPose) action 호출",
   "then": "A* 기반 글로벌 경로 생성 + /plan (nav_msgs/Path) publish"},
  {"id": "R2.2", "behavior": "로컬 플래너 장애물 회피",
   "given": "글로벌 경로 존재 + /scan (sensor_msgs/LaserScan) 수신 중",
   "when": "경로 상 1.5m 이내 장애물 감지",
   "then": "DWB 로컬 플래너가 회피 경로 생성 + /cmd_vel publish"},
  {"id": "R2.3", "behavior": "목적지 도착 판정",
   "given": "로봇이 경로 추종 중",
   "when": "현재 위치와 목적지 거리 < 0.1m, 각도 차 < 0.1rad",
   "then": "NavigateToPose action SUCCEEDED 반환"}
]}
```

#### cross-product: REST↔ROS2

```json
{"id": "R3", "behavior": "SARICS에서 로봇 미션 전송", "sub": [
  {"id": "R3.1", "behavior": "미션 생성 API",
   "given": "SARICS BE가 동작 중",
   "when": "POST /api/missions {robot_id, destination, priority}",
   "then": "미션 DB 저장 + 상태 'queued' 반환"},
  {"id": "R3.2", "behavior": "미션을 로봇으로 전달",
   "given": "미션 상태 'queued' + 대상 로봇 idle",
   "when": "미션 디스패처가 큐 폴링",
   "then": "ROS2 bridge를 통해 /mission_request (custom_msgs/Mission) publish"},
  {"id": "R3.3", "behavior": "로봇 미션 수행 상태 보고",
   "given": "로봇이 미션 수행 중 (core-task 노드)",
   "when": "core-task가 상태 변경 (navigating → arrived → docking)",
   "then": "/mission_status publish → ROS2 bridge → SARICS BE API → FE 실시간 반영"}
]}
```

### 경계 자동 제안 규칙

L3 진입 시 선택된 모듈(L0)에 따라 경계 패턴을 자동 제안:

| 모듈 조합 | 기본 경계 패턴 |
|----------|--------------|
| SARICS BE only | API endpoint ↔ Service (기존) |
| SARICS BE+FE | API ↔ UI (기존) |
| core-driver | HW ↔ Driver ↔ ROS2 topic |
| core-navigation, localization, docking | Node ↔ Node (topic/service/action) |
| core-task | ROS2 action ↔ REST API (cross 경계) |
| SARICS + SPX | REST ↔ ROS2 Bridge ↔ ROS2 |

---

## 8. 문서 동기화 강제화 + /spec-review 스킬

### 8-1. 문제: 문서 동기화가 프롬프트 의존

현재 hoyeon에서 spec.json 수준의 동기화는 CLI로 강제화되어 있다:

```
spec validate          → 스키마 검증 (CLI 강제)
derive-requirements    → decision↔requirement 연결 보장 (CLI 강제)
derive-tasks           → requirement↔task 연결 보장 (CLI 강제)
```

그러나 **spec.json → 문서 렌더링**은 프롬프트 지시일 뿐 강제 장치가 없다:

```
spec.json 수정 → design.md 재렌더링?  → 프롬프트 의존 ❌
D3 변경 → requirements.md 영향 반영?  → 프롬프트 의존 ❌
```

LLM이 재렌더링을 누락하거나 부분만 반영할 수 있다.

### 8-2. 해결: CLI 강제화 (hoyeon 패턴 동일)

hoyeon의 `derive-requirements` / `derive-tasks` 패턴을 문서에도 적용한다.

#### `sr-harness-cli spec render` — 문서 골격 생성

`derive-requirements`가 requirement 스텁을 생성하듯, `spec render`가 문서 골격을 생성한다.

```bash
sr-harness-cli spec render .sr-harness/specs/{name}/spec.json

# 동작:
# 1. spec.json 읽기
# 2. 각 문서의 골격 생성 (ID, 섹션 구조, 참조 링크)
# 3. LLM이 채울 영역을 placeholder로 표시
```

생성 결과 예시 (design.md 골격):

```markdown
## §1 시스템 개요
<!-- from: context.confirmed_goal -->
<!-- TODO: LLM이 목적 2-3문장 + 기술 스택 표 채움 -->

## §6 핵심 설계 결정

### D1. {decisions[0].question}
- **결정**: {decisions[0].answer}
- **근거**: {decisions[0].rationale}
- **대안 비교**: <!-- TODO: LLM이 채움 -->
- **코드 예시**: <!-- TODO: LLM이 채움 -->

### D2. {decisions[1].question}
...
```

**흐름**: `spec render`(CLI가 골격) → LLM이 상세 내용 채움 → `spec verify-docs`(CLI가 검증)

#### `sr-harness-cli spec verify-docs` — 문서-spec.json 일치 검증

`spec validate`가 스키마를 검증하듯, `verify-docs`가 문서 일치를 검증한다.

```bash
sr-harness-cli spec verify-docs .sr-harness/specs/{name}/spec.json

# 검증 항목:
# ✅ design.md 존재
# ✅ requirements.md 존재
# ✅ D1~D5 모두 design.md §6에 포함
# ✅ R1~R4 모두 requirements.md에 포함
# ✅ R1.1~R4.2 모두 GWT 필드 포함
# ❌ D3이 design.md에 없음 → FAIL
# ❌ R2.4가 requirements.md에 없음 → FAIL
```

게이트에서 `spec validate` 직후 `spec verify-docs`를 실행하여 문서 동기화를 강제한다:

```
게이트 시퀀스 (기존 + 추가):
1. sr-harness-cli spec validate              ← spec.json 스키마 검증
2. sr-harness-cli spec verify-docs            ← 문서-spec.json 일치 검증 (추가)
3. 문서 제시 → 사용자 승인
```

### 8-3. hoyeon 패턴 비교

| hoyeon 기존 | 시스콘 추가 | 패턴 |
|-----------|-----------|------|
| `derive-requirements` → 스텁 생성 | `spec render` → 문서 골격 생성 | CLI가 골격, LLM이 내용 |
| `derive-tasks` → 스텁 생성 | (동일 패턴) | CLI가 골격, LLM이 내용 |
| `spec validate` → 스키마 검증 | `spec verify-docs` → 문서 일치 검증 | CLI가 강제 검증 |

### 8-4. /spec-review 스킬 (게이트 밖 문서 동기화)

승인 게이트 밖에서도 동일한 동기화를 가능하게 하는 스킬.

```
사용자: /spec-review
    ↓
1. spec.json 로드
2. 사용자 피드백 수신 (자연어)
   "design.md §6의 D3 — UART 대신 CAN으로 변경해줘"
    ↓
3. spec.json --patch 수정
4. sr-harness-cli spec render (골격 재생성)
5. LLM이 변경된 영역 내용 보강
6. sr-harness-cli spec verify-docs (일치 검증)
7. 갱신된 문서 제시
    ↓
[Continue reviewing / Done]
```

### 승인 게이트 vs /spec-review

| | 승인 게이트 (specify 내) | /spec-review |
|--|------------------------|-------------|
| 실행 시점 | L2/L3/L4 완료 직후 | **언제든지** |
| 세션 | specify 세션 안에서만 | 독립 세션 가능 |
| CLI 강제화 | `validate` + `verify-docs` | `validate` + `verify-docs` (동일) |
| 문서 재렌더링 | `spec render` + LLM | `spec render` + LLM (동일) |

### 사용 시나리오

```bash
# 다음 날 design.md를 다시 읽다가 문제 발견
claude "/spec-review"
> "R2.3의 타임아웃 500ms를 300ms로 변경해줘"
# → spec.json patch → spec render → LLM 보강 → verify-docs → 문서 제시

# 리뷰 미팅 후 피드백 반영
claude "/spec-review"
> "D5의 ROS2 bridge 대신 직접 REST 호출로 변경"
# → spec.json patch → spec render → verify-docs → 영향받는 문서 전체 갱신

# 완료
> "Done"
```

---

## 9. 변경 파일 목록 (upstream 영향 분석)

### specify 스킬 변경

| 파일 | 변경 유형 | 내용 | 충돌 위험 |
|------|---------|------|---------|
| `skills/specify/SKILL.md` | 기존 섹션 수정 | Layer Flow에 L2.5, L0에 모듈/ROS 선택 | ⚠ 중간 |
| `skills/specify/references/L0-L1-context.md` | 섹션 추가 | 제품/모듈/ROS 선택 + Knowledge DB 로딩 + 멀티레포 | 🟢 낮음 |
| `skills/specify/references/L2-decisions.md` | 섹션 추가 | 프로파일별 차원 + DB 연동 + ROS 분기 + Tier 4~5 | 🟢 낮음 |
| `skills/specify/references/L2.5-team-mapping.md` | **신규 파일** | 팀 배분 + MS 매핑 + 모듈 인터페이스 | 🟢 없음 |
| `skills/specify/references/L3-requirements.md` | 섹션 추가 | driver/ros-node/cross-product 경계 패턴 예시 | 🟢 낮음 |
| `skills/specify/references/L4-tasks.md` | 변경 없음 | (기존 hoyeon L4 유지) | — |

### 신규 스킬 + 인프라

| 파일 | 변경 유형 | 내용 | 충돌 위험 |
|------|---------|------|---------|
| `skills/knowledge/SKILL.md` | **신규 스킬** | `/knowledge` CRUD 명령 | 🟢 없음 |
| `skills/spec-review/SKILL.md` | **신규 스킬** | `/spec-review` 게이트 밖 문서 동기화 | 🟢 없음 |
| `.sr-harness/knowledge/index.yaml` | **신규** (런타임 생성) | 모듈별 DB 인덱스 | 🟢 없음 |
| `.sr-harness/knowledge/{product}/{module}.md` | **신규** (런타임 생성) | 모듈별 지식 파일 | 🟢 없음 |

---

## 10. 구현 우선순위

| 순서 | 항목 | 복잡도 | 이유 |
|------|------|--------|------|
| 1 | L0 제품/모듈 선택 (+ ROS 조건부) | 낮음 | 이후 모든 분기의 기반 |
| 2 | L1 Knowledge DB 인프라 | 중간 | index.yaml + 로딩 흐름 + CRUD 명령 |
| 3 | L2 프로파일별 체크포인트 | 중간 | 가장 큰 가치 (도메인 맞춤 의사결정) |
| 4 | L2 Knowledge DB 연동 | 중간 | 자동 해결, 시나리오 질문, 영향도 검출 |
| 5 | L3 모듈별 경계 패턴 | 낮음 | 예시 섹션 추가 (driver, ros-node, cross) |
| 6 | L1 멀티레포 대응 | 낮음 | 프로젝트 폴더 감지 + 질문 |
| 7 | L2.5 팀 배분 (신규 레이어) | 중간 | 멀티모듈에서만 활성 |
| 8 | CLI `spec render` + `verify-docs` | 중간 | 문서 동기화 강제화 — hoyeon 패턴 일관성 |
| 9 | /spec-review 스킬 | 중간 | 게이트 밖 문서 동기화 — CLI 강제화 기반 |
| 10 | 첫 Knowledge DB 생성 (테스트) | 낮음 | 실제 레포 1개로 DB 초안 자동 생성 + 검증 |

---

## 11. spec.json 스키마 호환성

### 원칙: v1 스키마 필수 필드 변경 금지

시스콘 추가 필드는 `meta` 하위 + task 선택 필드로 배치. CLI validate를 깨지 않는다.

```json
{
  "meta": {
    "goal": "...",
    "non_goals": [],
    "schema_version": "v1",
    "product": "spx",                        // ← 추가 (선택)
    "modules": ["core-driver"],              // ← 추가 (선택)
    "ros_version": "ros2",                   // ← 추가 (선택, SPX 모듈 시)
    "teams": [...],                          // ← 추가 (선택)
    "milestone": {...},                      // ← 추가 (선택)
    "module_interfaces": [...]               // ← 추가 (선택)
  },
  "context": { /* 기존 구조 유지 */ },
  "constraints": [ /* 기존 구조 유지 */ ],
  "requirements": [ /* 기존 구조 유지 */ ],
  "tasks": [
    {
      "id": "T1",
      "action": "...",
      "fulfills": ["R1"],
      "depends_on": [],
      "module": "core-driver",               // ← 추가 (선택)
      "team": "FAC",                         // ← 추가 (선택)
      "slice_type": "module"                  // ← 추가 (선택)
    }
  ],
  "external_dependencies": { /* 기존 구조 유지 */ }
}
```

> CLI validate는 unknown fields를 통과시키므로 호환성 문제 없음.
