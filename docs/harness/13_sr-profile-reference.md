# sr_profile 레퍼런스

> 작성일: 2026-04-29
> 기준 버전: v1.6.0-sr.2
> 목적: SR-Harness 전용 프로젝트 컨텍스트 태그 `sr_profile`의 역할·감지 규칙·파이프라인 영향 정리

---

## SoT 안내

이 문서는 `sr_profile` 메커니즘의 **종합 레퍼런스**다. 실제 동작 명세는 다음 파일이 SoT다.

- `skills/specify/SKILL.md` — Step 0.1 감지, Step 0.4 Step D 깊이 보정, Phase 2 경계 컨텍스트 주입
- `skills/blueprint/SKILL.md` — Phase 4.5 design.md SR Profile overrides

명세가 본 문서와 충돌할 경우 **항상 SKILL.md를 따르며**, 본 문서를 갱신한다.

---

## 1. 무엇인가

`sr_profile`은 `/specify` Phase 0에서 사용자 입력을 키워드 스캔해 자동으로 부여하는 **SR(Syscon Robotics) 도메인 라우팅 키**다. 같은 specify 파이프라인이 도메인 특성에 맞게 다음 3가지를 분기시킨다.

1. 인터뷰 깊이 보정 (어떤 축을 deep으로 끌어올릴지)
2. 추가 인터뷰 노드 활성화 (HW 인터페이스, ROS 인터페이스, 통합 등)
3. 요구사항 경계 분해 단위 (sub-req를 어떻게 쪼갤지)
4. 설계 문서(design.md) 섹션 포맷 (아키텍처 뷰·시퀀스 형식)

`sr_product` (`spx` / `sarics-nx` / `cross-product`) 와 함께 작동하지만, **`sr_profile`이 파이프라인 동작을 결정하는 주 라우팅 키**다.

---

## 2. 값 정의

| 값 | 의미 | 대표 모듈/대상 |
|---|---|---|
| `driver` | HW 직접 제어 — UART/CAN/SPI 등 시리얼 프로토콜 + ROS publish/subscribe | core-driver (Wheel, BMS, LED, IO, Sensor, Lift) |
| `ros-node` | 순수 ROS 노드 — 토픽/서비스/액션 인터페이스 중심 | core-localization, core-navigation, core-task, core-docking |
| `cross-product` | SARICS↔SPX 통합 — REST/WS↔ROS Bridge↔ROS 3-layer | sarics-nx ↔ core-task 연동, ROS bridge |
| `web` | 웹 시스템 — frontend/backend/DB | sarics-nx FE/BE 단독 작업 |
| `infra` | 시뮬레이션·도구·테스트 인프라 | gazebo/rviz 시뮬, QA 도구, CI 환경 |
| `null` | 감지 불가 — 인터뷰 중 자연 노출에 위임 | — |

---

## 3. 감지 규칙 (Step 0.1)

`/specify`의 첫 단계 (Mirror) 직전에 사용자 입력(설명 + 키워드)을 스캔해 적용. 사용자에게 묻지 않는다.

### `sr_product` 추론

| 감지 키워드 | sr_product |
|---|---|
| `spx`, `core-driver`, `core-nav*`, `core-local*`, `core-task`, `core-docking` | `spx` |
| `sarics`, `관제`, `dashboard`, `frontend`, `backend`, `be`, `fe` | `sarics-nx` |
| spx + sarics 키워드 둘 다 등장 | `cross-product` |

### `sr_profile` 추론

| 감지 키워드 | sr_profile |
|---|---|
| `core-driver`, `uart`, `wheel`, `bms`, `sensor`, `lift`, `hw`, `hardware` | `driver` |
| `core-nav*`, `core-local*`, `core-task`, `core-docking`, `node`, `topic`, `action`, `service`, `nav2`, `amcl`, `ekf` | `ros-node` |
| `sarics` + `spx` 동시, `bridge`, `ros bridge`, `관제-로봇` | `cross-product` |
| `simulation`, `테스트`, `tool`, `도구`, `infra` | `infra` |
| `sarics` 단독 (SPX 키워드 없음) | `web` |

### `sr_ros_version` 추론

| 감지 키워드 | sr_ros_version |
|---|---|
| `ros2`, `rclpy`, `rclcpp`, `humble`, `iron`, `colcon` | `ros2` |
| `ros1`, `rospy`, `roscpp`, `noetic`, `catkin` | `ros1` |

### 감지 실패 시 정책

