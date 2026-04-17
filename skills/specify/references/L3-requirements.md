## L3: Requirements + Sub-requirements

**Output**: `requirements[]` with `sub[]`

### Step 1: Scaffold from decisions

```bash
sr-harness-cli spec derive-requirements .sr-harness/specs/{name}/spec.json
```

This auto-generates requirement stubs linked to every decision.
Output: `R0` (from goal) + `R1`...`Rn` (one per decision), each with 1 `TODO` sub-req.

**Coverage is 100% from the start.** No orphan decisions.

### Step 2: Reshape + Fill behaviors via --patch

The scaffold is a **starting point, not a constraint**. The 1:1 decision→requirement mapping is rarely the final structure. Freely reorganize:

- **Split**: One decision often needs multiple requirements (e.g., D1:"JWT auth" → R1:login, R2:token refresh, R3:token expiry)
- **Merge**: Multiple decisions may combine into one requirement (e.g., D1+D2 → R1:password security)
- **Add**: Create new requirements for behaviors not tied to any single decision
- **Delete**: Remove scaffold requirements that are redundant after reorganization

As long as `spec validate` passes at the L3 gate (every requirement has at least one sub-req), the structure is valid.

Run `sr-harness-cli spec guide requirements --schema v1` to check field types, then patch:

```bash
sr-harness-cli spec merge .sr-harness/specs/{name}/spec.json --stdin --patch << 'EOF'
{"requirements": [
  {"id": "R1", "behavior": "User can log in with email and password", "sub": [
    {"id": "R1.1", "behavior": "Valid login returns JWT", "given": "A registered user with valid credentials", "when": "POST /login with correct email and password", "then": "Returns 200 with JWT in response body"},
    {"id": "R1.2", "behavior": "Wrong password returns 401", "given": "A registered user exists", "when": "POST /login with incorrect password", "then": "Returns 401 with error message 'Invalid credentials'"}
  ]}
]}
EOF
```

**GWT (Given/When/Then) rule:**

Every sub-requirement MUST include `given`, `when`, and `then` fields. The `behavior` field serves as a **one-line summary** of the GWT scenario. The GWT fields provide the **detailed, testable specification**.

- `behavior` — one-line summary (required, used as fallback display)
- `given` — precondition / initial state
- `when` — trigger / action performed
- `then` — observable outcome / expected result

**Behavior quality rules:**
- BANNED: "correctly", "properly", "works", "as expected", "handles" (without what)
- REQUIRED: trigger (who/what initiates) + observable outcome
- BAD: `"behavior": "Login works correctly"`
- GOOD: `"behavior": "Valid login returns JWT", "given": "Valid credentials exist", "when": "POST /login with those credentials", "then": "Returns 200 + JWT in body"`

**Sub-requirement = behavioral acceptance criterion (GWT format):**
- Each sub-req IS an acceptance criterion for the parent requirement
- The `behavior` field summarizes the criterion in one line
- The `given`/`when`/`then` fields provide the full testable specification
- Tasks that `fulfills` this requirement must satisfy ALL sub-req GWT scenarios
- **Atomic** (single trigger, single outcome) → 1 sub-req with 1 GWT
- **Compound** (multiple paths) → happy path + error + boundary conditions, each with its own GWT

**Boundary decomposition rule:**

When a single requirement spans multiple implementation boundaries (API↔UI, Service↔Consumer, Producer↔Subscriber), decompose sub-requirements **per boundary**. Each side of a boundary must have its own sub-req with its own GWT.

Principle: if an artifact exists on one side of a boundary, the counterpart that produces or consumes it on the other side MUST also exist as a sub-req (unless it is admin-only or internal-only).

BAD — mixed layers in one sub-req:
```json
{"id": "R1", "behavior": "Project CRUD", "sub": [
  {"id": "R1.1", "behavior": "User can create a project"},
  {"id": "R1.2", "behavior": "User can delete a project"}
]}
```

