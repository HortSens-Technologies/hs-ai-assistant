# HortSens AI Assistant — Router v8.2

Router v8.2 is the client-side intelligence core behind the HortSens AI Assistant.  
It integrates conversation, multi-engine web search, and an advanced Pure Math Mode into one modular JavaScript system built for speed, clarity, and extensibility.

This repository is intended for active development and contributions. All components are cleanly separated, documented, and written to be modified, extended, or replaced by collaborators.

---

## Live Demo

The production version of the HortSens AI Assistant is available at:

https://www.hortsens.co/hortsensai

---

## Overview

Router v8.2 operates as a unified query router.  
Every user input passes through a deterministic pipeline that selects one of three modes:

- **Search Mode**: Web search, ranking, summarization.
- **Conversation Mode**: Local generative replies via `/api/chat`.
- **Math Mode**: Numerical evaluation, symbolic solving, graphing, and mathematical knowledge modules.

The system is designed for environments where instant response and direct browser execution are required.

---

## Core Features

### 1. Web Search (RRF Model)
- Wikipedia, DuckDuckGo, Google CSE, and optional server search providers.
- Reciprocal Rank Fusion across all available engines.
- Automatic query extraction and summarization.
- Source linking and normalized deduplication.
- Graceful fallback when providers fail.

### 2. Conversation Engine
- Local LLM chat endpoint (`/api/chat`).
- Deterministic system prompt and concise output.
- Greeting, time/date, and quick-intent detection.
- Fully isolated from search and math logic.

### 3. Pure Math Mode
- Flexible equation parsing and solving with automatic normalization.
- Numerical evaluation with expression cleanup and Math.* injection.
- Interactive graphing with:
  - Dynamic scaling
  - Panning
  - Zooming
  - Crosshair and coordinate tooltips
- Symbolic expansion of common algebraic identities.
- Built-in mathematics knowledge base:
  - Derivatives
  - Integrals
  - Trigonometry
  - Exponentials and logarithms
  - Sequences and series
  - Vectors
  - Complex numbers
- Identity sets such as *Identités remarquables*.

### 4. Mode System
- Search, Conversation, and Math modes.
- Persistent user preference via `localStorage`.
- Accessible mode selector with keyboard navigation.
- Router-level mode enforcement.

### 5. Math Keyboard
- Floating, draggable, non-intrusive keyboard.
- Smart cursor injection for functions and symbols.
- Solve / Graph / Calculate actions.
- Minimal footprint and zero external dependencies.

---

## Architecture

Router v8.2 is architected around three layers:

1. **Input Layer**  
   Normalizes user text, handles greetings, quick queries, and preprocessing.

2. **Routing Layer**  
   Determines the appropriate subsystem based on mode, heuristics, and content classification.

3. **Execution Layer**  
   - Math Engine  
   - Search Engine  
   - Local Conversation Engine

Each layer is isolated and can be modified independently.

---

## Project Structure

Although the full engine is shipped in a single script for deployment, contributors will find the internal organization modular:

- `Utils`  
  Normalization, cleaning, URL handling, numeric helpers.

- `Search Providers`  
  Independent functions for each search source.

- `RRF Engine`  
  Standardized scoring and deduplication.

- `Math Engine`  
  Parsing, solving, evaluation, graphing, identity expansion.

- `Conversation Engine`  
  Local API bridge and timeout logic.

- `Mode Manager`  
  Mode persistence and UI switching.

- `UI Helpers`  
  Bubble rendering, keyboard logic, scroll management.

---

## Contribution Guidelines

HortSens encourages active collaboration.  
When contributing:

1. Keep logic modular.  
   Avoid adding tightly coupled blocks.  
2. Prefer pure functions.  
3. Ensure that added features degrade gracefully when components fail.  
4. Maintain the code style:  
   - Clear naming  
   - Minimal abstraction  
   - Zero unnecessary dependencies  
5. Submit pull requests with clear explanations and test cases when applicable.

Future contributors may extend the math engine, add new search integrations, improve conversation heuristics, or refactor modules for better maintainability.

---

## Requirements

Backend endpoints expected by this front-end:

- `POST /api/chat`  
  Input: JSON with `system` and `prompt`  
  Output: `{ reply: string }`

- Optional:  
  `/api/search/google`  
  `/api/search/bing`  
  `/api/search/brave`  
  `/api/search/serpapi`

These endpoints may be replaced, extended, or adapted depending on deployment needs.

---

## Installation

1. Clone the repository.  
2. Integrate the script into your HTML page.  
3. Ensure backend endpoints are reachable.  
4. Open in any modern browser.  

No build process is required.

---

## License

MIT License.  
See `LICENSE` for full terms.

---

## Project Status

Router v8.2 is under active development.  
Contributors are welcome to improve individual modules or propose new capabilities aligned with the design principles of clarity, reliability, and forward compatibility.

