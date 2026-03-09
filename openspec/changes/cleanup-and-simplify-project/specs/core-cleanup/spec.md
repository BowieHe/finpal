## ADDED Requirements

### Requirement: Remove unused dependencies
The system SHALL remove all unused dependencies from package.json.

#### Scenario: Package.json cleanup
- **WHEN** reviewing package.json dependencies
- **THEN** playwright, duck-duck-scrape, and @playwright/test SHALL be removed
- **AND** the application SHALL build and run successfully

### Requirement: Clean up dead code references
The system SHALL remove any code referencing removed dependencies.

#### Scenario: No DuckDuckGo references
- **WHEN** searching the codebase for DuckDuckGo references
- **THEN** no import statements or usage SHALL exist

#### Scenario: No Playwright references
- **WHEN** searching the codebase for Playwright references
- **THEN** no import statements or usage SHALL exist
