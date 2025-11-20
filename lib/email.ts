interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: EmailData) {
  // Basic email sending function
  // You can integrate with services like SendGrid, Resend, or Nodemailer

  console.log("Sending email:", data);

  // Example using fetch to an email service API
  // Replace with your actual email service
  /*
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || "noreply@yourdomain.com",
      to: data.to,
      subject: data.subject,
      html: data.html,
    }),
  });

  return response.json();
  */

  // For now, just log
  return { success: true };
}

export function buildSessionSummaryEmail(
  session: any,
  answers: any[]
): string {
  let html = `
    <h2>New Form Submission</h2>
    <p><strong>Phone Number:</strong> ${session.phoneNumber}</p>
    <p><strong>Flow:</strong> ${session.flow?.name}</p>
    <p><strong>Completed:</strong> ${new Date(session.updatedAt).toLocaleString()}</p>
    <hr>
    <h3>Answers:</h3>
    <ul>
  `;

  answers.forEach((answer) => {
    html += `
      <li>
        <strong>${answer.question}</strong><br>
        ${answer.answer}
      </li>
    `;
  });

  html += `
    </ul>
  `;

  return html;
}
