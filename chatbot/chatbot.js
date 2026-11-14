// Conversion mappings based on the provided links
const conversionMap = {
    // BMP conversions
    "bmp to ico": "/bmp/bmp-to-ico-converter/",
    "bmp to jpg": "/bmp/bmp-to-jpg-converter/",
    "bmp to pdf": "/bmp/bmp-to-pdf-converter/",
    "bmp to tiff": "/bmp/bmp-to-tiff-converter/",
    "bmp to png": "/bmp/bmp-to-png-converter/",
    "bmp to webp": "/bmp/bmp-to-webp-converter/",
    
    // PNG conversions
    "png to jpg": "/png/png-to-jpg-converter/",
    "png to webp": "/png/png-to-webp-converter/",
    "png to bmp": "/png/png-to-bmp-converter/",
    "png to tiff": "/png/png-to-tiff-converter/",
    "png to pdf": "/png/png-to-pdf-converter/",
    "png to ico": "/png/png-to-ico-converter/",
    
    // JPG conversions
    "jpg to png": "/jpg/jpg-to-png-converter/",
    "jpg to webp": "/jpg/jpg-to-webp-converter/",
    "jpg to bmp": "/jpg/jpg-to-bmp-converter/",
    "jpg to tiff": "/jpg/jpg-to-tiff-converter/",
    "jpg to pdf": "/jpg/jpg-to-pdf-converter/",
    "jpg to ico": "/jpg/jpg-to-ico-converter/",
    
    // WEBP conversions
    "webp to jpg": "/webp/webp-to-jpg-converter/",
    "webp to png": "/webp/webp-to-png-converter/",
    "webp to bmp": "/webp/webp-to-bmp-converter/",
    "webp to tiff": "/webp/webp-to-tiff-converter/",
    "webp to pdf": "/webp/webp-to-pdf-converter/",
    "webp to ico": "/webp/webp-to-ico-converter/",
    
    // TIFF conversions
    "tiff to jpg": "/tiff/tiff-to-jpg-converter/",
    "tiff to webp": "/tiff/tiff-to-webp-converter/",
    "tiff to bmp": "/tiff/tiff-to-bmp-converter/",
    "tiff to png": "/tiff/tiff-to-png-converter/",
    "tiff to pdf": "/tiff/tiff-to-pdf-converter/",
    "tiff to ico": "/tiff/tiff-to-ico-converter/",
    
    // PDF conversions
    "pdf to jpg": "/pdf/pdf-to-jpg-converter/",
    "pdf to webp": "/pdf/pdf-to-webp-converter/",
    "pdf to bmp": "/pdf/pdf-to-bmp-converter/",
    "pdf to tiff": "/pdf/pdf-to-tiff-converter/",
    "pdf to png": "/pdf/pdf-to-png-converter/",
    "pdf to ico": "/pdf/pdf-to-ico-converter/",
    
    // ICO conversions
    "ico to jpg": "/ico/ico-to-jpg-converter/",
    "ico to webp": "/ico/ico-to-webp-converter/",
    "ico to bmp": "/ico/ico-to-bmp-converter/",
    "ico to tiff": "/ico/ico-to-tiff-converter/",
    "ico to pdf": "/ico/ico-to-pdf-converter/",
    "ico to png": "/ico/ico-to-png-converter/"
};

// DOM Elements
const chatbotContainer = document.getElementById('chatbotContainer');
const chatbotToggle = document.getElementById('chatbotToggle');
const chatbotToggleContainer = document.getElementById('chatbotToggleContainer');
const closeBtn = document.getElementById('closeBtn');
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Chatbot state
let userName = null;
let askedForName = false;

// Greeting messages
const GREETINGS = [
    "Hello there!",
    "Hi!",
    "Greetings!",
    "Hey there!",
    "Nice to see you!"
];

// Friendly responses
const FRIENDLY_RESPONSES = [
    "I'd be happy to help with that!",
    "I can definitely assist you with that!",
    "Let me help you with that conversion!",
    "That's something I can help you with!"
];

// Initialize chatbot
function initChatbot() {
    // Start with a greeting after a short delay
    setTimeout(() => {
        addMessage(getRandomGreeting() + " I'm your image conversion assistant. What's your name?", 'bot');
        askedForName = true;
    }, 800);
}

// Get random greeting
function getRandomGreeting() {
    return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

// Get random friendly response
function getRandomFriendlyResponse() {
    return FRIENDLY_RESPONSES[Math.floor(Math.random() * FRIENDLY_RESPONSES.length)];
}

// Toggle chatbot visibility
chatbotToggle.addEventListener('click', () => {
    chatbotContainer.classList.add('active');
    chatbotToggleContainer.style.display = 'none';
});

closeBtn.addEventListener('click', () => {
    chatbotContainer.classList.remove('active');
    setTimeout(() => {
        chatbotToggleContainer.style.display = 'flex';
    }, 300);
});

// Handle user input
function handleUserInput() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    userInput.value = '';
    
    // Process the message after a short delay to simulate thinking
    setTimeout(() => {
        processMessage(message);
    }, 500);
}

// Add message to chat
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add(`${sender}-message`);
    
    const messageText = document.createElement('p');
    messageText.textContent = text;
    messageDiv.appendChild(messageText);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Process the user message and generate response
function processMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check if we're asking for name
    if (askedForName && !userName) {
        userName = message;
        addMessage(`Nice to meet you, ${userName}! ${getRandomFriendlyResponse()} What image conversion do you need help with today?`, 'bot');
        askedForName = false;
        return;
    }
    
    // Check for greetings
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
        addMessage(`${getRandomGreeting()}${userName ? ` ${userName}` : ''}! How can I help you with image conversions today?`, 'bot');
        return;
    }
    
    // Check for thanks
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
        addMessage(`You're welcome${userName ? ` ${userName}` : ''}! Is there anything else I can help you with?`, 'bot');
        return;
    }
    
    // Check for known conversions
    let foundConversion = null;
    
    for (const [key, value] of Object.entries(conversionMap)) {
        if (lowerMessage.includes(key)) {
            foundConversion = { key, value };
            break;
        }
    }
    
    if (foundConversion) {
        // If a known conversion is found
        const responseDiv = document.createElement('div');
        responseDiv.classList.add('bot-message');
        
        const responseText = document.createElement('p');
        responseText.textContent = `${getRandomFriendlyResponse()} Here's the ${foundConversion.key.toUpperCase()} converter:`;
        responseDiv.appendChild(responseText);
        
        const conversionLink = document.createElement('a');
        conversionLink.href = foundConversion.value;
        conversionLink.textContent = `Go to ${foundConversion.key.toUpperCase()} Converter`;
        conversionLink.classList.add('conversion-link');
        conversionLink.target = '_blank';
        responseDiv.appendChild(conversionLink);
        
        chatMessages.appendChild(responseDiv);
    } else {
        // If no specific conversion is found
        addMessage(`I'm not sure I understand${userName ? ` ${userName}` : ''}. Could you specify the conversion you need? For example: 'PNG to JPG' or 'WEBP to PNG'.`, 'bot');
    }
}

// Event listeners
sendBtn.addEventListener('click', handleUserInput);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleUserInput();
    }
});

// Initialize chatbot when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Show welcome text after a delay
    setTimeout(() => {
        document.querySelector('.welcome-text').style.opacity = '1';
        document.querySelector('.welcome-text').style.transform = 'translateX(0)';
    }, 2000);
    
    // Initialize chatbot
    initChatbot();
});