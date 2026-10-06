import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup ES module directory variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for conversations
// Structure: Map<conversationId, Array<{ role: 'user' | 'model', parts: [{ text: string }] }>>
const conversations = new Map();

// Initialize Gemini API client
// It automatically picks up GEMINI_API_KEY from environment variables if not passed explicitly
let ai;
try {
  if (process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } else {
     console.warn("WARNING: GEMINI_API_KEY is missing in .env file.");
  }
} catch (error) {
  console.error("Failed to initialize Google GenAI SDK:", error.message);
}

// System prompt defining StudyMate AI's personality
const SYSTEM_PROMPT = `You are StudyMate AI, a friendly, concise, and beginner-friendly chatbot designed to help students learn programming and AI.
- Explain concepts clearly and simply using analogies when helpful.
- Provide small, understandable code snippets when appropriate.
- Be encouraging and supportive.
- Do not behave like a generic default assistant.
- Always retain your identity as StudyMate AI.`;

/**
 * Truncates and formats the conversation history before sending it to the API.
 * Ensures the system prompt is always present and keeps only the latest 10 messages.
 * 
 * @param {Array} history - The raw conversation history mapped to this conversationId
 * @returns {Object} Context messages and system instruction for the Gemini API
 */
function getContextMessages(history) {
    // Keep only the latest 10 messages
    // Since history contains user and model alternates, keeping the last 10 messages means 5 turns.
    const MAX_MESSAGES = 10;
    const truncatedHistory = history.length > MAX_MESSAGES 
        ? history.slice(history.length - MAX_MESSAGES) 
        : history;
    
    return {
        contents: truncatedHistory,
        systemInstruction: SYSTEM_PROMPT
    };
}

// Routes
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Backend is running successfully.' });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { conversationId, message } = req.body;

        // Input validation
        if (!conversationId) {
            return res.status(400).json({ error: 'conversationId is required.' });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'message cannot be empty.' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ error: 'message is too long (limit: 2000 characters).' });
        }

        // Check if API key is configured
        if (!ai) {
             return res.status(500).json({ error: 'Server configuration error: Gemini API key is missing.' });
        }

        // Retrieve or initialize conversation history
        let history = conversations.get(conversationId);
        if (!history) {
            history = [];
            conversations.set(conversationId, history);
        }

        // Add user message to history
        const userMessage = { role: 'user', parts: [{ text: message }] };
        history.push(userMessage);

        const { contents, systemInstruction } = getContextMessages(history);

        // Call Gemini API
        // For multi-turn with system prompts in @google/genai:
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7
            }
        });

        if (!response.text) {
             throw new Error("Invalid response received from Gemini API");
        }

        const reply = response.text;

        // Save model's response to history
        const modelMessage = { role: 'model', parts: [{ text: reply }] };
        history.push(modelMessage);

        // Optional: Update map again (not strictly necessary since array is referenced)
        conversations.set(conversationId, history);

        res.status(200).json({
            conversationId,
            reply
        });

    } catch (error) {
        console.error('API Error:', error.message);
        
        let statusCode = 500;
        let errorMessage = 'An unexpected error occurred while communicating with the AI.';

        // Handle specific errors based on API response structure if needed
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
             statusCode = 429;
             errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.status === 401 || error.status === 403 || (error.message && error.message.includes('API_KEY_INVALID'))) {
             statusCode = 500;
             errorMessage = 'Authentication Error: Invalid API key configuration.';
        }
        
        res.status(statusCode).json({ error: errorMessage });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
