**VERA: five-minute hackathon video script and recording guide**

Target: approximately 5:00, including your narration, customer speech, VERA's actual responses, and navigation. This is an editing target, not a verified submission limit. Prepared against this repository on September 27, 2026; the live deployment and provider account were not tested for this guide.

The story: a business configures VERA, a customer speaks to it, a request becomes visible work, a human receives context, and the owner teaches an approved answer for future customers.

Use NovaNest Electronics throughout. Introduce it as a demo business. Read only the lines labeled **Say** or **Customer**. All expected responses below describe the result to check, not dialogue to dub over the application.

The [official AssemblyAI Voice Agent Hackathon page](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) identifies AssemblyAI as the platform participants build on. Make its role visible through the actual managed-voice session and a brief architecture explanation. The five-minute target comes from your preference; the accessible event page did not establish a video-length requirement.

**Prepare the demo before recording**

1. Sign in and use a dedicated NovaNest demo workspace. In **Settings**, set the category to **Retail / E-commerce**. Use consistent business branding in the dashboard and the demonstration website.
2. Upload [novanest-support.md](novanest-support.md) in **Knowledge Base**. Wait until processing finishes and indexed chunks appear. The file supports standard delivery of 3–5 business days, express delivery of 1–2 business days, a 30-day return window for unused products, and damage reporting within 7 days. It deliberately contains no gift-wrapping policy.
3. In **Customize**, set the assistant name to **NovaNest Assistant**, greeting to **Hi! I'm NovaNest's assistant. How can I help?**, and additional instructions to **Keep answers concise and friendly. Use the approved business knowledge.** Click **Save changes**. These instructions help delivery; they do not guarantee a fixed response length.
4. Start voice and verify **AssemblyAI Voice Agent** appears. This is conditional on backend configuration and provider access. **Standard voice** means the fallback is running. If that is the only available mode, describe the recording as fallback voice and adjust the managed-voice narration; do not label it as a successful Voice Agent API session.
5. In **Website Embed**, copy the current workspace's snippet into your demo website and verify the widget loads. Use localhost or HTTPS for microphone access. If an origin allowlist is configured, include the website's exact origin. The existing root `test.html` currently says Urban Threads and contains a fixed assistant ID; it needs the current NovaNest name and snippet before you use it for this story. Do not assume its existing ID matches your workspace.
6. Keep three tabs ready: **Customize** for the live conversation, a second dashboard tab for owner actions, and the demo website. Open the architecture SVG separately for the closing explanation. Using **Customize → Test your assistant** for the main voice recording makes the source labels and provider badge easy to read. Clearly identify it as the test view; show the real website widget in its own shot.
7. Rehearse the case prompt below. If optional email is requested, say **Skip**. If a field was missed, answer the field VERA actually asks for. Check the review card before confirming.
8. Prepare this fictional, owner-approved NovaNest demo policy for the learning scene: **Yes. Gift wrapping is available for 49 rupees per order. Select gift wrapping at checkout.** Keep it in a text editor for pasting. Do not add it to the final demo workspace until the filmed approval step.
9. Rehearse knowledge-gap approval in a separate workspace. **Reset** clears a test conversation; it does not remove approved knowledge. If you have already taught the gift-wrapping answer, use a fresh demo workspace containing only the original support document for the final before/after recording.
10. Optional: select **Load demo orders** in **Action Center** if you plan to use the order-lookup variation. Order `NN-1042` is seeded as in transit; `NN-1043` is delivered. The seed dates are fixed sample dates. Present them as demonstration records, without calling the dates current delivery promises.
11. Connect Gmail in advance only if showing the optional email flow. A connection-status shot is sufficient in the main cut. A real send demonstration needs a controlled recipient inbox in the business settings and a separately reviewed, explicitly confirmed draft.
12. Use headphones and capture both microphone and application audio. Record a short sample and play it back. Record explanatory voice-over separately so your narration is not treated as a customer request by an active microphone session.

**Timeline**

| Time | Scene | Evidence viewers should see |
| --- | --- | --- |
| 0:00–0:20 | Introduce the problem and VERA | Product and clear customer use case |
| 0:20–0:45 | Configure the business assistant | Uploaded knowledge and customization |
| 0:45–1:00 | Put it on a website | Current embed snippet and working widget |
| 1:00–1:35 | Speak and interrupt | Actual audio, transcript, source, provider badge |
| 1:35–2:20 | Create a customer request | Review card, explicit confirmation, case number |
| 2:20–3:05 | Show the owner's response | Routed handoff, context, assignment, activity, call outcome |
| 3:05–3:55 | Teach a missing answer | Unknown question → approval → newly sourced answer |
| 3:55–4:15 | Show oversight and optional email | Conversation history, metrics, email connection |
| 4:15–4:40 | Explain the architecture | AssemblyAI and VERA's separate responsibilities |
| 4:40–5:00 | Close on business value | Finished workflow and next milestone |

