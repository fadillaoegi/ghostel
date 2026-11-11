---
inclusion: manual
---

# Kiroween 2026 submission checklist (include with #submission when preparing the Devpost entry)

## Sources
- The official pages (https://kiroween.devpost.com/ and `/rules`) return HTTP 403 to Kiro's fetch tool (checked again on 2026-11-10).
- Main source since 2026-11-10: the AWS Japan blog post "Kiro のハロウィンハッカソン Kiroween 2026 が始まりました" (https://aws.amazon.com/jp/blogs/news/kiroween-2026/). It summarises the official Devpost overview and Official Rules as of 2026-10-31 and says the English pages are authoritative. Everything below is Kiro's English paraphrase of that post. It is still secondary: the owner should confirm it in a browser, especially eligibility.

## Dates (US Pacific time, from the source)
- Submission period: 2026-10-30 09:00 to **2026-12-04 14:00 PT** (2026-12-05 05:00 WIB). No extensions; late entries are refused.
- Devpost Build Session: 2026-11-11 10:00 PT (2026-11-12 01:00 WIB).
- Free Kiro credits (4,000, once per person): request by 2026-12-01 12:00 PT through the form on the Resources tab. It needs a Kiro account and the Kiro user ID, and codes arrive within 48 business hours. Redeem by 2026-12-04; credits expire 2026-12-31 23:59 PT.
- Judging 2026-12-16 to 2027-01-29; winners around 2027-02-03.

## Eligibility
- Adults (age of majority where they live), teams of up to 3, or organisations. Some countries and regions are excluded. **The owner must check that Indonesia is not on the excluded list in the official rules.**
- Only new projects built during the submission period. Frameworks, libraries and starter templates are allowed; other pre-existing code must be declared. Ghostel started 2026-11-07 and uses no earlier project code (Ghost Turtle Kit was not copied).
- Judges may disqualify entries whose Kiro use is insufficient.
- Kiro IDE, CLI, Web or Kiro Crew may be used. Ghostel used Kiro CLI.

## Category
- One category per entry, from four: Resurrection, Frankenstein, Skeleton Crew, Costume Contest. Ghostel enters **Costume Contest** (owner, 2026-11-10).
- Costume Contest: any app, with a polished, unforgettable, spooky UI. The spooky design should support the app's function.
- Skeleton Crew would need two apps in separate folders. Ghostel's Game Kit is an echo, not an entry.

## What to submit
- [x] A public **GitHub** repository (not GitLab or Bitbucket) with all source, assets and instructions, and an open source license file shown in the repo's About panel. https://github.com/fadillaoegi/ghostel, GitHub detects MIT (checked 2026-11-09).
- [x] `/.kiro` at the root showing specs, hooks and steering, not in `.gitignore` (ignoring it can disqualify). Pushed 2026-11-09.
- [ ] A working app URL. If a login were needed, credentials would go in the private judges' field; Ghostel needs none (guest check-in).
- [ ] A text description of the features.
- [ ] A demo video **under 3 minutes** on YouTube, showing the project running. No unlicensed third-party trademarks or copyrighted music. Ghostel's music is original, so it can be used.
- [ ] A write-up of how Kiro was used. The source lists example topics:
  - which Kiro (IDE, CLI, Web, Crew)
  - custom agents
  - agent hooks
  - spec-driven development compared to vibe coding
  - steering
  - MCP
  - property-based testing (PBT)
  - Kiro powers

  Ghostel has evidence for: CLI, specs, steering, hooks (guard and session-status proven, PostFileSave indirect), subagents (context-gatherer, introspect). Not used yet: custom agents, MCP, PBT, powers, Crew. Do not claim them.
- [ ] Everything in English (or with English translations).

## Prizes (from the source)
- Overall: 1st $30,000, 2nd $20,000, 3rd $10,000. Category prizes: $5,000 each for Best Resurrection, Frankenstein, Skeleton Crew and Costume Contest. One entry gets either an overall prize or a category prize, not both.
- Bonus prizes can be combined; choose them in the submission form:
  - **Best Demo** ($1,000): automatic, for the highest Presentation score among the top 10% overall.
  - **Bonus Blog Prize** (2,000 Kiro credits, 100 winners): publish a post about Kiro and the project on an external blog during the submission period. The post must say it was written for Kiroween 2026. Submit its URL; the top 100 scoring eligible entries win.
  - **Social Blitz** (Kiro Pro+ for 3 months, 5 winners): a social post starting with `#KiroweenHackathon26` about what you like most in Kiro and how it changed your workflow. Submit the post URL.
  - Best Startup Project ($10,000; startup founders only), Best Ghost of Kiroween Past ($2,000; registered for Kiroween 2025), Best Kiro Crew App ($1,000; a Kiro Crew app), Best Student Project per category (all-student teams). Ask the owner which of these apply.

## Judging (from the source)
- Stage 1 is pass/fail: fits the theme and uses Kiro.
- Stage 2 scores five criteria, 10 points each, 20% each:
  1. **Potential Impact:** solves a real problem for real users, and the demo shows it. Useful, easy to understand, accessible, likely to be used.
  2. **Technological Implementation:** how deeply and well Kiro was used, a deliberate AI development workflow, and effective use and experimentation with Kiro's features.
  3. **Design:** a cohesive product experience, not just a tech prototype. Clear, polished and intentional.
  4. **Innovation/Idea:** original, different from existing things, with unusual combinations of technologies or public datasets.
  5. **Presentation:** the video shows the project working end to end and makes clear what problem it solves, for whom and why. Clear and memorable.

## Before submitting
- Open "Enter a Submission" early and save drafts; entries cannot be edited after the deadline.
- Re-run all checks and store the output in `docs/evidence/`.
- Make sure the deployed app is up and that calls work across two real networks.
- Every claim in the Devpost text must be backed by a file in the repo (evidence, screenshots, activity log). Never claim time saved or results that were not measured.
