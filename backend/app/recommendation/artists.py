import hashlib
from app.recommendation.genres import normalize
from app.routers.library import split_artist_names


def artists_for(track):
    credits = track.get('artists') or []
    if not credits:
        names = split_artist_names(track.get('displayArtist') or track.get('artist') or '')
        credits = [{'id': track.get('artistId') if i == 0 else None, 'name': n} for i, n in enumerate(names)]
    if not credits:
        credits = [{'name': track.get('artist') or 'Unknown artist', 'id': track.get('artistId')}]
    result = {}
    for i, artist in enumerate(credits):
        name = str(artist.get('name') or 'Unknown artist')
        normalized = normalize(name)
        remote_id = artist.get('id')
        artist_id = str(remote_id) if remote_id else 'local:' + hashlib.sha1(normalized.encode()).hexdigest()
        result[artist_id] = dict(id=artist_id, name=name, normalized_name=normalized, navidrome_id=str(remote_id) if remote_id else None, is_synthetic=not bool(remote_id), role='primary' if i == 0 else 'featured', position=i, weight=1 if i == 0 else .6)
    return list(result.values())
