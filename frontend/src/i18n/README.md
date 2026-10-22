# Application language

New installations start in English regardless of the phone's system locale.
The English/Thai selector is available on consent, login, profile and settings
screens. The choice is saved per installation in the `ginder.preferences`
MMKV store and is independent of authentication.

- `messages.ts`: English translations of the original Thai UI copy and Thai
  translations of originally English UI/accessibility copy.
- `index.ts`: `t`, `useTranslation` and `dateLocale`.
- `../stores/languageStore.ts`: validated language selection and persistence.
- `../components/LanguageSwitcher.tsx`: accessible selector shared by screens.

Use `useTranslation()` in components that display localized copy so they
subscribe to language changes; call `t(key, parameters)` at render/event time.
Do not translate labels when defining module-level option arrays. Translate
those labels when displaying them, keeping API values, invite codes and links
unchanged. Never use a translated label as a category or route identifier.

Restaurant names, user names and unknown server text retain their original
values. Public legal/reset pages and email templates are separate backend
content; this mobile language selector does not switch those documents.

Tests cover the English default, invalid saved values, persistence, live
switching without remounting a form, units, filter values and interpolation.
