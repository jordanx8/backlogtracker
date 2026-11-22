# Spec Delta

## Purpose

Restricts the hosted app to the repository owner by requiring a GitHub token with push access before any library data is shown or changed.

## ADDED Requirements

### Requirement: Sign-in with a GitHub token
The app SHALL show a sign-in screen whenever no valid token is stored on the device. The owner signs in by pasting a GitHub personal access token.

#### Scenario: First visit
- **WHEN** a visitor opens the site on a device with no stored token
- **THEN** the app shows only the sign-in screen, with instructions for creating a token, and no library data

#### Scenario: Token with push access
- **WHEN** the owner submits a token that grants push access to the configured repository
- **THEN** the app stores the token on this device and loads the library

### Requirement: Reject tokens without push access
The app SHALL accept a token only if GitHub confirms it grants push access to the configured repository.

#### Scenario: Invalid or read-only token
- **WHEN** a submitted token is invalid, expired, or lacks push access to the repository
- **THEN** the app stays on the sign-in screen, shows why the token was rejected, and does not store it

### Requirement: Stay signed in per device
The app SHALL keep a valid token on the device across reloads, and SHALL return to the sign-in screen when the stored token stops working.

#### Scenario: Returning visit
- **WHEN** the owner reopens the site on a device with a stored valid token
- **THEN** the app loads the library without asking for the token again

#### Scenario: Token revoked
- **WHEN** GitHub rejects the stored token as unauthorized
- **THEN** the app returns to the sign-in screen and keeps any unsaved local edits on the device so they can be saved after signing in again

### Requirement: Sign out
The app SHALL let the owner sign out, which removes the token and cached library data from the device.

#### Scenario: Sign out with everything saved
- **WHEN** the owner signs out and all edits are saved
- **THEN** the token and cached data are removed and the sign-in screen is shown

#### Scenario: Sign out with unsaved edits
- **WHEN** the owner signs out while edits are not yet saved
- **THEN** the app warns that unsaved edits will be lost and signs out only if the owner confirms

### Requirement: No secrets in the published site
The published site and the repository SHALL NOT contain any secret, including the IGDB client secret or any GitHub token.

#### Scenario: Inspecting the built site
- **WHEN** someone reads the published JavaScript and repository files
- **THEN** they find no IGDB client secret and no GitHub token
