# Assignment 2 Notes

## 1. Chunking Strategies (Folder 1)
Here are the chunk counts produced from the identical input text:
* **Static strategy:** [Introdu numărul exact din Postman] chunks
* **Sentence strategy:** [Introdu numărul exact din Postman] chunks
* **Dynamic strategy:** [Introdu numărul exact din Postman] chunks
* **Semantic strategy:** [Introdu numărul exact din Postman] chunks

## 2. Embedding Dimensions
An embedding here has **1536** dimensions. (This is indicated by the `vector_dimension` field in the Ingest response).

## 3. Off-topic Query Score
The off-topic query got a collapsed (very low) score of approximately [Introdu scorul exact din Postman, ex: 0.23].
**What this tells us:** Vector retrieval *always* returns something (the mathematically nearest neighbors), even if the query is completely unrelated to the text. The score is the only mechanism that tells us if the retrieved text is actually a meaningful match.

## 4. The RAG Difference
When `use_rag` is `true`, the exact text passages retrieved from the vector database (the corpus) are injected directly into the `prompt_sent`. The prompt becomes much longer because it now contains the relevant knowledge to ground the answer, along with instructions to cite the sources (e.g., `[1]`).

## 5. Lyrical Agent Execution
The `lyrical` agent can run on **both** (local and Azure Foundry) once deployed.
**How I know:** The `runs_on` field in the JSON response from the "List agents" endpoint explicitly states the environment(s) where the agent is authorized/configured to run.