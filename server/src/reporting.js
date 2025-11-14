const PDFDocument = require('pdfkit');

const buildMonthlyReport = ({ kpis, reasons, closers, insights }) => {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

  doc.fontSize(20).text('Roomvu Monthly Churn Report', { align: 'center' });
  doc.moveDown().fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(14).text('Key Metrics', { underline: true });
  doc.moveDown(0.5);
  Object.entries(kpis).forEach(([label, value]) => {
    doc.fontSize(11).text(`${label}: ${value}`);
  });

  doc.moveDown().fontSize(14).text('Reason Breakdown', { underline: true });
  reasons.forEach((reason) => {
    doc.fontSize(11).text(`${reason.label}: ${reason.value} cancellations`);
  });

  doc.moveDown().fontSize(14).text('Closer Performance', { underline: true });
  closers.forEach((closer) => {
    doc
      .fontSize(11)
      .text(
        `${closer.name}: ${closer.saves} saves / ${closer.cancellations} cancels (Save rate ${(
          closer.saveRate * 100
        ).toFixed(1)}%)`
      );
  });

  doc.moveDown().fontSize(14).text('Insights', { underline: true });
  insights.forEach((insight, idx) => {
    doc.fontSize(11).text(`${idx + 1}. ${insight}`);
  });

  doc.end();
  return doc;
};

module.exports = {
  buildMonthlyReport
};

