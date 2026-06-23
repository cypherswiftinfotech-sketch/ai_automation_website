/**
 * Standalone Chatbot Integration (Without Pre-Chat Form)
 */

(function() {
  const API_URL = "http://localhost:8002"; // <-- UPDATE THIS TO YOUR BACKEND URL IF NEEDED

  // State
  let conversationId = "";
  let token = ""; // Optional if backend supports anonymous
  let userId = crypto.randomUUID();
  let isLoading = false;
  let chatStarted = false;

  // --- HTML Structure Injection ---
  function injectHTML() {
    // Inject CSS
    if (!document.querySelector('link[href="chatbot.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'chatbot.css';
      document.head.appendChild(link);
    }

    const container = document.createElement('div');
    container.innerHTML = `
      <!-- Floating Button -->
      <button id="liveavatar-chat-btn">💬 Chat with Us</button>

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

      <!-- Pre-Chat Lead Form Modal -->
      <div id="liveavatar-form-modal">
        <div id="liveavatar-form-content">
          <h3>Before we begin...</h3>
          <p>Please tell us a bit about yourself to get the best diagnostic.</p>
          <div id="liveavatar-form-error"></div>

          <div class="liveavatar-form-grid">
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Name *</label>
              <input type="text" id="lf-name" class="liveavatar-form-input" required />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Business Mail *</label>
              <input type="email" id="lf-email" class="liveavatar-form-input" required />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Calling/WhatsApp Number</label>
              <input type="text" id="lf-phone" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Company Name</label>
              <input type="text" id="lf-company" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Role/Designation</label>
              <input type="text" id="lf-role" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Company Website</label>
              <input type="text" id="lf-website" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Location</label>
              <input type="text" id="lf-location" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Number of Employees</label>
              <input type="text" id="lf-employees" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Budget Range</label>
              <input type="text" id="lf-budget" class="liveavatar-form-input" />
            </div>
            <div class="liveavatar-form-group">
              <label class="liveavatar-form-label">Industry Type</label>
              <select id="lf-industry" class="liveavatar-form-select">
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
              </select>
            </div>
            <div class="liveavatar-form-group full-width">
              <label class="liveavatar-form-label">Service Requirement</label>
              <select id="lf-service" class="liveavatar-form-select">
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
              </select>
            </div>
            <div class="liveavatar-form-group full-width">
              <label class="liveavatar-form-label">Expected Timeline</label>
              <select id="lf-timeline" class="liveavatar-form-select">
                <option value="">Select...</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 1 Month">Within 1 Month</option>
                <option value="Within 3 Months">Within 3 Months</option>
                <option value="Planning Stage">Planning Stage</option>
              </select>
            </div>
          </div>
          
          <div class="liveavatar-form-actions">
            <button id="liveavatar-form-cancel">Cancel</button>
            <button id="liveavatar-form-submit">Submit & Start Chat</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  }

  // --- API Functions ---
  async function apiFetch(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function askQuery(queryText) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return apiFetch('/query/ask', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        query: queryText,
        language: "multi",
        conversation_id: conversationId || undefined,
        timezone
      })
    });
  }

  // --- UI Helpers ---
  function appendMessage(role, text) {
    const list = document.getElementById('liveavatar-message-list');
    const msgDiv = document.createElement('div');
    msgDiv.className = `liveavatar-message-bubble ${role === 'user' ? 'liveavatar-message-user' : 'liveavatar-message-avatar'}`;
    msgDiv.innerText = text;
    list.appendChild(msgDiv);
    list.scrollTop = list.scrollHeight;
  }

  function setLoading(state) {
    isLoading = state;
    document.getElementById('liveavatar-send-btn').disabled = state;
    if (state) {
      const typingMsg = document.createElement('div');
      typingMsg.id = "liveavatar-typing";
      typingMsg.className = "liveavatar-message-bubble liveavatar-message-avatar";
      typingMsg.innerText = "Typing...";
      document.getElementById('liveavatar-message-list').appendChild(typingMsg);
    } else {
      const typingMsg = document.getElementById('liveavatar-typing');
      if (typingMsg) typingMsg.remove();
    }
  }

  // --- Event Handlers ---
  async function handleSend() {
    const input = document.getElementById('liveavatar-chat-input');
    const text = input.value.trim();
    if (!text || isLoading) return;
    
    input.value = '';
    appendMessage('user', text);
    setLoading(true);

    try {
      const result = await askQuery(text);
      if (result.conversation_id) conversationId = result.conversation_id;
      appendMessage('avatar', result.answer);
    } catch (err) {
      console.error(err);
      appendMessage('avatar', "Sorry, I encountered an error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Modal & Lead Form Logic ---
  const modal = document.getElementById('liveavatar-form-modal');
  const errorDiv = document.getElementById('liveavatar-form-error');

  function openPreChatForm() {
    if (chatStarted) {
      // If chat already started, just open chat window
      document.getElementById('liveavatar-chat-window').style.display = 'flex';
      return;
    }
    const modal = document.getElementById('liveavatar-form-modal');
    modal.style.display = 'flex';
  }

  function closePreChatForm() {
    document.getElementById('liveavatar-form-modal').style.display = 'none';
  }

  async function handleFormSubmit() {
    const name = document.getElementById('lf-name').value.trim();
    const email = document.getElementById('lf-email').value.trim();

    if (!name || !email) {
      errorDiv.innerText = "Name and Business Mail are required.";
      errorDiv.style.display = "block";
      return;
    }

    const preChatData = {
      name,
      email,
      phone: document.getElementById('lf-phone').value.trim(),
      company_name: document.getElementById('lf-company').value.trim(),
      role: document.getElementById('lf-role').value.trim(),
      company_website: document.getElementById('lf-website').value.trim(),
      location: document.getElementById('lf-location').value.trim(),
      num_employees: document.getElementById('lf-employees').value.trim(),
      budget_range: document.getElementById('lf-budget').value.trim(),
      industry_type: document.getElementById('lf-industry').value,
      service_requirement: document.getElementById('lf-service').value,
      expected_timeline: document.getElementById('lf-timeline').value,
    };

    const submitBtn = document.getElementById('liveavatar-form-submit');
    submitBtn.innerText = "Submitting...";
    submitBtn.disabled = true;
    errorDiv.style.display = "none";

    try {
      // Initialize Session
      const res = await apiFetch('/query/init', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          language: "en",
          pre_chat_data: preChatData
        })
      });
      if (res.conversation_id) conversationId = res.conversation_id;

      // Close modal and open chat
      closePreChatForm();
      const chatWindow = document.getElementById('liveavatar-chat-window');
      chatWindow.style.display = 'flex';
      
      chatStarted = true;
      setLoading(true);
      
      // Auto trigger greeting
      const result = await askQuery("hello");
      appendMessage('avatar', result.answer);
    } catch (err) {
      errorDiv.innerText = err.message || "Failed to submit form.";
      errorDiv.style.display = "block";
    } finally {
      submitBtn.innerText = "Submit & Start Chat";
      submitBtn.disabled = false;
      setLoading(false);
    }
  }

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    injectHTML();

    const chatBtn = document.getElementById('liveavatar-chat-btn');
    const chatWindow = document.getElementById('liveavatar-chat-window');

    chatBtn.addEventListener('click', async () => {
      if (chatWindow.style.display === 'flex') {
        chatWindow.style.display = 'none';
      } else {
        // If they click the chat bubble and haven't started, open form instead
        openPreChatForm();
      }
    });

    document.getElementById('liveavatar-close-btn').addEventListener('click', () => {
      chatWindow.style.display = 'none';
    });

    document.getElementById('liveavatar-send-btn').addEventListener('click', handleSend);
    document.getElementById('liveavatar-chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    // Form Event Listeners
    document.getElementById('liveavatar-form-cancel').addEventListener('click', closePreChatForm);
    document.getElementById('liveavatar-form-submit').addEventListener('click', handleFormSubmit);

    // Intercept 'Get Diagnostic' links to open modal
    document.querySelectorAll('a[href*="diagnostic"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openPreChatForm();
      });
    });
  });
})();
