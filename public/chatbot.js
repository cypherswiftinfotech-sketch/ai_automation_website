/**
 * Standalone Chatbot Integration (Without Pre-Chat Form)
 */
// chatbot.js v2 — updated API_URL to http://127.0.0.1:8000 and improved error reporting.

(function () {
  const API_URL = "http://127.0.0.1:8000"; // <-- UPDATE THIS TO YOUR BACKEND URL IF NEEDED

  // HeyGen avatar used for the floating chat button icon.
  const DEFAULT_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

  // State
  let conversationId = "";
  let token = ""; // Optional if backend supports anonymous
  let userId = crypto.randomUUID();
  let isLoading = false;

  // --- HTML Structure Injection ---
  function injectHTML() {
    // Inject CSS
    if (!document.querySelector('link[href="chatbot.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "chatbot.css";
      document.head.appendChild(link);
    }

    const container = document.createElement("div");
    container.innerHTML = `
      <!-- Floating Button -->
      <button id="liveavatar-chat-btn" aria-label="Chat with us" title="Chat with us">
        <svg class="liveavatar-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <!-- Antennae -->
          <line x1="8" y1="3" x2="8" y2="6"/>
          <line x1="16" y1="3" x2="16" y2="6"/>
          <circle cx="8" cy="2.5" r="0.7" fill="currentColor" stroke="none"/>
          <circle cx="16" cy="2.5" r="0.7" fill="currentColor" stroke="none"/>
          <!-- Bot head -->
          <rect x="4" y="6" width="16" height="13" rx="3"/>
          <!-- Eyes -->
          <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/>
          <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/>
          <!-- Mouth / display -->
          <line x1="9.5" y1="16" x2="14.5" y2="16"/>
          <!-- Side ears -->
          <line x1="3" y1="11" x2="4" y2="11"/>
          <line x1="20" y1="11" x2="21" y2="11"/>
          <line x1="3" y1="14" x2="4" y2="14"/>
          <line x1="20" y1="14" x2="21" y2="14"/>
        </svg>
      </button>

      <!-- Pre-Chat Lead Form Modal -->
      <div id="liveavatar-form-modal" aria-hidden="true">
        <div id="liveavatar-form-content" role="dialog" aria-modal="true" aria-labelledby="liveavatar-form-title">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
            <h3 id="liveavatar-form-title" style="margin:0 0 8px 0;">Request a Business Diagnostic</h3>
            <button id="liveavatar-form-close" type="button" style="border:none;background:transparent;color:#fff;font-size:20px;cursor:pointer;">&times;</button>
          </div>
          <p style="margin:0 0 18px 0;color:#aaa;font-size:0.9rem;">Tell us a bit about your organization and our team will follow up with a tailored diagnostic.</p>
          <div id="liveavatar-form-error" style="color:#ef4444;margin-bottom:16px;display:none;"></div>

          <form id="diagnostic-form" autocomplete="on">
            <div class="liveavatar-form-grid">
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-name">Name *</label>
                <input class="liveavatar-form-input" type="text" id="lf-name" required />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-email">Business Mail *</label>
                <input class="liveavatar-form-input" type="email" id="lf-email" required />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-phone">Calling/WhatsApp Number</label>
                <input class="liveavatar-form-input" type="text" id="lf-phone" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-company">Company Name</label>
                <input class="liveavatar-form-input" type="text" id="lf-company" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-role">Role/Designation</label>
                <input class="liveavatar-form-input" type="text" id="lf-role" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-website">Company Website</label>
                <input class="liveavatar-form-input" type="text" id="lf-website" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-location">Location</label>
                <input class="liveavatar-form-input" type="text" id="lf-location" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-employees">Number of Employees</label>
                <input class="liveavatar-form-input" type="text" id="lf-employees" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-budget">Budget Range</label>
                <input class="liveavatar-form-input" type="text" id="lf-budget" />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="lf-industry">Industry Type</label>
                <select class="liveavatar-form-select" id="lf-industry">
                  <option value="">Select...</option>
                  <option value="AI Agent Development">AI Agent Development</option>
                  <option value="SaaS Product Development">SaaS Product Development</option>
                  <option value="Website / Application Development">Website / Application Development</option>
                  <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                </select>
              </div>
              <div class="liveavatar-form-group full-width">
                <label class="liveavatar-form-label" for="lf-service">Service Requirement</label>
                <select class="liveavatar-form-select" id="lf-service">
                  <option value="">Select...</option>
                  <option value="AI Agent Development">AI Agent Development</option>
                  <option value="SaaS Product Development">SaaS Product Development</option>
                  <option value="Website / Application Development">Website / Application Development</option>
                  <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                </select>
              </div>
              <div class="liveavatar-form-group full-width">
                <label class="liveavatar-form-label" for="lf-timeline">Expected Timeline</label>
                <select class="liveavatar-form-select" id="lf-timeline">
                  <option value="">Select...</option>
                  <option value="Immediately">Immediately</option>
                  <option value="Within 1 Month">Within 1 Month</option>
                  <option value="Within 3 Months">Within 3 Months</option>
                  <option value="Planning Stage">Planning Stage</option>
                </select>
              </div>
            </div>

            <div class="liveavatar-form-actions" style="margin-top:20px;">
              <button id="liveavatar-form-cancel" type="button">Cancel</button>
              <button id="liveavatar-form-submit" type="submit">Submit &amp; Request Diagnostic</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Chat Window -->
      <div id="liveavatar-chat-window">
        <div id="liveavatar-chat-header">
          <strong>Avor AI Assistant by CypherSwift</strong>
          <button id="liveavatar-close-btn">&times;</button>
        </div>
        <div id="liveavatar-message-list"></div>
        <div id="liveavatar-input-area">
          <input type="text" id="liveavatar-chat-input" placeholder="Type your message..." />
          <button id="liveavatar-send-btn">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  }

  // --- API Functions ---
  async function apiFetch(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url = `${API_URL}${endpoint}`;
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (networkErr) {
      throw new Error(
        `Network error contacting ${url} — is the backend running on ${API_URL}? (${networkErr.message})`,
      );
    }
    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch (_) {}
      throw new Error(
        `Backend ${res.status} at ${url}: ${body || res.statusText}`,
      );
    }
    return res.json();
  }

  async function askQuery(queryText) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const res = await apiFetch("/query/ask", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        query: queryText,
        language: "multi",
        conversation_id: conversationId || undefined,
        timezone,
      }),
    });
    // Normalise the field name to `ui_action` regardless of whether the
    // backend returns `ui_action` directly or wrapped under `data`.
    const payload = (res && res.ui_action !== undefined)
      ? res
      : (res && res.data && res.data.ui_action !== undefined)
        ? res.data
        : res;
    return Object.assign({}, payload, { ui_action: payload.ui_action || null });
  }

  // --- UI Helpers ---
  function appendMessage(role, text) {
    const list = document.getElementById("liveavatar-message-list");
    const msgDiv = document.createElement("div");
    msgDiv.className = `liveavatar-message-bubble ${role === "user" ? "liveavatar-message-user" : "liveavatar-message-avatar"}`;
    // Split on newlines so multi-paragraph messages render as separate lines.
    text.split("\n").forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      msgDiv.appendChild(p);
    });
    list.appendChild(msgDiv);
    list.scrollTop = list.scrollHeight;
  }

  function setLoading(state) {
    isLoading = state;
    document.getElementById("liveavatar-send-btn").disabled = state;
    if (state) {
      const typingMsg = document.createElement("div");
      typingMsg.id = "liveavatar-typing";
      typingMsg.className =
        "liveavatar-message-bubble liveavatar-message-avatar liveavatar-typing-bubble";
      // Three dots wave up/down so it reads as an animated "typing…" indicator.
      typingMsg.innerHTML =
        '<span class="liveavatar-typing-dot"></span>' +
        '<span class="liveavatar-typing-dot"></span>' +
        '<span class="liveavatar-typing-dot"></span>';
      document.getElementById("liveavatar-message-list").appendChild(typingMsg);
    } else {
      const typingMsg = document.getElementById("liveavatar-typing");
      if (typingMsg) typingMsg.remove();
    }
  }

  // --- Event Handlers ---
  async function handleSend() {
    const input = document.getElementById("liveavatar-chat-input");
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = "";
    appendMessage("user", text);
    setLoading(true);

    try {
      const result = await askQuery(text);
      if (result.conversation_id) {
        conversationId = result.conversation_id;
        capturedLead.conversation_id = conversationId;
      }
      // Refresh captured info (name/email/etc.) before rendering so the
      // booking card has the freshest data the LLM has extracted.
      refreshCapturedLead();
      renderAssistantTurn(result);
    } catch (err) {
      console.error(err);
      appendMessage(
        "avatar",
        "Sorry, I encountered an error. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Inspect a backend reply and render the right combination of
  // plain-text answer + structured UI component.
  function renderAssistantTurn(result) {
    if (result.answer) appendMessage("avatar", result.answer);
    const action = result && result.ui_action;
    if (!action) return;

    if (action.type === "show_slots" && Array.isArray(action.slots) && action.slots.length) {
      appendSlotPicker(action.slots);
      return;
    }

    if (action.type === "propose_oral_booking" && action.slot) {
      appendBookingConfirmationCard(action.slot, action.message || result.answer);
      return;
    }

    if (action.type === "escalation_pending") {
      appendMessage(
        "avatar",
        action.message ||
          "Thanks — I've notified the CypherSwift team. They'll reach out to you shortly."
      );
      return;
    }
  }

  // Render the slot picker as a vertical list of clickable cards.
  function appendSlotPicker(slots) {
    const list = document.getElementById("liveavatar-message-list");
    const wrapper = document.createElement("div");
    wrapper.className = "liveavatar-message-bubble liveavatar-message-avatar";
    wrapper.style.maxWidth = "92%";

    const intro = document.createElement("p");
    intro.textContent = "Pick a time that works for you:";
    intro.style.margin = "0 0 8px 0";
    wrapper.appendChild(intro);

    const slotList = document.createElement("div");
    slotList.className = "liveavatar-slot-list";

    slots.forEach((slot) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "liveavatar-slot-card";
      const label = document.createElement("strong");
      label.textContent = slot.label || slot.start || "Available slot";
      const sub = document.createElement("span");
      sub.textContent = slot.timezone || "";
      btn.appendChild(label);
      btn.appendChild(sub);
      btn.addEventListener("click", () => {
        // Lock all slot cards so the user can't double-pick.
        slotList.querySelectorAll("button").forEach((b) => {
          b.disabled = true;
          b.style.opacity = "0.5";
          b.style.cursor = "default";
        });
        btn.style.opacity = "1";
        btn.style.borderColor = "rgba(168, 85, 247, 0.9)";
        const input = document.getElementById("liveavatar-chat-input");
        if (input) {
          input.value = `I'd like to book the ${slot.label || slot.start} slot.`;
          handleSend();
        }
      });
      slotList.appendChild(btn);
    });

    wrapper.appendChild(slotList);
    list.appendChild(wrapper);
    list.scrollTop = list.scrollHeight;
  }

  // Render the booking confirmation summary card showing slot details +
  // captured user info, with Confirm / Pick another time buttons.
  function appendBookingConfirmationCard(slot, introText) {
    const list = document.getElementById("liveavatar-message-list");
    const wrapper = document.createElement("div");
    wrapper.className = "liveavatar-message-bubble liveavatar-message-avatar";
    wrapper.style.maxWidth = "92%";
    wrapper.style.padding = "0";
    wrapper.style.background = "transparent";
    wrapper.style.border = "none";

    const card = document.createElement("div");
    card.className = "liveavatar-booking-card";

    const title = document.createElement("h4");
    title.textContent = "Confirm your booking";
    card.appendChild(title);

    if (introText) {
      const intro = document.createElement("p");
      intro.style.margin = "0 0 8px 0";
      intro.style.color = "#cbd5e1";
      intro.textContent = introText;
      card.appendChild(intro);
    }

    // ── Slot section ──
    const slotTitle = document.createElement("div");
    slotTitle.className = "section-title";
    slotTitle.textContent = "Meeting";
    card.appendChild(slotTitle);

    const slotRows = [
      ["When", slot.label || slot.start],
      ["Timezone", slot.timezone || ""],
    ];
    slotRows.forEach(([k, v]) => card.appendChild(buildFieldRow(k, v || "—")));

    // ── Captured info section ──
    const infoTitle = document.createElement("div");
    infoTitle.className = "section-title";
    infoTitle.textContent = "Your details";
    card.appendChild(infoTitle);

    const f = capturedLead.fields || {};
    const infoRows = [
      ["Name", f.name],
      ["Email", f.email],
      ["Phone", f.phone],
      ["Company", f.company_name],
      ["Role", f.role],
      ["Industry", f.industry_type],
      ["Budget", f.budget_range],
      ["Timeline", f.expected_timeline],
    ];
    infoRows.forEach(([k, v]) => card.appendChild(buildFieldRow(k, v)));

    // ── Action buttons ──
    const actions = document.createElement("div");
    actions.className = "booking-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn-confirm";
    confirmBtn.textContent = "Confirm booking";
    confirmBtn.addEventListener("click", () => confirmBooking(slot, confirmBtn, cancelBtn, statusEl));

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-cancel";
    cancelBtn.textContent = "Pick a different time";
    cancelBtn.addEventListener("click", () => {
      const input = document.getElementById("liveavatar-chat-input");
      if (input) {
        input.value = "Show me different times please.";
        handleSend();
      }
    });

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    card.appendChild(actions);

    const statusEl = document.createElement("div");
    statusEl.className = "booking-status";
    card.appendChild(statusEl);

    wrapper.appendChild(card);
    list.appendChild(wrapper);
    list.scrollTop = list.scrollHeight;
  }

  function buildFieldRow(label, value) {
    const row = document.createElement("div");
    row.className = "field-row";
    const l = document.createElement("span");
    l.className = "label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "value";
    if (value && String(value).trim()) {
      v.textContent = value;
    } else {
      v.classList.add("missing");
      v.textContent = "Not captured yet";
    }
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  async function confirmBooking(slot, confirmBtn, cancelBtn, statusEl) {
    if (!conversationId) {
      showBookingStatus(statusEl, "error", "Conversation not initialised yet. Please try again.");
      return;
    }
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    const originalLabel = confirmBtn.textContent;
    confirmBtn.textContent = "Confirming…";

    try {
      const result = await apiFetch("/query/book-meeting", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          slot_id: slot.id,
          slot_start: slot.start,
          slot_end: slot.end,
          timezone: slot.timezone || "UTC",
        }),
      });

      const email = (capturedLead.fields && capturedLead.fields.email) || "your registered email";
      const label = slot.label || slot.start;
      showBookingStatus(
        statusEl,
        "success",
        `Booking confirmed for ${label}. A calendar invite will be emailed to ${email}.`
      );
      // Remove the action buttons — they're done.
      const actions = statusEl.previousElementSibling;
      if (actions && actions.classList.contains("booking-actions")) actions.remove();
    } catch (err) {
      console.error("Booking failed:", err);
      showBookingStatus(
        statusEl,
        "error",
        err.message || "Booking failed. Please try a different time."
      );
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = originalLabel;
    }
  }

  function showBookingStatus(statusEl, kind, message) {
    statusEl.classList.remove("success", "error");
    statusEl.classList.add(kind);
    statusEl.textContent = message;
  }

  // Intro greeting — fired when the chat first opens (and as a soft
  // acknowledgement after the diagnostic form is submitted).
  const INTRO_MESSAGE =
    "Hi, I am Avor, an AI Service Consultant from Cypher Swift InfoTech. I am here to assist you with our AI Automation and SaaS Solutions for Marketing and Sales, as well as AI Agent and AI Consultant Development Services.\n" +
    "Which service would you like to explore today?";

  // The six services the user can pick from, plus an "Other" escape hatch.
  const SERVICE_OPTIONS = [
    "AI Automation & SaaS for Marketing and Sales",
    "SaaS Marketing Services",
    "SaaS Sales Services",
    "AI Agent Development",
    "AI Consultant Development",
    "AI Live Avatar Solutions",
    "Other Requirements",
  ];

  // Local cache of the lead's qualified_fields (name/email/etc.) so the
  // booking summary card has something to show. Refreshed after every
  // backend reply and on /query/lead fetches.
  const capturedLead = { conversation_id: "", fields: {} };

  async function refreshCapturedLead() {
    if (!capturedLead.conversation_id) return;
    try {
      const res = await apiFetch(`/query/lead/${encodeURIComponent(capturedLead.conversation_id)}`);
      if (res && res.qualified_fields) {
        capturedLead.fields = res.qualified_fields;
      }
    } catch (err) {
      // Non-fatal — the booking card will just show "not captured" rows.
      console.warn("Could not refresh lead info:", err.message);
    }
  }

  // Append the structured greeting + the row of service chips.
  function showIntro() {
    if (isLoading) return;
    appendMessage("avatar", INTRO_MESSAGE);
    appendServiceChips();
  }

  async function triggerGreeting() {
    showIntro();
  }

  // Render the service chips directly under the intro message.
  function appendServiceChips() {
    const list = document.getElementById("liveavatar-message-list");
    const wrapper = document.createElement("div");
    wrapper.className = "liveavatar-message-bubble liveavatar-message-avatar";
    wrapper.style.maxWidth = "92%";

    const row = document.createElement("div");
    row.className = "liveavatar-chip-row";

    SERVICE_OPTIONS.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "liveavatar-chip";
      btn.textContent = label;
      btn.addEventListener("click", () => onServiceChosen(wrapper, label), { once: true });
      row.appendChild(btn);
    });

    wrapper.appendChild(row);
    list.appendChild(wrapper);
    list.scrollTop = list.scrollHeight;
  }

  // When a chip is clicked: lock the row, mark the chosen chip, and dispatch
  // a synthetic user message that the LLM will see as the first turn.
  function onServiceChosen(wrapper, label) {
    const chips = wrapper.querySelectorAll(".liveavatar-chip");
    chips.forEach((c) => {
      c.disabled = true;
      if (c.textContent !== label) {
        c.style.opacity = "0.45";
      } else {
        c.classList.add("selected");
      }
    });

    const input = document.getElementById("liveavatar-chat-input");
    if (input) {
      input.value = `I'd like to learn about: ${label}`;
      handleSend();
    }
  }

  // Replace the floating chat button's emoji with the HeyGen avatar's
  // preview image. Falls back to the existing emoji if the API key isn't
  // configured or the request fails — the chat must keep working either way.
  async function loadChatButtonAvatar() {
    const btn = document.getElementById("liveavatar-chat-btn");
    if (!btn) return;
    try {
      const res = await apiFetch(`/avatar-preview?avatar_id=${encodeURIComponent(DEFAULT_AVATAR_ID)}`);
      const previewUrl = res && res.data && res.data.preview_url;
      if (!previewUrl) return;
      btn.classList.add("liveavatar-has-image");
      btn.innerHTML = `<img src="${previewUrl}" alt="Chat with Avor" />`;
    } catch (err) {
      console.warn("Avatar preview unavailable, using fallback icon:", err.message);
    }
  }

  // --- Modal Helpers ---
  function setModalOpen(open) {
    const modal = document.getElementById("liveavatar-form-modal");
    if (!modal) return;
    modal.style.display = open ? "flex" : "none";
    modal.setAttribute("aria-hidden", open ? "false" : "true");

    // Close chat when opening modal (prevents overlapping UI)
    const chatWindow = document.getElementById("liveavatar-chat-window");
    if (open && chatWindow) chatWindow.style.display = "none";

    // Restore chat when closing
    if (!open && chatWindow) {
      // If chat was opened before, show it again.
      // Otherwise keep it hidden (display is inline-set by this script).
      const shouldShowChat = chatWindow.dataset.wasVisible === "true";
      chatWindow.style.display = shouldShowChat ? "flex" : "none";
    }
  }

  function isDiagnosticUrlIntent() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("type") === "diagnostic";
    } catch {
      return false;
    }
  }

  function preselectAndOpenModal() {
    // open only if diagnostic intent
    if (!isDiagnosticUrlIntent()) return;
    setModalOpen(true);

    // Preselect request type in case it differs
    const rt = document.getElementById("request-type");
    if (rt) rt.value = "diagnostic";
  }

  // --- Initialization ---
  document.addEventListener("DOMContentLoaded", () => {
    injectHTML();

    const chatBtn = document.getElementById("liveavatar-chat-btn");
    const chatWindow = document.getElementById("liveavatar-chat-window");

    // Load the HeyGen avatar image as the chat button icon.
    loadChatButtonAvatar();

    chatBtn.addEventListener("click", async () => {
      const isOpen = chatWindow.style.display === "flex";
      const next = isOpen ? "none" : "flex";
      chatWindow.dataset.wasVisible = next === "flex" ? "true" : "false";
      chatWindow.style.display = next;
      // On first open: ensure a server-side conversation exists, then show
      // the Avor intro + service chips.
      if (!isOpen) {
        try {
          if (!conversationId) {
            const initRes = await apiFetch("/query/init", {
              method: "POST",
              body: JSON.stringify({
                user_id: userId,
                language: "en",
                pre_chat_data: {},
              }),
            });
            if (initRes && initRes.conversation_id) {
              conversationId = initRes.conversation_id;
              capturedLead.conversation_id = conversationId;
            }
          }
        } catch (err) {
          console.warn("Could not init session before greeting:", err.message);
        }
        await triggerGreeting();
      }
    });

    document
      .getElementById("liveavatar-close-btn")
      .addEventListener("click", () => {
        chatWindow.style.display = "none";
      });

    // Modal close
    const modalCloseBtn = document.getElementById("liveavatar-form-close");
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", () => setModalOpen(false));
    }

    // Cancel button
    const cancelBtn = document.getElementById("liveavatar-form-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => setModalOpen(false));
    }

    // Submit form — collect lead data and init session via /query/init
    const contactForm = document.getElementById("diagnostic-form");
    if (contactForm) {
      contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("lf-name")?.value.trim() || "";
        const email = document.getElementById("lf-email")?.value.trim() || "";

        if (!name || !email) {
          const errEl = document.getElementById("liveavatar-form-error");
          if (errEl) {
            errEl.textContent = "Name and Business Mail are required.";
            errEl.style.display = "block";
          }
          return;
        }

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "<span>Submitting...</span>";
        }

        const preChatData = {
          name,
          email,
          phone: document.getElementById("lf-phone")?.value.trim() || "",
          company_name: document.getElementById("lf-company")?.value.trim() || "",
          role: document.getElementById("lf-role")?.value.trim() || "",
          company_website: document.getElementById("lf-website")?.value.trim() || "",
          location: document.getElementById("lf-location")?.value.trim() || "",
          num_employees: document.getElementById("lf-employees")?.value.trim() || "",
          budget_range: document.getElementById("lf-budget")?.value.trim() || "",
          industry_type: document.getElementById("lf-industry")?.value || "",
          service_requirement: document.getElementById("lf-service")?.value || "",
          expected_timeline: document.getElementById("lf-timeline")?.value || "",
        };

        const errEl = document.getElementById("liveavatar-form-error");
        if (errEl) errEl.style.display = "none";

        try {
          // Initialize session with lead data
          const res = await apiFetch("/query/init", {
            method: "POST",
            body: JSON.stringify({
              user_id: userId,
              language: "en",
              pre_chat_data: preChatData,
            }),
          });
          if (res.conversation_id) {
            conversationId = res.conversation_id;
            capturedLead.conversation_id = conversationId;
          }
          // Seed the local cache from the form so the booking summary card
          // has data ready before the first server refresh completes.
          capturedLead.fields = {
            name: preChatData.name,
            email: preChatData.email,
            phone: preChatData.phone,
            company_name: preChatData.company_name,
            role: preChatData.role,
            industry_type: preChatData.industry_type,
            budget_range: preChatData.budget_range,
            expected_timeline: preChatData.expected_timeline,
          };

          // Close form and open chat
          contactForm.reset();
          setModalOpen(false);
          const chatWindow = document.getElementById("liveavatar-chat-window");
          chatWindow.dataset.wasVisible = "true";
          chatWindow.style.display = "flex";

          // Auto-trigger greeting
          await triggerGreeting();
        } catch (err) {
          console.error(err);
          if (errEl) {
            errEl.textContent = err.message || "Submission failed. Please try again.";
            errEl.style.display = "block";
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }
      });
    }

    // Only open modal when landing page asks for diagnostic intent.
    preselectAndOpenModal();

    // Intercept ONLY the header "Get Diagnostic" CTA so it opens the popup
    // form instead of navigating to contact.html. Other diagnostic links on
    // the page (e.g. in-page hero CTAs) keep their normal navigation.
    document.querySelectorAll('.nav-cta a[href*="type=diagnostic"]').forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        setModalOpen(true);
        const rt = document.getElementById("request-type");
        if (rt) rt.value = "diagnostic";
      });
    });

    document
      .getElementById("liveavatar-send-btn")
      .addEventListener("click", handleSend);
    document
      .getElementById("liveavatar-chat-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSend();
      });
  });
})();
