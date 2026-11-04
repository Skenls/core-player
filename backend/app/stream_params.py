def build_stream_params(track_id, format, max_bit_rate, time_offset, estimate_content_length=False):
    params = {"id": track_id}
    if format and format != "raw":
        params["format"] = format
    if time_offset is not None:
        params["timeOffset"] = str(max(0, int(time_offset)))
    if max_bit_rate is not None:
        params["maxBitRate"] = str(max_bit_rate)
    elif format == "flac":
        params["maxBitRate"] = "0"
    if estimate_content_length:
        params["estimateContentLength"] = "true"
    return params
