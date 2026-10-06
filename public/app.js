document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatContainer = document.getElementById('chatContainer');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn'); // Delete All
    const newChatBtn = document.getElementById('newChatBtn');
    const historyList = document.getElementById('historyList');
    const errorBanner = document.getElementById('errorBanner');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');

    // State Variables
    let chats = JSON.parse(localStorage.getItem('studymate_chats')) || {};
    let conversationId = initializeConversationId();
    let isWaitingForResponse = false;

    // Initialize App
    checkBackendHealth();
    renderHistoryList();
    loadConversation(conversationId);

    // Event Listeners
    chatForm.addEventListener('submit', handleSend);
    clearBtn.addEventListener('click', deleteAllHistory);
    newChatBtn.addEventListener('click', createNewChat);

    /**
     * Initializes or retrieves the current active conversation ID from localStorage.
     * Ensures the chat object exists in our local store.
     */
    function initializeConversationId() {
        let id = localStorage.getItem('studymate_active_id');

        // If no active ID, or the active ID isn't in our chats dictionary, create a new one
        if (!id || !chats[id]) {
            id = generateNewId();
            createNewChatObject(id);
            localStorage.setItem('studymate_active_id', id);
        }
        return id;
    }

    function generateNewId() {
        return 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    }

    function createNewChatObject(id) {
        chats[id] = {
            id: id,
            title: 'New Chat',
            messages: [],
            updatedAt: Date.now()
        };
        saveChatsLocally();
    }

    /**
     * Creates a fresh new chat session
     */
    function createNewChat() {
        if (isWaitingForResponse) return;

        conversationId = generateNewId();
        createNewChatObject(conversationId);
        localStorage.setItem('studymate_active_id', conversationId);

        loadConversation(conversationId);
        renderHistoryList();

        if (window.innerWidth > 768) {
            messageInput.focus();
        }
    }

    /**
     * Renders the sidebar history list
     */
    function renderHistoryList() {
        historyList.innerHTML = '';

        // Convert to array and sort by updatedAt descending
        const chatArray = Object.values(chats).sort((a, b) => b.updatedAt - a.updatedAt);

        chatArray.forEach(chat => {
            const li = document.createElement('li');
            li.className = `history-item ${chat.id === conversationId ? 'active' : ''}`;
            li.textContent = chat.title || 'New Chat';
            li.title = chat.title || 'New Chat';

            li.addEventListener('click', () => {
                if (isWaitingForResponse || chat.id === conversationId) return;
                conversationId = chat.id;
                localStorage.setItem('studymate_active_id', conversationId);
                loadConversation(conversationId);
                renderHistoryList(); // Re-render to update 'active' class
            });

            historyList.appendChild(li);
        });
    }

    /**
     * Loads a specific conversation into the view
     */
    function loadConversation(id) {
        chatContainer.innerHTML = ''; // Clear current view
        hideError();

        const chat = chats[id];
        if (!chat || chat.messages.length === 0) {
            // Show welcome message if empty
            chatContainer.innerHTML = `
                <div class="message assistant-message">
                    <div class="bubble">
                        Hi! I'm StudyMate AI. I'm here to help you learn programming and AI concepts. How can I help you today?
                    </div>
                </div>
            `;
            return;
        }

        // Render history
        chat.messages.forEach(msg => {
            renderMessage(msg.role, msg.text);
        });

        scrollToBottom();
    }

    /**
     * Saves the `chats` dictionary to localStorage
     */
    function saveChatsLocally(updateCurrentTime = false) {
        if (updateCurrentTime && chats[conversationId]) {
            chats[conversationId].updatedAt = Date.now();
        }
        localStorage.setItem('studymate_chats', JSON.stringify(chats));
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

        hideError();

        // 1. Save and Render User Message
        const chat = chats[conversationId];

        // Update Title if this is the first message
        if (chat.messages.length === 0) {
            chat.title = messageText.length > 25 ? messageText.substring(0, 25) + '...' : messageText;
        }

        chat.messages.push({ role: 'user', text: messageText });
        saveChatsLocally(true);
        renderHistoryList();

        renderMessage('user', messageText);

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: conversationId,
                    message: messageText
                })
            });

            const data = await response.json();

            // 4. Remove loading indicator
            removeElement(loadingId);

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get response from server.');
            }

            // 5. Save and Render Assistant Reply
            chat.messages.push({ role: 'assistant', text: data.reply });
            saveChatsLocally(true);
            renderMessage('assistant', data.reply);

            // Bring this chat back to the top of the history list
            renderHistoryList();

        } catch (error) {
            removeElement(loadingId);
            showError(error.message);
            // Optionally, remove the user message if it failed, but usually it's good to keep it so they can read what they typed
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
     * Clears all local conversation history.
     */
    function deleteAllHistory() {
        if (!confirm('Are you sure you want to permanently delete ALL chat history?')) return;

        localStorage.removeItem('studymate_chats');
        localStorage.removeItem('studymate_active_id');

        chats = {};
        conversationId = initializeConversationId();

        renderHistoryList();
        loadConversation(conversationId);
        hideError();
    }

    /**
     * Appends a message to the chat container.
     */
    function renderMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}-message`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'bubble';

        let formattedText = escapeHTML(text)
            .replace(/\n/g, '<br>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        bubbleDiv.innerHTML = formattedText;
        msgDiv.appendChild(bubbleDiv);

        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    }

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

    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function showError(message) {
        errorBanner.textContent = message;
        errorBanner.classList.remove('hidden');
    }

    function hideError() {
        errorBanner.classList.add('hidden');
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
