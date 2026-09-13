"""
Structured schemas for VERA's Visual Intelligence layer.

Design principle: the LLM never emits pixels or markup. It emits a small,
strongly-typed *specification* (nodes/edges, or 3D objects, or an image
prompt). The React frontend owns all actual rendering (React Flow for
diagrams, React Three Fiber for 3D, <img> for images). This keeps visuals
editable, animatable, and voice-steerable — you can patch a spec in place
("add a caching layer") without regenerating a picture from scratch.
"""

from typing import Literal, Optional, List
from pydantic import BaseModel, Field

VisualType = Literal[
    "none",
    "diagram",          # React Flow: workflows, architectures, sequences, hierarchies
    "scene_3d",          # React Three Fiber: spatial/physical subjects
    "image_generated",  # illustration with no canonical real-world reference
    "image_retrieved",  # a real photo/reference is more useful than an illustration
]

VisualComplexity = Literal["simple", "moderate", "detailed"]

# What the planner is doing to the CURRENT visual, driven by voice follow-ups
# like "zoom into this part", "add the database", "remove that step",
# "show me this in 3D", "make it simpler".
VisualAction = Literal[
    "create",        # brand new visual, unrelated to whatever is on screen
    "update",        # in-place patch to the existing visual (add/remove/relabel)
    "highlight",     # focus/zoom onto part of the existing visual, no structural change
    "simplify",      # collapse the existing visual to fewer nodes/objects
    "switch_type",   # same subject, different representation (diagram -> 3d, etc.)
    "hide",          # user is done looking at it
]

DiagramDirection = Literal["horizontal", "vertical", "radial"]


class DiagramNodeSpec(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    group: Optional[str] = None   # e.g. "frontend", "backend", "database", "external"
    level: int = 0                 # hierarchy depth — drives layered auto-layout
    icon: Optional[str] = None     # semantic hint for the frontend's icon map:
    # "user" | "browser" | "server" | "database" | "api" | "lock" | "key" | "cloud" | "queue" | "generic"
    highlighted: bool = False


class DiagramEdgeSpec(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    animated: bool = False
    style: Literal["solid", "dashed"] = "solid"


class DiagramSpec(BaseModel):
    title: str
    direction: DiagramDirection = "horizontal"
    nodes: List[DiagramNodeSpec]
    edges: List[DiagramEdgeSpec]


class Scene3DObjectSpec(BaseModel):
    id: str
    label: str
    kind: Literal["glb_model", "primitive"] = "primitive"
    # For glb_model: a short search query used to resolve a real .glb asset
    # (e.g. "low poly human heart", "saturn planet model"). The frontend/asset
    # service resolves this to an actual URL; the LLM never invents file paths.
    asset_query: Optional[str] = None
    primitive: Optional[
        Literal["sphere", "box", "cylinder", "cone", "torus", "plane"]
    ] = None
    position: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    rotation: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    scale: List[float] = Field(default_factory=lambda: [1.0, 1.0, 1.0])
    color: Optional[str] = None
    description: Optional[str] = None
    highlighted: bool = False


class Scene3DSpec(BaseModel):
    title: str
    background: Optional[str] = "#0b1220"
    camera_position: List[float] = Field(default_factory=lambda: [0.0, 2.0, 6.0])
    objects: List[Scene3DObjectSpec]
    auto_rotate: bool = False


class ImageSpec(BaseModel):
    mode: Literal["generate", "retrieve"]
    prompt_or_query: str
    caption: Optional[str] = None
    # Filled in by the execute_visual_tool node after the LLM planning step —
    # never emitted by the LLM itself.
    resolved_url: Optional[str] = None


class VisualSpec(BaseModel):
    visual_id: str = ""   # filled in by the visual_planner node, not the LLM
    type: VisualType
    complexity: VisualComplexity = "moderate"
    interactive: bool = True
    animated: bool = False
    title: str
    diagram: Optional[DiagramSpec] = None
    scene3d: Optional[Scene3DSpec] = None
    image: Optional[ImageSpec] = None


class VisualDecision(BaseModel):
    """Structured output of the Visual Planner LLM call."""

    visual_required: bool
    action: VisualAction = "create"
    visual: Optional[VisualSpec] = None
    # Short, spoken-friendly line VERA says the instant the visual appears
    # (e.g. "Here's how JWT auth flows through your app.").
    narration: Optional[str] = None
    # The actual teaching content: a full, detailed walkthrough of the
    # concept and how it maps onto the visual (several sentences/paragraphs).
    # This is what gets shown in the chat AND spoken aloud as the main
    # response — the visual alone is never the whole answer.
    explanation: Optional[str] = None
    reason: Optional[str] = None