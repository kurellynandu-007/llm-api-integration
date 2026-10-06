document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatContainer = document.getElementById('chatContainer');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const errorBanner = document.getElementById('errorBanner');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');

    // State
    let conversationId = initializeConversationId();
    let isWaitingForResponse = false;

    // Health check on load
    checkBackendHealth();

    // Event Listeners
    chatForm.addEventListener('submit', handleSend);
    clearBtn.addEventListener('click', clearConversation);

    /**
     * Initializes or retrieves the unique conversation ID from localStorage.
     */
    function initializeConversationId() {
        let id = localStorage.getItem('studymate_conversation_id');
        if (!id) {
            id = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
            localStorage.setItem('studymate_conversation_id', id);
        }
        return id;
    }

    /**
     * Checks if the backend server is running and healthy.
     */
    async function checkBackendHealth() {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                connectionStatus.className = 'status-dot online';
                connectionText.textContent = 'Backend Online';
                return true;
            }
            throw new Error('Backend responded but not healthy');
        } catch (error) {
            connectionStatus.className = 'status-dot offline';
            connectionText.textContent = 'Backend Offline';
            showError('Server connection issue. Please run the backend server.');
            return false;
        }
    }

    /**
     * Handle the form submission to send a message.
     */
    async function handleSend(e) {
        e.preventDefault();

        if (isWaitingForResponse) return;

        const messageText = messageInput.value.trim();
        if (!messageText) return;

        // Clear previous errors
        hideError();

        // 1. Render User Message
        appendMessage('user', messageText);

        // Disable input while waiting
        messageInput.value = '';
        messageInput.disabled = true;
        sendBtn.disabled = true;
        isWaitingForResponse = true;

        // 2. Render Loading Indicator
        const loadingId = appendLoadingIndicator();
        scrollToBottom();

        try {
            // 3. Send request to backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: conversationId,
                    message: messageText
                })
            });

            const data = await response.json();

            // 4. Remove loading indicator
            removeElement(loadingId);

            if (!response.ok) {
                // If the response is not OK, throw error to be caught by catch block
                throw new Error(data.error || 'Failed to get response from server.');
            }

            // 5. Render Assistant Reply
            appendMessage('assistant', data.reply);

        } catch (error) {
            removeElement(loadingId);
            showError(error.message);
            // Optionally could add a "failed" message bubble here, but an error banner is cleaner
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            sendBtn.disabled = false;
            if (window.innerWidth > 768) {
                messageInput.focus();
            }
            isWaitingForResponse = false;
            scrollToBottom();
        }
    }

    /**
     * Clears the current conversation history locally and generates a new ID.
     */
    function clearConversation() {
        if (!confirm('Are you sure you want to clear this conversation?')) return;

        localStorage.removeItem('studymate_conversation_id');
        conversationId = initializeConversationId();

        // Reset UI with welcome message
        chatContainer.innerHTML = `
            <div class="message assistant-message">
                <div class="bubble">
                    Conversation cleared! Let's start a new topic. How can I help you today?
                </div>
            </div>
        `;
        hideError();
    }

    /**
     * Appends a message to the chat container.
     */
    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}-message`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'bubble';

        // Basic formatting for the text (escape html, handle newlines, very basic code blocks)
        // In a real app, you would use marked.js or similar for full markdown support
        let formattedText = escapeHTML(text)
            .replace(/\n/g, '<br>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>') // codeblocks
            .replace(/`([^`]+)`/g, '<code>$1</code>') // inline code
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // bold

        bubbleDiv.innerHTML = formattedText;
        msgDiv.appendChild(bubbleDiv);

        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    /**
     * Adds a temporary loading animation bubble while waiting for API.
     */
    function appendLoadingIndicator() {
        const id = 'loading-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.id = id;
        msgDiv.className = 'message assistant-message loading-message';

        msgDiv.innerHTML = `
            <div class="bubble">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        chatContainer.appendChild(msgDiv);
        return id;
    }

    /**
     * Removes an element by ID
     */
    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    /**
     * Shows an error message in the banner.
     */
    function showError(message) {
        errorBanner.textContent = message;
        errorBanner.classList.remove('hidden');
    }

    /**
     * Hides the error banner.
     */
    function hideError() {
        errorBanner.classList.add('hidden');
    }

    /**
     * Scrolls the chat to the bottom.
     */
    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /**
     * Escape HTML function to prevent XSS from user/bot messages visually
     */
    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
