const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const PDFDocument = require('pdfkit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP'
  }).format(value);
};

const deleteFileAfter = (filePath, ms = 5 * 60 * 1000) => {
  setTimeout(() => {
    fs.unlink(filePath).catch(() => {});
  }, ms);
};

app.post('/api/generate-payment-plan', async (req, res) => {
  const { userMessage, unitDetails } = req.body;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a financial assistant. Based on the unit details below and user request, extract:
- down payment percent
- delivery percent
- discount percent
- maintenance percent
- number of years
- installment frequency (monthly, quarterly, semi-annually)
- optional first installment date (if user provided)
Return only a JSON object with those values.`
          },
          {
            role: 'user',
            content: `Unit Details: ${JSON.stringify(unitDetails)}\nRequest: ${userMessage}`
          }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const gptData = JSON.parse(response.data.choices[0].message.content);

    const unitPrice = (unitDetails.indoorArea * unitDetails.indoorMeterPrice) +
                      (unitDetails.outdoorArea * unitDetails.outdoorMeterPrice);
    const discountAmount = (unitPrice * (gptData.discount || 0)) / 100;
    const priceAfterDiscount = unitPrice - discountAmount;
    const maintenanceFees = (priceAfterDiscount * (gptData.maintenance || 8)) / 100;
    const totalPrice = priceAfterDiscount + maintenanceFees;

    const downPaymentAmount = totalPrice * (gptData.downPayment / 100);
    const deliveryAmount = totalPrice * (gptData.delivery / 100);

    const years = gptData.years || 5;
    const frequencyMap = { monthly: 1, quarterly: 3, 'semi-annually': 6 };
    const nMonths = frequencyMap[gptData.installmentFrequency.toLowerCase()] || 3;
    const installmentCount = Math.round((years * 12) / nMonths);
    const firstInstallmentDate = gptData.firstInstallmentDate
      ? new Date(gptData.firstInstallmentDate)
      : new Date(new Date().setMonth(new Date().getMonth() + nMonths));

    const installmentAmount = (totalPrice - downPaymentAmount - deliveryAmount) / installmentCount;

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `CustomPlan_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, 'tmp', fileName);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).fillColor('#0096FF').text(`Custom Payment Plan - ${unitDetails.unitNo}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).fillColor('black');
    doc.text(`Project: ${unitDetails.projectName}`);
    doc.text(`Unit No: ${unitDetails.unitNo}`);
    doc.text(`Type: ${unitDetails.usage}`);
    doc.text(`Usage: ${unitDetails.activity}`);
    doc.text(`Indoor Area: ${unitDetails.indoorArea} m² @ ${formatCurrency(unitDetails.indoorMeterPrice)}`);
    doc.text(`Outdoor Area: ${unitDetails.outdoorArea} m² @ ${formatCurrency(unitDetails.outdoorMeterPrice)}`);
    doc.text(`Original Unit Price: ${formatCurrency(unitPrice)}`);
    doc.text(`Discount (${gptData.discount}%): ${formatCurrency(discountAmount)}`);
    doc.text(`Price After Discount: ${formatCurrency(priceAfterDiscount)}`);
    doc.text(`Maintenance (${gptData.maintenance}%): ${formatCurrency(maintenanceFees)}`);
    doc.text(`Total Price: ${formatCurrency(totalPrice)}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#000000').text('Installment Schedule', { underline: true });
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Down Payment (${gptData.downPayment}%): ${formatCurrency(downPaymentAmount)}`);
    doc.text(`Delivery Payment (${gptData.delivery}%): ${formatCurrency(deliveryAmount)}`);

    let currentDate = new Date(firstInstallmentDate);
    for (let i = 0; i < installmentCount; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      doc.text(`Installment ${i + 1} (${dateStr}): ${formatCurrency(installmentAmount)}`);
      currentDate.setMonth(currentDate.getMonth() + nMonths);
    }

    doc.end();

    stream.on('finish', () => {
      deleteFileAfter(filePath);
      res.json({ url: `/download/${fileName}` });
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send({ error: '❌ Failed to generate payment plan' });
  }
});

app.get('/download/:file', (req, res) => {
  const filePath = path.join(__dirname, 'tmp', req.params.file);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', 'attachment; filename=' + req.params.file);
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/', (req, res) => {
  res.send('✅ Payment Plan Bot is running!');
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
