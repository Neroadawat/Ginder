# Google Places metadata-only discovery

Ginder searches its restaurant database first. In Solo mode only, when fewer
than `MIN_LOCAL_RESTAURANTS` match at `MAX_RADIUS_KM`, it can supplement the deck
with live Google results. Google results remain transient: they are not imported
into the restaurant table, saved as likes, or used in party-session decks.

## Requested data

Nearby Search requests only `id`, `displayName`, `primaryType`, `location`, and
`formattedAddress`. No photos, ratings, price levels, opening hours, reviews,
or additional Place Details calls are requested. These fields use Nearby Search
Pro; changing the field mask requires reviewing Google's current SKU rules.

Cards use the app's category illustrations, label them as illustrative, display
the address and Google Maps attribution, and offer a Maps URL for navigation.
The legacy `/restaurants/google-photo` endpoint always returns `disabled`, even
if an older deployment environment still has nonzero photo limits.

## Cost controls

- Google remains disabled by default. Enabling it requires a server-side key,
  Places API (New), a billing account, restricted key access, and provider quotas.
- Keep `GOOGLE_NEARBY_SOFT_LIMIT=800` and `GOOGLE_NEARBY_HARD_LIMIT=1000` as
  conservative application limits. They are not Google's free allowance.
- Set `GOOGLE_PHOTO_SOFT_LIMIT=0` and `GOOGLE_PHOTO_HARD_LIMIT=0`.
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
python -m pytest tests/test_google_places.py tests/test_google_quota.py tests/test_restaurant_coverage.py
```

Tests use fake Google responses and quota stores; they must not call paid APIs.
The mobile card tests verify illustrations, address display, navigation, and
preservation of credited photos for database restaurants.

Deploying this code alone does not enable Google. Configure the restricted key
and review Cloud limits separately, then set `GOOGLE_PLACES_ENABLED=true` on the
backend and rebuild/restart its container. Ship a new Android release for the
new card UI. Older apps still receive no Google photo references from this
backend and their photo requests return `disabled`.

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
