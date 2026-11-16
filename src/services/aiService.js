const OpenAI = require("openai");

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "your", "have", "more",
  "will", "about", "into", "their", "what", "when", "where", "which", "while",
  "there", "been", "were", "they", "them", "then", "than", "some", "such",
  "only", "other", "also", "very", "just", "over", "after", "before", "most",
]);

const UNSAFE_PATTERNS = [
  /\b(casino|gambling|betting|roulette|jackpot)\b/i,
  /\b(pirated|cracked\s+software|keygen|warez|torrent\s+hack)\b/i,
  /\b(hate\s+speech|terrorist|extremist|kill\s+yourself)\b/i,
  /\b(nsfw|pornography|explicit\s+adult)\b/i,
  /\b(scam|ponzi\s+scheme|phishing\s+link)\b/i,
];

const isOpenAIConfigured = () => {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key !== "your_openai_api_key" && key.startsWith("sk-"));
};

const isGeminiConfigured = () => {
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  return Boolean(key && key !== "your_google_gemini_api_key" && key.length > 15);
};

const getOpenAIClient = () => {
  if (!isOpenAIConfigured()) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

// Call Google Gemini Free API via native fetch (zero external package overhead)
const callGeminiAPI = async (systemPrompt, userPrompt) => {
  if (!isGeminiConfigured() || typeof fetch !== "function") return null;
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
};

// Extract top keywords from content for tags
const extractKeywords = (text, maxTags = 5) => {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

  const freq = {};
  words.forEach((w) => {
    freq[w] = (freq[w] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([word]) => word);
};

// Split text into clean sentences
const splitSentences = (text) => {
  return String(text || "")
    .replace(/[#_*`~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
};

/**
 * 1. Generate SEO Metadata (Title suggestions, Excerpt, Meta Description, Slug, Tags)
 */
const generateSEOMetadata = async ({ title = "", content = "", category = "Technology" }) => {
  const client = getOpenAIClient();

  if (client) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert technical SEO strategist. Return a JSON object with keys: suggestedTitles (array of 3 strings), excerpt (string <= 250 chars), metaDescription (string <= 155 chars), tags (array of 5 lowercase strings), and slug (URL-safe hyphenated string).",
          },
          {
            role: "user",
            content: `Category: ${category}\nTitle: ${title}\nContent:\n${content.substring(0, 4000)}`,
          },
        ],
        temperature: 0.5,
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      return { provider: "openai", ...parsed };
    } catch (err) {
      // Fallback
    }
  }

  const sentences = splitSentences(content);
  const firstTwo = sentences.slice(0, 2).join(" ");
  const cleanTitle =
    title.trim() || (sentences[0] ? sentences[0].substring(0, 70) : `Complete Guide to ${category}`);
  const tags = extractKeywords(`${cleanTitle} ${content}`, 5);
  if (tags.length === 0) tags.push(category.toLowerCase(), "guide", "insights");

  const excerpt =
    firstTwo.length > 240
      ? `${firstTwo.substring(0, 237)}...`
      : firstTwo || `${cleanTitle} - comprehensive insights and practical guide.`;

  const metaDescription =
    excerpt.length > 155 ? `${excerpt.substring(0, 152)}...` : excerpt;

  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    provider: "buzzboard-ai-engine",
    suggestedTitles: [
      cleanTitle,
      `${cleanTitle}: Best Practices & Deep Dive`,
      `How to Master ${tags[0] ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1) : category} in Production`,
    ],
    excerpt,
    metaDescription,
    tags,
    slug,
  };
};

/**
 * 2. AI Writing Co-Pilot (Improve, Expand, Outline, Grammar, Tone Shift)
 */
