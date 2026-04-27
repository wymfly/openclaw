## ADDED Requirements

### Requirement: Frontend migration records backend gaps

Every Deck visual migration child change SHALL record backend/API/projection gaps discovered while porting old Deck workflows from Node+Next to Vite+Go.

#### Scenario: Old UI needs service data missing in Go

- **WHEN** an old Deck component, dialog, tab, stream view, or action needs service behavior that is absent from the Go backend
- **THEN** the owning child change SHALL record the old authority file, the old Node+Next service/API behavior, the current Go backend target, and the impact on the migrated UI.

### Requirement: Backend gaps are fixed with the owning panel

Backend/API/projection gaps that block old Deck workflow parity SHALL be fixed in the same child change that migrates the affected panel unless the Gateway source of truth does not support the capability.

#### Scenario: Go backend lacks a supported projection field

- **WHEN** the Gateway source of truth supports a capability and old Deck used it through the Node+Next service
- **AND** the Go backend omits the required route, projection field, snapshot, stream event, mutation, or error shape
- **THEN** the implementation SHALL update the Go backend/API adapter and add targeted verification before marking the panel migrated.

### Requirement: No frontend-only masking of backend defects

The Vite frontend SHALL NOT hide required old Deck workflows behind static placeholders, fake data, permanently disabled controls, or silent omission when the real issue is a missing Go backend/API contract.

#### Scenario: Panel can only be made visually similar by omitting a control

- **WHEN** a migrated panel omits or disables an old Deck control because required backend data is missing
- **THEN** the change SHALL either fix the backend gap or document the omission as a Gateway-unsupported exception with visible unavailable-state behavior.
