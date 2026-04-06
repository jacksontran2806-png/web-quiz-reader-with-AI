export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const prompt = `You are a quiz formatter. Convert the following text into a strict quiz format.

Rules:
- Each question must have exactly 4 options labeled A) B) C) D)
- The correct answer letter goes alone on the last line of each block
- Separate questions with a single blank line
- Do not include any extra text, explanations, or numbering
- Output ONLY the formatted questions, nothing else

Example output:
What is the capital of France?
A) London
B) Paris
C) Berlin
D) Rome
B

What does CPU stand for?
A) Central Processing Unit
B) Computer Personal Unit
C) Central Processor Undo
D) Core Processing Unit
A

Now convert this text:
${text}`;

  try {
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
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API error');

    const result = data.content[0].text;
    return res.status(200).json({ result });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}