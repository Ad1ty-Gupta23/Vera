# VERA presentation

High-level hackathon pitch. Seven slides with concise copy and presenter notes. Architecture and technology share one slide; customer workflow and owner-controlled knowledge share one slide. No demo slide.
Target template: the user's existing Canva presentation. Template adaptation is pending editor access or a supplied PPTX export.

## 1. VERA

**A voice assistant for your business website**

Answers from business knowledge. Tracks customer requests. Hands over with context.

AssemblyAI voice-agent challenge

Speaker notes: VERA helps a business offer conversational assistance directly on its website. Customers can speak or type. The owner controls the knowledge and reviews the resulting work in a dashboard. Browser voice requires no telephone number or Twilio integration.

## 2. The customer service gap

- Customers search across pages for a simple answer.
- Repeated questions consume staff time.
- A conversation often ends without a clear next step.
- Human support needs the context customers have already shared.

Speaker notes: These are the problems our product targets, not measured market findings. The goal is to connect answers to an observable outcome without making every interaction an email or ticket.

## 3. The VERA experience

**One website assistant, configured for each business**

- Upload business knowledge and customize the assistant.
- Embed chat and browser voice on the website.
- Answer questions with conversation context and sources.
- Review requests, handoffs and knowledge gaps in the dashboard.

Speaker notes: The same platform can serve commerce, professional services, clinics or hospitality through business-specific knowledge and request categories. Appointment and reservation examples capture requests for staff follow-up. They are not confirmed external bookings.

## 4. AssemblyAI at the center

**Natural voice interaction through a managed connection**

- Speech recognition, turn-taking and interruption handling.
- JSON-Schema tool calls into VERA's business workflow.
- Spoken responses alongside structured on-screen answers.
- Short-lived browser tokens keep the API key on the backend.

Speaker notes: AssemblyAI handles the managed voice session, including its voice model routing. VERA supplies the authoritative business response through handle_customer_message. The browser relays that tool call to FastAPI and sends the result back. The project also retains a streaming-STT and browser-speech fallback. Managed voice requires provider access. Do not claim measured latency or flawless interruption handling without a live benchmark.

## 5. System architecture and technology stack

Insert **VERA-architecture.svg** as the main slide visual. Editable source: page 1 of **VERA-architecture-workflow.drawio**. The diagram labels each component with its technology so no separate stack slide or crowded technology table is needed.

**Voice travels directly to AssemblyAI. Business knowledge and actions stay in VERA.**

Diagram technology labels:

- Customer interface: React, Vite, Tailwind CSS.
- Voice: AssemblyAI Voice Agent API, Web Audio, AudioWorklet, WebSocket.
- Backend: Python, FastAPI, Pydantic.
- Inference: Groq.
- Knowledge: Chroma, Sentence Transformers.
- Records: SQLite, SQLAlchemy.
- Identity and follow-up: Google OAuth, optional Gmail API.

Speaker notes: The React dashboard and embeddable widget share the backend, but the public widget itself uses JavaScript rather than React. The browser requests a temporary token from FastAPI, connects to AssemblyAI over WebSocket, and relays interactive tool requests to the tenant-scoped backend. The business pipeline retrieves Chroma knowledge and uses Groq to produce a grounded response. SQLite stores business and conversation records. Actions include confirmed customer requests, contextual handoffs and optional confirmed Gmail follow-up. Authlib supports Google OAuth. LangGraph belongs to the separate general-assistant pipeline and is not shown as the orchestrator of business RAG. Avoid claiming PostgreSQL, Redis, Twilio or a deployed cloud platform as current infrastructure.

## 6. Customer workflow and owner-controlled knowledge

Insert **VERA-workflow.svg**. Editable source: page 2 of **VERA-architecture-workflow.drawio**. Keep the customer journey and owner approval loop together in this single visual.

**Customer context guides the conversation. Owners control what VERA learns.**

Diagram branches:

- Known answer: business-scoped retrieval, structured response and resolution check.
- Action requested: customer reviews and confirms a tracked request.
- Knowledge missing: log the gap, owner approves an answer, index it for future retrieval.
- Human help needed: route a handoff with the conversation context.

Speaker notes: Owners control the approved knowledge used for business-filtered retrieval. Customer history provides context rather than verified business facts. A missing answer creates reviewable work and only an owner-approved answer enters the knowledge base. Normal questions do not automatically trigger intake or email. Customers confirm actions and any optional email follow-up. A human handoff means a contextual queue in Action Center, not a live transfer to a human phone call. These implementation controls are not an independent security certification.

## 7. Business value and next milestone

**More useful conversations, with work the business can follow through**

Expected value: faster access to business information and less repeated explanation.

Pilot measures: resolution rate, handoff rate, response time and owner-approved gap closure.

Next milestone: deploy a stable pilot and connect real booking or CRM systems.

Speaker notes: Present business outcomes as hypotheses to validate. The project does not yet have verified customer adoption, revenue or benchmark results. A future business model could charge per business with usage-based voice allowances, but no pricing is validated. The immediate goal is a working pilot with reliable persistence and measured voice behavior.

## Evidence for presenter preparation

- README.md: product scope and trust controls.
- frontend/src/services/assemblyVoiceAgent.js: direct voice WebSocket, browser tool relay, audio and session handling.
- backend/app/services/voice_agent.py: token bootstrap, managed session and spoken-answer formatting.
- backend/app/api/voice_agent_routes.py: business-scoped tool execution.
- backend/app/services/business_chat.py: separate business RAG pipeline, conversation history and grounded response structure.
- backend/app/knowledge/vector_store.py: business-filtered Chroma retrieval and Sentence Transformer embeddings.
- backend/app/services/call_operations.py: call records, feedback and routed handoffs. Sentiment is heuristic, not a demonstrated provider speech-understanding model.
- backend/app/db/session.py: SQLAlchemy storage.
- frontend/package.json and backend/requirements.txt: implementation dependencies.

## Using the diagram files

Open VERA-architecture-workflow.drawio in diagrams.net to edit either page. The accompanying SVGs are vector previews generated from the same diagram definitions and can be inserted into the presentation. They have not been visually verified in draw.io or Canva because browser automation is unavailable.

Format reference: https://www.drawio.com/docs/reference/diagram-generation/
