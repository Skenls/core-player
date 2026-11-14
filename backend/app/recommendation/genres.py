"""Deterministic tag normalization; unknown tags remain learnable."""
from datetime import datetime
from difflib import get_close_matches
from pathlib import Path
import json
import re
import unicodedata

DATA = Path(__file__).parent / 'data'
SEEDS = json.loads((DATA / 'genre_aliases.json').read_text())
ALIAS_VERSION = '1'


def normalize(value):
    value = unicodedata.normalize('NFKC', str(value)).casefold().replace('ё', 'е')
    value = value.replace('&', ' and ')
    return ' '.join(re.sub(r'[^\w\s]', ' ', value).split())


ALIASES = {normalize(alias): (slug, row) for slug, row in SEEDS.items() for alias in [slug, row['name'], *row['aliases']]}


def resolve_tag(raw):
    key = normalize(raw)
    found = ALIASES.get(key)
    confidence = 1.0
    if found is None:
        cyrillic = bool(re.search('[а-я]', key))
        candidates = [a for a in ALIASES if bool(re.search('[а-я]', a)) == cyrillic]
        near = get_close_matches(key, candidates, n=1, cutoff=.88)
        if near:
            found = ALIASES[near[0]]
            confidence = .8
    if found:
        slug, row = found
        return dict(slug=slug, name=row['name'], family=row['family'], is_unknown=False, raw_tag=str(raw), alias=key, confidence=confidence)
    family = next((r['family'] for alias, (_, r) in ALIASES.items() if len(alias) > 3 and alias in key), 'other')
    return dict(slug=key.replace(' ', '-') or 'unknown', name=str(raw), family=family, is_unknown=True, raw_tag=str(raw), alias=key, confidence=.5)


def normalize_genres(track):
    raw = track.get('genres') or [track.get('genre', '')]
    if isinstance(raw, str):
        raw = [raw]
    result = {}
    for tag in raw:
        tag = tag.get('name', '') if isinstance(tag, dict) else str(tag)
        if not tag.strip():
            continue
        # Try the compound first, notably R&B and Drum & Bass.
        pieces = [tag] if normalize(tag) in ALIASES else re.split(r'[;,|/]', tag)
        for piece in pieces:
            if piece.strip():
                genre = resolve_tag(piece.strip())
                result[genre['slug']] = genre
    return list(result.values())


def normalize_year(track):
    for value in (track.get('originalDate'), track.get('releaseDate'), track.get('year')):
        if isinstance(value, dict):
            value = value.get('year')
        try:
            year = int(str(value)[:4])
            if 1900 <= year <= datetime.utcnow().year + 1:
                return year
        except (ValueError, TypeError):
            pass
    return None
