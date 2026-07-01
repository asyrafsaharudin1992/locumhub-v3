import nodemailer from "nodemailer";

const createMailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Prevents certificate chain issues
      },
    });
  }
  return null;
};

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Validate HTTP method
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Extract email parameters from request body
  const { to, subject, text, html } = req.body;

  // Validate required fields
  if (!to || !subject || !text) {
    return res.status(400).json({
      error: "Missing required fields: to, subject, and text are required",
    });
  }

  const fromEmail = "operation@hsohealthcare.com";

  try {
    // Create mail transporter
    const transporter = createMailTransporter();

    if (!transporter) {
      console.warn("[Email Error] SMTP credentials are not configured.");
      return res.status(500).json({
        error: "SMTP configuration is missing. Please add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to environment variables.",
      });
    }

    // Send email via SMTP
    await transporter.sendMail({
      from: `"HSO Healthcare Operations" <${fromEmail}>`,
      to,
      subject,
      text,
      html: html || undefined,
    });

    console.log(`[Email Sent Successfully] To: ${to}, Subject: ${subject}`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return res.status(500).json({
      error: error.message || "Failed to send email",
    });
  }
}
