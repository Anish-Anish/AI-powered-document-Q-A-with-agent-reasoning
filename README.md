# AI-powered Document Q&A with Agentic Reasoning

A sophisticated Full-Stack AI application that uses an Agentic RAG (Retrieval-Augmented Generation) system to provide intelligent, reasoned answers from your documents.

## 🚀 Key Features

- **Agentic Reasoning**: Uses a ReAct agent to decide on retrieval strategies and verify answers.
- **Visual Decision-Making**: Visualize the agent's thought process step-by-step.
- **Multi-Document Support**: Upload and manage various document formats for your knowledge base.
- **Interactive Chat**: High-performance chat interface with markdown and code support.
- **Full-Stack Implementation**: Built with a React/TypeScript frontend and a FastAPI/Python backend.

## 📸 Project Screenshots

### 1. Agent Decision Visualizer
Understand how the AI thinks, acts, and observes before providing an answer.
![Agent Visualizer](Demo/images/Screenshot%202026-02-28%20at%203.05.08%20PM.png)

### 2. Intelligent Chat Interface
Detailed answers based on your documents with full context awareness.
![Chat UI](Demo/images/Screenshot%202026-02-28%20at%203.07.49%20PM.png)

### 3. Document Management
Easily upload and track your knowledge base records.
![Document Management](Demo/images/Screenshot%202026-02-28%20at%203.04.14%20PM.png)

---

## 🛠️ Technology Stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python, FastAPI, LlamaIndex/LangChain (Agentic logic)
- **Vector Store**: ChromaDB
- **UI Components**: Framer Motion, Lucide React

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Anish-Anish/AI-powered-document-Q-A-with-agent-reasoning.git
   cd AI-powered-document-Q-A-with-agent-reasoning
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Backend Setup**:
   ```bash
   cd ../backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python run.py
   ```

---
*Created for the Full Stack AI Engineer Position Home Assignment.*