GOOD — boundary-separated (fullstack: API↔UI):
```json
{"id": "R1", "behavior": "Project CRUD", "sub": [
  {"id": "R1.1", "behavior": "Create project via API", "given": "Authenticated user with valid session", "when": "POST /api/projects with name and description", "then": "Returns 201 with created project JSON including id"},
  {"id": "R1.2", "behavior": "List projects via API", "given": "Two projects exist for the user", "when": "GET /api/projects", "then": "Returns 200 with array of 2 project objects"},
  {"id": "R1.3", "behavior": "Delete project via API", "given": "Project with id=42 exists", "when": "DELETE /api/projects/42", "then": "Returns 204 and project is removed from database"},
  {"id": "R1.4", "behavior": "Frontend renders project list", "given": "GET /api/projects returns 2 projects", "when": "User navigates to project list page", "then": "Page renders 2 project cards with name and description"},
  {"id": "R1.5", "behavior": "Frontend delete removes project", "given": "Project list page shows project id=42", "when": "User clicks delete button on project id=42", "then": "DELETE /api/projects/42 is called and project disappears from list"}
]}
```

GOOD — boundary-separated (API↔Worker):
```json
{"id": "R1", "behavior": "Order processing", "sub": [
  {"id": "R1.1", "behavior": "Create order returns job ID", "given": "Valid order payload with items", "when": "POST /orders", "then": "Returns 202 with job_id in response body"},
  {"id": "R1.2", "behavior": "Worker processes order event", "given": "order.created event is published to queue", "when": "Worker consumes the event", "then": "Order status transitions to 'processing' and inventory is decremented"},
  {"id": "R1.3", "behavior": "Order status is queryable", "given": "Order id=99 has been processed by worker", "when": "GET /orders/99", "then": "Returns 200 with status='completed'"}
]}
```

GOOD — boundary-separated (SDK↔CLI):
```json
{"id": "R1", "behavior": "Config management", "sub": [
  {"id": "R1.1", "behavior": "SDK persists config value", "given": "No prior config exists at ~/.config/app.json", "when": "ConfigStore.set('theme', 'dark') is called", "then": "~/.config/app.json contains {\"theme\": \"dark\"}"},
  {"id": "R1.2", "behavior": "CLI set command calls SDK", "given": "ConfigStore.set is available", "when": "User runs `app config set theme dark`", "then": "ConfigStore.set('theme', 'dark') is invoked and stdout prints 'Set theme = dark'"}
]}
```

**Coverage checks (agent self-check before approval):**
- Every decision has at least one requirement tracing back to it (guaranteed by derive)
- Sub-requirements together cover the full behavior of the parent
- No orphan decisions
- **Boundary check**: if a sub-req implies a cross-boundary dependency (e.g., an API endpoint), verify the other side has a matching sub-req
- **GWT completeness check**: every sub-req has all three GWT fields filled (given, when, then)

### L3 Approval

Print ALL requirements and sub-requirements as text (show everything, do not truncate), then AskUserQuestion (Approve/Revise/Abort).

### L3 Gate

```bash
sr-harness-cli spec validate .sr-harness/specs/{name}/spec.json --layer requirements
```

### L3 Document Rendering

After CLI validate passes, update design documents before presenting to user.

**Read spec.json** to get: `requirements[]` with `sub[]` (GWT), plus all L2 data.

**Update `requirements.md`** at `.sr-harness/specs/{name}/requirements.md`:

```markdown
# Requirements — {project name}

## 배경/목표
{confirmed_goal 확장}

## 비목표
{non_goals 목록}

## 요구사항

### R1. {behavior} (← D{n})
- **R1.1** {sub behavior} `[testable]`
  - Given: {given}
  - When: {when}
  - Then: {then}
- **R1.2** {sub behavior} `[testable]`
  - Given: {given}
  - When: {when}
  - Then: {then}

### R2. {behavior} (← D{n}, D{m})
...

## Known Gaps
{known_gaps 목록, 없으면 "(없음)"}
```

**Update `design.md`** — L2에서 생성한 파일에 다음 섹션을 추가/보강:

#### §2 아키텍처 보강
- 2.2 정적 구조: requirements에서 도출된 모듈/컴포넌트 관계도 확정 + `| 모듈 | 파일 | 역할 | 핵심 원칙 |` 표
- 2.3 동적 흐름: requirements의 GWT 시나리오 기반으로 주요 요청 경로 확정

