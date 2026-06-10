---
name: Lead Statuses
description: Complete lead status lifecycle and interactive badge rules
type: feature
---
## Interested Status Dropdown (5 statuses only)
- Initial Call (callback_later)
- No Answer (no_answer)
- Hung Up (hung_up)
- Wrong Info (wrong_info)
- FTD (converted)

## Hidden from dropdown but still valid in DB
- Not Called (not_called) — default for new leads
- Wrong Number (wrong_number) — legacy
- Not Interested (not_interested) — legacy
- Interested (interested) — legacy

## Retention Statuses (separate field)
new_to_retention, contacted, follow_up, active, deposited_converted, lost, do_not_contact
