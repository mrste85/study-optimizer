const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a study optimization assistant that transforms content into effective learning materials using evidence-based memory techniques.

You will generate three types of output:
1. CONDENSED NOTES - Hierarchical bullet points (max 3 levels deep) capturing key concepts
2. FLASHCARDS - Question-answer pairs for active recall and spaced repetition
3. KEY QUESTIONS - "Why" and "How" questions for elaborative interrogation

Follow these principles:
- Chunk information into digestible pieces (cognitive load theory)
- Focus on core concepts, not peripheral details
- Create flashcards that test understanding, not just recall
- Generate questions that promote deeper processing`;

async function processContent(content, title) {
  // Truncate content if too long
  const maxLength = 50000;
  const truncatedContent = content.length > maxLength
    ? content.substring(0, maxLength) + '...[truncated]'
    : content;

  const userPrompt = `Process the following content titled "${title || 'Article'}" and generate study materials.

CONTENT:
${truncatedContent}

---

Respond with a JSON object containing:
{
  "notes": "Markdown formatted hierarchical notes with bullet points (use -, not *)",
  "flashcards": [
    {"front": "question", "back": "answer"},
    ...
  ],
  "questions": [
    {"question": "Why/How question", "hint": "Brief hint for self-testing"},
    ...
  ]
}

Guidelines:
- Notes: 5-10 key points, max 3 levels of nesting
- Flashcards: 8-15 cards covering core concepts
- Questions: 5-8 elaborative questions starting with Why/How

Return ONLY valid JSON, no additional text.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const responseText = response.content[0].text;

  // Parse JSON from response
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const result = JSON.parse(jsonStr.trim());

    // Validate structure
    if (!result.notes || !result.flashcards || !result.questions) {
      throw new Error('Missing required fields in response');
    }

    return result;
  } catch (parseError) {
    console.error('Failed to parse Claude response:', parseError);
    console.error('Raw response:', responseText);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

module.exports = { processContent };
