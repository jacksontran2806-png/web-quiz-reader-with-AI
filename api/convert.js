const prompt = (text) => `You are a quiz formatter. Convert the following text into a strict quiz format.

IMPORTANT: Detect the language of the input and respond in that SAME language. If the input is Vietnamese, output Vietnamese. If English, output English. Match the language exactly.

There are TWO question types you must detect and format correctly:

TYPE 1 - Multiple choice (4 options):
What is the capital of France?
A) London
B) Paris
C) Berlin
D) Rome
MULTI:B

TYPE 2 - True/False questions:
The Earth is flat.
YESNO:False

Rules:
- For multiple choice: list exactly 4 options labeled A) B) C) D), then the answer as MULTI:X where X is the correct letter
- For true/false: do NOT list options, just the question then YESNO:True or YESNO:False
- Separate questions with a single blank line
- Output ONLY the formatted questions, nothing else
- Support any language including Vietnamese

Now convert this text:
${text}`;

async function tryAnthropic(text) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt(text) }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Anthropic API error');
  return data.content[0].text;
}

async function tryOpenAI(text) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt(text) }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
  return data.choices[0].message.content;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    // Try Claude first
    const result = await tryAnthropic(text);
    return res.status(200).json({ result, provider: 'Claude' });
  } catch (claudeErr) {
    console.warn('Claude failed, falling back to OpenAI:', claudeErr.message);
    try {
      // Fall back to OpenAI
      const result = await tryOpenAI(text);
      return res.status(200).json({ result, provider: 'OpenAI' });
    } catch (openaiErr) {
      return res.status(500).json({ error: `Both APIs failed. Claude: ${claudeErr.message}. OpenAI: ${openaiErr.message}` });
    }
  }
}