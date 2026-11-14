from datetime import datetime
import math

PRIORS = dict(favorite_track=2.5, favorite_album=1.5, favorite_artist=2, artist=1.6,
              album=1, genre=1.4, family=.8, era=.5, year=.4, bridge=.9,
              mood=1.2, completion=.6, unfamiliar=.2, novelty=.5, fatigue=-1.5,
              recent_artist=-.8, recent_album=-.5)


def predict(weights, bias, features):
    raw = bias + sum(weights.get(k, PRIORS.get(k, 0)) * v for k, v in features.items())
    return 1 / (1 + math.exp(-max(-30, min(30, raw))))


def train(weights, bias, features, label, total):
    weights = {**PRIORS, **weights}
    error = label - predict(weights, bias, features)
    rate = .03 / math.sqrt(1 + total / 500)
    for key, value in features.items():
        weights[key] = max(-5, min(5, weights.get(key, 0) + rate * error * value - .001 * weights.get(key, 0)))
    return weights, max(-5, min(5, bias + rate * error))


def classify(event_type, played, duration):
    if event_type in ('complete', 'favorite') or (duration > 0 and played / duration >= .85):
        return 'positive', 1
    if played < min(20, duration * .25):
        return 'strong', 0
    if played < min(60, duration * .5):
        return 'weak', None
    return 'neutral', None


def decay(score, updated_at, half_life=90):
    days = max(0, (datetime.utcnow() - updated_at).total_seconds() / 86400)
    return score * .5 ** (days / half_life)


def taste_half_life(kind, score):
    return 21 if score < 0 else 60 if kind in ('track', 'album', 'era') else 90


def affinity(row):
    return math.tanh(decay(row.score, row.updated_at, taste_half_life(row.entity_type, row.score))) * row.confidence if row else 0
