// api/gemini-function.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' }); return;
  }
  try {
    const { prompt } = req.body || {};
    if (!prompt) { res.status(400).json({ error: 'Missing "prompt" in body' }); return; }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable' }); return; }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      res.status(response.status).json({ error: 'Failed to fetch from Gemini API', details: errorText }); return;
    }
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ text });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
