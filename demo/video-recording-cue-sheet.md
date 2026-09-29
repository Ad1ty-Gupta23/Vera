**VERA — five-minute recording cue sheet**

Use with [the detailed recording guide](five-minute-video-script.md). Times include actual application responses. Record explanatory narration separately from the active microphone conversation.

**Recordly setup**

- Capture the browser window; keep the demo website, dashboard and architecture in its tabs.
- Enable microphone and system audio. Wear headphones. Export and play a short audio test first.
- Recordly microphone captures the presenter; VERA microphone should be active only for customer interaction.
- Use a continuous source take where practical, then trim transitions. Import additional narration if needed.
- Use a simple 16:9 frame with little padding. Review automatic zooms; emphasize sources, confirmations and results.
- Save the `.recordly` project and original media. Export an approximately five-minute 1920×1080 MP4.

| Time | Show / do | Spoken cue |
| --- | --- | --- |
| 0:00–0:20 | VERA → dashboard | Introduce business questions, tracked requests and human follow-up. |
| 0:20–0:45 | NovaNest settings → indexed support file → Customize | Owner supplies knowledge and configures the assistant. |
| 0:45–1:00 | Website Embed → Copy → installed widget | Chat and voice on the business website. |
| 1:00–1:35 | Customize test view; start voice; show AssemblyAI badge and source | **How long does standard delivery take?** Interrupt: **What about express delivery?** |
| 1:35–2:20 | Review customer action → confirmation → case number | **My name is Maya Rao. My order NN-1043 arrived damaged, and I need a replacement. Skip my email.** Then **Create the case.** |
| 2:20–3:05 | Handoff; stop voice; Action Center → context → case → outcome | **I need a human about a refund for this order.** Show Billing; accept; assign case; save In progress. |
| 3:05–3:55 | Reset → unknown answer → Knowledge gaps → approval → Reset → new answer | **Do you offer gift wrapping?** Approve policy below. Ask again in a fresh conversation. |
| 3:55–4:15 | Conversations → Overview → Email Integration | Records, knowledge gaps and optional separately confirmed Gmail sending. |
| 4:15–4:40 | Architecture SVG | AssemblyAI voice → browser tool relay → FastAPI → Chroma / Groq / SQLite. |
| 4:40–5:00 | Dashboard or VERA closing card | Recap shown outcomes; next step: stable pilot, real integrations, measured outcomes. |

**Policy to paste during owner approval**

> Yes. Gift wrapping is available for 49 rupees per order. Select gift wrapping at checkout.

This is fictional policy for the NovaNest demonstration. Approve it only after capturing the unknown-answer shot.

**Results to recognize**

- Standard delivery: **3–5 business days**. Express: **1–2 business days**.
- First answer source: **novanest-support.md**.
- Case: correct customer and requested outcome, followed by a generated number.
- Handoff: **Billing follow-up** with the recorded conversation.
- Case management: **Assigned to: Aditya — support**, **In progress**, **Save case**, activity event.
- Learning: **Approve & teach VERA**, success notification, new answer with **49 rupees** and an approved-answer source.

**Before pressing Record**

- Current NovaNest embed snippet installed; no old Urban Threads branding.
- Managed voice badge verified; microphone and application audio checked.
- Original support document indexed; gift-wrapping answer not yet approved.
- Owner tab, customer test tab, website and architecture ready.
- Optional email stays optional. Do not call a created request a completed refund.
- Reset after the handoff and before the final knowledge retest.
- Keep real voice exchanges at normal speed; trim navigation and explanations first.