These slots include waiting for VERA. Do a timed rehearsal with actual responses. If it runs long, use the reduction order at the end rather than racing through speech.

**1. 0:00–0:20 — Introduce the problem and VERA**

Show the landing page or a simple VERA title for a few seconds, then the business dashboard. A small face-camera overlay is optional and should not cover product text.

**Say:**

> A customer should be able to ask a business a question and get a clear next step. This is VERA, our project for the lablab.ai AssemblyAI Voice Agent Hackathon. I'll show how a business turns spoken questions into answers, tracked requests, and human follow-up.

Use the on-screen caption **Business knowledge → voice conversation → tracked outcome**. Spend the opening establishing the purpose, then move into the product.

**2. 0:20–0:45 — Configure the business assistant**

Open **Settings** briefly to show NovaNest Electronics and its commerce category. Switch to **Knowledge Base** and show the support document with completed indexing. Then open **Customize** and show the assistant name, greeting, instructions, and theme color. You can demonstrate a single color change and save it; the entire form does not need to be filled during the video.

**Say:**

> I'm using NovaNest, a demo electronics business. The owner uploads its support policy, which becomes searchable knowledge. Here, I can customize the assistant's name, greeting, instructions, and appearance. The business supplies the facts that VERA uses in customer conversations.

If including the upload action, record it separately and cut from choosing the file to its completed status. Keep the resulting document visible long enough to read its name.

**3. 0:45–1:00 — Put it on a website**

Open **Website Embed**, show **Embed code**, click **Copy**, and switch to the website where that exact snippet is already installed. Open the floating widget and show its NovaNest greeting.

**Say:**

> The owner copies this embed snippet into their website. Here it is installed on our demo site, giving visitors access to the configured assistant through chat and browser voice, without a phone number.

Caption the website **NovaNest demo website**. For the next scene, switch to **Customize → Test your assistant**, with the caption **Live assistant test — NovaNest workspace**. This makes the change of view explicit.

**4. 1:00–1:35 — Speak to VERA and interrupt naturally**

Start the microphone. Keep the **AssemblyAI Voice Agent** badge and transcript in view.

**Customer:**

> How long does standard delivery take?

Let VERA start answering. The supported fact is **3–5 business days**. While it is still speaking, ask:

**Customer:**

> What about express delivery?

The result to verify is that the old spoken output stops and the new answer uses the express policy: **1–2 business days**. Keep the complete interruption exchange at normal speed. If VERA finishes before you interrupt, re-record the attempt; the clip needs audible overlap to demonstrate interruption handling.

Show the **Source: novanest-support.md** label when present. Let the viewer hear the resolution-check question. If answering it before continuing, say **Yes, thank you**.

**Say, as brief voice-over after the exchange if timing allows:**

> The answer is tied to the uploaded policy.

Do not add a second long explanation over the voice interaction. The actual audio and source label are the evidence. Do not claim a measured latency from this clip.

**5. 1:35–2:20 — Turn speech into a confirmed case**

Remain in the same conversation. Introduce the transition with a short caption, **From answer to action**.

**Say:**

> Now the customer needs the business to take action.

**Customer:**

> My name is Maya Rao. My order NN-1043 arrived damaged, and I need a replacement. Skip my email.

Pronounce the reference as **N N, one zero four three**. The case does not depend on loading demo orders; if orders are loaded, this reference matches the delivered sample record.

Wait for the actual next turn. If a field is missing, use the relevant answer:

| VERA asks for | Customer answer |
| --- | --- |
| Name | Maya Rao. |
| Issue or outcome | My order arrived damaged. I would like a replacement. |
| Optional email | Skip. |
| Reference | NN-1043. |

When **Review customer action** appears, pause on the customer details and requested outcome. Confirm only after checking that the extraction is correct.

**Customer:**

> Create the case.

Show the generated case number. If voice confirmation fails in rehearsal, the legitimate alternative is to click **Create case** and say **I confirm the reviewed request here**. Let the video show which mechanism actually worked.

**Say, after the successful result:**

> VERA creates the reviewed case after confirmation. Email is optional.

