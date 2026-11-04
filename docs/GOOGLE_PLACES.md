# Google Places Solo discovery and limited photo previews

Ginder searches its restaurant database first. In Solo mode only, when fewer
than `MIN_LOCAL_RESTAURANTS` match at `MAX_RADIUS_KM`, it can supplement the deck
with live Google results. If zero restaurants match, it can call Google at any
supported radius (0.5–3 km), without requiring radius expansion first. Existing
price, rating and open-now filter restrictions still apply. Each search requests
up to 20 restaurants; Google can return fewer, and category filtering and
deduplication can further reduce that number. Google results remain transient: they are not imported
into the restaurant table, saved as likes, or used in party-session decks.
When a deck with Google cards runs out, the app waits for the user to tap
**Find more restaurants** and choose a wider radius or adjust the filters.
Nearby Search has no next-page token. A new search can include previously shown
Google results, especially when the new search area overlaps the previous one.

## Requested data

Nearby Search requests only `id`, `displayName`, `primaryType`, `location`, and
`formattedAddress`. When photo previews are explicitly enabled with a positive
photo hard limit, it additionally requests `places.photos`. Ratings, price levels,
opening hours, reviews and additional Place Details calls are not requested.
Review current SKU rules before changing this field mask.

After deduplication and deck truncation, at most the first five Google cards
resolve one photo each. Cards without photos use labelled category illustrations.
Photo requests use the server-side key and `skipHttpRedirect=true`; only the
returned HTTPS Google media URL reaches the client. All provided photo authors
are credited with their profile links. The app falls back to artwork if a media
URL fails, without requesting another paid photo. No Google metadata, photo
references or photo URLs are written to the restaurant database or shared cache.
Cards display the address, Google Maps attribution and a navigation link.
The legacy `/restaurants/google-photo` endpoint remains disabled: clients cannot
submit arbitrary photo names to spend the photo allowance.

## Cost controls

- Google remains disabled by default. Enabling it requires a server-side key,
  Places API (New), a billing account, restricted key access, and provider quotas.
- Keep `GOOGLE_NEARBY_SOFT_LIMIT=800` and `GOOGLE_NEARBY_HARD_LIMIT=1000` as
  conservative application limits. They are not Google's free allowance.
- Photos require `GOOGLE_PLACES_PHOTOS_ENABLED=true` AND a positive
  `GOOGLE_PHOTO_HARD_LIMIT`. Defaults remain disabled with zero photo limits.
- For a small test rollout, keep Nearby limits at 10/20 and use photo soft/hard
  limits of 80/100. One search can reserve one Nearby request and up to five
  separate Photo requests. These are app limits, not Google's free allowances.
- A Redis cooldown applies to the signed-in account across devices, networks,
  and search filters. Transport failures do not automatically retry Solo discovery
  in the mobile client. Background reconnects/focus do not trigger discovery.
- Every allowed provider call first commits an atomic monthly PostgreSQL
  reservation. Redis restarts cannot erase the allowance. A Redis or database
  outage blocks external calls and leaves database discovery available.
- Accounting months use `America/Los_Angeles`, including daylight saving time.
  Reservations are conservative: failed Google requests are not refunded.
- Monitor the actual Cloud usage across projects sharing the billing account.
  App counters do not include requests made by other programs or keys. Cloud
  budget alerts notify; they do not stop spending. Do not rely on an app limit
  alone to guarantee a zero bill.

Google content is not stored permanently or shared through an area cache to save
requests. Keep current Places attribution and storage requirements in force.

## Validation and rollout

Run backend checks from `backend`:

```powershell
python -m pytest tests/test_google_places.py tests/test_google_preview_photos.py tests/test_google_quota.py tests/test_restaurant_coverage.py
```

Tests use fake Google responses and quota stores; they must not call paid APIs.
The mobile card tests verify illustrations, address display, navigation, and
preservation of credited photos for database restaurants.

Deploying this code alone does not enable Google photos. Configure the restricted
key and review Cloud limits separately. For the requested 20-restaurant / first
five-photo test rollout, merge these values into the server's existing
`.env.production` (never replace its other secrets):

```dotenv
GOOGLE_PLACES_ENABLED=true
GOOGLE_PLACES_PHOTOS_ENABLED=true
GOOGLE_NEARBY_SOFT_LIMIT=10
GOOGLE_NEARBY_HARD_LIMIT=20
GOOGLE_PHOTO_SOFT_LIMIT=80
GOOGLE_PHOTO_HARD_LIMIT=100
GOOGLE_USER_COOLDOWN_SECONDS=30
```

This requires a backend image containing ALL modified services, config and
schemas, plus a new Android build for Google photo display and author credits.
The old `ops/deploy-google-metadata.sh` copies only five files and is NOT a
deployment procedure for this change. A container restart/recreation using the
old image will not install this code. Run the mocked backend tests before rollout,
then recreate backend using the newly built image and the existing Firebase
Compose override. Never run unbounded live API tests.

On the latest app, test an empty area at 0.5 km and 1.5 km with category/price/
rating/open-now filters cleared. Verify up to 20 cards, at most five photos, all
photo credits, Maps navigation and counters (at most +1 Nearby / +5 Photo per
search). Verify photo limits or HTTP failures leave all restaurant cards usable.
Set `GOOGLE_PLACES_PHOTOS_ENABLED=false` and recreate backend to disable only
photos; set `GOOGLE_PLACES_ENABLED=false` to stop Google discovery entirely.

If price, minimum-rating, or open-now filters are active, Google fallback remains
unavailable: this metadata-only request cannot truthfully satisfy those filters.
Party rooms continue to use database restaurants. Supporting live Google voting
requires a separate Place-ID-based session design and result/likes handling.

References:
- https://developers.google.com/maps/documentation/places/web-service/nearby-search
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/billing-and-pricing/overview
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/billing-and-pricing/manage-costs