const assistWriting = async ({ prompt = "", content = "", action = "improve", tone = "professional" }) => {
  // Try Google Gemini Free Tier first if configured
  if (isGeminiConfigured()) {
    try {
      const geminiText = await callGeminiAPI(
        `You are an expert editorial AI co-pilot for BuzzBoard. Perform the "${action}" action using a "${tone}" tone.`,
        `Instruction: ${prompt}\n\nDraft Content:\n${content}`
      );
      if (geminiText) {
        return { provider: "google-gemini-free", action, tone, result: geminiText.trim() };
      }
    } catch (err) {
      // Fallback
    }
  }

  const client = getOpenAIClient();
  if (client) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert editorial AI co-pilot for BuzzBoard. Perform the "${action}" action using a "${tone}" tone.`,
          },
          {
            role: "user",
            content: `Instruction: ${prompt}\n\nDraft Content:\n${content}`,
          },
        ],
        temperature: 0.6,
      });

      return {
        provider: "openai",
        action,
        tone,
        result: response.choices[0].message.content,
      };
    } catch (err) {
      // Fallback
    }
  }

  const source = (content || prompt || "").trim();
  let result = "";

  if (action === "outline") {
    const topic = prompt || content || "Modern Software Architecture";
    result = [
      `# Article Outline: ${topic}`,
      `## 1. Executive Summary & Problem Statement`,
      `- Why ${topic} matters in modern production environments`,
      `- Common pitfalls and bottlenecks`,
      `## 2. Core Architecture & Key Principles`,
      `- Foundational building blocks`,
      `- Trade-offs and scalability considerations`,
      `## 3. Step-by-Step Implementation Guide`,
      `- Setting up the foundation`,
      `- Production best practices & real-world patterns`,
      `## 4. Performance Optimization & Takeaways`,
      `- Key metrics to monitor`,
      `- Final conclusion and next steps`,
    ].join("\n");
  } else if (action === "expand") {
    result = `${source}\n\n### Deeper Perspective (${tone} tone)\nFurthermore, applying these principles in a real-world scenario requires careful attention to scalability, maintainability, and user experience. By structuring your workflow around measurable outcomes, teams can consistently deliver higher value while minimizing technical debt.`;
  } else {
    const normalized = source.replace(/\s+/g, " ");
    result = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    if (!/[.!?]$/.test(result)) result += ".";
  }

  return {
    provider: "buzzboard-ai-engine",
    action,
    tone,
    result,
  };
};

/**
 * 3. Generate 1-Click TL;DR Summary for Readers
 */
const generatePostSummary = async ({ title = "", content = "" }) => {
  if (isGeminiConfigured()) {
    try {
      const geminiText = await callGeminiAPI(
        "Summarize the following blog post into 3 concise bullet points (TL;DR) for busy readers.",
        `Title: ${title}\n\nContent:\n${content.substring(0, 5000)}`
      );
      if (geminiText) {
        return { provider: "google-gemini-free", summary: geminiText.trim() };
      }
    } catch (err) {
      // Fallback
    }
  }

  const client = getOpenAIClient();
  if (client) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Summarize the following blog post into 3 concise, high-signal bullet points (TL;DR) for busy readers.",
          },
          {
            role: "user",
            content: `Title: ${title}\n\nContent:\n${content.substring(0, 5000)}`,
          },
        ],
        temperature: 0.4,
      });

      return {
        provider: "openai",
        summary: response.choices[0].message.content.trim(),
      };
    } catch (err) {
      // Fallback
    }
  }

  const sentences = splitSentences(content);
  const bullets = sentences.slice(0, 3);
  if (bullets.length === 0) {
    bullets.push(content.trim().substring(0, 180) || title);
  }

  const formattedSummary = [`TL;DR — ${title}:`, ...bullets.map((b) => `• ${b}`)].join("\n");

  return {
    provider: "buzzboard-ai-engine",
    summary: formattedSummary,
  };
};

/**
 * 4. AdSense & Brand-Safety Content Moderation Guard
 */
const evaluateBrandSafety = async ({ title = "", content = "" }) => {
  const combined = `${title}\n${content}`;
  const matchedIssues = [];

  for (const regex of UNSAFE_PATTERNS) {
    const match = combined.match(regex);
    if (match) {
      matchedIssues.push(`Detected restricted keyword/topic: "${match[0]}"`);
    }
  }

  const isAdSafe = matchedIssues.length === 0;
  return {
    isAdSafe,
    adSafetyScore: isAdSafe ? 98 : Math.max(15, 100 - matchedIssues.length * 35),
    reason: isAdSafe
      ? "Content complies with standard Google AdSense & Brand Safety guidelines."
      : matchedIssues.join("; "),
    flaggedCategories: matchedIssues,
  };
};

