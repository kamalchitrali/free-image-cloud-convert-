// Chatbot loader
function loadChatbot() {
    // Create container
    const container = document.createElement('div');
    container.id = 'chatbot-embed-container';
    document.body.appendChild(container);
    
    // Load CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/chatbot/chatbot.css';
    document.head.appendChild(cssLink);
    
    // Load HTML and JS
    fetch('/chatbot/chatbot.html')
        .then(response => response.text())
        .then(html => {
            container.innerHTML = html;
            const script = document.createElement('script');
            script.src = '/chatbot/chatbot.js';
            document.body.appendChild(script);
        });
}

// Load when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadChatbot);
} else {
    loadChatbot();
}