// api/gemini-tts-function.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' }); return;
  }
  try {
    const { text, lang } = req.body || {};
    if (!text) { res.status(400).json({ error: 'Missing "text" in body' }); return; }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable' }); return; }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const prompt = lang === 'ar' ? `Say in a warm, natural Lebanese accent: ${text}` : text;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'ar' ? 'Kore' : 'Puck' } } }
      },
      model: 'gemini-2.5-flash-preview-tts'
    };
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini TTS API Error:', errorText);
      res.status(response.status).json({ error: 'Failed to fetch from Gemini TTS API', details: errorText }); return;
    }
    const result = await response.json();
    const audioDataB64 = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    res.status(200).json({ audioDataB64 });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
