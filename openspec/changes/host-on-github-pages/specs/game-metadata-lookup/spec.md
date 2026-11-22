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
The workflow SHALL search IGDB for the entered title, limited to the IGDB platform of the entered system. It SHALL prefer an exact title match (ignoring case and punctuation), then a release year equal to the one entered, then IGDB's own ranking.

#### Scenario: Exact title preferred
- **WHEN** the search returns "Hades II" first and "Hades" second for the title "Hades"
- **THEN** "Hades" is chosen

#### Scenario: Release year breaks ties
- **WHEN** two games share the entered title and the owner entered release year 2023
- **THEN** the one released in 2023 is chosen

#### Scenario: Platform limit
- **WHEN** the owner enters system "Nintendo Switch"
- **THEN** only games IGDB lists for Nintendo Switch are considered in the first search

#### Scenario: IGDB ID given
- **WHEN** the owner enters an IGDB ID
- **THEN** that game is used without searching

### Requirement: Refuse uncertain matches
When no acceptable match exists, the workflow SHALL fail without changing the library and SHALL list the closest candidates with their IGDB IDs.

#### Scenario: Nothing on the platform, no exact title elsewhere
- **WHEN** the platform-limited search finds nothing and the unrestricted search finds no exact title match
- **THEN** the run fails, the library is unchanged, and the summary lists up to five candidates with IGDB IDs to re-run with

#### Scenario: Exact title on another platform listing
- **WHEN** the platform-limited search finds nothing but the unrestricted search finds an exact title match
- **THEN** that game is used, with the system the owner entered

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
