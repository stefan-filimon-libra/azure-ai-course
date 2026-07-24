const API_BASE = 'http://localhost:7799';

// Core fetch function
async function apiCall(endpoint, method = 'GET', body = null) {
    const errorBanner = document.getElementById('errorBanner');
    errorBanner.style.display = 'none';
    
    try {
        const options = { method, headers: {} };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(API_BASE + endpoint, options);
        const data = await response.json();
        
        if (!response.ok) {
            errorBanner.textContent = `Error ${response.status}: ${data.detail || JSON.stringify(data)}`;
            errorBanner.style.display = 'block';
            throw new Error(`HTTP ${response.status}`);
        }
        return data;
    } catch (err) {
        if (err.message === 'Failed to fetch') {
            errorBanner.textContent = `Network Error: Backend unreachable at ${API_BASE}. Is it running?`;
            errorBanner.style.display = 'block';
        }
        throw err;
    }
}

// 1. Service Status
async function fetchStatus() {
    const resDiv = document.getElementById('statusResult');
    resDiv.innerHTML = 'Loading...';
    try {
        const [health, config] = await Promise.all([
            apiCall('/health'),
            apiCall('/config')
        ]);
        resDiv.innerHTML = `
            <div><strong>Qdrant:</strong> <span class="badge">${health.qdrant}</span> at ${health.qdrant_url}</div>
            <div><strong>LLM Provider:</strong> ${health.llm.provider} (${health.llm.model})</div>
            <div><strong>Embeddings:</strong> ${health.embeddings.provider} (${health.embeddings.model})</div>
            <pre>${JSON.stringify(config.providers, null, 2)}</pre>
        `;
    } catch (e) { resDiv.innerHTML = ''; }
}

