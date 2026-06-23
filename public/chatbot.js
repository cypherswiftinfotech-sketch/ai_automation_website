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

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    injectHTML();

    const chatBtn = document.getElementById('liveavatar-chat-btn');
    const chatWindow = document.getElementById('liveavatar-chat-window');

    chatBtn.addEventListener('click', async () => {
      if (chatWindow.style.display === 'flex') {
        chatWindow.style.display = 'none';
      } else {
        chatWindow.style.display = 'flex';
        // Auto-trigger an initial greeting if chat hasn't started
        if (!chatStarted) {
          chatStarted = true;
          setLoading(true);
          try {
            const result = await askQuery("hello");
            if (result.conversation_id) conversationId = result.conversation_id;
            appendMessage('avatar', result.answer);
          } catch (e) {
             appendMessage('avatar', 'Hello! How can I help you today?');
          } finally {
             setLoading(false);
          }
        }
      }
    });

    document.getElementById('liveavatar-close-btn').addEventListener('click', () => {
      chatWindow.style.display = 'none';
    });

    document.getElementById('liveavatar-send-btn').addEventListener('click', handleSend);
    document.getElementById('liveavatar-chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  });
})();