The successful action is a saved replacement request. Do not narrate it as an approved replacement, issued refund, or dispatched shipment.

**6. 2:20–3:05 — Show the owner's response and retained context**

First, request staff help in the same conversation:

**Customer:**

> I need a human about a refund for this order.

Let VERA acknowledge the handoff. Stop the voice session before opening the completed-call view.

Switch to the owner dashboard tab, open or reload **Action Center**, and demonstrate the records from the interaction just recorded:

1. Show **Billing follow-up** in **Human handoff queue**, then click **Accept handoff**.
2. Click **View context**. It opens the conversation list; select the relevant conversation using its preview and identifier. Briefly show the earlier customer messages.
3. Return to **Action Center** and open the case with the same number shown in scene 5.
4. Enter **Aditya — support** under **Assigned to**, change **Status** to **In progress**, then click **Save case**.
5. Show **Activity** and the AssemblyAI session identifier if available.
6. Scroll to **Voice-call outcomes** and show the completed call's actual outcome, summary, intent, turns, and interruptions. Reload once if the ending request has not yet appeared.

**Say, as voice-over across these shots:**

> This becomes a billing handoff with the conversation attached. The team can accept it and review what the customer already said. The confirmed case can be assigned and tracked through its activity log. Once the call ends, the owner can inspect its outcome and summary.

Use **In progress** for the case because the replacement has not actually been handled. A handoff is a queue for staff follow-up; this implementation does not connect the customer to a live human phone call. **Mark completed** is available after acceptance, but you do not need to simulate completed staff work in this cut.

**7. 3:05–3:55 — Show the owner-approved learning loop**

Return to **Customize** and click **Reset**, then start a new voice session. Caption this **New customer conversation**. This reset is necessary: an active handoff keeps the previous conversation in follow-up mode and can prevent normal retrieval from running.

**Customer:**

> Do you offer gift wrapping?

Let VERA give its actual response. With only the supplied NovaNest support file indexed, the intended result is that it cannot confirm the policy and records a knowledge gap. Check this during rehearsal; do not substitute an invented refusal if it answers differently.

Stop voice. In the owner tab, open or reload **Knowledge Base**, scroll to **Knowledge gaps**, and show the gift-wrapping question. Paste the prepared demo policy:

> Yes. Gift wrapping is available for 49 rupees per order. Select gift wrapping at checkout.

Click **Approve & teach VERA**. Wait for **Answer approved and added to the knowledge base**. The approval creates an indexed document, so show completion before retesting.

**Say, across the owner-action shots:**

> That policy was missing. VERA records a knowledge gap. The owner enters a verified answer and approves it before it becomes searchable business knowledge. Now a new customer can retrieve the approved answer.

Back in **Customize**, click **Reset** again and restart voice, then ask:

**Customer:**

> Do you offer gift wrapping?

Capture the real answer containing **49 rupees per order** and the new source label, which should reference an `approved-answer-gap-…` document. This fresh conversation demonstrates retrieval of approved knowledge rather than reuse of the previous conversation's text.

End the session. An optional final **Yes, thank you** can demonstrate a positive resolution outcome if it fits the actual timing.

**8. 3:55–4:15 — Show oversight and optional email**

Use a short montage: **Conversations** with a recorded exchange, **Overview → Support impact**, and **Email Integration** with its actual connection state.

**Say:**

> Owners can review conversations, grounded-answer coverage, open knowledge gaps, and active cases. Gmail is an optional connection for sending reviewed requests to the business's configured action inbox. Sending requires a separate confirmation.

Use the numbers currently shown. Do not describe demo counters as customer adoption, a benchmark, or proven business savings. A connected Gmail account proves the connection state; it does not prove a message was sent.

**9. 4:15–4:40 — Explain what powers the workflow**

Show [VERA-architecture.svg](presentation/VERA-architecture.svg). Inspect the SVG at the intended recording size in advance. Follow the voice path and business path with your cursor.

**Say:**

> AssemblyAI's Voice Agent API handles the live voice session, including speech recognition, turn-taking, interruptions, and spoken output. Its tool requests pass through the browser to VERA's FastAPI backend. VERA retrieves business knowledge from Chroma, uses Groq for responses, and stores conversations and actions in SQLite. Temporary browser tokens keep the provider key on the backend.

This narration assumes the demonstrated session used managed voice. Speak the technology names clearly. You do not need to read every diagram box or show source code.

**10. 4:40–5:00 — Close on the completed workflow**

Return to the dashboard or a VERA closing card. Keep the product name visible.

**Say:**

