# 태스크 계획(tasks.md) 작성 가이드

## 구조

각 태스크는 2~5분 단위의 작은 단위로 분해한다.

### Task N: [컴포넌트/기능명]

**파일:**
- Create: `path/to/new-file.ext`
- Modify: `path/to/existing.ext:시작행-종료행`
- Test: `tests/path/to/test.ext`

**Step 1: 실패 테스트 작성** → 코드
**Step 2: 테스트 실패 확인** → 실행 명령 + 예상 출력
**Step 3: 최소 구현** → 코드
**Step 4: 테스트 통과 확인** → 실행 명령 + 예상 출력
**Step 5: 커밋** → git 명령

## 원칙

- 태스크 간 의존 순서 명시
- 각 태스크는 독립 커밋 가능해야 함
- 수정할 파일의 정확한 경로와 행 범위 포함