#### §3 주요 엔티티 (from requirements)
- requirements에서 데이터 모델 도출 → 테이블/스키마 표
- 상태 머신이 있으면 상태 전이 다이어그램 (ASCII)
- 열거형, 설정값, 예�� 타입 표

#### §4 주요 기능 상세 (from requirements + sub)
- requirement별 독립 섹션으로 확장:
  - 엔드포인트 URL + HTTP 메서드
  - 요청/응답 JSON 예시 (실제 필드명)
  - 처리 흐름 ASCII (입력 → 검증 → 처리 → 응답)
  - 분기/에러 케이스 (sub-requirement의 GWT에서 추출)
  - 알고리즘이 있으면 pseudo-code

**Present documents to user** — 갱신된 requirements.md와 design.md를 보여주고 User Approval Protocol 실행.

사용자가 Revise 선택 시:
1. 사용자가 문서의 특정 부분(예: "R2에 에러 핸들링 추가", "§4의 JSON 응답 형식 수정") 지적
2. 해당 requirement/sub를 spec.json에서 `--patch` 또는 `--append`로 수정
3. requirements.md + design.md 해당 섹션 재생성
4. 재제시 → 승인 대기

Pass → advance to L4.

---

## Syscon Robotics Extension: Module-specific Boundary Patterns

> 이 섹션은 시스콘 로보틱스 커스터마이즈. L0에서 결정된 프로파일에 따라 경계 분해 패턴이 분기된다.

### 프로파일별 경계 패턴

기존 hoyeon의 경계 분해 패턴(API↔UI, Service↔Consumer 등)에 추가.

#### web 프로파일: API↔UI (기존 유지)

기존 hoyeon 패턴 그대로 사용.

#### driver 프로파일: HW↔Driver↔ROS

sub-requirement를 **HW 통신 → 드라이버 처리 → ROS 인터페이스** 경계로 분해:

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

**경계 분해 원칙**: HW 통신 sub-req ↔ ROS 인터페이스 sub-req를 반드시 분리. 한 sub-req에 HW 프로토콜과 ROS 토픽을 섞지 않는다.

#### ros-node 프로파일: Node↔Node (topic/service/action)

sub-requirement를 **노드 간 인터페이스** 경계로 분해:

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

#### cross-product 프로파일: REST↔ROS

sub-requirement를 **SARICS 측 ↔ Bridge ↔ SPX 측** 경계로 분해:

```json
{"id": "R3", "behavior": "SARICS에서 로봇 미션 전송", "sub": [
  {"id": "R3.1", "behavior": "미션 생성 API",
   "given": "SARICS BE가 동작 중",
   "when": "POST /api/missions {robot_id, destination, priority}",
   "then": "미션 DB 저장 + 상태 'queued' 반환"},
  {"id": "R3.2", "behavior": "미션을 로봇으로 전달",
   "given": "미션 상태 'queued' + 대상 로봇 idle",
   "when": "미션 디스패처가 큐 폴링",
   "then": "ROS bridge를 통해 /mission_request (custom_msgs/Mission) publish"},
  {"id": "R3.3", "behavior": "로봇 미션 수행 상태 보고",
   "given": "로봇이 미션 수행 중 (core-task 노드)",
   "when": "core-task가 상태 변경 (navigating → arrived → docking)",
   "then": "/mission_status publish → ROS bridge → SARICS BE API → FE 실시간 반영"}
]}
```

### 경계 자동 제안

L3 진입 시 `meta.product`/`meta.modules`에 따라 경계 패턴을 자동 제안:

| 모듈 조합 | 기본 경계 패턴 |
|----------|--------------|
| SARICS BE only | API endpoint ↔ Service (기존) |
| SARICS BE+FE | API ↔ UI (기존) |
| core-driver | HW ↔ Driver ↔ ROS topic |
| core-navigation, localization, docking | Node ↔ Node (topic/service/action) |
| core-task | ROS action ↔ REST API (cross 경계) |
| SARICS + SPX | REST ↔ ROS Bridge ↔ ROS |
