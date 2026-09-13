"""
Resolves an ImageSpec (mode="generate" | "retrieve") into an actual image URL.

Kept separate from diagram/3d handling because it's the one visual type that
needs an external call after the planner runs. Wire this in as a small
"execute_visual_tool" node between visual_planner and generate_response,
gated on `state["visual_type"] in ("image_generated", "image_retrieved")` —
diagrams and 3D scenes need no such step since the spec itself is the
renderable artifact.

Swap the bodies below for whatever's already configured in this project
(the existing settings module has Azure GPT-4o-mini + Groq configured —
add an image endpoint the same way, e.g. Azure OpenAI DALL-E-3 deployment,
or a stock/creative-commons image search API for retrieval).
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ImageResult:
    success: bool
    url: str | None = None
    caption: str | None = None
    error_message: str | None = None


async def generate_image(prompt: str) -> ImageResult:
    """Call an image-generation model (e.g. Azure OpenAI DALL-E-3) with `prompt`."""
    try:
        # from app.config.settings import settings
        # response = await azure_image_client.generate(prompt=prompt, size="1024x1024")
        # return ImageResult(success=True, url=response.url, caption=prompt)
        raise NotImplementedError("Wire up your image-generation provider here.")
    except Exception as exc:
        logger.error("[visual_tools] generate_image failed: %s", exc)
        return ImageResult(success=False, error_message=str(exc))


async def retrieve_image(query: str) -> ImageResult:
    """Look up a real reference image for `query` (stock/CC image search API)."""
    try:
        # results = await image_search_client.search(query, count=1)
        # return ImageResult(success=True, url=results[0].url, caption=results[0].title)
        raise NotImplementedError("Wire up your image search provider here.")
    except Exception as exc:
        logger.error("[visual_tools] retrieve_image failed: %s", exc)
        return ImageResult(success=False, error_message=str(exc))


IMAGE_TOOL_REGISTRY = {
    "generate": generate_image,
    "retrieve": retrieve_image,
}