// 2. Collection
async function fetchCollection() {
    const resDiv = document.getElementById('collectionResult');
    resDiv.innerHTML = 'Loading...';
    try {
        const data = await apiCall('/collection');
        resDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (e) { resDiv.innerHTML = ''; }
}

async function resetCollection() {
    if (!confirm('Are you sure you want to delete all stored vectors? This cannot be undone.')) return;
    try {
        await apiCall('/collection', 'DELETE');
        fetchCollection();
    } catch (e) {}
}

// 3. Chunking & Ingestion
function renderChunks(chunks) {
    return chunks.map(c => `
        <div class="chunk-box">
            <div class="chunk-meta">Index: ${c.index} | Chars: ${c.chars} | Approx Tokens: ${c.approx_tokens}</div>
            <div>${c.text}</div>
        </div>
    `).join('');
}

async function doChunk() {
    const text = document.getElementById('sourceText').value;
    const strategy = document.getElementById('chunkStrategy').value;
    const resDiv = document.getElementById('chunkResult');
    if (!text) return alert('Please paste some text first.');
    
    resDiv.innerHTML = 'Loading...';
    try {
        const data = await apiCall('/chunk', 'POST', { text, strategy });
        resDiv.innerHTML = `
            <p><strong>Strategy used:</strong> ${data.strategy} | <strong>Total chunks:</strong> ${data.count}</p>
            ${renderChunks(data.chunks)}
        `;
    } catch (e) { resDiv.innerHTML = ''; }
}

async function doIngest() {
    const text = document.getElementById('sourceText').value;
    const strategy = document.getElementById('chunkStrategy').value;
    const resDiv = document.getElementById('chunkResult');
    if (!text) return alert('Please paste some text first.');
    
    resDiv.innerHTML = 'Ingesting...';
    try {
        const data = await apiCall('/ingest', 'POST', { text, strategy, source: 'admin-panel' });
        resDiv.innerHTML = `
            <div style="background: #d1e7dd; color: #0f5132; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                <strong>Success!</strong> ${data.count} chunks stored. Vector dimension: ${data.vector_dimension}.
            </div>
            <strong>Embedding Preview (First 8 dims):</strong>
            <div class="embedding-preview">[${data.embedding_preview.join(', ')} ...]</div>
            ${renderChunks(data.chunks)}
        `;
        fetchCollection(); 
    } catch (e) { resDiv.innerHTML = ''; }
}

// 4. Search
async function doSearch() {
    const query = document.getElementById('searchQuery').value;
    const top_k = parseInt(document.getElementById('searchTopK').value) || 4;
    const resDiv = document.getElementById('searchResult');
    if (!query) return alert('Enter a search query.');
    
    resDiv.innerHTML = 'Searching...';
    try {
        const data = await apiCall('/search', 'POST', { query, top_k });
        
        let html = `
            <strong>Query Embedding Preview:</strong>
            <div class="embedding-preview">[${data.query_embedding_preview.join(', ')} ...]</div>
        `;

        if (!data.hits.length) {
            resDiv.innerHTML = html + '<p>No results found.</p>';
            return;
        }

        html += data.hits.map(h => `
            <div class="chunk-box">
                <div class="chunk-meta">Score: <strong>${h.score.toFixed(4)}</strong> | Source: ${h.source || 'N/A'}</div>
                <div>${h.text}</div>
            </div>
        `).join('');

        resDiv.innerHTML = html;
    } catch (e) { resDiv.innerHTML = ''; }
}

// 5. Ask (RAG Generation)
async function doAsk() {
    const question = document.getElementById('askQuery').value;
    const useRag = document.getElementById('useRag').checked;
    const top_k = parseInt(document.getElementById('searchTopK').value) || 4;
    const resDiv = document.getElementById('askResult');
    if (!question) return alert('Enter a question.');
    
    resDiv.innerHTML = 'Generating answer...';
    try {
        const data = await apiCall('/ask', 'POST', { question, use_rag: useRag, top_k });
        resDiv.innerHTML = renderAskResponse(data);
    } catch (e) { resDiv.innerHTML = ''; }
}

async function doCompare() {
    const question = document.getElementById('askQuery').value;
    const top_k = parseInt(document.getElementById('searchTopK').value) || 4;
    const resDiv = document.getElementById('askResult');
    if (!question) return alert('Enter a question.');

    resDiv.innerHTML = 'Generating side-by-side comparison...';
    try {
        const [resPlain, resRag] = await Promise.all([
            apiCall('/ask', 'POST', { question, use_rag: false, top_k }),
            apiCall('/ask', 'POST', { question, use_rag: true, top_k })
        ]);

        resDiv.innerHTML = `
            <div class="grid-2" style="margin-top: 15px;">
                <div>
                    <h3 style="color: #6c757d;">Without RAG (Plain LLM)</h3>
                    ${renderAskResponse(resPlain, true)}
                </div>
                <div>
                    <h3 style="color: #0d6efd;">With RAG (Augmented)</h3>
                    ${renderAskResponse(resRag, true)}
                </div>
            </div>
        `;
    } catch (e) { resDiv.innerHTML = ''; }
}

// Helper to render Ask response UI
function renderAskResponse(data, isCompact = false) {
    let retrievedHTML = '';
    if (data.augmented && data.retrieved.length > 0) {
        retrievedHTML = `
            <h4 style="margin-bottom: 5px;">Retrieved Context:</h4>
            ${data.retrieved.map(h => `
                <div class="chunk-box" style="font-size: ${isCompact ? '12px' : '13px'}; padding: 8px;">
                    <div class="chunk-meta">Score: ${h.score.toFixed(4)}</div>
                    ${h.text}
                </div>
            `).join('')}
        `;
    }

    return `
        <div style="background: ${data.augmented ? '#e7f1ff' : '#f8f9fa'}; border: 1px solid ${data.augmented ? '#b6d4fe' : '#dee2e6'}; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
            <strong>Answer (${data.provider} - ${data.model}):</strong><br>
            <div style="margin-top: 8px;">${data.answer.replace(/\n/g, '<br>')}</div>
        </div>
        
        <h4>Exact Prompt Sent to LLM:</h4>
        <pre style="${isCompact ? 'max-height: 250px;' : ''}">${data.prompt_sent}</pre>
        
        ${retrievedHTML}
    `;
}

// Init & LocalStorage logic
window.onload = () => {
    fetchStatus();

    // Restore saved settings
    const savedStrategy = localStorage.getItem('libra_strategy');
    if (savedStrategy) document.getElementById('chunkStrategy').value = savedStrategy;

    const savedTopK = localStorage.getItem('libra_top_k');
    if (savedTopK) document.getElementById('searchTopK').value = savedTopK;

    // Attach listeners to save settings on change
    document.getElementById('chunkStrategy').addEventListener('change', (e) => {
        localStorage.setItem('libra_strategy', e.target.value);
    });
    
    document.getElementById('searchTopK').addEventListener('change', (e) => {
        localStorage.setItem('libra_top_k', e.target.value);
    });
};