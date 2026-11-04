import unittest

from app.stream_params import build_stream_params


class BuildStreamParamsTests(unittest.TestCase):
    def test_time_offset_is_forwarded_as_integer_string(self):
        params = build_stream_params("track", "aac", None, 85)
        self.assertEqual(params["timeOffset"], "85")

    def test_float_time_offset_is_truncated_integer(self):
        params = build_stream_params("track", "mp3", None, 85.9)
        self.assertEqual(params["timeOffset"], "85")

    def test_time_offset_is_optional(self):
        params = build_stream_params("track", "aac", None, None)
        self.assertNotIn("timeOffset", params)

    def test_raw_format_is_not_forwarded(self):
        params = build_stream_params("track", "raw", None, 10)
        self.assertNotIn("format", params)
        self.assertEqual(params["timeOffset"], "10")

    def test_flac_uses_unlimited_bitrate(self):
        params = build_stream_params("track", "flac", None, None)
        self.assertEqual(params["maxBitRate"], "0")


if __name__ == "__main__":
    unittest.main()
