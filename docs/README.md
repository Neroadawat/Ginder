# Project documentation

## Development

- [Project setup and tests](../README.md)
- [Android emulator and Appetize preview](mobile/appetize.md)
- [Language implementation](../frontend/src/i18n/README.md)

## Operations and release

- [Production deployment](../DEPLOYMENT.md)
- [Manual release checklist](../MANUAL_RELEASE_CHECKLIST.md)
- [Play Store preparation](PLAY_STORE.md)
- [Security review — 22 October 2026](security/2026-10-22-review.md)

## Directory conventions

- `backend/app/`: API, domain services, models, workers and WebSocket code.
- `backend/tests/`: backend regression tests.
- `frontend/src/`: mobile application source, grouped by feature/responsibility.
- `frontend/src/i18n/`: UI translations and language helpers.
- `frontend/src/**/__tests__/`: tests next to the code they exercise.
- `frontend/scripts/`: development/build checks and preview helpers.
- `ops/`: deployment and operational scripts.
- `docs/mobile/`: mobile development guides.
- `docs/security/`: dated security reviews; not live deployment status.

Generated builds, caches, `node_modules`, temporary experiments, local IDE/JDK
settings, real `.env` files, signing keys and service-account credentials stay
untracked. Existing local material in `docs/srs/` and `tmp/` is left intact.
