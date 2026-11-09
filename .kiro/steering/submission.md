---
inclusion: manual
---

# Kiroween 2026 submission checklist (include with #submission when preparing the Devpost entry)

Status of the sources: the official rules page (https://kiroween.devpost.com/rules) returns HTTP 403 to Kiro's fetch tool. Until the owner provides the official text, the items below come from secondary sources recorded on 2026-11-05 (see `product.md`) and must be re-checked.

## Requirements (to confirm against the official rules)
- [ ] Built with Kiro in a meaningful way; the `.kiro` folder (steering, specs, hooks) is at the repository root and is not gitignored.
- [ ] Working, public app URL (HTTPS) for judges.
- [ ] Public GitHub repository with an open source license (`LICENSE` is MIT).
- [ ] Demo video on YouTube, under 3 minutes.
- [ ] Category chosen: Costume Contest (fallback Frankenstein, see `docs/CATEGORY-REPORT.md`).
- [ ] Devpost text: what it is, how Kiro was used (link `docs/KIRO-ACTIVITY.md`), how to test it.
- [ ] Deadline: 2026-12-04 14:00 PT (2026-12-05 05:00 WIB); personal target 2026-12-03 21:00 WIB.

## Before submitting
- Re-run all checks and store the output in `docs/evidence/`.
- Make sure the deployed app is awake (keep-alive workflow) and that calls work across two real networks.
- Every claim in the Devpost text must be backed by a file in the repo (evidence, screenshots, activity log). Never claim time saved or results that were not measured.
