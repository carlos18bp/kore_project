# Design: Onboarding Modal Priority on `/subscription`

**Date:** 2026-05-10
**Owner:** Kore Frontend
**Status:** Approved (pending user review of this document)

## Problem

When a newly-admin-invited customer logs in for the first time and lands on `/subscription`, two modals render on top of each other:

1. `ProfileCompletionCTA` (fill personal data) — at `frontend/app/components/profile/ProfileCompletionCTA.tsx`
2. `MoodCheckIn` ("how do you feel today") — at `frontend/app/components/profile/MoodCheckIn.tsx`

Both are mounted in `frontend/app/(app)/layout.tsx:81-82`, both with `z-[60]`, both with their own backdrop. The result is one stacked on top of the other.

The user-requested priority is:

1. **Change password** — must run before anything else
2. **Profile completion** — second
3. **Mood check-in** — last

## Root cause

The change-password step is already handled correctly: it is **not a modal**, it is a forced full-page redirect to `/change-password-required` performed in `frontend/app/(app)/layout.tsx:42-44` whenever `user.must_change_password === true`. That route blocks navigation until the user submits a new password, so priority #1 is enforced.

The remaining collision is between profile-completion and mood. The trigger conditions live in two different Zustand stores and consult different "profile complete" flags:

- `ProfileCompletionCTA` consults **`profile.customer_profile.profile_completed`** (the strict flag — requires `first_name`, `last_name`, `sex`, `date_of_birth`, `city`, `primary_goal`).
- `MoodCheckIn` consults **`user.profile_completed`** (the auth-store flag — looser; can be `true` even when customer-profile fields are missing).

When `user.profile_completed === true` but `profile.customer_profile.profile_completed === false`, both modals' guards pass and they render simultaneously.

## Decision

Tighten the mood-modal auto-trigger guard so it also requires the strict profile-store flag. No central orchestrator, no new store, no z-index hacks.

### Decided behavior on dismissal

- If the user dismisses the profile modal with "Ahora no" without filling the form, **the mood modal still does not appear in that session**. It only appears once `profile.customer_profile.profile_completed === true`.
- The profile modal continues to reappear on subsequent logins (existing `shownRef.current` once-per-session behavior is preserved) until the user completes it.
- When the user completes the profile **during the same session**, the mood modal becomes eligible to appear immediately (the effect re-runs because the profile-completed flag is in the dependency array).

## Scope

### In scope

- `frontend/app/components/profile/MoodCheckIn.tsx` — strengthen the auto-trigger guard.
- One Jest unit test confirming the guard works.

### Out of scope

- Refactoring `ProfileCompletionCTA` (already correct).
- Touching `/change-password-required` (already correct).
- Aligning `user.profile_completed` and `profile.customer_profile.profile_completed` at the backend level — these are intentionally different flags (auth-level vs. customer-domain). Aligning them is a larger conversation.
- Introducing a generic onboarding-orchestrator store for future prompts. Revisit only when a third gated modal is added.
- Changing the dismissibility of either modal.
- Changing the `openMoodModal()` manual trigger (dashboard CTA continues to bypass session-storage dismissal).

## Implementation

### Change in `MoodCheckIn.tsx`

The component already imports `useProfileStore` and reads `profile`, `todayMood`, etc. The auto-trigger `useEffect` currently reads `user.profile_completed`. Replace that condition with:

```ts
const profileFullyComplete =
  user?.profile_completed === true &&
  profile?.customer_profile?.profile_completed === true;
```

And use `profileFullyComplete` instead of `user?.profile_completed === true` in the auto-trigger condition. Add `profile?.customer_profile?.profile_completed` to the effect's dependency array so the modal becomes eligible the moment the profile becomes complete in the same session.

The condition tree after the change:

1. `todayMood !== null` → skip (already logged today)
2. `!profileFullyComplete` → skip (profile gate)
3. `sessionStorage['kore_mood_dismissed']` set → skip (dismissed this session)
4. Otherwise → open modal

The manual-trigger branch (`moodModalOpen === true`) is untouched and continues to ignore all of the above (admin/dashboard can still force-open the mood modal from the profile page).

### Degraded paths

- If `profile === null` (profile store not yet hydrated), the guard returns `false` for `profile?.customer_profile?.profile_completed`, so the mood modal stays closed until hydration completes. Acceptable — `ProfileCompletionCTA` has the same dependency and behaves the same way.

## Testing

### Unit (Jest)

New file: `frontend/app/components/profile/__tests__/MoodCheckIn.test.tsx` (or extend the existing one if present).

Add one focused test:

> Given `user.profile_completed === true` and `profile.customer_profile.profile_completed === false`, when the component mounts with `todayMood === null` and no dismissal in sessionStorage, the modal must not render.

Existing tests for the manual-trigger path and the happy-path auto-trigger should continue to pass; if they don't exist, add one happy-path test alongside the new gate test (`profile.customer_profile.profile_completed === true` → modal renders).

### Manual

After implementation, run the dev server, log in with a freshly-admin-invited customer (`test@kore.com` after a fresh seed if needed), change the password, and confirm:

1. Only the profile modal appears on `/subscription`.
2. Closing the profile modal with "Ahora no" does not trigger the mood modal.
3. Completing the profile form in `/profile` and returning to `/subscription` triggers the mood modal.

## Risks

- **Low.** Single-file frontend change, deterministic guard, no backend, no DB.
- The risk of regression is in the manual-trigger path — covered by keeping `moodModalOpen` branch unchanged and asserted by a sanity test.
