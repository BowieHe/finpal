## Why

The FinPal codebase has accumulated significant technical debt from previous development iterations. Many dependencies are unused (Playwright, DuckDuckGo scraper), the core logic in nodes.ts has grown to 958 lines of complex code, and the architecture contains dead code paths. This cleanup is necessary to improve maintainability, reduce build times, and establish a clean foundation for future development.

## What Changes

### Remove Unused Dependencies
- Remove `playwright` - not used in any code (was planned for scraping but abandoned)
- Remove `duck-duck-scrape` - no DuckDuckGo references exist in codebase
- Remove `@playwright/test` - no Playwright tests exist

### Simplify Core Logic
- Refactor `src/lib/graph/nodes.ts` (958 lines) into smaller, focused modules:
  - `researcher-node.ts` - Search query generation and research logic
  - `persona-nodes.ts` - Optimistic/pessimistic persona logic
  - `decider-node.ts` - Debate conclusion and winner selection
  - `utils.ts` - Shared utilities (JSON extraction, content parsing)

### Remove Dead Code
- Verify and remove unused type definitions
- Clean up unused MCP configurations
- Remove debug/development logging if excessive

### Streamline Component Structure
- Simplify `src/app/page.tsx` (474 lines) - break into smaller components
- Consolidate redundant UI components
- Remove unused component props and state

### **BREAKING**: API Changes
- Simplified search interface - remove legacy unifiedSearch wrapper
- Streamlined state types - remove unused fields from GraphState

## Capabilities

### New Capabilities
- `core-cleanup`: Remove unused dependencies and simplify build configuration
- `graph-refactor`: Restructure LangGraph nodes into maintainable modules
- `ui-simplification`: Consolidate and simplify React components

### Modified Capabilities
- None (this is a pure refactoring/cleanup change)

## Impact

- **Dependencies**: Reduced bundle size and faster installs
- **Build Time**: Faster compilation with fewer dependencies
- **Maintainability**: Smaller, focused modules instead of 958-line monolith
- **Code Quality**: Remove dead code and simplify complex logic paths
- **Tests**: Existing tests should continue to pass after refactoring