> VERA connects business knowledge, natural voice, and work the team can follow through. You've seen a sourced answer, a confirmed request, contextual human follow-up, and an owner-approved knowledge update. Our next step is a stable pilot with real business integrations and measured outcomes. Thank you.

Keep the last frame visible for one or two seconds. A tested project link can appear on the closing card if you have one.

**Optional swaps when you want a particular feature to receive more attention**

These replace footage; they do not add time to a five-minute cut.

| Feature | Exact demonstration | Suggested replacement |
| --- | --- | --- |
| Business-record lookup | After loading demo orders, ask **Where is order NN-1042?** Show the returned in-transit status and sample estimate. Say **This answer comes from the demo order records.** | Replace the 20-second oversight/email montage. |
| An actual optional email | On a separate request, select **Email this request**, inspect the recipient, subject and body, confirm the send, and show delivery to your controlled inbox. Describe it as sending to the business action inbox. | Allow 30–40 seconds by replacing the oversight montage and shortening setup and architecture. |
| Resolution-triggered escalation | In a fresh managed-voice conversation, ask **What is your return window?** After the answer and resolution check, say **No, that did not help. I need a human about a refund.** Show Billing follow-up. | Replace the direct human request and part of the case-management footage; budget the extra answer time. |
| Other business categories | Briefly show category-aware **Voice action templates** for appointments, reservations or leads. | Replace part of the setup montage. Describe these as request capture for follow-up, unless an external booking system is actually integrated. |

**Feature coverage and what deserves screen time**

| Project area | How the main video covers it |
| --- | --- |
| Business setup and settings | Preconfigured demo business and a brief settings shot |
| Document upload and retrieval | Indexed document followed by a sourced voice answer |
| Assistant customization | Saved name, greeting, instructions and appearance |
| Website embedding | Current snippet and the actual widget on a separate page |
| Voice and interruption | Uncut live interaction with managed-voice badge |
| Request collection and confirmation | Spoken request, review card and created case number |
| Case management | Assignment, status and activity log |
| Human handoff | Routed queue entry, acceptance and retained transcript |
| Call operations | Completed-call outcome and summary |
| Controlled knowledge improvement | Missing answer, explicit owner approval and fresh retrieval |
| Conversation history and overview | Brief owner-dashboard montage |
| Gmail | Optional connection explained; real sending is a swap |
| Demo order adapter | Optional lookup swap |
| Subscription | Omit from the main cut. The current page is a plan flag; no payment provider is wired up. |

The end-to-end business workflow is the focus. Authentication, every navigation item, and unrelated general-assistant experiments do not each need a separate walkthrough to explain this product in five minutes.

**Recordly setup for this video**

