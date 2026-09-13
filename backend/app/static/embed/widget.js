/*!
 * VERA business assistant embed widget (Stage 7).
 *
 * Loaded on a business's own website via a <script> tag with two data
 * attributes:
 *   data-assistant-id  the assistant's public_id (safe to expose — it can
 *                       only ever reach this one business's assistant)
 *   data-api-base       the backend's public API base URL
 *
 * Renders entirely inside a Shadow DOM so the widget's styles can never
 * leak into (or be broken by) the host page's CSS, and never touches
 * localStorage/cookies — only a per-tab sessionStorage id so a page
 * refresh continues the same conversation instead of starting a new one.
 */
(function () {
  "use strict";

  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var ASSISTANT_ID = currentScript.getAttribute("data-assistant-id");
  var API_BASE = (currentScript.getAttribute("data-api-base") || "").replace(/\/$/, "");

  if (!ASSISTANT_ID || !API_BASE) {
    console.error("[VERA widget] missing data-assistant-id or data-api-base on the embed <script> tag.");
    return;
  }

  var SESSION_KEY = "vera_widget_session:" + ASSISTANT_ID;

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (e) {
      // sessionStorage can throw in locked-down iframes — fall back to an
      // in-memory id for the life of this page load.
      return "mem-" + Date.now() + "-" + Math.random();
    }
  }

  var sessionId = getSessionId();

  function api(path, options) {
    return fetch(API_BASE + path, options).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) {
          var msg = (body && body.detail) || "Something went wrong.";
          throw new Error(typeof msg === "string" ? msg : "Something went wrong.");
        }
        return body;
      });
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "style") node.style.cssText = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  // ------------------------------------------------------------- widget --

  var root = el("div", { id: "vera-widget-root" });
  root.style.cssText = "all: initial; position: fixed; z-index: 2147483000;";
  document.body.appendChild(root);
  var shadow = root.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent =
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}" +
    ".launcher{position:fixed;width:56px;height:56px;border-radius:9999px;border:none;cursor:pointer;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.25);color:#fff;font-size:24px;display:flex;align-items:center;" +
      "justify-content:center;bottom:20px;}" +
    ".launcher.right{right:20px;} .launcher.left{left:20px;}" +
    ".panel{position:fixed;width:340px;max-width:calc(100vw - 24px);height:480px;max-height:calc(100vh - 100px);" +
      "background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;" +
      "overflow:hidden;bottom:88px;opacity:0;pointer-events:none;transform:translateY(10px);transition:all .15s ease;}" +
    ".panel.open{opacity:1;pointer-events:auto;transform:translateY(0);}" +
    ".panel.right{right:20px;} .panel.left{left:20px;}" +
    ".head{padding:14px 16px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}" +
    ".head h1{font-size:14px;font-weight:600;margin:0;}" +
    ".head button{background:none;border:none;color:#fff;opacity:.85;cursor:pointer;font-size:18px;line-height:1;}" +
    ".callbar{display:none;align-items:center;gap:8px;padding:9px 12px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;color:#166534;font-size:11px;}" +
    ".callbar.show{display:flex;} .callbar .pulse{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px #bbf7d0;}" +
    ".callbar .callstatus{flex:1;font-weight:600;} .callbar .timer{font-variant-numeric:tabular-nums;color:#64748b;}" +
    ".callbar button{border:0;border-radius:7px;background:#dc2626;color:#fff;padding:5px 8px;font-size:10px;cursor:pointer;}" +
    ".body{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;}" +
    ".msg{max-width:82%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.4;white-space:pre-wrap;}" +
    ".msg a{color:inherit;text-decoration:underline;overflow-wrap:anywhere;}" +
    ".msg.assistant{background:#fff;border:1px solid #e2e8f0;color:#1e293b;align-self:flex-start;border-bottom-left-radius:4px;}" +
    ".msg.customer{color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}" +
    ".msg.err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;align-self:center;}" +
    ".hint{font-size:10px;color:#94a3b8;margin-top:2px;}" +
    ".foot{border-top:1px solid #e2e8f0;padding:10px;display:flex;gap:6px;flex-shrink:0;background:#fff;}" +
    ".foot input{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-size:13px;outline:none;}" +
    ".foot button{border:none;border-radius:10px;padding:0 14px;color:#fff;font-size:13px;cursor:pointer;}" +
    ".foot button:disabled{opacity:.5;cursor:default;}" +
    ".draft{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff;align-self:stretch;}" +
    ".draft label{font-size:10px;color:#64748b;display:block;margin-bottom:2px;}" +
    ".draft input,.draft textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;" +
      "font-size:12px;margin-bottom:8px;font-family:inherit;}" +
    ".draft textarea{resize:vertical;min-height:70px;}" +
    ".draft .actions{display:flex;flex-wrap:wrap;gap:6px;}" +
    ".draft .actions button{flex:1;padding:7px;border-radius:8px;font-size:12px;border:none;cursor:pointer;}" +
    ".draft .cancel{background:#f1f5f9;color:#334155;}" +
    ".powered{text-align:center;font-size:10px;color:#94a3b8;padding:4px 0 8px;}";
  shadow.appendChild(style);

  var side = "right";
  var panelSide = "right"; // resolved once config loads
  var themeColor = "#7c3aed";

  var launcher = el("button", { class: "launcher right", "aria-label": "Open chat" });
  launcher.textContent = "💬";
  var panel = el("div", { class: "panel right" });
  var head = el("div", { class: "head" });
  var headTitle = el("h1", { text: "Chat with us" });
  var closeBtn = el("button", { text: "✕", "aria-label": "Close chat" });
  head.appendChild(headTitle);
  head.appendChild(closeBtn);
  var callStatus = el("span", { class: "callstatus", text: "Connecting…", role: "status", "aria-live": "polite" });
  var callTimer = el("span", { class: "timer", text: "00:00", role: "timer", "aria-label": "Call duration" });
  var endCallBtn = el("button", { text: "End", type: "button", "aria-label": "End support call" });
  var callBar = el("div", { class: "callbar", "aria-label": "Voice helpdesk status" }, [
    el("span", { class: "pulse", "aria-hidden": "true" }),
    callStatus,
    callTimer,
    endCallBtn,
  ]);
  var body = el("div", { class: "body", role: "log", "aria-live": "polite", "aria-relevant": "additions" });
  var input = el("input", { placeholder: "Type a message…", maxlength: "2000" });
  var sendBtn = el("button", { text: "Send" });
  var foot = el("div", { class: "foot" }, [input, sendBtn]);
  var powered = el("div", { class: "powered", text: "AI assistant" });

  panel.appendChild(head);
  panel.appendChild(callBar);
  panel.appendChild(body);
  panel.appendChild(foot);
  panel.appendChild(powered);
  shadow.appendChild(launcher);
  shadow.appendChild(panel);

  function paint() {
    launcher.className = "launcher " + panelSide;
    launcher.style.background = themeColor;
    panel.className = "panel " + panelSide + (panel.classList.contains("open") ? " open" : "");
    head.style.background = themeColor;
    sendBtn.style.background = themeColor;
  }

  var open = false;
  function togglePanel(forceOpen) {
    open = typeof forceOpen === "boolean" ? forceOpen : !open;
    panel.classList.toggle("open", open);
    if (open) input.focus();
  }
  launcher.addEventListener("click", function () { togglePanel(); });
  closeBtn.addEventListener("click", function () {
    if (voiceState.active || voiceState.starting) stopVoice();
    togglePanel(false);
  });

  function appendLinkifiedText(node, text) {
    var pattern = /(https?:\/\/[^\s]+)/g;
    var cursor = 0;
    String(text || "").replace(pattern, function (url, _match, offset) {
      if (offset > cursor) node.appendChild(document.createTextNode(String(text).slice(cursor, offset)));
      node.appendChild(el("a", {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        text: url,
      }));
      cursor = offset + url.length;
      return url;
    });
    if (cursor < String(text || "").length) {
      node.appendChild(document.createTextNode(String(text).slice(cursor)));
    }
  }

  function addMessage(role, text) {
    var node = el("div", { class: "msg " + role });
    appendLinkifiedText(node, text);
    body.appendChild(node);
    body.scrollTop = body.scrollHeight;
    return node;
  }

  function addError(text) {
    addMessage("err", text);
  }

  var activeIncident = null;

  function renderIncidentDraft(incident) {
    var existing = shadow.querySelector(".draft");
    if (existing) existing.remove();
    if (!incident || incident.status !== "ready_for_review" || !incident.email_draft) return;

    var subjectInput = el("input", { value: incident.email_draft.subject });
    var bodyInput = el("textarea", {});
    bodyInput.value = incident.email_draft.body;
    var fields = incident.fields || {};
    var ticketBtn = el("button", { text: "Create case" });
    ticketBtn.style.background = "#059669";
    ticketBtn.style.color = "#fff";
    var emailBtn = el("button", { text: "Email this request" });
    emailBtn.style.background = "#ede9fe";
    emailBtn.style.color = "#6d28d9";
    var confirmBtn = el("button", { text: "Confirm & Send Email" });
    confirmBtn.style.background = themeColor;
    confirmBtn.style.color = "#fff";
    confirmBtn.style.display = "none";
    var cancelBtn = el("button", { class: "cancel", text: "Cancel" });
    var emailFields = el("div", {}, [
      el("label", { text: "To: " + incident.email_draft.to }),
      el("label", { text: "Subject" }),
      subjectInput,
      el("label", { text: "Message" }),
      bodyInput,
    ]);
    emailFields.style.display = "none";

    var draft = el("div", { class: "draft" }, [
      el("label", { text: "Review customer action" }),
      el("div", { text: fields.issue_description || "Customer follow-up requested" }),
      el("div", {
        class: "hint",
        text: "Customer: " + (fields.customer_name || "Not provided") +
          (fields.order_reference ? " · Reference: " + fields.order_reference : ""),
      }),
      emailFields,
      el("div", { class: "actions" }, [ticketBtn, emailBtn, confirmBtn, cancelBtn]),
      el("div", { class: "hint", text: "Nothing is emailed automatically." }),
    ]);
    body.appendChild(draft);
    body.scrollTop = body.scrollHeight;

    emailBtn.addEventListener("click", function () {
      emailFields.style.display = "block";
      emailBtn.style.display = "none";
      confirmBtn.style.display = "block";
      body.scrollTop = body.scrollHeight;
    });

    ticketBtn.addEventListener("click", function () {
      ticketBtn.disabled = true;
      emailBtn.disabled = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      api(
        "/public/assistants/" + ASSISTANT_ID + "/incidents/" + incident.id +
          "/ticket?session_id=" + encodeURIComponent(sessionId),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            channel: voiceState.active ? "voice" : "chat",
            assemblyai_session_id: voiceState.providerSessionId || null,
          }),
        }
      )
        .then(function (ticket) {
          draft.remove();
          addMessage(
            "assistant",
            "Answer:\nCustomer case " + ticket.ticket_number + " has been created.\n\n" +
              "Details:\n- Priority: " + ticket.priority + "\n- Status: " + ticket.status
          );
          activeIncident = null;
        })
        .catch(function (err) {
          addError(err.message || "Could not create the case.");
          ticketBtn.disabled = false;
          emailBtn.disabled = false;
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });

    confirmBtn.addEventListener("click", function () {
      ticketBtn.disabled = true;
      emailBtn.disabled = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      var dirty =
        subjectInput.value !== incident.email_draft.subject || bodyInput.value !== incident.email_draft.body;
      (dirty
        ? api(
            "/public/assistants/" + ASSISTANT_ID + "/incidents/" + incident.id + "?session_id=" + encodeURIComponent(sessionId),
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email_subject: subjectInput.value, email_body: bodyInput.value }),
            }
          )
        : Promise.resolve()
      )
        .then(function () {
          return api(
            "/public/assistants/" + ASSISTANT_ID + "/incidents/" + incident.id + "/confirm?session_id=" + encodeURIComponent(sessionId),
            { method: "POST" }
          );
        })
        .then(function () {
          draft.remove();
          addMessage("assistant", "Your message has been sent — thanks for reaching out!");
          activeIncident = null;
        })
        .catch(function (err) {
          addError(err.message || "Could not send the email.");
          ticketBtn.disabled = false;
          emailBtn.disabled = false;
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });

    cancelBtn.addEventListener("click", function () {
      ticketBtn.disabled = true;
      emailBtn.disabled = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      api(
        "/public/assistants/" + ASSISTANT_ID + "/incidents/" + incident.id + "/cancel?session_id=" + encodeURIComponent(sessionId),
        { method: "POST" }
      )
        .then(function () {
          draft.remove();
          addMessage("assistant", "No problem — the request was cancelled.");
          activeIncident = null;
        })
        .catch(function (err) {
          addError(err.message || "Could not cancel.");
          ticketBtn.disabled = false;
          emailBtn.disabled = false;
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });
  }

  // -------------------------------------------------------------- voice --
  // Prefers AssemblyAI's end-to-end Voice Agent API and automatically
  // retains the established streaming-STT + browser-TTS path as fallback.
  // It is self-contained (no import) because
  // this file runs standalone on a third-party page — the AudioWorklet
  // processor is inlined as a Blob URL instead of a second static file.

  var WS_BASE = API_BASE.replace(/^http/, "ws");
  var LEGACY_SAMPLE_RATE = 16000;
  var MANAGED_SAMPLE_RATE = 24000;
  var VOICE_TOOL_NAME = "handle_customer_message";

  var MIC_PROCESSOR_SRC =
    "class MicrophoneProcessor extends AudioWorkletProcessor {" +
    "constructor(o){super();this._target=(o.processorOptions&&o.processorOptions.targetSampleRate)||16000;" +
    "this._step=sampleRate/this._target;this._samples=[];this._position=0;" +
    "this._chunkSamples=Math.round(this._target*0.05);this._buffer=new Int16Array(this._chunkSamples);this._offset=0;}" +
    "push(v){var s=Math.max(-1,Math.min(1,v));this._buffer[this._offset++]=s<0?s*0x8000:s*0x7fff;" +
    "if(this._offset>=this._chunkSamples){this.port.postMessage(this._buffer.buffer,[this._buffer.buffer]);" +
    "this._buffer=new Int16Array(this._chunkSamples);this._offset=0;}}" +
    "process(inputs){var input=inputs[0]&&inputs[0][0];if(!input||!input.length)return true;" +
    "for(var i=0;i<input.length;i++)this._samples.push(input[i]);" +
    "while(this._position+1<this._samples.length){var left=Math.floor(this._position),f=this._position-left;" +
    "this.push(this._samples[left]+(this._samples[left+1]-this._samples[left])*f);this._position+=this._step;}" +
    "var used=Math.floor(this._position);if(used>0){this._samples.splice(0,used);this._position-=used;}return true;}}" +
    "registerProcessor('microphone-processor', MicrophoneProcessor);";

  function speakText(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    var voices = window.speechSynthesis.getVoices();
    var preferred = voices.find(function (v) {
      return v.lang.indexOf("en") === 0 && (v.name.indexOf("Google") !== -1 || v.name.indexOf("Natural") !== -1);
    }) || voices.find(function (v) { return v.lang.indexOf("en") === 0; });
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  }

  var voiceState = {
    ws: null,
    audioContext: null,
    playbackContext: null,
    workletNode: null,
    sourceNode: null,
    silentGain: null,
    stream: null,
    active: false,
    starting: false,
    ready: false,
    mode: null,
    playbackTime: 0,
    playbackSources: [],
    pendingTools: {},
    lastTurnEvent: null,
    lastToolResult: null,
    greeting: "",
    providerSessionId: null,
    interruptions: 0,
    suppressReplyAudio: false,
    latestUserTranscript: "",
    callStartedAt: null,
    timerId: null,
  };

  function updateCallTimer() {
    if (!voiceState.callStartedAt) return;
    var elapsed = Math.max(0, Math.floor((Date.now() - voiceState.callStartedAt) / 1000));
    var minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    var seconds = String(elapsed % 60).padStart(2, "0");
    callTimer.textContent = minutes + ":" + seconds;
  }

  function showCallStatus(statusText) {
    callBar.classList.add("show");
    callStatus.textContent = statusText;
    if (!voiceState.callStartedAt) {
      voiceState.callStartedAt = Date.now();
      updateCallTimer();
      voiceState.timerId = setInterval(updateCallTimer, 1000);
    }
  }

  function hideCallStatus() {
    callBar.classList.remove("show");
    callStatus.textContent = "Connecting…";
    callTimer.textContent = "00:00";
    voiceState.callStartedAt = null;
    if (voiceState.timerId) clearInterval(voiceState.timerId);
    voiceState.timerId = null;
  }

  function stopManagedPlayback() {
    voiceState.playbackSources.forEach(function (source) {
      try { source.stop(); } catch (e) { /* already ended */ }
    });
    voiceState.playbackSources = [];
    voiceState.playbackTime = voiceState.playbackContext ? voiceState.playbackContext.currentTime : 0;
  }

  function stopVoice() {
    var managedWs = voiceState.mode === "managed" && voiceState.ws;
    var completedProviderSessionId = voiceState.providerSessionId;
    var completedInterruptions = voiceState.interruptions;
    voiceState.active = false;
    voiceState.starting = false;
    voiceState.ready = false;
    stopManagedPlayback();
    if (voiceState.workletNode) voiceState.workletNode.disconnect();
    if (voiceState.sourceNode) voiceState.sourceNode.disconnect();
    if (voiceState.silentGain) voiceState.silentGain.disconnect();
    if (voiceState.stream) voiceState.stream.getTracks().forEach(function (t) { t.stop(); });
    if (voiceState.audioContext && voiceState.audioContext.state !== "closed") {
      voiceState.audioContext.close().catch(function () {});
    }
    if (voiceState.playbackContext && voiceState.playbackContext.state !== "closed") {
      voiceState.playbackContext.close().catch(function () {});
    }
    if (managedWs && managedWs.readyState === WebSocket.OPEN) {
      try { managedWs.send(JSON.stringify({ type: "session.end" })); } catch (e) { /* closing */ }
    }
    if (voiceState.ws && voiceState.ws.readyState < 2) voiceState.ws.close();
    voiceState.ws = null;
    voiceState.audioContext = null;
    voiceState.playbackContext = null;
    voiceState.workletNode = null;
    voiceState.sourceNode = null;
    voiceState.silentGain = null;
    voiceState.stream = null;
    voiceState.mode = null;
    voiceState.pendingTools = {};
    voiceState.lastTurnEvent = null;
    voiceState.lastToolResult = null;
    voiceState.providerSessionId = null;
    voiceState.interruptions = 0;
    voiceState.suppressReplyAudio = false;
    voiceState.latestUserTranscript = "";
    if (completedProviderSessionId) {
      api("/public/assistants/" + ASSISTANT_ID + "/voice-agent/calls/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assemblyai_session_id: completedProviderSessionId,
          interruptions: completedInterruptions,
        }),
        keepalive: true,
      }).catch(function () {});
    }
    window.speechSynthesis && window.speechSynthesis.cancel();
    hideCallStatus();
    paintMic();
  }

  function bytesToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function startMicrophone(targetRate, onChunk) {
    return navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      .then(function (stream) {
        voiceState.stream = stream;
        var audioContext = new AudioContext();
        voiceState.audioContext = audioContext;
        var blobUrl = URL.createObjectURL(new Blob([MIC_PROCESSOR_SRC], { type: "application/javascript" }));
        return audioContext.resume().then(function () {
          return audioContext.audioWorklet.addModule(blobUrl);
        }).then(function () {
          URL.revokeObjectURL(blobUrl);
          var source = audioContext.createMediaStreamSource(stream);
          var worklet = new AudioWorkletNode(audioContext, "microphone-processor", {
            processorOptions: { targetSampleRate: targetRate },
          });
          var gain = audioContext.createGain();
          gain.gain.value = 0;
          voiceState.sourceNode = source;
          voiceState.workletNode = worklet;
          voiceState.silentGain = gain;
          worklet.port.onmessage = onChunk;
          source.connect(worklet).connect(gain).connect(audioContext.destination);
        });
      });
  }

  function playManagedAudio(base64) {
    var ctx = voiceState.playbackContext;
    if (!ctx || !voiceState.active || voiceState.suppressReplyAudio) return;
    var raw = atob(base64);
    var buffer = ctx.createBuffer(1, Math.floor(raw.length / 2), MANAGED_SAMPLE_RATE);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      var value = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
      if (value >= 32768) value -= 65536;
      data[i] = value / 32768;
    }
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = function () {
      var index = voiceState.playbackSources.indexOf(source);
      if (index !== -1) voiceState.playbackSources.splice(index, 1);
    };
    voiceState.playbackSources.push(source);
    voiceState.playbackTime = Math.max(voiceState.playbackTime, ctx.currentTime);
    source.start(voiceState.playbackTime);
    voiceState.playbackTime += buffer.duration;
  }

  function runManagedTool(event) {
    if (event.name !== VOICE_TOOL_NAME) {
      return Promise.resolve({ ok: false, error: "Unsupported voice tool: " + event.name });
    }
    // Preserve the exact STT text so referential follow-ups are not lost
    // when the voice model constructs its tool arguments.
    var message = String(
      voiceState.latestUserTranscript || (event.arguments && event.arguments.message) || ""
    ).trim();
    voiceState.latestUserTranscript = "";
    if (!message) return Promise.resolve({ ok: false, error: "Missing customer message" });
    return api("/public/assistants/" + ASSISTANT_ID + "/voice-agent/tool", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        message: message,
        assemblyai_session_id: voiceState.providerSessionId,
      }),
    }).then(function (result) {
      voiceState.lastToolResult = result;
      activeIncident = result.incident || null;
      renderIncidentDraft(activeIncident);
      return { ok: true, result: result };
    }).catch(function (err) {
      return { ok: false, error: err.message || "Tool call failed" };
    });
  }

  function flushManagedToolsIfIdle() {
    if (voiceState.lastTurnEvent !== "reply.done" ||
        !voiceState.ws || voiceState.ws.readyState !== WebSocket.OPEN) return;
    Object.keys(voiceState.pendingTools).forEach(function (callId) {
      var pending = voiceState.pendingTools[callId];
      if (!pending.ready) return;
      delete voiceState.pendingTools[callId];
      voiceState.ws.send(JSON.stringify({
        type: "tool.result",
        call_id: callId,
        result: JSON.stringify(pending.outcome.ok ? pending.outcome.result : { error: pending.outcome.error }),
        is_error: !pending.outcome.ok,
      }));
    });
  }

  function queueManagedTool(event) {
    var pending = { ready: false, outcome: null };
    voiceState.pendingTools[event.call_id] = pending;
    runManagedTool(event).then(function (outcome) {
      pending.ready = true;
      pending.outcome = outcome;
      flushManagedToolsIfIdle();
    });
  }

  function handleManagedEvent(event) {
    if (event.type === "reply.audio") {
      if (!voiceState.suppressReplyAudio) {
        showCallStatus("Assistant speaking");
        playManagedAudio(event.data);
      }
    } else if (event.type === "transcript.user") {
      voiceState.latestUserTranscript = event.text || "";
      showCallStatus("Processing request");
      addMessage("customer", event.text).style.background = themeColor;
    } else if (event.type === "tool.call") {
      queueManagedTool(event);
    } else if (event.type === "reply.started" || event.type === "input.speech.started") {
      voiceState.lastTurnEvent = event.type;
      if (event.type === "input.speech.started") {
        voiceState.suppressReplyAudio = true;
        showCallStatus("Listening");
        stopManagedPlayback();
      } else {
        voiceState.suppressReplyAudio = false;
        showCallStatus("Preparing response");
      }
    } else if (event.type === "transcript.agent") {
      var isGreeting = voiceState.greeting &&
        String(event.text || "").trim().toLowerCase() === voiceState.greeting.trim().toLowerCase();
      voiceState.greeting = "";
      // All managed non-greeting replies must be backed by VERA's tool.
      // Ignore unpaired provider transcripts so text that was not the final
      // spoken business response cannot appear as a ghost chat bubble.
      if (!isGreeting && event.text && voiceState.lastToolResult) {
        var msg = addMessage("assistant", voiceState.lastToolResult.answer);
        if (voiceState.lastToolResult.grounded === false) {
          msg.appendChild(el("div", { class: "hint", text: "No matching info found" }));
        }
        voiceState.lastToolResult = null;
      }
    } else if (event.type === "reply.done") {
      voiceState.lastTurnEvent = event.type;
      if (event.status === "interrupted") {
        voiceState.interruptions += 1;
        voiceState.suppressReplyAudio = true;
        stopManagedPlayback();
        voiceState.pendingTools = {};
        showCallStatus("Listening");
      } else {
        flushManagedToolsIfIdle();
        showCallStatus("Listening");
      }
    } else if (event.type === "session.error") {
      addError(event.message || "Managed voice session error.");
    }
  }

  function startManagedVoice(bootstrap) {
    voiceState.mode = "managed";
    voiceState.greeting = (bootstrap.session && bootstrap.session.greeting) || "";
    voiceState.playbackContext = new AudioContext();
    voiceState.playbackContext.resume().catch(function () {});
    voiceState.playbackTime = voiceState.playbackContext.currentTime;

    return startMicrophone(MANAGED_SAMPLE_RATE, function (e) {
      if (voiceState.ready && voiceState.ws && voiceState.ws.readyState === WebSocket.OPEN) {
        voiceState.ws.send(JSON.stringify({ type: "input.audio", audio: bytesToBase64(e.data) }));
      }
    }).then(function () {
      return new Promise(function (resolve, reject) {
        var wsUrl = new URL(bootstrap.websocket_url);
        wsUrl.searchParams.set("token", bootstrap.token);
        var ws = new WebSocket(wsUrl);
        var settled = false;
        var timeout = setTimeout(function () {
          if (!settled) reject(new Error("Managed voice timed out"));
        }, 12000);
        voiceState.ws = ws;
        ws.onopen = function () {
          ws.send(JSON.stringify({ type: "session.update", session: bootstrap.session }));
        };
        ws.onmessage = function (e) {
          var event;
          try { event = JSON.parse(e.data); } catch (err) { return; }
          if (event.type === "session.error" && !settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error(event.message || "Managed voice failed"));
            return;
          }
          if (event.type === "session.ready" && !settled) {
            settled = true;
            clearTimeout(timeout);
            voiceState.ready = true;
            voiceState.active = true;
            voiceState.starting = false;
            voiceState.providerSessionId = event.session_id || null;
            powered.textContent = "Powered by AssemblyAI Voice Agent";
            showCallStatus("Listening");
            paintMic();
            resolve();
          }
          handleManagedEvent(event);
        };
        ws.onerror = function () {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error("Managed voice connection failed"));
          } else if (voiceState.active) {
            addError("Managed voice connection error.");
            stopVoice();
          }
        };
        ws.onclose = function () {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error("Managed voice closed during setup"));
          } else if (voiceState.active) stopVoice();
        };
      });
    });
  }

  function startLegacyVoice() {
    var ws = new WebSocket(
      WS_BASE + "/ws/business-voice/widget/" + ASSISTANT_ID + "?session_id=" + encodeURIComponent(sessionId)
    );
    ws.binaryType = "arraybuffer";
    voiceState.ws = ws;
    voiceState.mode = "legacy";

    ws.onopen = function () {
      startMicrophone(LEGACY_SAMPLE_RATE, function (e) {
        if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
      })
        .then(function () {
          voiceState.active = true;
          voiceState.starting = false;
          powered.textContent = "AI assistant";
          showCallStatus("Listening");
          paintMic();
        })
        .catch(function (err) {
          addError(err && err.name === "NotAllowedError" ? "Microphone permission denied." : "Could not start voice.");
          stopVoice();
        });
    };

    ws.onmessage = function (e) {
      var event;
      try { event = JSON.parse(e.data); } catch (err) { return; }
      if (event.type === "transcript.final") {
        showCallStatus("Processing request");
        addMessage("customer", event.text).style.background = themeColor;
      } else if (event.type === "agent.response") {
        showCallStatus("Assistant speaking");
        var m = addMessage("assistant", event.text);
        if (event.grounded === false) {
          m.appendChild(el("div", { class: "hint", text: "No matching info found" }));
        }
        speakText(event.spoken_text || event.text);
      } else if (event.type === "incident.update") {
        activeIncident = event.incident;
        renderIncidentDraft(activeIncident);
      } else if (event.type === "ticket.update") {
        activeIncident = null;
        renderIncidentDraft(null);
      } else if (event.type === "agent.status" && event.status === "idle") {
        showCallStatus("Listening");
      } else if (event.type === "agent.interrupted") {
        window.speechSynthesis && window.speechSynthesis.cancel();
        showCallStatus("Listening");
      } else if (event.type === "speech.started") {
        window.speechSynthesis && window.speechSynthesis.cancel();
        showCallStatus("Listening");
      } else if (event.type === "error") {
        addError(event.message || "Voice session error.");
      }
    };

    ws.onclose = function () { if (voiceState.active) stopVoice(); };
    ws.onerror = function () { addError("Voice connection error."); stopVoice(); };
  }

  function startVoice() {
    if (voiceState.starting || voiceState.active) return;
    voiceState.starting = true;
    showCallStatus("Connecting securely");
    paintMic();
    api("/public/assistants/" + ASSISTANT_ID + "/voice-agent/session", { cache: "no-store" })
      .then(startManagedVoice)
      .catch(function (err) {
        var microphoneError = err && (err.name === "NotAllowedError" || err.name === "NotFoundError");
        stopVoice();
        if (microphoneError) {
          addError(err.name === "NotAllowedError" ? "Microphone permission denied." : "No microphone found.");
          return;
        }
        // Feature disabled, provider unavailable, or account not enabled:
        // reconnect through the original Universal Streaming voice path.
        voiceState.starting = true;
        startLegacyVoice();
      });
  }

  var micBtn = el("button", { title: "Start voice helpdesk", "aria-label": "Start voice helpdesk" });
  micBtn.textContent = "🎤";
  micBtn.style.cssText = "border:none;border-radius:10px;padding:0 12px;font-size:15px;cursor:pointer;background:#f1f5f9;color:#334155;";
  foot.insertBefore(micBtn, input);

  function paintMic() {
    micBtn.textContent = voiceState.active ? "⏹" : "🎤";
    micBtn.setAttribute("aria-label", voiceState.active ? "End voice helpdesk call" : "Start voice helpdesk call");
    micBtn.title = voiceState.active ? "End voice helpdesk call" : "Start voice helpdesk";
    micBtn.style.background = voiceState.active ? "#dc2626" : "#f1f5f9";
    micBtn.style.color = voiceState.active ? "#fff" : "#334155";
  }

  micBtn.addEventListener("click", function () {
    if (voiceState.active) stopVoice();
    else startVoice();
  });

  endCallBtn.addEventListener("click", stopVoice);

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendBtn.disabled = true;
    addMessage("customer", text).style.background = themeColor;
    api("/public/assistants/" + ASSISTANT_ID + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: text }),
    })
      .then(function (result) {
        var m = addMessage("assistant", result.answer);
        if (!result.grounded) {
          m.appendChild(el("div", { class: "hint", text: "No matching info found" }));
        }
        activeIncident = result.incident || null;
        renderIncidentDraft(activeIncident);
      })
      .catch(function (err) {
        addError(err.message || "Could not reach the assistant.");
      })
      .finally(function () {
        sendBtn.disabled = false;
      });
  }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });

  // ------------------------------------------------------------- bootstrap --

  api("/public/assistants/" + ASSISTANT_ID)
    .then(function (config) {
      headTitle.textContent = config.assistant_name;
      themeColor = config.theme_color || themeColor;
      panelSide = config.widget_position === "bottom-left" ? "left" : "right";
      paint();
      addMessage("assistant", config.greeting_message);
    })
    .catch(function (err) {
      console.error("[VERA widget] failed to load assistant config:", err.message);
      launcher.style.display = "none";
    });
})();
