const { GoogleGenAI } = require("@google/genai");

const apiKey = "AIzaSyBnYq1eWXBzsLiU7mMwmSQNd5TqRip1R7Q";
const ai = new GoogleGenAI({ apiKey });

async function testAPI() {
  try {
    console.log("Testing Gemini API...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        "Hello! Please respond with 'API is working' if you can see this message.",
      ],
    });
    console.log("✅ API Response:", response.text);
  } catch (error) {
    console.error("❌ API Error:", error.message);
    console.error("Full error:", error);
  }
}

testAPI();