The selected recorder is Recordly. Its [official website](https://recordly.dev/) documents microphone plus system-audio capture, zooms, timeline editing, imported audio tracks, MP4 export, and saved `.recordly` projects. Exact controls can vary by installed version; the settings below are recommendations for this VERA recording.

| Choice | Recommended setup |
| --- | --- |
| Capture source | One browser window containing all demo tabs. Open the architecture SVG in that browser too. |
| Microphone capture | On in Recordly; select your intended headset or external microphone. |
| System audio | On, so the export includes VERA's spoken replies. |
| Headphones | Wear them to reduce the chance of VERA hearing its own output through your microphone. |
| Webcam | Optional small overlay. Position it away from the widget, chat controls, source labels and case details; omit it if it obscures the product. |
| Frame | 16:9; use little decorative padding so dashboard text stays readable. |
| Background | A simple dark solid color or subtle gradient that fits VERA. |
| Zooms | Review the automatic suggestions, then keep only the ones that help explain a result. Add manual zoom regions for small evidence labels. |
| Cursor | Keep it visible and smooth, with restrained effects. |
| Export | MP4, 1920×1080, high quality, approximately five minutes. |

First record a 20–30 second test: say a sentence, ask VERA one question, let it answer, and export that sample. Play the exported file and verify both voices are audible and the transcript is readable. This checks the complete recording-to-export path before the real take.

The two microphone controls serve different purposes. **Recordly's microphone captures you for the video. VERA's microphone sends speech to the agent.** Keep VERA's microphone off during introductions and owner-dashboard explanations. Turn it on for the customer prompts. Record explanatory narration separately if it needs to accompany an active conversation scene; Recordly supports importing audio tracks. Preserve the actual customer and agent audio in those exchanges.

For a straightforward Recordly workflow, capture one continuous source take in the script's order, leaving a few seconds between scenes. Trim the transitions afterward. This avoids depending on a multi-video assembly feature. If one difficult exchange needs a separate recording, save that take as well; use an editor that supports combining clips if your installed Recordly version cannot assemble them.

Suggested places for deliberate zooms:

- **1:00–1:35:** the provider badge and source label, while keeping enough transcript visible to understand the question.
- **1:35–2:20:** the reviewed customer action and generated case number.
- **2:20–3:05:** Billing follow-up, the assigned case, and its activity entry.
- **3:05–3:55:** the missing question, **Approve & teach VERA**, and the new approved-answer source.

Hold each useful zoom steady for a few seconds. During the interruption demonstration, keep the question and answer in a stable frame; review automatic zooms so cursor movement does not pull attention away from the conversation. Keep the sidebar visible during navigation so viewers can follow the change of page.

Save the editable project as `VERA-hackathon-demo.recordly` and the final export as `VERA-hackathon-demo.mp4`. Keep the original recordings and imported audio together with the project until the submission is complete. These are suggested filenames, not files generated by this guide.

**Record and edit it in this order**

1. Record a rehearsal and time the actual voice exchanges. Agent response lengths and provider delays determine the final room available for narration.
2. Record the original unknown-answer shot before approving the new policy. Record the approval and new answer immediately afterward, keeping the same business workspace.
3. Capture voice, case creation, and handoff as genuine product interactions with both sides audible. Keep the case numbers and conversation identifiers consistent across the customer and owner shots.
4. For Recordly, capture the setup, website, dashboard, Gmail, and architecture in the same source take where practical. Record any additional explanatory voice-over afterward and import it into the timeline. Natural scene cuts are appropriate for navigation and document processing.
5. Preserve the interruption exchange and at least one complete question-to-answer exchange at normal speed. Do not remove waiting time from inside an exchange while implying that the result demonstrates response latency. Label sped-up setup footage if used.
6. Add captions for your prompts and VERA's replies. Manually check **NovaNest**, **AssemblyAI**, order references, and amounts. Use short feature captions such as **Grounded answer**, **Customer confirms**, and **Owner approves**.
7. Make the source label, review card, new case number, Billing handoff, approved answer, and new source readable for a beat. Keep the cursor still while the viewer reads.
8. Export at a readable 16:9 resolution, such as 1920×1080. Review the exported file from start to finish with headphones. Confirm that system audio is present, narration does not overlap VERA, and the final runtime matches your target.

**If the recording runs over five minutes**

Cut optional color-change footage first. Then shorten the website installation explanation, dashboard montage, and architecture narration. Preserve the real voice exchange, case confirmation and result, contextual handoff, and complete knowledge-gap before/after sequence. If a long response still pushes it over, use fewer spoken explanations and let source labels and captions carry those details.

Short architecture alternative:

> AssemblyAI manages the voice session. Browser-relayed tool calls reach FastAPI, where Chroma supplies business knowledge and Groq generates responses. SQLite stores the resulting conversations and actions.

**Recovery cues for rehearsal**

| What happens | What to do |
| --- | --- |
| The badge says Standard voice | Verify managed-voice configuration and provider access; if using fallback, change the claims in the video. |
| VERA finishes before the interruption | Re-record and speak while its answer is audibly in progress. |
| The case form asks another question | Answer the actual missing field; use **Skip** for optional contact information. |
| Voice confirmation does not create a case | Use the visible **Create case** button and show the actual successful confirmation. |
| Gift wrapping is already known | Use a fresh demo workspace with only the original policy. Reset alone does not erase knowledge. |
| Gift wrapping returns a queued-handoff message | Reset the test conversation before asking the knowledge question. |
| The owner view does not show the new record | Reload the owner page after the relevant request completes. |
| Completed-call details are missing | Explicitly stop the microphone session, then reload Action Center. |
| The website shows the wrong business | Replace the existing test-page snippet with the current workspace's exact snippet. |
| The app is slow after an idle period | Open and rehearse before recording. For the free Render demo, also verify uploaded data still exists. |

**Keep the claims aligned with what is demonstrated**

Use **created a request**, **queued a human follow-up**, and **indexed an owner-approved answer** for those results. A request is not a completed external booking or refund. The current sentiment label is a heuristic and should not be described as a validated speech-emotion model. Grounded-answer rate is an application metric, not independently verified accuracy. The current project uses SQLite and Chroma; do not claim a production persistence setup or payment integration from the demo.

Final success check: a viewer should be able to explain how a business sets VERA up, hear a real voice interaction, see the work it creates, and understand who controls what it learns.
