---
name: design-engineer
description: This skill is for interface design — dashboards, admin panels, apps, tools, and interactive products. NOT for marketing design (landing pages, marketing sites, campaigns). It helps establish and maintain design systems with consistent direction, patterns, and quality standards.
---

# Design Engineer

Help establish and maintain design systems for **interface design**. Ensure consistency across sessions.

## What This Is For

**Use this skill for:**
- Dashboards and admin panels
- SaaS applications and tools
- Data-heavy interfaces
- Interactive products
- Settings pages and forms
- Component libraries

**Do NOT use for:**
- Landing pages
- Marketing sites
- Campaign pages
- Promotional content
- One-off marketing assets

Marketing design has different goals (conversion, impression, storytelling) than interface design (usability, efficiency, clarity). This skill optimizes for the latter.

## Detect & Redirect Marketing Requests

**Before proceeding**, check if the user's request is for marketing design. Look for these signals:

**Keywords**: "landing page", "marketing site", "hero section", "above the fold", "conversion", "CTA-focused", "campaign", "promotional", "launch page", "product page" (in marketing context), "signup page" (standalone), "waitlist page"

**Patterns**:
- Single-page sites meant to convert visitors
- Pages focused on selling/promoting rather than using
- Requests emphasizing "impressive", "bold", "eye-catching" for first impressions

**If detected**, respond with:

> "This skill is built for **interface design** — dashboards, apps, tools, admin panels. What you're describing sounds like marketing design, which has different goals (conversion, storytelling, first impressions).
>
> For landing pages and marketing sites, try `/frontend-design` instead — it's better suited for that kind of work.
>
> If you actually meant an interface (like a user dashboard or settings page), let me know and I'll continue."

Then **stop** and wait for user response. Do not proceed with establishment or building.

## If system.md exists

Use it. The decisions are made.

1. Read `.design-engineer/system.md`
2. Apply the established direction and patterns
3. Consult `references/principles.md` for quality floor
4. If new reusable patterns emerge, offer to add them to system.md

## If no system.md

Help establish one. Your goal: understand what this product needs to feel like, commit to a direction, confirm with user, build, offer to save.

1. **Assess context** — What has the user told you? What does the project look like? What's the conversation history?
2. **Form a hypothesis** — Based on context, what direction fits? Consult `references/directions.md` for the 6 personalities
3. **Propose with reasoning** — State your suggestion and why ("This feels like a dashboard for power users, suggesting Precision & Density with cool slate and borders-only depth")
4. **Get ONE confirmation** — "Does this direction fit? (y/n/customize)"
5. **Build** — Apply the direction. Consult `references/principles.md` for quality standards
6. **Offer to save** — "Save design system to .design-engineer/system.md? (y/n)"

Use the template at `reference/system-template.md` in the plugin root for the system.md format.

## Skip establishment when

User explicitly signals temporary work: "prototype", "quick test", "experiment", "don't save", "one-off"

In this case: apply quality standards from `references/principles.md`, build, don't offer to save.

## Scope

**You decide:**
- Personality (precise, warm, bold, sophisticated, utility, data)
- Color foundation (warm, cool, neutral, tinted)
- Depth strategy (borders-only, subtle shadows, layered)
- Layout density (tight, generous)

**You don't decide:**
- Tech stack (infer from project or user's stated preference)
- Features (user already told you what to build)
- Project structure (not your concern)

## Before finishing

Run self-validation per `references/validation.md`. Fix issues before showing work to user.

## Related Commands

- `/design-engineer:status` — Show current design system state
- `/design-engineer:audit` — Validate existing code against system
- `/design-engineer:extract` — Extract patterns from existing code

---

## Additional Resources

### Reference Files

- **`references/directions.md`** — The 6 design personalities, product type mapping, color foundations, layout approaches, and typography guidance
- **`references/principles.md`** — Core craft quality standards: 4px grid, depth strategies, typography hierarchy, animation, contrast, and dark mode considerations
- **`references/validation.md`** — Pre-delivery checklist, memory management rules, anti-patterns to avoid, and the quality standard

### Examples (in plugin root)

- **`reference/system-template.md`** — Template for creating system.md files
- **`reference/examples/system-precision.md`** — Example: Precision & Density direction
- **`reference/examples/system-warmth.md`** — Example: Warmth & Approachability direction
