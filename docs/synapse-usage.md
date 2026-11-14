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

Frontend browser checks use intercepted API fixtures, without reading credentials or contacting the music server. They cover mood selection/clearing, hiding on search, 20 rows, playback animation, reduced motion and narrow layout. These checks do not establish real Navidrome connectivity or audio streaming. Test the first catalog sync and a real listening session on the target server before relying on personalization.
