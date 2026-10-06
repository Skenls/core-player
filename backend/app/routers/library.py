from fastapi import APIRouter, Depends, Query
from typing import Literal
from app.dependencies import get_subsonic_client
from app.subsonic_client import SubsonicClient


router = APIRouter(prefix="/library", tags=["library"])


@router.get("/albums")
async def get_albums(
    type: Literal["recent", "frequent", "random", "newest", "starred"] = "recent",
    size: int = Query(default=50, le=500),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get list of albums"""
    response = await client.get("getAlbumList2.view", type=type, size=size)
    albums = response.get("albumList2", {}).get("album", [])
    return {"albums": albums}


@router.get("/albums/{album_id}")
async def get_album(
    album_id: str,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get album details with tracks"""
    response = await client.get("getAlbum.view", id=album_id)
    album = response.get("album", {})
    return {"album": album}


@router.get("/artists")
async def get_artists(
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get all artists (indexed)"""
    response = await client.get("getArtists.view")
    
    # Flatten the indexed structure
    artists = []
    indexes = response.get("artists", {}).get("index", [])
    for index in indexes:
        artists.extend(index.get("artist", []))
    
    return {"artists": artists}


@router.get("/artists/{artist_id}")
async def get_artist(
    artist_id: str,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get artist details with albums"""
    response = await client.get("getArtist.view", id=artist_id)
    artist = response.get("artist", {})
    return {"artist": artist}


@router.get("/playlists")
async def get_playlists(
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get all playlists"""
    response = await client.get("getPlaylists.view")
    playlists = response.get("playlists", {}).get("playlist", [])
    return {"playlists": playlists}


@router.get("/playlists/{playlist_id}")
async def get_playlist(
    playlist_id: str,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get playlist details with tracks"""
    response = await client.get("getPlaylist.view", id=playlist_id)
    playlist = response.get("playlist", {})
    return {"playlist": playlist}


@router.get("/search")
async def search(
    query: str = Query(..., min_length=2),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Search for tracks, albums, and artists"""
    response = await client.get("search3.view", query=query)
    results = response.get("searchResult3", {})
    return {"results": results}


@router.get("/random")
async def get_random_tracks(
    size: int = Query(default=50, le=500),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get random tracks"""
    response = await client.get("getRandomSongs.view", size=size)
    tracks = response.get("randomSongs", {}).get("song", [])
    return {"tracks": tracks}


@router.post("/star")
async def star_item(
    id: str,
    type: Literal["track", "album", "artist"],
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Star/favorite an item"""
    param_name = {"track": "id", "album": "albumId", "artist": "artistId"}[type]
    await client.get("star.view", **{param_name: id})
    return {"message": "Item starred successfully"}


@router.post("/unstar")
async def unstar_item(
    id: str,
    type: Literal["track", "album", "artist"],
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Unstar/unfavorite an item"""
    param_name = {"track": "id", "album": "albumId", "artist": "artistId"}[type]
    await client.get("unstar.view", **{param_name: id})
    return {"message": "Item unstarred successfully"}


@router.post("/scrobble")
async def scrobble_track(
    id: str,
    time: int | None = None,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Scrobble a track (mark as played)"""
    params = {"id": id}
    if time is not None:
        params["time"] = time
    
    await client.get("scrobble.view", **params)
    return {"message": "Track scrobbled successfully"}
