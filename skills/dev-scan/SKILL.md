---
name: dev-scan
description: Collect diverse opinions on technical topics from developer communities. Use for "developer reactions", "community opinions" requests. Aggregates Reddit, HN, Dev.to, Lobsters, ProductHunt, etc.
version: 3.0.0
---

# Dev Opinions Scan

Collect and synthesize diverse opinions on specific topics from multiple developer communities.

## Purpose

Quickly understand **diverse perspectives** on technical topics:
- Distribution of pros/cons
- Practitioner experiences
- Hidden concerns or advantages
- Unique or notable perspectives

## Data Sources

| Platform | Method |
|----------|--------|
| Reddit | Vendored web-search.mjs (`chromux`) — Google `site:reddit.com` + enrichment (post body, comments, score) |
| X (Twitter) | Vendored web-search.mjs (`chromux`) — Google `site:x.com` + enrichment (tweets, likes, replies) |
| Hacker News | Vendored hn-search.py (`python3`) — Algolia API, no key needed |
| Dev.to | Vendored web-search.mjs (`chromux`) — Google `site:dev.to` + enrichment (article, comments) |
| Lobsters | Vendored web-search.mjs (`chromux`) — Google `site:lobste.rs` + enrichment (article, comments) |
| ProductHunt | Vendored ph-search.py (`python3`) — GraphQL API, requires `PRODUCT_HUNT_TOKEN` env var |

## Execution

### Step 0: Dependency Check

Run all checks in a **single Bash call** using shell backgrounding (`&` + `wait`).
Claude Code executes Bash calls sequentially — multiple Bash tool calls do NOT run in parallel.
The only way to parallelize is within one shell invocation.

```bash
mkdir -p /tmp/dev-scan-$$
node skills/dev-scan/vendor/chromux-search/web-search.mjs --check > /tmp/dev-scan-$$/web.txt 2>&1 &
python3 skills/dev-scan/vendor/hn-search/hn-search.py --check > /tmp/dev-scan-$$/hn.txt 2>&1 &
python3 skills/dev-scan/vendor/ph-search/ph-search.py --check > /tmp/dev-scan-$$/ph.txt 2>&1 &
wait
echo "=== Web (chromux) ===" && cat /tmp/dev-scan-$$/web.txt
echo "=== HN ===" && cat /tmp/dev-scan-$$/hn.txt
echo "=== ProductHunt ===" && cat /tmp/dev-scan-$$/ph.txt
rm -rf /tmp/dev-scan-$$
```

| Result | Action |
|--------|--------|
| `web-search --check` → `available: true` | chromux available — Reddit, X, Dev.to, Lobsters all use Google `site:` + enrichment |
| `web-search --check` → `available: false` | Fall back to WebSearch tool for all Google-based sources |
| `hn-search --check` → `available: true` | Hacker News source available |
| `hn-search --check` → `available: false` | Fall back to WebSearch for HN |
| `ph-search --check` → `available: true` | ProductHunt source available |
| `ph-search --check` → `available: false` | Skip ProductHunt (token not set or invalid) |

Report available sources before proceeding. Minimum 1 source required.

### Step 1: Query Planning

> **Note**: Step 0 (dependency check) and Step 1 (query planning) are independent — run Step 0 bash commands and perform Step 1 reasoning in the same message to save a round-trip.

#### 1-1. Parse Request

Extract structured components from user request:

- **topic**: Main subject
- **entities**: Key product/technology names
- **type**: `comparison` | `opinion` | `technology` | `event`

Examples:
- "Developer reactions to React 19" → topic: `React 19`, entities: [`React 19`], type: `opinion`
- "Community opinions on Bun vs Deno" → topic: `Bun vs Deno`, entities: [`Bun`, `Deno`], type: `comparison`
- "What happened with Redis license" → topic: `Redis license`, entities: [`Redis`], type: `event`

#### 1-2. Query Decomposition

