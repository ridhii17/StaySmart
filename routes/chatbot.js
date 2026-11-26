const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbot");
const { rateLimit } = require("../middleware");

router.post("/", rateLimit({ scope: "chatbot", windowMs: 10 * 60 * 1000, max: 30 }), chatbotController.reply);

module.exports = router;
