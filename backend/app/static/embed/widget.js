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
    ".body{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;}" +
    ".msg{max-width:82%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.4;white-space:pre-wrap;}" +
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
    ".draft .actions{display:flex;gap:6px;}" +
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
  var body = el("div", { class: "body" });
  var input = el("input", { placeholder: "Type a message…", maxlength: "2000" });
  var sendBtn = el("button", { text: "Send" });
  var foot = el("div", { class: "foot" }, [input, sendBtn]);
  var powered = el("div", { class: "powered", text: "AI assistant" });

  panel.appendChild(head);
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
  closeBtn.addEventListener("click", function () { togglePanel(false); });

  function addMessage(role, text) {
    var node = el("div", { class: "msg " + role, text: text });
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
    var confirmBtn = el("button", { text: "Confirm & Send" });
    confirmBtn.style.background = themeColor;
    confirmBtn.style.color = "#fff";
    var cancelBtn = el("button", { class: "cancel", text: "Cancel" });

    var draft = el("div", { class: "draft" }, [
      el("label", { text: "To: " + incident.email_draft.to }),
      el("label", { text: "Subject" }),
      subjectInput,
      el("label", { text: "Message" }),
      bodyInput,
      el("div", { class: "actions" }, [confirmBtn, cancelBtn]),
    ]);
    body.appendChild(draft);
    body.scrollTop = body.scrollHeight;

    confirmBtn.addEventListener("click", function () {
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
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });

    cancelBtn.addEventListener("click", function () {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      api(
        "/public/assistants/" + ASSISTANT_ID + "/incidents/" + incident.id + "/cancel?session_id=" + encodeURIComponent(sessionId),
        { method: "POST" }
      )
        .then(function () {
          draft.remove();
          addMessage("assistant", "No problem — the report was cancelled.");
          activeIncident = null;
        })
        .catch(function (err) {
          addError(err.message || "Could not cancel.");
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });
  }

  // -------------------------------------------------------------- voice --
  // Mirrors the free chatbot's voice pipeline (AssemblyAI STT + browser
  // TTS) at a much smaller scope: no map/visual/location events, just
  // speech in -> business_chat text out. Self-contained (no import) since
  // this file runs standalone on a third-party page — the AudioWorklet
  // processor is inlined as a Blob URL instead of a second static file.

  var WS_BASE = API_BASE.replace(/^http/, "ws");
  var SAMPLE_RATE = 16000;

  var MIC_PROCESSOR_SRC =
    "class MicrophoneProcessor extends AudioWorkletProcessor {" +
    "constructor(){super();this._chunkSamples=Math.round(sampleRate*0.1);" +
    "this._buffer=new Int16Array(this._chunkSamples);this._offset=0;}" +
    "process(inputs){var input=inputs[0]&&inputs[0][0];if(!input||!input.length)return true;" +
    "for(var i=0;i<input.length;i++){var s=Math.max(-1,Math.min(1,input[i]));" +
    "this._buffer[this._offset++]=s<0?s*0x8000:s*0x7fff;" +
    "if(this._offset>=this._chunkSamples){this.port.postMessage(this._buffer.buffer,[this._buffer.buffer]);" +
    "this._buffer=new Int16Array(this._chunkSamples);this._offset=0;}}return true;}}" +
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

  var voiceState = { ws: null, audioContext: null, workletNode: null, stream: null, active: false };

  function stopVoice() {
    voiceState.active = false;
    if (voiceState.workletNode) voiceState.workletNode.disconnect();
    if (voiceState.stream) voiceState.stream.getTracks().forEach(function (t) { t.stop(); });
    if (voiceState.audioContext && voiceState.audioContext.state !== "closed") {
      voiceState.audioContext.close().catch(function () {});
    }
    if (voiceState.ws && voiceState.ws.readyState < 2) voiceState.ws.close();
    voiceState.ws = null;
    voiceState.audioContext = null;
    voiceState.workletNode = null;
    voiceState.stream = null;
    window.speechSynthesis && window.speechSynthesis.cancel();
    paintMic();
  }

  function startVoice() {
    var ws = new WebSocket(
      WS_BASE + "/ws/business-voice/widget/" + ASSISTANT_ID + "?session_id=" + encodeURIComponent(sessionId)
    );
    ws.binaryType = "arraybuffer";
    voiceState.ws = ws;

    ws.onopen = function () {
      navigator.mediaDevices
        .getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true } })
        .then(function (stream) {
          voiceState.stream = stream;
          var audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
          voiceState.audioContext = audioContext;
          var blobUrl = URL.createObjectURL(new Blob([MIC_PROCESSOR_SRC], { type: "application/javascript" }));
          return audioContext.audioWorklet.addModule(blobUrl).then(function () {
            var source = audioContext.createMediaStreamSource(stream);
            var worklet = new AudioWorkletNode(audioContext, "microphone-processor");
            voiceState.workletNode = worklet;
            worklet.port.onmessage = function (e) {
              if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
            };
            source.connect(worklet);
            voiceState.active = true;
            paintMic();
          });
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
        addMessage("customer", event.text).style.background = themeColor;
      } else if (event.type === "agent.response") {
        var m = addMessage("assistant", event.text);
        if (event.grounded === false) {
          m.appendChild(el("div", { class: "hint", text: "No matching info found" }));
        }
        speakText(event.text);
      } else if (event.type === "incident.update") {
        activeIncident = event.incident;
        renderIncidentDraft(activeIncident);
      } else if (event.type === "agent.interrupted") {
        window.speechSynthesis && window.speechSynthesis.cancel();
      } else if (event.type === "error") {
        addError(event.message || "Voice session error.");
      }
    };

    ws.onclose = function () { if (voiceState.active) stopVoice(); };
    ws.onerror = function () { addError("Voice connection error."); stopVoice(); };
  }

  var micBtn = el("button", { title: "Speak to the assistant", "aria-label": "Toggle voice" });
  micBtn.textContent = "🎤";
  micBtn.style.cssText = "border:none;border-radius:10px;padding:0 12px;font-size:15px;cursor:pointer;background:#f1f5f9;color:#334155;";
  foot.insertBefore(micBtn, input);

  function paintMic() {
    micBtn.textContent = voiceState.active ? "⏹" : "🎤";
    micBtn.style.background = voiceState.active ? "#dc2626" : "#f1f5f9";
    micBtn.style.color = voiceState.active ? "#fff" : "#334155";
  }

  micBtn.addEventListener("click", function () {
    if (voiceState.active) stopVoice();
    else startVoice();
  });

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