User requests are often complex or conversational. Before generating platform-specific queries, decompose the request into **atomic search concepts** that search engines can match effectively.

**Why this matters**: Search engines match keywords, not intent. A verbose question like "Is React 19's use() hook a viable replacement for useEffect patterns in production apps?" will miss threads titled "use() vs useEffect" or "React 19 hooks review". Decomposition bridges this gap.

**Process**:

1. **Extract core entities**: Product/technology names exactly as communities write them
2. **Generate query variants** by search intent:
   - `core`: The most concise keyword combination (2-4 words)
   - `versus`: Direct comparison form if applicable ("A vs B")
   - `opinion`: How people ask about it ("A worth it", "A review", "A experience")
   - `technical`: Specific feature/aspect if the question targets one ("A feature X")
3. **Select best variant per platform** (see mapping below)

**Example**: "React 19의 use() hook이 기존 useEffect 패턴을 대체할 수 있는가"

| Variant | Query |
|---------|-------|
| `core` | `React 19 use hook` |
| `versus` | `use() vs useEffect` |
| `opinion` | `React 19 use hook worth it` |
| `technical` | `React 19 use hook replace useEffect` |

**Example**: "Cursor가 돈 낼 만한 가치가 있어? GitHub Copilot이랑 비교해서"

| Variant | Query |
|---------|-------|
| `core` | `Cursor AI editor` |
| `versus` | `Cursor vs GitHub Copilot` |
| `opinion` | `Cursor worth paying for` |
| `technical` | (not applicable — no specific feature) |

**Example**: "What happened with the Redis license change"

| Variant | Query |
|---------|-------|
| `core` | `Redis license` |
| `versus` | (not applicable) |
| `opinion` | `Redis license change reaction` |
| `technical` | `Redis SSPL Valkey fork` |

#### 1-3. Source-Specific Query Mapping

Map the best variant from Step 1-2 to each platform's search behavior.

| Source | Variable | Best variant | Platform-specific adjustments |
|--------|----------|-------------|-------------------------------|
| Reddit | `Q_REDDIT` | `versus` or `opinion` | Google `site:reddit.com` — keep "vs", natural phrasing. Enrichment extracts post body + top comments. |
| X/Twitter | `Q_TWITTER` | `versus` or `core` | Google `site:x.com` — short terms. Enrichment extracts tweets + likes + replies. |
| HN | `Q_HN` | `core` or `technical` | Drop "vs" — Algolia full-text matches better without. |
| Dev.to | `Q_DEVTO` | `opinion` or `versus` | Google `site:dev.to` — add context word (`comparison`/`review`/`guide`) for recall. |
| Lobsters | `Q_LOBSTERS` | `core` | Google `site:lobste.rs` — simple terms. Small community, keep broad. |
| ProductHunt | `Q_PH` | `core` | Product names only. Drop generic words. **Only if PH relevant (see below).** |

**ProductHunt relevance check** — PH is a product launch community. Only set `Q_PH` when the query involves **specific products, tools, or SaaS** (e.g. "Cursor", "Linear", "Supabase vs Firebase"). Skip PH when the topic is abstract/conceptual (e.g. "microservices best practices", "Rust async patterns", "tech layoffs").

**Full example**: user asks "claude code vs codex"

Decomposition: `core`=`claude code codex`, `versus`=`claude code vs codex`, `opinion`=`claude code vs codex worth it`

| Variable | Variant used | Optimized Query |
|----------|-------------|----------------|
| `Q_REDDIT` | versus | `claude code vs codex` |
| `Q_TWITTER` | versus | `claude code vs codex` |
| `Q_HN` | core | `claude code codex` |
| `Q_DEVTO` | versus | `claude code vs codex comparison` |
| `Q_LOBSTERS` | core | `claude code codex` |
| `Q_PH` | core | `claude code codex` |

### Step 1.5: Time Period

Extract time period from user request. Default: `month`.

