/**
 * Standalone Chatbot Integration (Without Pre-Chat Form)
 */
// chatbot.js v2 — updated API_URL to http://127.0.0.1:8000 and improved error reporting.

(function () {
  const API_URL = "http://127.0.0.1:8000"; // <-- UPDATE THIS TO YOUR BACKEND URL IF NEEDED

  // State
  let conversationId = "";
  let token = ""; // Optional if backend supports anonymous
  let userId = crypto.randomUUID();
  let isLoading = false;
  let greetingShown = false;

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
      <button id="liveavatar-chat-btn">💬 Chat with Us</button>

      <!-- Pre-Chat Lead Form Modal -->
      <div id="liveavatar-form-modal" aria-hidden="true">
        <div id="liveavatar-form-content" role="dialog" aria-modal="true" aria-labelledby="liveavatar-form-title">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
            <h3 id="liveavatar-form-title" style="margin:0 0 8px 0;">Get Your Diagnostic</h3>
            <button id="liveavatar-form-close" type="button" style="border:none;background:transparent;color:#fff;font-size:20px;cursor:pointer;">&times;</button>
          </div>
          <p style="margin:0 0 18px 0;color:#aaa;font-size:0.9rem;">Share your details and we’ll email you the 5-day sales & AI growth diagnostic.</p>
          <div id="liveavatar-form-error" style="color:#ef4444;margin-bottom:16px;display:none;"></div>

          <form id="diagnostic-form" autocomplete="on">
            <div class="liveavatar-form-grid">
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="full-name">Full Name</label>
                <input class="liveavatar-form-input" type="text" id="full-name" required />
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="email">Business Email</label>
                <input class="liveavatar-form-input" type="email" id="email" required />
              </div>

              <div class="liveavatar-form-group full-width">
                <label class="liveavatar-form-label" for="website">Company Website</label>
                <input class="liveavatar-form-input" type="url" id="website" required />
              </div>

              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="company-size">Company Size</label>
                <select class="liveavatar-form-select" id="company-size" required>
                  <option value="startup">Startup (< 20 Reps)</option>
                  <option value="midmarket">Mid-Market (20 - 100 Reps)</option>
                  <option value="enterprise">Enterprise (100+ Reps)</option>
                </select>
              </div>
              <div class="liveavatar-form-group">
                <label class="liveavatar-form-label" for="request-type">Request Type</label>
                <select class="liveavatar-form-select" id="request-type" required>
                  <option value="diagnostic" selected>5-Day AI Growth Diagnostic</option>
                  <option value="strategy">Strategy Blueprint Session</option>
                  <option value="case-study">Full Case Study Request</option>
                  <option value="partnership">Retainer Partnership Discussion</option>
                </select>
              </div>

              <div class="liveavatar-form-group full-width">
                <label class="liveavatar-form-label" for="message">Strategic Context (Optional)</label>
                <textarea class="liveavatar-form-input" id="message" rows="4" placeholder="Briefly describe your existing CRM stack or growth constraints..."></textarea>
              </div>
            </div>

            <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:18px;">
              <div style="font-size:12px;color:#71717a;line-height:1.4;">
                <div>Estimated investment</div>
                <div style="font-weight:800;color:#e4e4e7;margin-top:2px;" id="calc-estimate">$900 / ₹75,000</div>
              </div>
              <div class="liveavatar-form-actions">
                <button id="liveavatar-form-cancel" type="button">Cancel</button>
                <button id="liveavatar-form-submit" type="submit">Submit Request</button>
              </div>
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
    msgDiv.innerText = text;
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

  // Auto-trigger an AI intro the first time the chat is opened in a session.
  async function triggerGreeting() {
    if (greetingShown || isLoading) return;
    greetingShown = true;
    setLoading(true);
    try {
      const result = await askQuery("hello");
      if (result.conversation_id) conversationId = result.conversation_id;
      appendMessage("avatar", result.answer);
    } catch (err) {
      console.error(err);
      appendMessage(
        "avatar",
        "Hi! I'm Avor, your AI consultant avatar at Cypher Swift InfoTech. How can I help you today?",
      );
    } finally {
      setLoading(false);
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

    chatBtn.addEventListener("click", async () => {
      const isOpen = chatWindow.style.display === "flex";
      const next = isOpen ? "none" : "flex";
      chatWindow.dataset.wasVisible = next === "flex" ? "true" : "false";
      chatWindow.style.display = next;
      if (!isOpen) await triggerGreeting();
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

    // Estimate calculator (sync with contact.html logic)
    const pricingSelect = document.getElementById("company-size");
    const pricingResult = document.getElementById("calc-estimate");
    if (pricingSelect && pricingResult) {
      pricingSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "startup") {
          pricingResult.textContent = "$900 / ₹75,000";
        } else if (val === "midmarket") {
          pricingResult.textContent = "$1,800 / ₹1,50,000";
        } else if (val === "enterprise") {
          pricingResult.textContent = "Custom Strategy Pricing";
        }
      });
    }

    // Submit form
    const contactForm = document.getElementById("diagnostic-form");
    if (contactForm) {
      contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "<span>Processing Request...</span>";
        }

        const name = document.getElementById("full-name")?.value || "";
        const email = document.getElementById("email")?.value || "";
        const website = document.getElementById("website")?.value || "";
        const size =
          document.getElementById("company-size")?.value || "startup";
        const type =
          document.getElementById("request-type")?.value || "diagnostic";
        const context = document.getElementById("message")?.value || "";

        try {
          const res = await fetch(`${API_URL}/api/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              email,
              website,
              companySize: size,
              requestType: type,
              strategicContext: context,
            }),
          });

          const result = await res.json().catch(() => ({}));
          if (!res.ok || result?.success === false) {
            const detail =
              result?.message || result?.detail || "Submission failed";
            const errEl = document.getElementById("liveavatar-form-error");
            if (errEl) {
              errEl.textContent = detail;
              errEl.style.display = "block";
            }
            return;
          }

          alert(
            `Thank you for submitting your Diagnostic Request!\n\nOur lead strategist will email you at ${email} within 2 hours to confirm your scheduling. Your request has also been logged securely in our system database.`,
          );
          contactForm.reset();
          setModalOpen(false);
        } catch (err) {
          console.error(err);
          const errEl = document.getElementById("liveavatar-form-error");
          if (errEl) {
            errEl.textContent = "Lead submission failed. Please try again.";
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

    // Intercept all "Get Diagnostic" links so they open the popup form
    // instead of navigating away to contact.html
    document.querySelectorAll('a[href*="type=diagnostic"]').forEach(link => {
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
