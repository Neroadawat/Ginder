# Ginder Privacy Policy

Effective date: 11 October 2026

Ginder is a university class project for discovering restaurants and making a
shared restaurant choice. This policy describes the data handled by the app and
must be reviewed again before any public or commercial launch.

## Data we handle

- Account data: email address, display name, password hash, consent timestamp,
  authentication records, and an optional notification token.
- Location: the current device location is used to search and calculate
  distance. A group host's coordinates are stored with that group session so
  every participant sees distances from the same centre. Precise coordinates
  are not displayed to other users.
- Activity: likes, skips, friendships, invitations, group participation,
  matches, and match history.
- Operational data: monthly external-API counters and limited security logs.
  Logs use a one-way user/IP-derived identifier and do not intentionally record
  GPS coordinates or Google API keys.

## How data is used

Data is used only to authenticate users, find nearby restaurants, calculate
distance, run group sessions, retain likes and history, send requested
notifications, protect paid API quotas, and operate or troubleshoot the service.

## External services

- OpenStreetMap contributors provide restaurant data. An uncached search
  outside the launch area may send the search centre and radius to an Overpass
  API provider.
- Google Maps Platform may receive a search centre, radius, and photo resource
  name only when the optional live fallback is enabled. Google live place and
  photo content is not stored permanently by Ginder.
- Firebase Cloud Messaging may process a device notification token when push
  notifications are configured.
- Infrastructure providers may process encrypted traffic and database backups
  as necessary to host the service.

Use of these services is also governed by their respective privacy policies,
including the [Google Privacy Policy](https://policies.google.com/privacy) and
[OpenStreetMap privacy policy](https://osmfoundation.org/wiki/Privacy_Policy).

## Retention and deletion

Account-linked data is retained while the account exists. Users can permanently
delete their account from Settings. Friendships, votes, notifications, tokens,
and open-session participation are deleted with the account. Completed shared
session results may remain for other participants without retaining the deleted
account as host. Infrastructure backups expire according to the deployment's
documented backup-retention schedule.

Google live photo names and temporary media URLs are held only in memory while
the relevant cards are active. They are not written to the application database,
Redis, object storage, or a persistent mobile query cache.

## Security and choices

Production traffic uses HTTPS. Passwords are stored as hashes, secrets remain on
the server, and database/Redis services are not exposed publicly. Location
permission can be revoked in device settings, but nearby discovery will then be
unavailable. Push notifications are optional.

## Contact

For this class project, privacy questions and deletion problems can be reported
through the repository's [GitHub Issues](https://github.com/Neroadawat/Ginder/issues).