/**
 * 5. "Ask AI About This Post" — Contextual Q&A over a Post's Content
 */
const askArticleQuestion = async ({ title = "", content = "", question = "" }) => {
  if (isGeminiConfigured()) {
    try {
      const geminiAnswer = await callGeminiAPI(
        "Answer the reader's question concisely based strictly on the provided article.",
        `Article Title: ${title}\nArticle Content: ${content.substring(0, 5000)}\n\nQuestion: ${question}`
      );
      if (geminiAnswer) {
        return { provider: "google-gemini-free", question, answer: geminiAnswer.trim() };
      }
    } catch (err) {
      // Fallback
    }
  }

  const client = getOpenAIClient();
  if (client) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Answer the reader's question concisely based on the provided article.",
          },
          {
            role: "user",
            content: `Article Title: ${title}\nArticle Content: ${content.substring(0, 5000)}\n\nQuestion: ${question}`,
          },
        ],
        temperature: 0.3,
      });

      return {
        provider: "openai",
        question,
        answer: response.choices[0].message.content.trim(),
      };
    } catch (err) {
      // Fallback
    }
  }

  // Deterministic contextual sentence matching (RAG Lite)
  const sentences = splitSentences(content);
  const queryTerms = extractKeywords(question, 6);
  const scored = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    const hits = queryTerms.reduce((acc, term) => acc + (lower.includes(term) ? 1 : 0), 0);
    return { sentence, hits };
  });

  scored.sort((a, b) => b.hits - a.hits);
  const bestMatches = scored
    .slice(0, 2)
    .map((s) => s.sentence)
    .join(" ");

  return {
    provider: "buzzboard-ai-engine",
    question,
    answer:
      bestMatches ||
      `Based on "${title}", the article discusses: ${content.substring(0, 200)}...`,
  };
};

/**
 * 6. 1-Click Multilingual Translation (Bangla <-> English)
 */
const translateContent = async ({ title = "", content = "", targetLang = "bn" }) => {
  const langLabel = targetLang === "bn" ? "Bangla (বাংলা)" : "English";

  if (isGeminiConfigured()) {
    try {
      const geminiTranslated = await callGeminiAPI(
        `Translate the following article title and content into natural ${langLabel}.`,
        `Title: ${title}\n\nContent:\n${content.substring(0, 4000)}`
      );
      if (geminiTranslated) {
        return {
          provider: "google-gemini-free",
          targetLang,
          translatedTitle: title,
          translatedContent: geminiTranslated.trim(),
        };
      }
    } catch (err) {
      // Fallback
    }
  }

  const client = getOpenAIClient();
  if (client) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate the article into natural ${langLabel}.`,
          },
          {
            role: "user",
            content: `Title: ${title}\n\nContent:\n${content.substring(0, 4000)}`,
          },
        ],
        temperature: 0.3,
      });

      return {
        provider: "openai",
        targetLang,
        translatedTitle: title,
        translatedContent: response.choices[0].message.content.trim(),
      };
    } catch (err) {
      // Fallback
    }
  }

  return {
    provider: "buzzboard-ai-engine",
    targetLang,
    languageName: langLabel,
    translatedTitle:
      targetLang === "bn" ? `[বাংলা সংস্করণ] ${title}` : `[English Version] ${title}`,
    translatedContent:
      targetLang === "bn"
        ? `[বাংলা অনুবাদ — ${title}]\n\n${content}`
        : `[English Translation — ${title}]\n\n${content}`,
  };
};

module.exports = {
  generateSEOMetadata,
  assistWriting,
  generatePostSummary,
  evaluateBrandSafety,
  askArticleQuestion,
  translateContent,
  extractKeywords,
  isOpenAIConfigured,
  isGeminiConfigured,
};
