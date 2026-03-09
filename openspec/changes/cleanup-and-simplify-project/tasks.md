## 1. Core Cleanup - Remove Unused Dependencies

- [ ] 1.1 Remove `playwright` from package.json dependencies
- [ ] 1.2 Remove `duck-duck-scrape` from package.json dependencies
- [ ] 1.3 Remove `@playwright/test` from package.json devDependencies
- [ ] 1.4 Run `npm install` to update lock file
- [ ] 1.5 Verify build still passes with `npm run build`
- [ ] 1.6 Run tests to ensure no regressions: `npm test`

## 2. Graph Refactor - Extract Utilities

- [ ] 2.1 Create `src/lib/graph/node-utils.ts` with shared utilities
- [ ] 2.2 Move `getContentString()` to node-utils.ts
- [ ] 2.3 Move `extractJSONFromText()` to node-utils.ts
- [ ] 2.4 Move `safeJsonParse()` to node-utils.ts
- [ ] 2.5 Move `getCurrentDateInfo()` to node-utils.ts
- [ ] 2.6 Move `extractYearFromQuestion()` to node-utils.ts
- [ ] 2.7 Update nodes.ts to import from node-utils.ts

## 3. Graph Refactor - Extract Researcher Node

- [ ] 3.1 Create `src/lib/graph/researcher-node.ts`
- [ ] 3.2 Move `buildSearchQueryPrompt()` to researcher-node.ts
- [ ] 3.3 Move `parseSearchQueries()` to researcher-node.ts
- [ ] 3.4 Move `executeSearchQueries()` to researcher-node.ts
- [ ] 3.5 Move `generateResearchSummary()` to researcher-node.ts
- [ ] 3.6 Move `researcherNode` function to researcher-node.ts
- [ ] 3.7 Export from researcher-node.ts
- [ ] 3.8 Update nodes.ts to import and re-export researcherNode

## 4. Graph Refactor - Extract Persona Nodes

- [ ] 4.1 Create `src/lib/graph/persona-nodes.ts`
- [ ] 4.2 Move `buildPersonaPrompt()` to persona-nodes.ts
- [ ] 4.3 Move `buildRebuttalPrompt()` to persona-nodes.ts
- [ ] 4.4 Move `optimisticInitialNode` to persona-nodes.ts
- [ ] 4.5 Move `pessimisticInitialNode` to persona-nodes.ts
- [ ] 4.6 Move `optimisticRebuttalNode` to persona-nodes.ts
- [ ] 4.7 Move `pessimisticRebuttalNode` to persona-nodes.ts
- [ ] 4.8 Export all persona functions from persona-nodes.ts
- [ ] 4.9 Update nodes.ts to import and re-export persona functions

## 5. Graph Refactor - Extract Decider Node

- [ ] 5.1 Create `src/lib/graph/decider-node.ts`
- [ ] 5.2 Move `formatArgument()` to decider-node.ts
- [ ] 5.3 Move `buildDeciderPrompt()` to decider-node.ts
- [ ] 5.4 Move `parseDeciderResponse()` to decider-node.ts
- [ ] 5.5 Move `deciderNode` function to decider-node.ts
- [ ] 5.6 Export from decider-node.ts
- [ ] 5.7 Update nodes.ts to import and re-export deciderNode

## 6. Graph Refactor - Update Index

- [ ] 6.1 Update `src/lib/graph/index.ts` to export from new modules
- [ ] 6.2 Verify all public exports remain available
- [ ] 6.3 Run graph tests to verify functionality

## 7. UI Simplification - Extract Header Component

- [ ] 7.1 Create `src/components/Header.tsx`
- [ ] 7.2 Extract header JSX from page.tsx
- [ ] 7.3 Extract header state and handlers
- [ ] 7.4 Define Header props interface
- [ ] 7.5 Export Header component
- [ ] 7.6 Update page.tsx to use Header

## 8. UI Simplification - Extract ChatContainer Component

- [ ] 8.1 Create `src/components/ChatContainer.tsx`
- [ ] 8.2 Extract message list and input layout from page.tsx
- [ ] 8.3 Extract related state and handlers
- [ ] 8.4 Define ChatContainer props interface
- [ ] 8.5 Export ChatContainer component
- [ ] 8.6 Update page.tsx to use ChatContainer

## 9. UI Simplification - Review Settings Components

- [ ] 9.1 Review SettingsModal.tsx and SettingsForm.tsx overlap
- [ ] 9.2 Decide: consolidate or keep separate
- [ ] 9.3 If consolidating, merge into SettingsModal.tsx
- [ ] 9.4 Update imports in page.tsx if needed

## 10. Final Verification

- [ ] 10.1 Run full test suite: `npm test`
- [ ] 10.2 Run build: `npm run build`
- [ ] 10.3 Run linting: `npm run lint`
- [ ] 10.4 Verify page.tsx is under 150 lines
- [ ] 10.5 Verify nodes.ts only contains re-exports
- [ ] 10.6 Check bundle size improvement
- [ ] 10.7 Manual smoke test of the application
