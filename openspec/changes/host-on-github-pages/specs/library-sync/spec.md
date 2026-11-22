# Spec Delta

## Purpose

Keeps the owner's games and journal stored in the GitHub repository, loading them on any device and saving edits automatically without losing changes made on another device.

## ADDED Requirements

### Requirement: Load the library from the repository
After sign-in the app SHALL load the games and journal from the latest commit on the configured branch, not from files served by the site.

#### Scenario: Fresh load
- **WHEN** the owner opens the app on a device with no unsaved edits
- **THEN** the app shows the games and journal as of the latest commit on the branch

#### Scenario: Data not served by the site
- **WHEN** anyone requests the site's former data URLs, such as `data/games.json` under the site path
- **THEN** the site does not return the library data

### Requirement: Autosave edits as commits
The app SHALL save edits to the repository automatically, a few seconds after the last edit, with no Save button. One save SHALL write the games and journal together in a single commit.

#### Scenario: Burst of edits
- **WHEN** the owner makes several edits within a few seconds and then stops
- **THEN** one commit containing all of those edits is added to the branch

#### Scenario: Leaving the page
- **WHEN** the page is hidden or closed while edits are unsaved
- **THEN** the app attempts to save immediately, and any edits that were not saved remain on the device and are saved the next time the app opens

### Requirement: Descriptive commit messages
Each autosave commit SHALL have a message summarising what changed, naming the affected games.

#### Scenario: Edit and add
- **WHEN** a save contains an edit to "Pragmata" and a newly added "Hades"
- **THEN** the commit message names both games and what happened to each

### Requirement: Show save status
The app SHALL always show whether the library is saved, saving, unsaved, offline, or failed to save.

#### Scenario: Save fails
- **WHEN** a save fails for a reason other than a resolvable conflict
- **THEN** the status shows the failure, local edits are kept, and the app retries later

#### Scenario: Offline
- **WHEN** the device has no connection
- **THEN** the status shows offline, edits continue to be kept on the device, and they are saved once the connection returns

### Requirement: Merge concurrent edits from other devices
When another device has saved since this device last loaded, the app SHALL merge both sets of changes and save the result, without discarding either device's edits except where both changed the same field.

#### Scenario: Different games edited on two devices
- **WHEN** device A edits game X and device B edits game Y, and B saves after A
- **THEN** the saved library contains both edits

#### Scenario: Same game, different fields
- **WHEN** device A changes a game's status and device B changes the same game's rating, and B saves after A
- **THEN** the saved game has A's status and B's rating

#### Scenario: Same field on both devices
- **WHEN** both devices change the same field of the same game, and B saves after A
- **THEN** the saved value is B's, the value from the device saving later

#### Scenario: Deleted on one device, edited on the other
- **WHEN** one device deletes a game and the other edits it
- **THEN** the edited game is kept

#### Scenario: Added on both devices
- **WHEN** each device adds a different new game or journal entry
- **THEN** the saved library contains both additions

#### Scenario: Deleted on one device only
- **WHEN** one device deletes a game or journal entry and the other device did not change it
- **THEN** it is deleted in the saved library

### Requirement: Pick up remote changes on return
When the app regains focus, it SHALL check whether the branch has newer commits and bring them in.

#### Scenario: No local edits
- **WHEN** the app regains focus, the branch has a newer commit, and this device has no unsaved edits
- **THEN** the app updates to the newer library without a prompt

#### Scenario: Local edits pending
- **WHEN** the app regains focus, the branch has a newer commit, and this device has unsaved edits
- **THEN** the app merges the newer library with the local edits and saves the result

### Requirement: Carry over unsaved edits from the previous version
On first use of the new version, the app SHALL treat unsaved edits left on the device by the previous local-save flow as local edits and save them through the normal merge.

#### Scenario: Old unsaved edits present
- **WHEN** the app opens on a device that has unsaved edits from the previous version
- **THEN** those edits are merged with the repository data and saved, and nothing is lost
