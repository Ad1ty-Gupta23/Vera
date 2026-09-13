# AssemblyAI Voice Agent demo

## Before presenting

1. Put a valid `ASSEMBLYAI_API_KEY` in `backend/.env`.
2. Keep `ASSEMBLYAI_VOICE_AGENT_ENABLED=true` (the default).
3. Upload `demo/novanest-support.md` to the NovaNest knowledge base.
4. Set the Business Settings category that matches the demo, then open **Action Center** to show
   its category-aware action templates. For a commerce demo, select **Load demo orders**.
5. Open **Customize Assistant**, select the microphone, and confirm the green
   **AssemblyAI Voice Agent** badge appears. If it says **Standard voice**, the
   AssemblyAI account does not currently have Voice Agent API access or the
   managed connection was unavailable; VERA has safely fallen back.

This demo is browser-to-browser and needs no Twilio account or phone number.

## Three-minute judge flow

Say: "What is your return window?"

- The Voice Agent API transcribes the turn with Universal-3 Pro.
- Its LLM routing selects VERA's `handle_customer_message` JSON-Schema tool.
- VERA retrieves the tenant's approved knowledge, records the conversation,
  and returns a grounded result.
- AssemblyAI speaks the answer through its managed voice output.
- VERA asks whether the answer resolved the request, so the call produces a
  measurable outcome instead of ending with an untracked answer.

Say: "No, that did not help. I need a human about a refund."

- VERA routes the escalation to **Billing**, keeps the full transcript, and
  tells the customer they will not need to repeat the issue.
- Open **Action Center** to show the live human handoff queue. Select
  **Accept handoff**, open the conversation context, then mark it completed.
- End the voice session and show the call summary, detected intent,
  resolution outcome, sentiment, turn count, and interruption count.

While it is speaking, say: "Wait—what if the item is damaged?"

- The stale audio stops, demonstrating semantic interruption handling rather
  than a fixed silence timer.

Say: "Do you offer gift wrapping?"

- Because that information is absent, VERA refuses to invent it and records a
  Knowledge Gap. Approve an answer in **Knowledge Base**, then ask again to
demonstrate the human-approved learning loop.

For a commerce business, say: "Where is order NN-1042?"

- VERA reads the tenant-scoped order adapter and gives a structured status,
  delivery estimate, and available action.
- The same lookup works from the widget embedded on another website.

Then demonstrate the configured business action. For example:

- Clinic: "I would like to book an appointment next Tuesday."
- Restaurant: "I would like to reserve a table for four."
- Real estate: "I would like to arrange a property viewing."
- SaaS: "I would like a product demo."
- Commerce: "I need to report a damaged order."

- Continue with a name, optional contact details, optional booking/account/order reference, and
  the desired outcome.
- Ordinary questions never open this form. Email is optional and remains
  collapsed unless the customer or owner explicitly selects **Email this request**.
- VERA creates an editable request. Say **"create the case"** or select the
  green **Create case** button. This works without Gmail.
- Open **Action Center** to show the category, requested action, priority, AssemblyAI session ID, customer
  context, assignment controls, lifecycle status, and append-only activity log.
- The existing email draft remains a separate, explicitly confirmed option;
  voice automation never silently sends mail.

## One-sentence pitch

"VERA is a browser-native action agent for any business: AssemblyAI handles
the natural voice loop, while VERA grounds answers, checks whether the issue
was resolved, routes contextual human handoffs, creates traceable business
actions, and turns unknown questions into owner-approved knowledge."