| User says | `TIME_PERIOD` | `--time` value |
|-----------|---------------|----------------|
| (nothing) | `month` | `month` / `m` |
| "지난주", "last week" | `week` | `week` / `w` |
| "최근 3일", "last few days" | `week` | `week` / `w` |
| "올해", "this year" | `year` | `year` / `y` |
| "전체", "all time" | `all` | `all` / `a` |

Use `TIME_PERIOD` in all search commands below.

### Step 2: Search (Two Bash Calls)

Split into two phases: API sources in parallel (shell backgrounding), then all Google `site:` sources sequentially (chromux shares one Chrome instance — simultaneous use causes tab conflicts).

**Both Bash calls must share the same temp directory.** Generate a stable `RUN_ID` once and use it in both calls.

**Bash call 1 — API sources (parallel):**
```bash
RUN_ID="dev-scan-$(date +%s)-$RANDOM"
D="/tmp/$RUN_ID"
mkdir -p "$D"
echo "$D" > /tmp/dev-scan-current-dir

python3 skills/dev-scan/vendor/hn-search/hn-search.py "{Q_HN}" --count 10 --comments 5 --time {TIME_PERIOD} --json > "$D/hn.json" 2>"$D/hn.err" &
python3 skills/dev-scan/vendor/ph-search/ph-search.py "{Q_PH}" --count 10 --comments 3 --time {TIME_PERIOD} --json > "$D/ph.json" 2>"$D/ph.err" &
wait

echo "=== HN ===" && cat "$D/hn.json"
echo "=== ProductHunt ===" && cat "$D/ph.json"
```

**Bash call 2 — Google `site:` sources (sequential via chromux, same Bash call):**
```bash
D="$(cat /tmp/dev-scan-current-dir)"

node skills/dev-scan/vendor/chromux-search/web-search.mjs "{Q_REDDIT}" --site reddit.com --time {TIME_SHORT} --count 10 --comments 5 --body 500 --json > "$D/reddit.json" 2>"$D/reddit.err"
echo "=== Reddit ===" && cat "$D/reddit.json"

node skills/dev-scan/vendor/chromux-search/web-search.mjs "{Q_TWITTER}" --site x.com --time {TIME_SHORT} --count 10 --comments 5 --json > "$D/x.json" 2>"$D/x.err"
echo "=== X/Twitter ===" && cat "$D/x.json"

node skills/dev-scan/vendor/chromux-search/web-search.mjs "{Q_DEVTO}" --site dev.to --time {TIME_SHORT} --count 10 --comments 5 --body 500 --json > "$D/devto.json" 2>"$D/devto.err"
echo "=== Dev.to ===" && cat "$D/devto.json"

node skills/dev-scan/vendor/chromux-search/web-search.mjs "{Q_LOBSTERS}" --site lobste.rs --time {TIME_SHORT} --count 10 --comments 5 --json > "$D/lobsters.json" 2>"$D/lobsters.err"
echo "=== Lobsters ===" && cat "$D/lobsters.json"

rm -rf "$D" /tmp/dev-scan-current-dir
```

**`TIME_SHORT` mapping**: `month`→`m`, `week`→`w`, `year`→`y`, `all`→`a` (web-search.mjs uses single-letter time codes).

- Omit any source that failed `--check` in Step 0 or is not relevant (e.g. skip PH line if `Q_PH` not set).
- If chromux unavailable, fall back to `WebSearch` tool with `site:` filter for all Google-based sources.
- Run Bash call 1 and 2 in the **same message** (Claude Code sends them sequentially, but this saves a round-trip vs separate messages).

#### Source Notes

