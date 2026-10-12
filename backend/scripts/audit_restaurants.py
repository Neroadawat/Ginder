"""Read-only, reproducible audit of restaurant data; never guess missing facts."""

import argparse
import csv
from collections import defaultdict
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", default=str(Path(__file__).resolve().parents[1] / "data/thammasat_rangsit_restaurants.csv"))
    args = parser.parse_args()
    with open(args.file, encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    print(f"Restaurants: {len(rows)}")
    for column in ("address", "opening_hours_json", "photo_url"):
        print(f"With {column}: {sum(bool(row.get(column)) for row in rows)}")
    print("\nCategories requiring owner verification:")
    for row in rows:
        if row["category"] == "Other":
            print(f"- {row['name']} ({row['place_id']})")
    groups = defaultdict(list)
    for row in rows:
        groups[row["name"].strip().casefold()].append(row)
    print("\nRepeated names (different coordinates can indicate branches; not auto-deleted):")
    for restaurants in groups.values():
        if len(restaurants) > 1:
            for row in restaurants:
                print(f"- {row['name']}: {row['place_id']} ({row['latitude']}, {row['longitude']})")


if __name__ == "__main__":
    main()
