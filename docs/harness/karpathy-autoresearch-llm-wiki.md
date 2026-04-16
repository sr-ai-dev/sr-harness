# Karpathy의 AutoResearch & LLM Wiki — 기술 참고 자료

> 작성일: 2026-04-09
> 분류: 기술 참고 자료 (외부 사례)
> 관련 문서: digital-pm-architecture.md
> 출처: Andrej Karpathy (전 Tesla AI Director, OpenAI 공동창립자)

---

## 1. 개요

Karpathy가 2026년 3~4월에 공개한 두 개의 프로젝트를 정리한다. 둘은 별개 프로젝트이지만, "AI 에이전트가 자율적으로 반복 작업을 수행한다"는 공통 철학을 공유한다.

| | AutoResearch (2026-03-07) | LLM Wiki / Knowledge Base (2026-04-02) |
|---|---|---|
| **목적** | ML 학습 코드 자동 실험 | 개인 지식 관리 시스템 |
| **핵심** | AI가 코드 수정 → 학습 → 평가 루프 | AI가 원본 자료를 마크다운 위키로 "컴파일" |
| **도구** | PyTorch + GPU + LLM 에이전트 | Obsidian + LLM 에이전트 (Claude Code 등) |
| **산출물** | 개선된 모델 코드 | 구조화된 마크다운 위키 |
| **GitHub** | [karpathy/autoresearch](https://github.com/karpathy/autoresearch) | [llm-wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) |

---

## 2. AutoResearch — AI 자율 ML 실험 시스템

### 2.1 핵심 아이디어

LLM 에이전트에게 실제 학습 코드를 주고, **코드 수정 → 5분 학습 → 결과 평가 → 유지/폐기 → 반복**하는 루프를 밤새 자동으로 돌린다. 공개 직후 GitHub 스타 21,000+개, 발표 트윗 조회수 860만을 기록했다.

### 2.2 3-파일 아키텍처 (총 ~630줄)

전체 시스템은 단 3개 파일로 구성된다:

| 파일 | 역할 | 수정 주체 |
|------|------|-----------|
| `prepare.py` | 데이터 전처리 + 평가 메트릭 정의 (`val_bpb`) | **불변** (아무도 수정 안 함) |
| `program.md` | 에이전트에게 주는 지시문 (탐색 방향, 제약 조건) | **인간**이 작성/수정 |
| `train.py` | GPT 모델 + 옵티마이저(Muon + AdamW) + 학습 루프 | **AI 에이전트**가 수정 |

**설계 원칙:**

- **평가 기준 고정** — `prepare.py` 불변이므로 모든 실험이 동일한 잣대(`val_bpb`)로 비교 가능
- **인간은 코드를 직접 안 건드림** — `program.md`에 자연어로 탐색 방향만 지시
- **에이전트는 `train.py` 하나만 자유롭게 수정** — 아키텍처, 하이퍼파라미터, 옵티마이저 등 모든 것이 변경 가능

### 2.3 동작 방식

```
┌─────────────────────────────────────────┐
│  1. program.md 읽기 (인간의 지시문)        │
│  2. train.py 현재 코드 분석               │
│  3. 개선 가설 수립 (예: LR 스케줄 변경)     │
│  4. train.py 코드 수정                    │
│  5. 학습 실행 (정확히 5분 wall-clock)      │
│  6. val_bpb 메트릭 평가                   │
│  7. 개선됨 → 유지 / 악화됨 → 롤백         │
│  8. 1번으로 돌아감                        │
└─────────────────────────────────────────┘
```

- **시간 예산**: 실험당 정확히 5분 (하드웨어 무관하게 wall-clock 기준)
- **처리량**: 시간당 ~12개 실험, 하룻밤 ~100개 실험
- **하드웨어**: NVIDIA GPU 1개면 충분
- **외부 의존성**: PyTorch + 소수 패키지만 필요. 분산 학습, 복잡한 설정 없음

### 2.4 실제 성과

| 실행자 | 결과 |
|--------|------|
| Karpathy 본인 | 밤새 126개 실험 → 여러 구조적 개선 발견 |
| Shopify CEO Tobi Lutke | 밤새 37개 실험 → **19% 성능 향상** |
| 대형 모델 적용 테스트 | 20개 트윅 적용 → **11% 학습 속도 향상** |

에이전트가 발견한 것들은 단순 하이퍼파라미터 튜닝이 아닌 **구조적 코드 변경**이었다:

- QKnorm에 attention sharpening용 scaler multiplier 누락 발견
- Value Embeddings에 정규화 추가 효과
- Banded attention 튜닝
- AdamW beta 파라미터 및 weight decay 스케줄링 개선

### 2.5 Karpathy의 비전

> "모든 LLM 프론티어 랩이 이걸 하게 될 것이다. 이것이 최종 보스 전투다."

미래 구상: SETI@home 스타일로 **에이전트 스웜**을 구성하여, 작은 모델에서 유망한 아이디어를 발굴 → 점점 더 큰 스케일로 프로모션하는 **비동기 대규모 협업 연구 시스템**.

---

## 3. LLM Wiki — 마크다운 기반 지식 관리 시스템

### 3.1 핵심 아이디어

LLM을 "컴파일러"로 취급하여, 원본 자료(논문, 기사, 코드, 데이터셋)를 구조화된 마크다운 위키로 변환한다. Obsidian을 저장소이자 UI로 사용한다.

### 3.2 Obsidian의 역할

Obsidian은 이 아키텍처에서 **마크다운 파일의 저장소이자 UI**이다:

1. **Web Clipper**: Obsidian Web Clipper로 웹 콘텐츠를 `.md` 파일로 변환 (이미지도 로컬 저장)
2. **파일 시스템 기반**: 벡터 DB 없이 로컬 `.md` 파일로 관리
3. **백링크 시각화**: Obsidian의 그래프 뷰로 지식 간 연결 관계 시각화

### 3.3 아키텍처: 3단계 파이프라인

```
[Phase 1: Data Ingest]
    raw/ (원본 자료)
      ├── 논문.pdf
      ├── 기사.md  (Obsidian Web Clipper로 수집)
      └── 코드 스니펫
              ↓
[Phase 2: LLM "컴파일"]
    LLM이 원본을 읽고:
    - 요약 생성
    - 핵심 개념 추출
    - 백과사전식 문서 작성
    - 백링크(상호 참조) 생성
              ↓
[Phase 3: 구조화된 위키]
    wiki/
      ├── concept_A.md  ←→  concept_B.md
      ├── summary_X.md  ←→  concept_A.md
      └── ...  (백링크로 상호 연결)
              ↓
[상시 유지보수: LLM "린팅"]
    - 비일관성 스캔/수정
    - 누락 데이터 보완
    - 새로운 연결 관계 발견/추가
```

### 3.4 RAG를 대체하는 이유

**기존 RAG 파이프라인:**
```
원본 문서 → 청킹 → 임베딩 → 벡터 DB 저장 → 쿼리 시 유사도 검색 → LLM에 컨텍스트 주입
```

**Karpathy의 접근:**
```
원본 문서 → LLM이 마크다운 위키로 "컴파일" → 필요할 때 .md 파일을 컨텍스트에 직접 로드
```

**RAG 대체가 가능한 3가지 이유:**

| # | 이유 | 설명 |
|---|------|------|
| 1 | **컨텍스트 윈도우 확대** | Claude 200K+ 토큰, Gemini 1M+ 토큰. 개인 위키 수백 개 노트는 컨텍스트에 통째로 들어감 → 벡터 검색 불필요 |
| 2 | **LLM이 정제한 데이터** | 원본을 그대로 청킹하는 RAG와 달리, LLM이 요약/구조화/백링크까지 완료한 "컴파일된" 지식이므로 품질이 높음 |
| 3 | **인프라 제로** | 벡터 DB, 임베딩 모델, 청킹 전략, 리트리버 튜닝 등 전부 불필요. 마크다운 파일 + LLM이 전부 |

### 3.5 적용 범위와 한계

| 규모 | 적합성 | 비고 |
|------|--------|------|
| 개인 연구자 / 소규모 팀 | 최적 | 수백 개 노트 수준, RAG 대비 95% 비용 절감 주장 |
| 중규모 팀 | 가능 | 수천 개 노트까지 컨텍스트 윈도우로 커버 가능 |
| 엔터프라이즈 (수만~수십만 문서) | 부적합 | 여전히 RAG/벡터 DB 필요 |

---

## 4. 시스콘 디지털 PM 에이전트에 대한 시사점

Karpathy의 두 프로젝트에서 디지털 PM 에이전트 설계에 참고할 수 있는 패턴:

### 4.1 AutoResearch에서 배울 점

| 패턴 | AutoResearch | 디지털 PM 적용 가능성 |
|------|-------------|---------------------|
| **고정 메트릭 + 자유 실험** | `val_bpb` 고정, 코드 자유 수정 | 거버넌스 규칙 고정, 에이전트 판단/실행 자유도 부여 |
| **인간은 방향만 지시** | `program.md`로 탐색 방향 설정 | PM이 우선순위/정책만 설정, 에이전트가 감시/보고 |
| **자율 반복 루프** | 수정 → 학습 → 평가 → 반복 | 감지 → 판단 → 실행 → 피드백 → 반복 |
| **극단적 단순성** | 630줄, 3개 파일 | 최소 구성으로 시작, 점진적 확장 |

### 4.2 LLM Wiki에서 배울 점

| 패턴 | LLM Wiki | 디지털 PM 적용 가능성 |
|------|----------|---------------------|
| **마크다운 기반 지식 관리** | `.md` 위키 | 프로젝트 거버넌스 문서를 마크다운으로 관리, LLM이 직접 읽고 활용 |
| **RAG 없는 지식 주입** | 컨텍스트 윈도우에 직접 로드 | 프로젝트 규모(480개 태스크)면 RAG 없이 컨텍스트로 충분할 가능성 |
| **LLM 린팅** | 위키 비일관성 자동 수정 | 거버넌스 문서 간 비일관성 자동 감지/보고 |
| **컴파일 패턴** | 원본 → 구조화된 위키 | ClickUp 데이터 → 구조화된 프로젝트 상태 보고서 |

---

## 5. 참고 자료

- [GitHub: karpathy/autoresearch](https://github.com/karpathy/autoresearch)
- [GitHub Gist: llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Fortune — The Karpathy Loop](https://fortune.com/2026/03/17/andrej-karpathy-loop-autonomous-ai-agents-future/)
- [VentureBeat — AutoResearch](https://venturebeat.com/technology/andrej-karpathys-new-open-source-autoresearch-lets-you-run-hundreds-of-ai)
- [VentureBeat — LLM Knowledge Base Architecture](https://venturebeat.com/data/karpathy-shares-llm-knowledge-base-architecture-that-bypasses-rag-with-an)
- [DataCamp — Guide to AutoResearch](https://www.datacamp.com/tutorial/guide-to-autoresearch)
- [DAIR.AI — LLM Knowledge Bases](https://academy.dair.ai/blog/llm-knowledge-bases-karpathy)
- [MindStudio — LLM Wiki with Claude Code](https://www.mindstudio.ai/blog/andrej-karpathy-llm-wiki-knowledge-base-claude-code)
- [Data Science Dojo — 100 Experiments Overnight](https://datasciencedojo.com/blog/karpathy-autoresearch-explained/)