| Source | Tool | Notes |
|--------|------|-------|
| Reddit | web-search.mjs | Google `site:reddit.com` + enrichment. Extracts: post title, body, author, score, top comments with author/score. |
| X/Twitter | web-search.mjs | Google `site:x.com` + enrichment. Extracts: tweets, author, handle, likes, time. |
| HN | hn-search.py | Algolia API, no key. Stories with points and top comments. |
| Dev.to | web-search.mjs | Google `site:dev.to` + enrichment. Extracts: article body, author, tags, comments. |
| Lobsters | web-search.mjs | Google `site:lobste.rs` + enrichment. Extracts: article body, author, tags, score, comments. |
| ProductHunt | ph-search.py | GraphQL API, needs `PRODUCT_HUNT_TOKEN`. Only for product/tool queries. |

### Step 3: Synthesize & Present

**Deduplicate across sources**: If the same URL appears in multiple source results, merge them (keep the richer version with more comments/metadata). Cite by the actual platform (Reddit, X, Dev.to), not "Google".

#### 3-0. Comment-level Sentiment Tagging

For every comment extracted from Reddit and X/Twitter (Google `site:` enriched results), tag sentiment:

| Tag | When to apply |
|-----|---------------|
| `positive` | Praise, endorsement, excitement, recommendation |
| `negative` | Criticism, frustration, warning, discouragement |
| `neutral` | Factual statement, question, "it depends" |
| `mixed` | Same comment contains both positive and negative points |

Use these tags downstream in Opinion Classification and Controversy detection — comments with opposing sentiment on the same subtopic signal controversy.

#### 3-1. Opinion Classification

Classify collected opinions by:
- **Pro/Positive**: Supporting opinions (aggregate from `positive` comments)
- **Con/Negative**: Concerns, criticism, alternatives (aggregate from `negative` comments)
- **Neutral/Conditional**: "Only if...", "When used with..." (from `neutral`/`mixed`)
- **Experience-based**: Based on actual production use (any sentiment, but with concrete details)

#### 3-2. Derive Consensus

Identify opinions **repeatedly appearing** across communities:
- Same point mentioned in 2+ sources = consensus
- Especially high reliability if mentioned in both Reddit and HN
- Prioritize opinions with specific numbers or examples
- **Target at least 5 consensus items**

#### 3-3. Identify Controversies

Find points where **opinions diverge**:
- Opposing opinions on same topic
- Threads with active debates
- Topics with many "depends on...", "but actually..." responses
- **Target at least 3 controversy points**

#### 3-4. Select Notable Perspectives

Find unique or deep insights:
- Logically sound opinions that differ from majority
- Opinions from senior developers or domain experts
- Insights from large-scale project experience
- Edge cases or long-term perspectives others might miss
- **Target at least 3 notable perspectives**

## Output Format

**Core Principle**: All opinions must have inline source. No opinions without sources.

```markdown
## Key Insights

### Consensus

1. **[Opinion Title]**
   - [Detailed description]
   - Sources: [Reddit](url), [HN](url)

2. **[Opinion Title]**
   - [Details]
   - Source: [Dev.to](url)

(at least 5)

---

### Controversy

1. **[Controversy Topic]**
   - Pro: "[Quote]" - [Source](url)
   - Con: "[Quote]" - [Source](url)
   - Context: [Why opinions diverge]

(at least 3)

---

### Notable Perspective

1. **[Insight Title]**
   > "[Original quote or key sentence]"
   - [Why this is notable]
   - Source: [Platform](url)

(at least 3)
```

### Source Citation Rules

- **Inline links required**: End every opinion with `Source: [Platform](url)`
- **Multiple sources**: `Sources: [Reddit](url), [HN](url)`
- **Direct quotes**: Use `"..."` format when possible
- **URL accuracy**: Only include verified accessible links

## Error Handling

| Situation | Response |
|------|------|
| No search results for a source | Skip that platform, focus on others |
| chromux unavailable | Fall back to `WebSearch` tool with `site:` filter for all Google-based sources |
| web-search enrichment timeout on URL | Skip that URL, include remaining results |
| hn-search failure | Skip HN, proceed with other sources |
| ph-search failure / token missing | Skip ProductHunt, proceed with other sources |
| Topic too new | Note insufficient results, suggest related keywords |