- `sr_product` / `sr_profile`이 키워드로 추론 안 되면 `null`로 두고 **묻지 않는다**. Phase 1 TECH 인터뷰가 자연스럽게 드러낸다.
- `sr_ros_version`만 모호하고 `sr_profile`이 `ros-node`나 `driver`인 경우, **Mirror 확인과 한 번에 묶어서** AskUserQuestion으로 묻는다.

---

## 4. 저장 위치

`<spec_dir>/qa-log.md` frontmatter:

```yaml
where:
  sr_product: spx | sarics-nx | cross-product | other | null
  sr_modules: [<module>, ...] | null
  sr_ros_version: ros1 | ros2 | null
  sr_profile: web | driver | ros-node | cross-product | infra | null
```

이후 phase는 모두 여기서 읽는다. 파일 외부에 별도로 캐시되지 않는다.

---

## 5. 파이프라인에 미치는 영향

### 5-1. 인터뷰 깊이 보정 (specify Step 0.4 Step D)

Step A(PROJECT_TYPE)→B(SITUATION/AMBITION)→C(RISK_MODIFIERS) 적용 후 마지막 단계로 작동. **escalate만 하고 절대 downgrade하지 않는다.**

| sr_profile | 깊이 escalate | 추가로 활성화되는 인터뷰 노드 |
|---|---|---|
| `driver` | TECH.INFRA **deep** | `TECH.HW_INTERFACE`: UART/CAN/SPI 프로토콜, baud rate, 패킷 포맷, 타임아웃/재시도 정책, E-Stop 처리 |
| `ros-node` | TECH.ARCH **deep**, TECH.COMPAT **deep** | `TECH.ROS_INTERFACE`: 토픽/서비스/액션 이름, msg 타입, QoS 설정, lifecycle 상태, tf frames |
| `cross-product` | TECH.ARCH **deep**, TECH.COMPAT **deep**, BUSINESS.RISK **deep** | `TECH.INTEGRATION`: REST↔ROS Bridge 프로토콜, latency SLA, 재연결 정책 / `TECH.SAFETY`: E-Stop 전파 |
| `web` | 변경 없음 (Step A–C 기본 적용) | — |
| `infra` | BUSINESS.WHO **light**, INTERACTION 전체 **light** | — |

결과는 `qa-log.md` frontmatter `depth_calibration:`에 기록되어 Phase 1 인터뷰와 gap-auditor가 함께 읽는다.

### 5-2. 요구사항 경계 분해 (specify Phase 2)

`tech-extractor` 에이전트 프롬프트에 sr_profile별 boundary 가이드를 주입해, sub-requirement(R-T1.x)를 도메인에 맞는 단위로 쪼개도록 강제한다.

#### `driver` — HW↔Driver↔ROS 3-layer 분해

```
각 sub-requirement는 HW 통신 / Driver 처리 / ROS 인터페이스로 분리.
HW 프로토콜 디테일과 ROS 토픽명을 한 sub-req에 섞지 말 것.

예시:
  R-T1.1 UART 패킷 송신 (속도 명령)
  R-T1.2 /cmd_vel subscriber → 패킷 변환
  R-T1.3 통신 타임아웃 시 E-Stop 발동
```

#### `ros-node` — Publisher↔Subscriber 분해

```
Publisher 측과 Subscriber 측을 별도 sub-req로 분리.
각 측에 토픽/서비스/액션 이름, msg 타입, QoS, 성공/실패 조건 포함.

예시:
  R-T1.1 /navigate_to_pose action client (요청 발행)
  R-T1.2 global planner action server (경로 계산)
  R-T1.3 local planner /cmd_vel publish (실주행 명령)
```

#### `cross-product` — SARICS↔Bridge↔SPX 3-layer 분해

```
모든 cross-system interaction은 3개 측면 sub-req를 가져야 함.

예시:
  R-T1.1 POST /api/missions (SARICS 측)
  R-T1.2 Bridge dispatch — REST → ROS 변환 (Bridge)
  R-T1.3 /mission_request ROS publish (SPX 측)
```

#### `web` / `infra` / `null`

표준 v2 경계 분해 (API↔UI 등) 사용. SR 전용 boundary 미적용.

### 5-3. design.md 섹션 포맷 (blueprint Phase 4.5)

`/blueprint` 마지막 단계에서 생성하는 `design.md` 9개 섹션 중 §2/§4/§5를 sr_profile에 맞춰 포맷한다.

