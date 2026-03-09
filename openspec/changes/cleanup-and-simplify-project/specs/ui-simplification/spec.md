## ADDED Requirements

### Requirement: Simplify page.tsx
The system SHALL reduce the complexity of page.tsx by extracting components.

#### Scenario: ChatContainer extraction
- **WHEN** examining the components directory
- **THEN** ChatContainer.tsx SHALL exist containing the message list and input layout logic
- **AND** page.tsx SHALL import and use ChatContainer

#### Scenario: Header extraction
- **WHEN** examining the components directory
- **THEN** Header.tsx SHALL exist containing the title and settings button
- **AND** page.tsx SHALL import and use Header

#### Scenario: Reduced page.tsx size
- **WHEN** measuring page.tsx line count
- **THEN** it SHALL be under 150 lines (reduced from 474)

### Requirement: Consolidate related components
The system SHALL review and consolidate closely related components where appropriate.

#### Scenario: Settings components review
- **WHEN** examining SettingsModal.tsx and SettingsForm.tsx
- **THEN** they SHALL either be consolidated into one component
- **OR** have clearly distinct responsibilities documented
