import math


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate straight-line distance between two coordinates in meters.
    Uses the Haversine formula. NOT driving distance.
    """
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def format_distance(meters: float) -> str:
    """Format distance for display. Labeled as straight-line, not driving."""
    if meters < 1000:
        return f"{int(meters)} m away"
    return f"{meters / 1000:.1f} km away"
