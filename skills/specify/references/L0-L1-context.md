## L0: Goal

**Output**: `meta.goal`, `meta.non_goals`, `context.confirmed_goal`

### Mirror Protocol

Before asking questions, mirror the user's goal:

```
"I understand you want [goal]. Scope: [included / excluded].
 Done when: [success criteria].
 Does this match?"
```

Then `AskUserQuestion`: "Does this match your intent?"

**Rules:**
- Mirror confirms goal, scope, done criteria ONLY. No tech choices (those are L2).
- Include at least one inference beyond the literal request.
- If ambiguous, surface the ambiguity explicitly.
- Max 3 mirror attempts. If still unclear, ask directly.

### Merge

Run `sr-harness-cli spec guide context --schema v1` and `spec guide meta --schema v1` to check fields, then:

```bash
sr-harness-cli spec merge .sr-harness/specs/{name}/spec.json --stdin << 'EOF'
{constructed JSON matching guide output — confirmed_goal in context, non_goals in meta}
EOF
```

> `confirmed_goal` stays in `context`, NOT `meta`.
> `non_goals`: strategic scope exclusions. Use `[]` if none.

### Gate

User confirms mirror → advance to L1. No reviewer.

---

## L1: Context Research

**Output**: `context.research`

### Execution

Orchestrator scans the codebase with Glob/Grep/Read to find:
- Existing patterns relevant to the goal
- Project structure, build/test/lint commands
- Internal docs, ADRs, READMEs

For larger codebases, optionally dispatch like below:

```
Task(subagent_type="code-explorer",
     prompt="Find: existing patterns for [feature type]. Report findings as file:line format.")

Task(subagent_type="code-explorer",
     prompt="Find: project structure, package.json scripts for lint/test/build commands. Report as file:line format.")

Task(subagent_type="docs-researcher",
     prompt="Find internal documentation relevant to [feature/task]. Search docs/, ADRs, READMEs, config files for conventions, architecture decisions, and constraints. Report as file:line format.")

Task(subagent_type="ux-reviewer",
     prompt="User's Goal: [goal]. Evaluate how this change affects existing UX.")
```


Also search past learnings:
```bash
sr-harness-cli spec search "[goal keywords]" --json --limit 5
```

### Merge

Run `sr-harness-cli spec guide context --schema v1` to check fields, then merge research via `--stdin`.

### Gate

Auto-advance after merge. No reviewer, no user approval at L1.

---

## Syscon Robotics Extension: Product/Module/ROS Selection

> 이 섹션은 시스콘 로보틱스 커스터마이즈. L0 Mirror 후, L1 Research 전에 실행.

### L0 추가: 제품/모듈 선택

Mirror Protocol로 goal을 확인한 뒤, 대상 제품과 모듈을 선택한다.
선택된 모듈에 따라 프로파일이 결정되고, 이후 레이어(L1~L3)의 동작이 분기된다.

#### Step 1: 제품 선택

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

#### Step 2: 모듈 선택 (제품에 따라 분기)

SARICS-NX:
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

SPX:
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

#### Step 3: ROS 버전 선택 (SPX ROS 모듈 시에만)

SPX의 ROS 사용 모듈(core-driver, core-localization, core-navigation, core-task, core-docking) 선택 시에만 질문.
SARICS-NX, 기타 모듈에서는 이 단계를 건너뛴다.

```
AskUserQuestion(
  question: "이 모듈의 ROS 버전을 선택해주세요.",
  options: [
    { label: "ROS1", description: "ROS Noetic (catkin, rospy/roscpp, rostopic)" },
    { label: "ROS2", description: "ROS2 Humble/Iron (colcon, rclpy/rclcpp, lifecycle)" }
  ]
)
```

#### Merge

선택 결과를 spec.json meta에 저장:

```bash
sr-harness-cli spec merge .sr-harness/specs/{name}/spec.json --stdin << 'EOF'
{"meta": {"product": "spx", "modules": ["core-driver", "core-navigation"], "ros_version": "ros2"}}
EOF
```

- `product`: "sarics-nx" | "spx" | "cross-product" | "other"
- `modules`: 선택된 모듈 배열
- `ros_version`: "ros1" | "ros2" | null (SARICS-NX, 기타)

#### 프로파일 결정

선택된 제품/모듈에 따라 프로파일이 자동 결정. L2 체크포인트 차원, L3 경계 패턴이 프로파일에 따라 분기.

| 프로파일 | 대상 모듈 | L2 추가 차원 | L3 경계 |
|---------|----------|-------------|--------|
| **web** | SARICS BE, FE, BE+FE | 없음 (기본 5차원) | API↔UI |
| **driver** | core-driver | + HW Interface | HW↔Driver↔ROS |
| **ros-node** | core-localization, navigation, task, docking | + ROS Interface | Node↔Node |
| **cross-product** | SARICS↔SPX | + Integration + Safety | REST↔ROS |
| **infra** | 시뮬, 테스트, 도구 | 축소 3차원 | 없음 |

### L1 추가: Knowledge DB 우선 로드

L1 Research 시작 전에 Knowledge DB를 확인한다.

```
L1 시작
  ↓
.sr-harness/knowledge/index.yaml 존재?
  ├── YES → 선택된 모듈의 DB 파일 존재?
  │           ├── YES → Read하여 context.research에 반영 (풀 스캔 생략)
  │           └── NO  → 풀 스캔 (기존 방식) → 결과를 DB 파일로 저장
  └── NO  → 풀 스캔 (기존 방식)
```

ROS 버전 분기가 있으면 해당 버전의 파일만 로드:
```
ros_version == "ros2"
  → Read("spx/core-driver.md")          ← 공통
  → Read("spx/core-driver.ros2.md")     ← ROS2 전용만
  → (core-driver.ros1.md 무시)
```

### L1 추가: 멀티레포 워크스페이스 대응

워크스페이스에 프로젝트 폴더가 2개 이상이면 리서치 대상을 질문:

```
AskUserQuestion(
  question: "워크스페이스에 여러 프로젝트가 있습니다. 리서치 대상을 선택해주세요.",
  multiSelect: true,
  options: [
    { label: "spx-core-driver/", description: "ROS2 패키지 — Wheel, BMS, Sensor 드라이버" },
    { label: "spx-core-navigation/", description: "ROS2 패키지 — nav2, planner" },
    ...
  ]
)
```

Knowledge DB에 source.path가 있으면 워크스페이스 폴더와 자동 매칭.
