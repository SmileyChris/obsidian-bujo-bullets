# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.3.1 - 2026-04-23

### Changed

- Renamed `[-]` bullet type from "Irrelevant" to "Cancelled" (affects command palette label and right-click menu; command ID and hotkey bindings unchanged)

## 1.3.0 - 2026-04-22

### Added

- `- [/]` In-Progress bullet type with matching icon and command
- Signifier coloring now applies in Live Preview, not just Reading view
- Editor right-click context menu with "Change bullet to" submenu (previously only available in Reading view)

### Fixed

- Signifiers no longer double-wrap or corrupt inline content when the signifier character appears later on the line (#3)
- Removed duplicated iteration over checkbox list items (#3, supersedes #4)

## 1.2.1 - 2025-03-08

### Fixed

- Set the correct default values for the signifiers setting

## 1.2.0 - 2025-03-08

### Added

- Support for signifiers
- Settings to customize signifiers

## 1.1.0 - 2025-02-19

### Added

- Commands and hotkeys to change bullet types

## 1.0.2 - 2025-01-13

### Added

- Right-click menu for changing bullet types

## 1.0.1 - 2024-10-03

### Fixed

- Update the manifest author field to the correct value

## 1.0.0 - 2024-10-03

### Added

- Custom rendering of Bullet Journal styled checkboxes