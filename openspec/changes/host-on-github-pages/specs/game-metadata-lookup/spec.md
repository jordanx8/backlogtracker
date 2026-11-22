# Spec Delta

## Purpose

Lets the owner search IGDB and auto-fill game details, cover art and time to beat from the hosted site, through a lookup service only the owner can use.

## ADDED Requirements

### Requirement: IGDB lookups work from the hosted site
The app SHALL support IGDB game search, detail auto-fill, screenshots, bundled games and time-to-beat lookups when running on the hosted site, not only in local development.

#### Scenario: Searching while signed in
- **WHEN** the signed-in owner searches for a game title in the add-game form on the hosted site
- **THEN** matching IGDB results are shown and picking one fills in the game's details

### Requirement: Lookups are restricted to the owner
The lookup service SHALL serve only requests that carry a GitHub token with push access to the configured repository, and only from the app's own origins.

#### Scenario: Request without a valid token
- **WHEN** a request reaches the lookup service without a token, or with a token lacking push access
- **THEN** the service refuses it and makes no IGDB call

#### Scenario: Request from another website
- **WHEN** a page on another origin calls the lookup service from a browser
- **THEN** the browser blocks the response

#### Scenario: Request for an endpoint outside the allowed set
- **WHEN** an authorized request asks for an IGDB endpoint the app does not use
- **THEN** the service refuses it

### Requirement: Lookups degrade gracefully
When the lookup service is not configured or fails, the app SHALL still let the owner add and edit games by entering details by hand.

#### Scenario: Service unavailable
- **WHEN** a lookup fails or the service is not configured
- **THEN** the form shows that lookup is unavailable and all fields remain editable by hand

### Requirement: Time to beat comes from IGDB or manual entry only
The app SHALL fill time to beat only from IGDB, and SHALL NOT contact HowLongToBeat.

#### Scenario: IGDB has no time to beat
- **WHEN** a picked game has no IGDB time-to-beat data
- **THEN** the field is left empty for manual entry and no other service is queried

#### Scenario: Existing values kept
- **WHEN** a game already has a time to beat recorded, including one previously filled from HowLongToBeat
- **THEN** the value is kept and shown as before
