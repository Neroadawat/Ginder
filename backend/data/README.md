# Restaurant production data

`thammasat_rangsit_restaurants.csv` is the reviewed import candidate for the
initial launch area:

- Centre: Thammasat University, Rangsit Campus (`14.0708, 100.6065`)
- Radius: 3 km
- Source: OpenStreetMap via Overpass
- Retrieved: 2026-10-09
- Licence: Open Database License (ODbL)

The app must display `© OpenStreetMap contributors` with a link to
<https://www.openstreetmap.org/copyright> wherever this dataset is used.

## Current audit

- 189 raw OSM eateries returned
- 75 unnamed POIs excluded because they cannot form a usable swipe card
- 1 same-name POI pair within 25 metres deduplicated
- 113 named restaurants retained
- 13 restaurants include parseable opening hours
- 4 include an address
- 0 include an approved photo
- 45 restaurants were recategorised with an auditable reason and source
- 14 remain in the `Other` category and still need local verification

The category decisions are recorded in `category_curation.csv`. Rows were
changed only when an OSM tag, an explicit restaurant name, or an official brand
source identified the category. Ambiguous names remain `Other`.

Unknown price levels, ratings, review counts, photos, and hours are deliberately
left blank. They must not be fabricated for production. The app should hide
unknown values or show a neutral fallback.

## Review and import

Edit the CSV directly to add verified categories, addresses, hours, and photo
URLs. A photo is accepted only when all three fields are present:

- `photo_url`: direct HTTPS image URL
- `photo_source`: source or licence page URL (or `owner_upload` for a team photo)
- `photo_attribution`: the credit text that must appear in the app

The importer ignores a photo that is missing its source or attribution. This is
intentional: an image being publicly reachable does not mean the project has
permission to reuse it. The two old Imgur URLs currently present in OSM were
therefore not imported.
Preserve `place_id` for OSM rows so repeated imports update rather than duplicate
the same POI.

Every imported row is stored with separate `source` and `source_place_id`
metadata. OSM and reviewed manual imports receive a `verified_at` timestamp;
photo origin and attribution are stored separately from the image URL. This
keeps future providers from being mixed together and lets production discovery
exclude synthetic development data safely.

Preview without touching the database:

```powershell
cd backend
python scripts/seed_restaurants.py `
  --source csv `
  --file data/thammasat_rangsit_restaurants.csv `
  --dry-run
```

Import or update the reviewed rows:

```powershell
python scripts/seed_restaurants.py `
  --source csv `
  --file data/thammasat_rangsit_restaurants.csv
```

Refresh the candidate sheet from current OSM data for a new review cycle:

```powershell
python scripts/seed_restaurants.py `
  --source osm `
  --dry-run `
  --export-csv data/thammasat_rangsit_restaurants.csv
```

Do not use `--clear` on a shared or production database; it deletes every
restaurant, including manually curated rows.
