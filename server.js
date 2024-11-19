require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // For making HTTP requests
const app = express();
const port = process.env.PORT || 7000;

app.use(bodyParser.json()); // Middleware to parse JSON request bodies

// Welcome route to check server status
app.get('/', (req, res) => {
    res.send("Welcome! The Pharmacy Chatbot server is running.");
});

// GET route for webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.MYTOKEN) {
        console.log("Webhook verified successfully!");
        res.status(200).send(challenge); // Send the challenge response
    } else {
        console.error("Webhook verification failed. Invalid token.");
        res.sendStatus(403); // Forbidden status code
    }
});

// POST route for webhook to handle incoming messages
app.post('/webhook', (req, res) => {
    console.log("Incoming Webhook Event:", JSON.stringify(req.body, null, 2));

    // Check if incoming request contains expected fields
    if (
        req.body.entry &&
        req.body.entry[0].changes &&
        req.body.entry[0].changes[0].value.messages &&
        req.body.entry[0].changes[0].value.messages[0]
    ) {
        const incomingMessage = req.body.entry[0].changes[0].value.messages[0];
        const senderId = incomingMessage.from; // Sender's WhatsApp ID

        // Text message handler
        if (incomingMessage.type === 'text') {
            const messageText = incomingMessage.text?.body.toLowerCase();
            if (messageText === 'hi') {
                sendInteractiveMessage(senderId, 'Welcome to ABC Pharmacy! How can we assist you today?');
            }
        } 
        // Button reply handler
        else if (incomingMessage.type === 'interactive' && incomingMessage.interactive.type === 'button_reply') {
            const buttonId = incomingMessage.interactive.button_reply?.id.toLowerCase();
            if (buttonId) {
                handleButtonResponse(senderId, buttonId);
            } else {
                console.error("Button ID not found in the response.");
            }
        } 
        // List reply handler
        else if (incomingMessage.type === 'interactive' && incomingMessage.interactive.type === 'list_reply') {
            const selectedOptionId = incomingMessage.interactive.list_reply?.id.toLowerCase();
            if (selectedOptionId) {
                handleListResponse(senderId, selectedOptionId);
            } else {
                console.error("List option ID not found in the response.");
            }
        }
    }

    res.sendStatus(200); // Acknowledge the webhook event
});

// Function to send an interactive message with buttons
async function sendInteractiveMessage(senderId, text) {
    const messageData = {
        messaging_product: 'whatsapp',
        to: senderId,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: text },
            footer: { text: 'Please select an option below' },
            action: {
                buttons: [
                    { type: 'reply', reply: { id: 'ORDER_MEDICINE', title: 'Order Medicine' } },
                    { type: 'reply', reply: { id: 'CHECK_AVAILABILITY', title: 'Check Availability' } },
                    { type: 'reply', reply: { id: 'MORE_SERVICES', title: 'More Services' } }
                ]
            }
        }
    };

    await sendToWhatsApp(senderId, messageData);
}

// Function to send an image message
async function sendImageMessage(senderId, imageUrl, captionText) {
    const messageData = {
        messaging_product: 'whatsapp',
        to: senderId,
        type: 'image',
        image: {
            link: imageUrl,
            caption: captionText
        }
    };

    await sendToWhatsApp(senderId, messageData);
}

// Modify handleButtonResponse to include the image response
async function handleButtonResponse(senderId, buttonId) {
    let responseText;

    switch (buttonId) {
        case 'order_medicine':
            const imageUrl = 'https://img.freepik.com/free-photo/pharmacist-work_23-2150600097.jpg';
            const imageCaption = `To order medicine, please upload your prescription here: https://cool-licorice-048bcb.netlify.app . Our pharmacist will contact you shortly.`;
            await sendImageMessage(senderId, imageUrl, imageCaption);
            break;

        case 'check_availability':
            responseText = 'Please specify the medicine name, and we’ll check the stock for you.';
            await sendTextMessage(senderId, responseText);
            break;

        case 'more_services':
            responseText = 'Here are additional services we offer:';
            await sendListOptions(senderId, responseText);
            break;

        default:
            responseText = 'Invalid option. Please try again.';
            await sendTextMessage(senderId, responseText);
    }
}

// Function to send a list of options for 'More Services'
async function sendListOptions(senderId, text) {
    const messageData = {
        messaging_product: 'whatsapp',
        to: senderId,
        type: 'interactive',
        interactive: {
            type: 'list',
            header: { type: 'text', text: text },
            body: { text: 'Please choose from the options below' },
            action: {
                button: 'Services',
                sections: [
                    {
                        title: 'Our Services',
                        rows: [
                            { id: 'CONSULT_PHARMACIST', title: 'Consult a Pharmacist' },
                            { id: 'HEALTH_TIPS', title: 'Health & Wellness Tips' },
                            { id: 'OFFERS', title: 'Current Offers' },
                            { id: 'RETURN_POLICY', title: 'Return Policy' },
                            { id: 'SUPPORT', title: 'Customer Support' },
                            { id: 'PREVIOUS_MENU', title: 'Previous Menu' },
                            { id: 'DELIVERY_STATUS', title: 'Check Delivery Status' },
                            { id: 'LOYALTY_PROGRAM', title: 'Join Loyalty Program' },
                            { id: 'COVID_VACCINE', title: 'COVID-19 Vaccine Info' }
                        ]
                    }
                ]
            }
        }
    };

    await sendToWhatsApp(senderId, messageData);
}

// Updated function to handle list option responses
async function handleListResponse(senderId, selectedOptionId) {
    let responseText;

    switch (selectedOptionId) {
        case 'CONSULT_PHARMACIST':
            responseText = 'Our pharmacist is available to assist you. Please describe your query.';
            break;

        case 'HEALTH_TIPS':
            responseText = 'Stay healthy! Here are some daily wellness tips: eat well, exercise regularly, and stay hydrated.';
            break;

        case 'OFFERS':
            responseText = 'Check out our latest offers on medicines and wellness products!';
            break;

        case 'RETURN_POLICY':
            responseText = 'You may return unopened medicines within 7 days of purchase. Please keep the receipt.';
            break;

        case 'SUPPORT':
            responseText = 'Our customer support is here to help. Reach us at support@abcpharmacy.com.';
            break;

        case 'PREVIOUS_MENU':
            sendListOptions(senderId, 'Welcome back! How can we assist you today?');
            return;

        case 'DELIVERY_STATUS':
            responseText = 'Please provide your order number to check the delivery status.';
            break;

        case 'LOYALTY_PROGRAM':
            responseText = 'Join our loyalty program to earn points on each purchase! Contact support for more details.';
            break;

        case 'COVID_VACCINE':
            responseText = 'Stay informed! Contact us to learn about availability and appointments for COVID-19 vaccines.';
            break;

        default:
            responseText = 'Invalid option. Please try again.';
    }

    await sendTextMessage(senderId, responseText);
}

// Helper function to send a simple text message
async function sendTextMessage(senderId, text) {
    const messageData = {
        messaging_product: 'whatsapp',
        to: senderId,
        type: 'text',
        text: { body: text }
    };

    await sendToWhatsApp(senderId, messageData);
}

// Helper function to send messages via WhatsApp API
async function sendToWhatsApp(senderId, messageData) {
    try {
        await axios.post(process.env.WHATSAPP_API_URL, messageData, {
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
        });
    } catch (error) {
        console.error('Error sending message to WhatsApp:', error.response ? error.response.data : error.message);
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
