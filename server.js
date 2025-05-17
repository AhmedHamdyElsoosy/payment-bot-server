// server.js
    const firstInstallmentDate = gptData.firstInstallmentDate
      ? new Date(gptData.firstInstallmentDate)
      : new Date(new Date().setMonth(new Date().getMonth() + nMonths));

    const installmentAmount = (totalPrice - downPaymentAmount - deliveryAmount) / installmentCount;

    // Step 3: PDF Generation
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

    const tableHeaders = ['#', 'Date', 'Amount'];
    let currentDate = new Date(firstInstallmentDate);

    doc.fontSize(11);
    doc.text(`Down Payment (${gptData.downPayment}%): ${formatCurrency(downPaymentAmount)}`);
    doc.text(`Delivery Payment (${gptData.delivery}%): ${formatCurrency(deliveryAmount)}`);

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

// Serve file for download directly
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