| sr_profile | §2 아키텍처 뷰 | §4 기능 상세 | §5 시퀀스 |
|---|---|---|---|
| `driver` | HW↔Driver↔ROS 레이어 다이어그램 | UART 패킷 포맷 + ROS 토픽 형식 | HW interrupt → Driver → ROS publish |
| `ros-node` | Node graph (토픽/서비스/액션 연결도) | topic/service/action 명세표 (이름·msg·QoS) | publisher → subscriber 메시지 흐름 |
| `cross-product` | SARICS↔Bridge↔SPX 전체 아키텍처 | REST API + ROS interface 혼합 명세 | REST → Bridge → ROS 3-layer 시퀀스 |
| `web` | 기본 (frontend↔backend↔DB) | REST API 엔드포인트 표 | HTTP request → handler → DB 흐름 |
| `infra` | 명시적 override 없음 (기본 9-section) | — | — |

§1, §3, §6~§9는 sr_profile 무관하게 공통 포맷.

---

## 6. 동작 예시

### 예시 1 — driver 모듈

**사용자 입력**: "core-driver의 wheel controller에 BMS 알람 처리 추가해줘"

| 단계 | 결과 |
|---|---|
| Step 0.1 감지 | `sr_product: spx`, `sr_profile: driver`, `sr_modules: [core-driver]`, `sr_ros_version: null` (모호 → 묶어서 질문) |
| Step 0.4D 보정 | TECH.INFRA **deep**, `TECH.HW_INTERFACE` 활성화 |
| Phase 1 추가 질문 | UART 프로토콜? baud rate? 패킷 포맷? 타임아웃 정책? E-Stop 발동 조건? |
| Phase 2 분해 | R-T1.1 BMS UART 알람 패킷 수신 / R-T1.2 Driver 알람 등급 분류 / R-T1.3 ROS `/bms_alarm` publish |
| design.md §2 | HW↔Driver↔ROS 레이어 다이어그램 + BMS 통신 레이어 |

### 예시 2 — cross-product 통합

**사용자 입력**: "SARICS에서 미션을 만들면 SPX core-task로 전달되도록 ROS bridge 통합"

| 단계 | 결과 |
|---|---|
| Step 0.1 감지 | `sr_product: cross-product`, `sr_profile: cross-product`, `sr_modules: [sarics-nx, core-task]` |
| Step 0.4D 보정 | TECH.ARCH/COMPAT/BUSINESS.RISK 모두 **deep**, `TECH.INTEGRATION` + `TECH.SAFETY` 활성화 |
| Phase 1 추가 질문 | REST → ROS 변환 latency SLA? Bridge 재연결 정책? E-Stop 전파 경로? |
| Phase 2 분해 | R-T1.1 SARICS POST /missions / R-T1.2 Bridge 변환 / R-T1.3 /mission_request publish |
| design.md §2 | SARICS↔Bridge↔SPX 전체 통합 아키텍처 |

### 예시 3 — sarics-nx 단독 (web)

**사용자 입력**: "SARICS 대시보드에 로봇 상태 차트 추가"

| 단계 | 결과 |
|---|---|
| Step 0.1 감지 | `sr_product: sarics-nx`, `sr_profile: web` |
| Step 0.4D 보정 | 변경 없음 (Step A–C만 적용) |
| Phase 2 분해 | 표준 API↔UI 분해 |
| design.md §2 | 기본 frontend↔backend↔DB 다이어그램 |

---

## 7. 갱신 트리거

다음 중 하나라도 발생하면 본 문서를 갱신해야 한다.

- `skills/specify/SKILL.md` Step 0.1 키워드 표 변경
- `skills/specify/SKILL.md` Step 0.4D 깊이 escalate 표 변경
- `skills/specify/SKILL.md` Phase 2 boundary 컨텍스트 추가/수정
- `skills/blueprint/SKILL.md` Phase 4.5 SR Profile overrides 표 변경
- 새 `sr_profile` 값 추가 (예: `simulation`, `safety`)
- `qa-log.md` frontmatter 스키마의 `where.*` 필드 변경

---

## 8. 관련 문서

- `docs/harness/09_specify-customization-design.md` — v1.6.0 시점 SR specify 커스터마이즈 설계 의도 (스냅샷)
- `docs/harness/12_specify-pipeline-review.md` — v1.6.0-sr.1 사후 리뷰
- `skills/specify/SKILL.md` — 동작 SoT
- `skills/blueprint/SKILL.md` — design.md 생성 SoT
