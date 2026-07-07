# 25 — AI Intelligence Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## 1. Overview

The **AI Intelligence Architecture** defines how Large Language Models (LLMs) intersect with the Application Intelligence Platform.

Crucially, the AI Engine **does not** parse ASTs or construct the Knowledge Graph. The graph construction is strictly deterministic. Instead, the AI Engine acts as an advanced *consumer* of the graph, operating on **Projection Models** to generate insights, explanations, and natural language interfaces for engineers.

---

## 2. AI Provider Abstraction

To avoid vendor lock-in, the system relies on an `AIProvider` abstraction. 

### Supported Providers
Via the [Plugin SDK & Extension System](./24-plugin-sdk-architecture.md), the AI Engine supports:
- **OpenAI** (GPT-4o)
- **Anthropic** (Claude 3.5 Sonnet)
- **Google** (Gemini 1.5 Pro)
- **Azure OpenAI** (Enterprise boundaries)
- **Vertex AI**
- **Ollama** (Local, privacy-first inference)

### Abstraction Interface
```typescript
interface IAIProvider {
  generateCompletion(prompt: PromptContext): Promise<string>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  supportsContextWindow(): number;
}
```

---

## 3. RAG Strategy (Retrieval-Augmented Generation)

The core mechanism for answering architectural questions relies on RAG.

### Graph & Projection Retrieval
When a user asks a question (e.g., "What services will break if I change the Payment schema?"), the AI Engine does not read raw source code.
1. **Graph Query**: The Graph Query Engine retrieves the blast radius subgraph.
2. **Projection**: The subgraph is converted into a condensed JSON Projection Model.
3. **Context Building**: The Projection Model is injected into the LLM prompt.
4. **Generation**: The LLM explains the JSON topology in natural language.

---

## 4. AI Use Cases & Capabilities

### Repository & Architecture Summaries
- Automatically generates high-level documentation for undocumented repositories based on their dependency graphs and extracted symbols.
- Summarizes the purpose of individual modules or React components.

### Blast Radius & Risk Explanations
- When the [Risk Engine](./06-risk-engine.md) flags a highly coupled component, the AI Engine explains *why* the coupling is dangerous and suggests architectural decoupling strategies.

### Dead Code Identification
- Combines graph connectivity (finding disconnected subgraphs) with AI analysis to confidently recommend dead code removal.

### Refactoring & Migration Suggestions
- When migrating from React Class Components to Hooks, or migrating from REST to GraphQL, the AI Engine analyzes the Projection Model of the targeted files and provides step-by-step refactoring guides contextualized to the application's architecture.

### Onboarding Assistance & Developer Q&A
- Powers a chat interface where engineers can ask: "Where is user authentication handled?" The search engine retrieves the relevant graph nodes, and the AI Engine summarizes the flow.

---

## 5. Future Agent Architecture

While MVP capabilities are read-only, future iterations will introduce an **Agent Architecture**.
- Agents will have access to tools (e.g., executing a Cypher query, running a specific projection).
- Agents will navigate the graph autonomously to answer multi-hop architectural reasoning questions.
