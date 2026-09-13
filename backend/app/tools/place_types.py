"""
Centralized mapping from VERA intents / natural-language categories
to Google Places API (New) includedTypes values.

Reference: https://developers.google.com/maps/documentation/places/web-service/place-types
"""

# Intent → list of Google place types for Nearby Search
# NOTE: only use types from Google's actual Table A (see
# https://developers.google.com/maps/documentation/places/web-service/place-types).
# "emergency_room_doctor" is not a real Places type and was causing every
# hospital/emergency search to fail with a 400 INVALID_ARGUMENT.
INTENT_TO_PLACE_TYPES: dict[str, list[str]] = {
    "find_hospital":  ["hospital"],
    "find_pharmacy":  ["pharmacy", "drugstore"],
    "find_restaurant": ["restaurant"],
    "find_hotel":     ["hotel", "lodging", "motel"],
    "find_place":     [],  # generic — use text search
    "emergency_medical": ["hospital"],
    "emergency_general": ["hospital", "police", "fire_station"],
}

# Keyword → Google place types (for natural-language within find_place)
KEYWORD_TO_PLACE_TYPES: dict[str, list[str]] = {
    "coffee": ["coffee_shop", "cafe"],
    "cafe": ["coffee_shop", "cafe"],
    "bank": ["bank"],
    "atm": ["atm"],
    "gas": ["gas_station"],
    "petrol": ["gas_station"],
    "fuel": ["gas_station"],
    "school": ["school", "primary_school", "secondary_school"],
    "university": ["university"],
    "park": ["park"],
    "gym": ["gym"],
    "supermarket": ["supermarket", "grocery_store"],
    "grocery": ["grocery_store", "supermarket"],
    "airport": ["airport"],
    "train": ["train_station", "transit_station"],
    "bus": ["bus_station", "transit_station"],
    "police": ["police"],
    "fire": ["fire_station"],
    "dentist": ["dentist"],
    "doctor": ["doctor", "medical_clinic"],
    "clinic": ["medical_clinic"],
    "vet": ["veterinary_care"],
    "library": ["library"],
    "museum": ["museum"],
    "hotel": ["hotel", "lodging"],
    "motel": ["motel"],
    "bar": ["bar"],
    "pub": ["bar"],
    "bakery": ["bakery"],
    "spa": ["spa"],
    "salon": ["hair_salon", "beauty_salon"],
}

# Queries that work better with Text Search than Nearby Search
TEXT_SEARCH_KEYWORDS = {
    "vegetarian", "vegan", "halal", "kosher", "organic",
    "italian", "chinese", "indian", "mexican", "thai", "japanese",
    "sushi", "pizza", "burger", "bbq", "seafood",
    "trauma", "urgent care", "24 hour", "open now",
    "starbucks", "mcdonalds", "subway", "apollo",
}


def get_place_types_for_intent(intent: str) -> list[str]:
    """Return Google place types for a given VERA intent."""
    return INTENT_TO_PLACE_TYPES.get(intent, [])


def should_use_text_search(intent: str, user_message: str) -> bool:
    """
    Determine whether Text Search is more appropriate than Nearby Search.
    True when the query contains qualifiers that Nearby Search can't handle.
    """
    if intent in ("find_place",):
        return True
    msg_lower = user_message.lower()
    return any(kw in msg_lower for kw in TEXT_SEARCH_KEYWORDS)


def build_text_query(intent: str, user_message: str) -> str:
    """
    Build a clean text query for Text Search from the user message.
    Strips filler phrases to improve search quality.
    """
    filler = [
        "find me", "find a", "find an", "find", "search for",
        "look for", "i need", "i want", "show me", "get me",
        "near me", "nearby", "close to me", "around me",
        "in my area", "around here",
    ]
    query = user_message.lower()
    for phrase in filler:
        query = query.replace(phrase, "")
    return query.strip() or user_message