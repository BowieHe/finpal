## Context

FinPal is a Next.js + LangGraph AI debate assistant. The current codebase has grown complex and contains unused dependencies and overly large modules. The main issues are:

1. **nodes.ts (958 lines)**: Contains all 6 LangGraph nodes in one file - researcher, optimistic, pessimistic, rebuttals, and decider
2. **page.tsx (474 lines)**: Main UI component with too much logic
3. **Unused dependencies**: Playwright and duck-duck-scrape packages are in package.json but not used in code
4. **Dead code paths**: References to search features that don't exist anymore

Current architecture uses a single-file approach for core logic, which hinders maintainability.

## Goals / Non-Goals

**Goals:**
- Remove unused dependencies (playwright, duck-duck-scrape)
- Split nodes.ts into focused modules by responsibility
- Simplify the main page component
- Reduce overall lines of code by removing dead code
- Maintain all existing functionality

**Non-Goals:**
- No new features or capabilities
- No changes to the LangGraph workflow logic
- No UI/UX redesign
- No changes to the API contract

## Decisions

### 1. Module Organization: Split by Node Type
**Decision**: Split nodes.ts into 4 modules:
- `researcher-node.ts` - Search query generation and research logic (~250 lines)
- `persona-nodes.ts` - Optimistic/pessimistic persona logic and rebuttals (~400 lines)
- `decider-node.ts` - Debate conclusion logic (~150 lines)
- `node-utils.ts` - Shared utilities (JSON extraction, content parsing) (~100 lines)

**Rationale**: Each node has a distinct responsibility. Grouping personas together makes sense as they share prompting patterns.

**Alternative considered**: Split into 6 files (one per node) - rejected as too granular, creates import overhead.

### 2. Keep MCP Search, Remove DuckDuckGo
**Decision**: The current MCP-only search (bailian-websearch) works. Remove DuckDuckGo fallback entirely.

**Rationale**: The DuckDuckGo scraper dependency adds complexity and the MCP approach is sufficient.

### 3. Component Refactoring Strategy
**Decision**: Extract from page.tsx:
- `ChatContainer` - Message list and input layout
- `Header` - Title and settings button
- Keep page.tsx as a thin wrapper

**Rationale**: page.tsx handles too many concerns (state, layout, event handling). Extraction improves testability.

### 4. Preserve Public API
**Decision**: All exports from lib/graph/index.ts remain unchanged. Internal refactoring only.

**Rationale**: Avoid breaking changes to any consumers of the graph module.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Maintain existing tests, add integration test before refactoring |
| Merge conflicts with in-progress work | Complete this change quickly, coordinate with team |
| Loss of git history for moved code | Use `git mv` where possible, document moves in commit |
| Increased file count | Accept trade-off for better maintainability |

## Migration Plan

1. **Phase 1**: Remove unused dependencies from package.json
2. **Phase 2**: Extract node utilities to `node-utils.ts`
3. **Phase 3**: Move researcher logic to `researcher-node.ts`
4. **Phase 4**: Move persona logic to `persona-nodes.ts`
5. **Phase 5**: Move decider logic to `decider-node.ts`
6. **Phase 6**: Update `nodes.ts` to re-export from new modules
7. **Phase 7**: Extract components from page.tsx
8. **Phase 8**: Run full test suite and verify

Rollback: Restore from git if any issues arise.

## Open Questions

1. Should we consolidate the SettingsModal and SettingsForm components? They seem closely related.
2. Are there any other unused type definitions in src/types/?
