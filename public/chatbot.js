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
      <button id="liveavatar-chat-btn" aria-label="Chat with us" title="Chat with us">💬</button>

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
          <strong>AI Assistant</strong>
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
    return apiFetch("/query/ask", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        query: queryText,
        language: "multi",
        conversation_id: conversationId || undefined,
        timezone,
      }),
    });
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
        "liveavatar-message-bubble liveavatar-message-avatar";
      typingMsg.innerText = "Typing...";
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
      if (result.conversation_id) conversationId = result.conversation_id;
      appendMessage("avatar", result.answer);
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

  // Hardcoded intro shown every time the chat is opened.
  const INTRO_MESSAGE =
    "Hello! I'm Avor, a senior AI consultant here to help you explore how we can support your business. I see you've reached out to us today.\n" +
    "We specialise in driving business growth through AI Agent & AI Consultant Development and delivering high-impact AI Automation for Marketing and Sales.\n" +
    "Before we dive into how these technologies can scale your operations, I'd love to learn a bit more about you — what does your company do, and what brings you here today";

  // Always show the hardcoded intro when the chat is opened.
  function triggerGreeting() {
    if (isLoading) return;
    appendMessage("avatar", INTRO_MESSAGE);
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
      if (!isOpen) triggerGreeting();
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
          if (res.conversation_id) conversationId = res.conversation_id;

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
