---
inclusion: manual
---

# Kiroween 2026 submission checklist (include with #submission when preparing the Devpost entry)

Status of the sources: the official pages (https://kiroween.devpost.com/ and `/rules`) return HTTP 403 to Kiro's fetch tool (checked again on 2026-11-10). Until the owner provides the official text, the items below come from secondary sources recorded on 2026-11-05 (see `product.md`) and from search snippets of the official page seen on 2026-11-10. They must be re-checked.

## Eligibility and rules seen so far
- One category per entry ("pick a category", snippet of the official page, 2026-11-10).
- Only new projects built during the submission period, 2026-10-30 to 2026-12-04 (same snippet). Ghostel started on 2026-11-07, and its root commit was pushed on 2026-11-09.
- Categories (secondary source, 2026-11-05): Resurrection, Frankenstein, Skeleton Crew, Costume Contest. Bonus prizes include Best Startup Project, Best Kiro Crew App and Best Demo, and a blog post can earn bonus credits.
- The 2026 page also names Kiro Crew, Kiro powers and MCP as ways to use Kiro. Ghostel has not used them. Do not claim them.

## Requirements (to confirm against the official rules)
- [x] Built with Kiro in a meaningful way; the `.kiro` folder (steering, specs, hooks) is at the repository root and is not gitignored. (Pushed in the root commit on 2026-11-09.)
- [ ] Working, public app URL (HTTPS) for judges.
- [x] Public GitHub repository with an open source license (`LICENSE` is MIT). https://github.com/fadillaoegi/ghostel, public, GitHub detects MIT (checked 2026-11-09).
- [ ] Demo video on YouTube, under 3 minutes.
- [ ] Category chosen: Costume Contest (owner, 2026-11-10). Enter it on Devpost.
- [ ] Devpost text: what it is, how Kiro was used (link `docs/KIRO-ACTIVITY.md`), how to test it, and an "Also inside the hotel" part that names the Frankenstein and Resurrection echoes (M16) without claiming those categories.
- [ ] Deadline: 2026-12-04 14:00 PT (2026-12-05 05:00 WIB); personal target 2026-12-03 21:00 WIB.
- [ ] Official rules read in full (owner pastes the text; M15 task 7).

## Before submitting
- Re-run all checks and store the output in `docs/evidence/`.
- Make sure the deployed app is awake (keep-alive workflow) and that calls work across two real networks.
- Every claim in the Devpost text must be backed by a file in the repo (evidence, screenshots, activity log). Never claim time saved or results that were not measured.
