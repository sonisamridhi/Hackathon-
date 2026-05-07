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

function extractTopic(message, normalized) {
  const source = String(message || "").trim();
  const patterns = [
    /summarize\s+(.+)/i,
    /summary\s+of\s+(.+)/i,
    /revision plan for\s+(.+)/i,
    /mcq(?:'s|s)?\s+on\s+(.+)/i,
    /quiz\s+on\s+(.+)/i,
    /about\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[.?!]+$/, "");
    }
  }

  if (normalized === "yeah" || normalized === "yes") {
    return "";
  }

  return source.replace(/[.?!]+$/, "");
}

function buildMcqReply(subjectTag, topic) {
  const targetTopic = topic || "general knowledge";
  return `[${subjectTag}] 5 MCQs on ${targetTopic}:
1) Which statement best describes ${targetTopic}? (A) ... (B) ... (C) ... (D) ...
2) Which region/country is most connected to ${targetTopic}? (A) ... (B) ... (C) ... (D) ...
3) Why is ${targetTopic} important globally? (A) ... (B) ... (C) ... (D) ...
4) Which event most affected ${targetTopic} recently? (A) ... (B) ... (C) ... (D) ...
5) Which factor can disrupt ${targetTopic}? (A) ... (B) ... (C) ... (D) ...
Share your options level (easy/medium/hard) and I will give exact answers + explanations.`;
}

function buildPlanReply(subjectTag, topic) {
  const targetTopic = topic || "your subject";
  return `[${subjectTag}] 7-day revision plan for ${targetTopic}:
Day 1: Core concepts + formula sheet
Day 2: Topic-wise short notes + examples
Day 3: Practice questions (easy -> medium)
Day 4: Mixed problem solving + error log
Day 5: Timed practice set + corrections
Day 6: Active recall + flashcards + weak areas
Day 7: Full revision + mock test + final recap`;
}

function buildSummaryReply(subjectTag, topic) {
  const targetTopic = topic || "the topic";
  return `[${subjectTag}] Simple summary of ${targetTopic}:
- What it is: A core concept you should define in one line.
- Why it matters: It affects real-world understanding and exam questions.
- Key points: Learn 3-5 main ideas and one example for each.
- Quick recall tip: Write a 5-line note in your own words and revise twice today.`;
}

function buildFallbackReply(message, subject, history) {
  const normalized = String(message || "").toLowerCase().trim();
  const subjectTag = subject || "General";
  const data = loadData();
  const recentContext = Array.isArray(history)
    ? history.slice(-4).map((item) => String(item.text || "").toLowerCase()).join(" ")
    : "";
  const topic = extractTopic(message, normalized);
  const wantsMcq = /quiz|mcq/.test(normalized) || (/quiz|mcq/.test(recentContext) && (normalized.startsWith("about ") || normalized === "yeah" || normalized === "yes"));
  const wantsPlan = /plan|revision/.test(normalized);
  const wantsSummary = /summary|summarize|explain/.test(normalized);

  if (wantsMcq) {
    return buildMcqReply(subjectTag, topic || "general knowledge");
  }

  if (wantsPlan) {
    return `${buildPlanReply(subjectTag, topic)}\nTip: ${data.tips.revision}`;
  }

  if (wantsSummary) {
    return `${buildSummaryReply(subjectTag, topic)}\nTip: ${data.tips.summary}`;
  }

  return `[${subjectTag}] Start with concept definition, then one formula/rule, one solved example, and one practice question.`;
}

async function buildAssistantReply(message, subject, history) {
  const apiKey = (config.gemini && config.gemini.apiKey) || "";
  const model = (config.gemini && config.gemini.model) || "gemini-1.5-flash";
  const contextText = Array.isArray(history)
    ? history.slice(-6).map((item) => `${item.role || "user"}: ${item.text || ""}`).join("\n")
    : "";
  const prompt = `You are an AI Study Assistant.
Subject: ${subject || "General"}
Recent chat context:
${contextText || "No previous context"}
Student question: ${message}
Give a concise, practical answer with:
1) brief explanation
2) one example
3) one quick practice question`;

  if (!apiKey) {
    return buildFallbackReply(message, subject, history);
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
      return buildFallbackReply(message, subject, history);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : buildFallbackReply(message, subject, history);
  } catch (error) {
    return buildFallbackReply(message, subject, history);
  }
}

module.exports = { buildAssistantReply };
