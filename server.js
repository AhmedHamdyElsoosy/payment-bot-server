// server.js
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/generate-payment-plan', async (req, res) => {
  const { userMessage, unitDetails } = req.body;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `أنت مساعد مالي ذكي. تولد خطة سداد مفصلة بناءً على وصف العميل وبيانات الوحدة التالية: ${JSON.stringify(unitDetails)}`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.4,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = response.data.choices[0].message.content;
    res.send({ plan: result });
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).send({ error: '❌ حصل خطأ أثناء التواصل مع OpenAI' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Payment Plan Bot is running!');
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
