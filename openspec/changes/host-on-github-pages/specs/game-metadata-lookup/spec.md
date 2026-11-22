# Spec Delta

## Purpose

Lets the owner add a game with its details filled in from IGDB by running a GitHub Actions workflow with the options they choose, so that IGDB access needs no service beyond GitHub.

## ADDED Requirements

### Requirement: Add a game from IGDB with a workflow
The repository SHALL provide a manually run workflow, "Add game from IGDB", whose form takes a title and system (both required), status, ownership, an optional release year, an optional IGDB ID, and a preview-only option. A successful run SHALL add the matched game to the library.

#### Scenario: Adding a game
- **WHEN** the owner runs the workflow with title "Hades", system "PC" and status "Backlog"
- **THEN** a commit adds Hades to `data/games.json` with system PC, status backlog, and its IGDB details

#### Scenario: Run summary
- **WHEN** a run finishes
- **THEN** its summary shows the IGDB game that was chosen, with its IGDB ID and release year, and the other close candidates

### Requirement: Match the game using the options entered
The workflow SHALL search IGDB for the entered title, with every query limited to the IGDB platform of the entered system. It SHALL prefer an exact title match (ignoring case and punctuation), then a release year equal to the one entered, then IGDB's own ranking.

#### Scenario: Exact title preferred
- **WHEN** the search returns "Hades II" first and "Hades" second for the title "Hades"
- **THEN** "Hades" is chosen

#### Scenario: Release year breaks ties
- **WHEN** two games share the entered title and the owner entered release year 2023
- **THEN** the one released in 2023 is chosen

#### Scenario: Only the chosen system
- **WHEN** the owner enters system "Nintendo Switch"
- **THEN** every query is limited to games IGDB lists for Nintendo Switch, and games only on other systems are never chosen or listed

#### Scenario: System with no IGDB platform
- **WHEN** the owner chooses Other and types a system name
- **THEN** the search is not limited to a platform

#### Scenario: IGDB ID given
- **WHEN** the owner enters an IGDB ID
- **THEN** that game is used without searching

### Requirement: Search wider before giving up
When the first search has no confident match, the workflow SHALL search again with more results, including games whose names contain every significant word of the entered title, before deciding.

#### Scenario: Title typed without its prefix
- **WHEN** the owner enters "Zelda Tears of the Kingdom" for Nintendo Switch and the first search has no confident match
- **THEN** the wider search finds "The Legend of Zelda: Tears of the Kingdom", the only result containing every word, and it is chosen

#### Scenario: Confident on the first search
- **WHEN** the first search returns an exact title match
- **THEN** no wider search is made

### Requirement: Refuse uncertain matches
When neither search gives a confident match, which is an exact title or exactly one result containing every entered word, the workflow SHALL fail without changing the library and SHALL list the closest candidates on that system with their IGDB IDs.

#### Scenario: Only loose matches
- **WHEN** both searches return games on the system, but none has the exact title and several contain every entered word
- **THEN** the run fails, the library is unchanged, and the summary lists up to five of those games with IGDB IDs to re-run with

#### Scenario: Nothing on the system
- **WHEN** neither search returns any game for the system
- **THEN** the run fails, the library is unchanged, and the summary says nothing was found for that system

### Requirement: Preview without changing the library
A preview-only run SHALL report the match it would use and SHALL NOT commit anything.

#### Scenario: Preview run
- **WHEN** the owner runs the workflow with preview-only selected
- **THEN** the summary shows the chosen match and no commit is made

### Requirement: Refresh a game that is already in the library
If the matched game is already in the library, the same IGDB ID or the same title and system, the workflow SHALL update its IGDB details instead of adding a duplicate, keeping the owner's own fields.

#### Scenario: Re-running for an existing game
- **WHEN** the owner runs the workflow for a game already in the library that has a rating, notes, and some DLC marked done
- **THEN** its IGDB details are refreshed, no second copy is added, and its status, ownership, rating, notes and done-states are unchanged

### Requirement: Saving alongside the app
The workflow's commit SHALL NOT discard edits that the app saved while the workflow was running.

#### Scenario: App saves during a run
- **WHEN** the app commits an edit to another game after the workflow read the library but before it committed
- **THEN** the resulting library contains both the app's edit and the added game

### Requirement: No IGDB access from the app
The app SHALL NOT contact IGDB or any lookup service, and SHALL let the owner add and edit games by hand, including time to beat.

#### Scenario: Adding by hand
- **WHEN** the owner adds a game in the app
- **THEN** the game is saved with the details entered, no IGDB request is made, and the form points to the workflow for adding from IGDB

#### Scenario: Existing values kept
- **WHEN** a game already has details recorded, including a time to beat previously filled from HowLongToBeat
- **THEN** the values are kept and shown as before

### Requirement: IGDB credentials stay in GitHub secrets
The IGDB client ID and secret SHALL be read only from the workflow's repository secrets and SHALL NOT appear in the published site or the repository.

#### Scenario: Inspecting the site and repository
- **WHEN** someone reads the published JavaScript and the repository files
- **THEN** they find no IGDB client secret
