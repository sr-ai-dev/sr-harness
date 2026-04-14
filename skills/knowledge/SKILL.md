---
name: knowledge
description: |
  "/knowledge", "knowledge scan", "knowledge update", "knowledge delete",
  "knowledge list", "knowledge status",
  "지식 DB", "KB 스캔", "KB 업데이트", "KB 삭제", "KB 목록"
  Syscon Robotics Knowledge DB CRUD.
  Manage module-specific knowledge files for specify pipeline.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /knowledge — Knowledge DB Manager

시스콘 로보틱스 모듈별 지식 DB를 관리한다.
Knowledge DB는 `/specify` L1 단계에서 풀 스캔 대신 사전 구축된 지식을 로드하는 데 사용된다.

---

## Knowledge DB 구조

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
│   ├── core-navigation.md
│   ├── core-task.md
│   └── core-docking.md
└── cross/
    └── sarics-spx.md                       ← cross-product 연동
```

### 네이밍 규약

| 규칙 | 패턴 | 예시 |
|------|------|------|
| 제품 폴더 | `{product}/` (kebab-case) | `sarics-nx/`, `spx/` |
| 모듈 파일 | `{module}.md` | `core-driver.md` |
| ROS 분기 | `{module}.{ros-version}.md` | `core-driver.ros1.md` |
| Cross-product | `cross/{product-a}-{product-b}.md` | `cross/sarics-spx.md` |

---

## Commands

인자에 따라 동작이 분기된다.

### `/knowledge scan {module}`

현재 워크스페이스를 풀 스캔하여 모듈의 지식 파일을 생성/갱신한다.

**동작:**

1. 워크스페이스에서 프로젝트 구조 스캔 (Glob/Grep/Read)
2. 표준 포맷으로 지식 파일 생성
3. index.yaml 업데이트

**스캔 항목 (표준 포맷):**

```markdown
# {모듈명} Knowledge Base

## 1. Overview
- 목적: (1-2문장)
- GitHub: (레포 URL — .git/config에서 추출)
- 기술 스택: (언어, 프레임워크, 빌드 시스템)
- ROS 버전: ROS1 / ROS2

## 2. Architecture
- 패키지/디렉토리 구조 (트리)
- 핵심 클래스/노드 목록 (이름 + 역할 1줄)
- 의존 패키지 (package.xml 또는 requirements.txt 요약)

## 3. Interfaces (외부 연동)
- 입력: | 이름 | 타입 | 소스 | 주기 |
- 출력: | 이름 | 타입 | 수신자 | 주기 |
- 설정: (파라미터 파일, launch 인자)

## 4. Patterns & Conventions
- 네이밍 규칙, 에러 처리 패턴, 테스트 구조

## 5. Known Constraints
- HW 제약, 성능 요구, 호환성

## 6. Common Changes
- 새 드라이버/노드 추가 시 절차
- 파라미터 변경 시 영향 범위
```

**driver 모듈 추가 섹션:**
```markdown
## 7. Hardware Interfaces
| 장치 | 프로토콜 | 포트/버스 | 데이터 레이트 | 드라이버 노드 |

## 8. Error Handling
| 에러 유형 | 감지 방법 | 복구 동작 | 안전 영향 |
```

**ROS 분기 파일 생성 규칙:**
- `package.xml`에서 ROS 버전 감지
- ROS1: catkin, rospy, roscpp → `.ros1.md` 생성
- ROS2: rclpy, rclcpp, ament → `.ros2.md` 생성
- ROS 분기 파일에는 topic/service/action 목록, 빌드 시스템, QoS 등 ROS 버전별 정보

**스캔 실행:**

```
1. 프로젝트 루트 감지 (package.xml, CMakeLists.txt, package.json 등)
2. ROS 버전 감지 (있으면)
3. 디렉토리 구조 트리 생성
4. 소스 파일 스캔 (클래스, 노드, 인터페이스)
5. 설정 파일 스캔 (yaml, launch, config)
6. 결과를 표준 포맷으로 .sr-harness/knowledge/{product}/{module}.md에 저장
7. ROS 분기 파일 생성 (해당 시)
8. index.yaml 업데이트 (source.path, commit_sha, scanned_at)
```

**index.yaml 항목 형식:**

```yaml
modules:
  {module-name}:
    product: {product}
    files:
      common: {product}/{module}.md
      ros1: {product}/{module}.ros1.md    # 있으면
      ros2: {product}/{module}.ros2.md    # 있으면
    source:
      path: {워크스페이스 절대 경로}
      github: {git remote URL}
    ros: {ros1|ros2|null}
    scanned_at: "{ISO 8601}"
    commit_sha: "{git HEAD SHA}"
```

---

### `/knowledge update {module}`

기존 지식 파일을 갱신한다. 변경이 있을 때만 재스캔.

**동작:**

1. index.yaml에서 해당 모듈의 `commit_sha` 조회
2. 현재 워크스페이스의 `git rev-parse HEAD`와 비교
3. 동일하면: "변경 없음. 스킵합니다."
4. 다르면: 재스캔 (= `/knowledge scan` 동작) → commit_sha 갱신

---

### `/knowledge delete {module}`

모듈의 지식 파일을 삭제한다.

**동작:**

1. index.yaml에서 해당 모듈 항목 조회
2. 연결된 파일 삭제 (common + ros1/ros2)
3. index.yaml에서 항목 제거
4. 빈 디렉토리 정리

---

### `/knowledge list`

등록된 모듈 목록을 표시한다.

**출력 형식:**

```
Knowledge DB — .sr-harness/knowledge/

| Module | Product | ROS | Scanned | Commit |
|--------|---------|-----|---------|--------|
| core-driver | spx | ros2 | 2026-04-15 | a1b2c3d |
| backend | sarics-nx | — | 2026-04-15 | e5f6g7h |

Total: 2 modules
```

---

### `/knowledge status`

각 모듈의 변경 여부를 확인한다.

**동작:**

1. index.yaml의 각 모듈에 대해:
2. `source.path`에서 현재 `git rev-parse HEAD` 조회
3. `commit_sha`와 비교

**출력 형식:**

```
Knowledge DB Status

| Module | Scanned Commit | Current Commit | Status |
|--------|---------------|----------------|--------|
| core-driver | a1b2c3d | a1b2c3d | ✅ up-to-date |
| backend | e5f6g7h | x9y0z1w | ⚠ outdated |

Outdated: 1 module(s). Run `/knowledge update {module}` to refresh.
```

---

## 인자 없이 호출 시

`/knowledge` 만 입력하면 `/knowledge list`와 동일하게 동작한다.

## 인자 파싱

| 입력 | 동작 |
|------|------|
| `/knowledge` | list |
| `/knowledge list` | list |
| `/knowledge status` | status |
| `/knowledge scan core-driver` | scan core-driver |
| `/knowledge update core-driver` | update core-driver |
| `/knowledge delete core-driver` | delete core-driver |
| `/knowledge scan` (모듈 없이) | 현재 워크스페이스를 자동 감지하여 모듈명 추론 |
