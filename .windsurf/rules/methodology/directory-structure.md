---
description: directory structure to follow
trigger: always_on
---     
# Directory Structure
```mermaid
flowchart TD
    Root[Project Root]
    Root --> Backend[backend/]
    Root --> Frontend[frontend/]
    Root --> Docs[docs/]
    Root --> Tasks[tasks/]
    Root --> Scripts[scripts/]
    Root --> Windsurf[.windsurf/]
    Root --> GitHub[.github/]
    Windsurf --> Rules[rules/]
    Windsurf --> Workflows[workflows/]
    Rules --> Methodology[methodology/]
    Docs --> DocMethodology[methodology/]
    Docs --> Literature[literature/]
    Tasks --> RFC[rfc/]
```