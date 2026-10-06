# StudyMate AI - LLM API Integration

This project is an internship assignment demonstrating the integration of the Google Gemini API using Node.js, Express, and Vanilla JavaScript. 

StudyMate AI is a friendly, concise, and beginner-friendly chatbot designed to help students learn programming and AI concepts. It supports a multi-turn conversation memory, context truncation, and robust error handling.

## Features
- **Node.js/Express Backend**: A fast and lightweight API server.
- **Google GenAI Integration**: Uses the official `@google/genai` package to communicate with `gemini-2.5-flash`.
- **In-Memory Conversation Tracking**: Maintains separate message histories for distinct `conversationId`s across the browser session.
- **Context Management**: Employs context truncation to always keep the `SYSTEM_PROMPT` but limits the history to the latest 10 messages (5 user/agent alternations) to manage the token count.
- **Robust Error Handling**: Covers missing API keys, invalid responses, rate limits, and authentication errors with user-friendly frontend banners.
- **Modern UI**: A responsive, vibrant, and accessible chat interface created with Vanilla CSS.

## Tech Stack
- **Backend**: Node.js, Express.js
- **API**: Google Gemini GenAI SDK
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript
- **No Database**: Uses an in-memory `Map` and `localStorage` to manage sessions transparently.

## Project Structure
```text
LLM-API-Integration/
├── .env                 # Secret environment variables (ignored in Git)
├── .env.example         # Example of required environment variables
├── .gitignore           # Git ignored files and directories
├── package.json         # Project metadata and npm scripts
├── server.js            # Node.js Express Backend logic
├── README.md            # Project documentation (You are here)
└── public/
    ├── index.html       # Chat application layout structure
    ├── style.css        # Vibrant and responsive styling
    └── app.js           # Client-side logic and DOM interactions
```

## How to Install

1. Ensure you have Node.js installed (v18+ recommended).
2. Clone this repository or download the source code files.
3. Open a terminal in the root of the project directory.
4. Run `npm install` to download required dependencies (`express`, `dotenv`, `@google/genai`).

## How to create a Gemini API key

1. Visit Google AI Studio at [https://aistudio.google.com/](https://aistudio.google.com/).
2. Sign in with your Google account.
3. On the left navigation pane, click "Get API Key".
4. Click "Create API Key in new project" (or use an existing project).
5. Copy the generated key. **Never share this key publicly.**

## How to configure `.env`

1. Create a file named `.env` in the root folder (`LLM-API-Integration/`).
2. Add your API key inside the `.env` file like this:
   ```env
   GEMINI_API_KEY="your_actual_api_key_here"
   PORT=3000
   ```
   *(Ensure you replace `"your_actual_api_key_here"` with your real key without quotes)*

## How to run

We provide two npm scripts:
- **`npm start`**: Runs the server natively using Node.js.
- **`npm run dev`**: Runs the server in watch mode (requires Node.js v19+ `--watch` flag).

Starts on the port defined in `.env` or defaults to `3000`. Navigate to `http://localhost:3000` to interact with StudyMate AI.

## API Endpoints

### `GET /api/health`
Returns the status of the backend. Used by the frontend to confirm connection.
**Response (200 OK):**
```json
{
  "status": "ok", 
  "message": "Backend is running successfully." 
}
```

### `POST /api/chat`
Sends a message to the Gemini Model.
**Expected Request Body:**
```json
{
  "conversationId": "some-id",
  "message": "Hello"
}
```
**Expected Response (200 OK):**
```json
{
  "conversationId": "some-id",
  "reply": "Hello! How can I help you today?"
}
```

## How conversation memory works
The frontend generates a unique random string called `conversationId` using `Date.now()` and Math routines, stringified and stored in the browser's `localStorage`. 
Every time a message is sent to `/api/chat`, this `conversationId` is included.
The backend maintains a `Map` structure. It looks up the array of historical messages based on the ID. It appends the new instruction from the user, queries the Gemini API with this historical block, and saves Gemini's response back to the array. 

## How context truncation works
Inside `server.js`, the `/api/chat` router intercepts the history block before talking to the Gemini API and routes it through `getContextMessages()`. 
If the message volume grows past `MAX_MESSAGES` (e.g., 10 components), it slices the history array, keeping only the final 10. The `systemInstruction` is provided as part of the configuration properties passed strictly separated from the context to prevent the personality instruction from being eliminated. 

## Error handling
- **Missing API Key:** Tested on startup. Frontend returns a `500 Server configuration error` banner if the key is not defined.
- **Rate Limit:** Triggers upon excessive usage (HTTP 429), yielding a specific user-facing text instruction.
- **Network Extraneous Errors:** The `catch` block catches failures such as the Gemini API being temporarily absent, translating them into `HTTP 500`.

## Security notes
- The project adheres to security best-practices by keeping sensitive credentials in a `.env` file and utilizing an `.env.example` placeholder.
- `.env` relies heavily on `.gitignore` to prevent API keys from leaking online.

## Example conversation for testing
User: `My name is Vivekananda.`
Bot: `Hi Vivekananda! It's great to meet you. How can I help you with your programming or AI studies today?`

User: `I am learning Java.`
Bot: `That's a fantastic choice! Java is a powerful, object-oriented language widely used for enterprise applications and Android development. What specific concepts in Java are you working on right now?`

User: `What is my name?`
Bot: `Your name is Vivekananda.`
