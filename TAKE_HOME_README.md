# Take-Home Assignment: Project X Enhancement Implementation

## Main Feature

Implemented visual context to help users better understand the relationship between their questionnaire answers and the recommended results.

[Main PR - feat-implement-visual-context-for-recommendations](https://github.com/garrettomi/Project-X-Test/pull/1)

## What

The initial version of Project X starts with a 10-question questionnaire and provides job recommendations based on the user's values and strengths.

On the original results page, users were shown 3–6 matching companies, with each company displaying:

- Company name
- Description
- Three bullet points explaining the match

However, the experience felt like it was lacking transparency, and as a user I had a hard time:

- Remembering what they answered
- Understanding how results were calculated
- Realizing that two categories (strengths and values) were even being used

## What Changed

In this enhancement:

- I added a summary of the user's answers above the company recommendations
- I included per-category scores for each company (ie. how well it matched the user's values and strengths)
- Visual cues were added to indicate match strength (Strong, Great, Good)

## Why

Without reflecting the user’s input, results felt a bit arbitrary or impersonal. By visually tying recommendations to specific strengths and values, users can:

- Better trust the recommendations
- See how their identity connects to each company
- More easily compare companies based on what's important to them

This change is meant to foster clarity, emotional connection, and ultimately, user confidence in the results.

## Code Areas Affected

- `/src/app/api/values/route.ts` -- a GET request was added to directly pull from user_values to recommendations
- `/src/app/components/recommendations/RecommendationsContent.tsx` -- added contextual summaries of user's answers
- `/src/app/components/recommendations/CompanyCard.tsx` -- added visual scoring logic and display
- `/public/locales/en/ai.json` -- updated i18n keys for new strings
- `/public/locales/ja/ai.json` -- updated i18n keys for new strings

## Potential Risks

This feature introduces more on-screen text which could:

- Overwhelm users if not presented clearly
- Add redundancy if users still don't engage with the added content

## Mitigation and Future Iterations

This is a first step in building trust and transparency into Project X. Future iterations could include:

- A personalized dashboard
- Deeper identity-building experiences
- Storytelling elements to help users connect with profiles similar to theirs

The ultimate goal: Help users feel seen and understood which in turn will increase conversions through trust-driven design.

### Setup & Configuration

Follow the documentation outlined in `README.md`

## Additional Fixes

### 1. Implement redirection state for sign-up button

[PR - fix-sign-up-button-state-on-redirect](https://github.com/garrettomi/Project-X-Test/pull/2)
