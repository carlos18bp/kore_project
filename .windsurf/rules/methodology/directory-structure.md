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

    Backend --> CoreApp[core_app/]
    CoreApp --> Models["models/ (22 files → 24 models)"]
    CoreApp --> Views["views/ (20 files)"]
    CoreApp --> Serializers["serializers/ (12 files)"]
    CoreApp --> Services["services/ (12 files)"]
    CoreApp --> Tests["tests/ (72 files)"]
    CoreApp --> Commands["management/commands/ (18)"]

    Frontend --> App[app/]
    App --> Public["(public)/ — 10 pages"]
    App --> AuthApp["(app)/ — 20 pages"]
    App --> Components["components/ (36)"]
    App --> FETests["__tests__/ (66 files)"]
    Frontend --> Lib[lib/]
    Lib --> Stores["stores/ (12)"]
    Frontend --> E2E["e2e/ (38 specs)"]

    Windsurf --> Rules[rules/]
    Windsurf --> Workflows[workflows/]
    Rules --> Methodology[methodology/]
    Docs --> DocMethodology[methodology/]
    Docs --> Literature[literature/]
    Tasks --> RFC[rfc/]
```