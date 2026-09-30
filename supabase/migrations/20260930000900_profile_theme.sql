-- =============================================================================
-- TutorFlow 0009: per-account colour theme (light / dark / follow the system)
-- =============================================================================
-- Stored on the profile so the choice follows the user to every device. The browser also caches it
-- in localStorage, only to paint the right colours before the profile has loaded.
-- Writes go through the existing profiles_update_own policy: users can change only their own row.

alter table public.profiles
  add column theme text not null default 'system'
    constraint profiles_theme_check check (theme in ('light', 'dark', 'system'));

grant update (theme) on public.profiles to authenticated;
