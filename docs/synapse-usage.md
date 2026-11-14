# Synapse

Implementation specification: [synapse.md](synapse.md).

## Using the wave

Synapse occupies the first panel on Home. Familiarity chips combine; moods are exclusive and clicking the selected mood clears it. Refresh creates a fresh mix; playing any row starts that mix as the queue. The sphere and wave animate during Synapse playback, pause offscreen and respect reduced motion. Searching hides the panel. The existing library sections follow it.

Only tracks carrying Synapse session metadata train the profile. Ordinary album, playlist and search playback do not train it. Favorites remain separate permanent anchors. Mood estimates come from metadata and listening behavior, not audio analysis.

Settings → Audio contains Continue playback (off by default) and Reset Synapse. Reset removes this user's learned profile while retaining favorites. Continuation checks queue and user identity before applying a response.

## Rollback

The implementation started on `feat/synapse` from checkpoint **7217532**. The pre-existing Synapse plan is in **f5d0c04**. Existing untracked architecture documentation was saved in the checkpoint before product edits.

Use `git log --oneline 7217532..feat/synapse` to inspect feature commits and `git revert` those commits, newest first, to undo the implementation without rewriting history. No playback endpoint was changed. The new recommendation tables can remain unused after code rollback; no existing favorite or library data needs to be deleted. Profile reset is a user action and cannot be undone by reverting code; back up the database first if learned data must be preserved.

## Verification notes

Frontend browser checks use intercepted API fixtures, without reading credentials or contacting the music server. They cover mood selection/clearing, hiding on search, 20 rows, playback animation, reduced motion, unavailable-catalog messaging, audio settings, and a 390px layout with the existing sidebar collapsed. These checks do not establish real Navidrome connectivity or audio streaming. Test the first catalog sync and a real listening session on the target server before relying on personalization.


Run the checks from the repository root:

```sh
(cd backend && venv/bin/python -m unittest discover -s tests -v)
node --experimental-strip-types --test frontend/tests/*.test.ts
(cd frontend && npm run build)
PYTHONPATH=backend backend/venv/bin/python backend/tests/benchmark_synapse.py
```

The benchmark creates its own synthetic in-memory SQLite database and does not touch the application database. It measures complete mix creation, including persisted session exposures. The engine caps hydrated candidates at 1,000 and uses indexed channel samples, diversity counters and batch exposure writes. Actual timings depend on hardware, metadata and profile size.

`npm run lint` currently fails because this repository has no ESLint 9 configuration. The implementation does not change the project's lint setup.

Continuation uses an additional authenticated `POST /api/synapse/mix` with the same filters and an `exclude_track_ids` JSON array. Home retains `GET /api/synapse/mix`. This avoids URL length limits for large queues; exclusions are capped at 100,000 IDs and are passed into SQLite through a single JSON binding. Playback endpoints are unchanged.

Final independent verification: 28 backend tests and 20 frontend tests passed. A repeated synthetic benchmark produced mix times 214.1, 232.9, 204.0, 191.3, 183.6 and 182.2 ms (warm median 191.3 ms). Individual requests can exceed the median; no live server latency claim is made.
