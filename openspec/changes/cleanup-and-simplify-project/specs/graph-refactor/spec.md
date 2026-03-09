## ADDED Requirements

### Requirement: Split nodes.ts into focused modules
The system SHALL split the 958-line nodes.ts file into smaller, focused modules by responsibility.

#### Scenario: Researcher node extraction
- **WHEN** examining the graph module structure
- **THEN** researcher-node.ts SHALL exist containing researcherNode function
- **AND** it SHALL handle search query generation and research summary logic

#### Scenario: Persona nodes extraction
- **WHEN** examining the graph module structure
- **THEN** persona-nodes.ts SHALL exist containing optimisticInitialNode, pessimisticInitialNode, optimisticRebuttalNode, and pessimisticRebuttalNode
- **AND** all persona-related prompting logic SHALL be in this file

#### Scenario: Decider node extraction
- **WHEN** examining the graph module structure
- **THEN** decider-node.ts SHALL exist containing deciderNode function
- **AND** it SHALL handle debate winner selection and summary generation

#### Scenario: Node utilities extraction
- **WHEN** examining the graph module structure
- **THEN** node-utils.ts SHALL exist containing shared utilities
- **AND** it SHALL export getContentString, extractJSONFromText, and safeJsonParse

### Requirement: Maintain public API compatibility
The system SHALL preserve all exports from lib/graph/index.ts.

#### Scenario: Existing exports unchanged
- **WHEN** importing from lib/graph
- **THEN** all previously exported functions and types SHALL remain available
- **AND** nodes.ts SHALL re-export from the new modules
