#!/usr/bin/env python3
"""
KB Accumulated Learnings 압축 헬퍼.

사용법:
  python3 scripts/kb-compact.py <kb_file.md> [--threshold N] [--keep-ratio R] [--dry-run]

동작:
  1. KB 파일에서 ## Accumulated Learnings 섹션을 라인 단위로 찾음 (regex DOTALL 함정 회피).
  2. 항목 수가 threshold(기본 50) 이하면 skip.
  3. threshold 초과 시 가장 오래된 (1 - keep_ratio) 만큼을 ## Archived Learnings 섹션으로 이동.
  4. ## Archived Learnings 섹션이 없으면 ## Accumulated Learnings 직전에 새로 생성.
  5. 정렬 기준: bullet 시작의 YYYY-MM-DD prefix. 파싱 불가 항목은 가장 최근으로 간주.

호출자 (knowledge SKILL.md):
  /knowledge update {module} --compact 옵션이 들어오면 이 스크립트를 호출.
"""

import argparse
import re
import sys
from datetime import datetime


HEADING_ACCUMULATED = re.compile(r'^## .*Accumulated Learnings.*$')
HEADING_ARCHIVED = re.compile(r'^## .*Archived Learnings.*$')
DATE_PREFIX = re.compile(r'^- (\d{4}-\d{2}-\d{2})\b')


def find_section(lines, heading_pattern):
    """헤딩 라인 인덱스와 본문 끝 인덱스 반환. 없으면 (None, None)."""
    for i, line in enumerate(lines):
        if heading_pattern.match(line):
            end = len(lines)
            for j in range(i + 1, len(lines)):
                if lines[j].startswith("## "):
                    end = j
                    break
            return i, end
    return None, None


def extract_bullets(lines, body_start, body_end):
    """본문에서 bullet 항목만 추출. placeholder 제외."""
    return [
        l.rstrip()
        for l in lines[body_start:body_end]
        if l.strip().startswith("- ") and "초기에는 비어 있음" not in l
    ]


def parse_date(bullet):
    """bullet의 YYYY-MM-DD 추출. 없으면 datetime.max (가장 최근으로 취급)."""
    m = DATE_PREFIX.match(bullet.strip())
    if not m:
        return datetime.max
    try:
        return datetime.strptime(m.group(1), "%Y-%m-%d")
    except ValueError:
        return datetime.max


def main():
    parser = argparse.ArgumentParser(description="KB Accumulated Learnings compactor")
    parser.add_argument("kb_file", help="대상 KB 마크다운 파일")
    parser.add_argument("--threshold", type=int, default=50,
                        help="압축 트리거 임계값 (기본: 50)")
    parser.add_argument("--keep-ratio", type=float, default=0.5,
                        help="유지 비율 (기본: 0.5 — 절반은 archive로 이동)")
    parser.add_argument("--dry-run", action="store_true",
                        help="파일 변경 없이 결과만 출력")
    args = parser.parse_args()

    with open(args.kb_file) as f:
        lines = f.read().split("\n")

    acc_start, acc_end = find_section(lines, HEADING_ACCUMULATED)
    if acc_start is None:
        print(f"[skip] {args.kb_file}: ## Accumulated Learnings 섹션 없음", file=sys.stderr)
        return 0

    bullets = extract_bullets(lines, acc_start + 1, acc_end)
    print(f"[scan] {args.kb_file}: {len(bullets)}개 항목 (threshold={args.threshold})")

    if len(bullets) <= args.threshold:
        print(f"[skip] threshold 이하 → 압축 불필요")
        return 0

    # 날짜 기준 정렬 (오래된 것 먼저)
    bullets_sorted = sorted(bullets, key=parse_date)
    keep_count = int(len(bullets) * args.keep_ratio)
    move_count = len(bullets) - keep_count

    archived = bullets_sorted[:move_count]
    kept = bullets_sorted[move_count:]
    print(f"[plan] archive {move_count}개 (oldest), keep {keep_count}개 (newest)")

    # 새 Accumulated Learnings 본문
    new_acc_body = [""] + kept + [""]

    # Archived 섹션 처리
    arc_start, arc_end = find_section(lines, HEADING_ARCHIVED)
    if arc_start is not None:
        # 기존 archived와 병합
        existing_archived = extract_bullets(lines, arc_start + 1, arc_end)
        all_archived = sorted(existing_archived + archived, key=parse_date)
        new_arc_body = [""] + all_archived + [""]
        # 두 섹션 모두 교체 (Accumulated가 항상 Archived 뒤에 온다고 가정 — 그렇지 않으면 둘 다 교체 필요)
        # 안전: 두 섹션 위치를 비교해서 처리
        if arc_start < acc_start:
            new_lines = (
                lines[:arc_start + 1] + new_arc_body
                + lines[arc_end:acc_start + 1] + new_acc_body
                + lines[acc_end:]
            )
        else:
            new_lines = (
                lines[:acc_start + 1] + new_acc_body
                + lines[acc_end:arc_start + 1] + new_arc_body
                + lines[arc_end:]
            )
    else:
        # Accumulated 직전에 Archived 새로 삽입
        archived_block = ["## Archived Learnings", ""] + archived + [""]
        new_lines = (
            lines[:acc_start] + archived_block
            + lines[acc_start:acc_start + 1] + new_acc_body
            + lines[acc_end:]
        )

    if args.dry_run:
        print(f"[dry-run] would write {len(new_lines)} lines")
        return 0

    with open(args.kb_file, "w") as f:
        f.write("\n".join(new_lines))
    print(f"[done] {args.kb_file}: archived={move_count}, kept={keep_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
