const fs = require("fs");
const path = require("path");
const config = require("./config.json");

const DATA_PATH = path.join(__dirname, "data.json");
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return {
      tips: {
        quiz: "Practice from easy to hard.",
        revision: "Use active recall and spaced repetition.",
        summary: "Keep notes concise and concept-focused."
      }
    };
  }
}

function buildFallbackReply(message, subject) {
  const normalized = String(message || "").toLowerCase();
  const subjectTag = subject || "General";
  const data = loadData();

  if (normalized.includes("quiz") || normalized.includes("mcq")) {
    return `[${subjectTag}] ${data.tips.quiz} I can create 5 MCQs if you share chapter/topic name.`;
  }

  if (normalized.includes("plan") || normalized.includes("revision")) {
    return `[${subjectTag}] ${data.tips.revision} Suggested cycle: 40 min learn + 20 min solve + 10 min recap.`;
  }

  if (normalized.includes("summary") || normalized.includes("summarize") || normalized.includes("explain")) {
    return `[${subjectTag}] ${data.tips.summary} Share your exact topic and I will break it into key points.`;
  }

  return `[${subjectTag}] Start with concept definition, then one formula/rule, one solved example, and one practice question.`;
}

async function buildAssistantReply(message, subject) {
  const apiKey = (config.gemini && config.gemini.apiKey) || "";
  const model = (config.gemini && config.gemini.model) || "gemini-1.5-flash";
  const prompt = `You are an AI Study Assistant.
Subject: ${subject || "General"}
Student question: ${message}
Give a concise, practical answer with:
1) brief explanation
2) one example
3) one quick practice question`;

  if (!apiKey) {
    return buildFallbackReply(message, subject);
  }

  try {
    const response = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      return buildFallbackReply(message, subject);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : buildFallbackReply(message, subject);
  } catch (error) {
    return buildFallbackReply(message, subject);
  }
}

module.exports = { buildAssistantReply };
