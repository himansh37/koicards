// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// IMPORTANT: Increase the data limit so we can accept large image files
app.use(express.json({ limit: '10mb' }));

// The Route
app.post('/api/generate', async (req, res) => {
    try {
        // 1. Get the payload (image data & prompt) from the frontend
        const payload = req.body;

        // 2. Get the API Key from the secure .env file
        const apiKey = process.env.API_KEY;
        
        // 3. Define the Gemini API URL
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // 4. Send the request to Google (Server-to-Server)
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // 5. Send Google's response back to the frontend
        res.json(response.data);

    } catch (error) {
        console.error("Error connecting to Gemini:", error.message);
        // Send a meaningful error back to frontend
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});