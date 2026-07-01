import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Create transporter
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
        rejectUnauthorized: false, // Prevents issues with self-signed or intermediate certificates
      },
    });
  }
  return null;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON requests
  app.use(express.json());

  // API Route: Send Email Confirmation
  app.post("/api/send-email", async (req, res) => {
    const { to, doctorName, date, time, branch } = req.body;

    if (!to) {
      return res.status(400).json({ error: "Recipient email is required" });
    }

    const subject = `Confirmation of Slot - ${branch}`;
    const text = `Hi/salam Dr ${doctorName || "Doctor"},

Thank you for taking up the slot, details as below:

Date: ${date || "N/A"}
Time: ${time || "N/A"}
Branch: ${branch || "N/A"}

Please check the app for more info.

Thank you.`;

    const fromEmail = "operation@hsohealthcare.com";

    try {
      const transporter = createMailTransporter();

      if (transporter) {
        await transporter.sendMail({
          from: `"HSO Healthcare Operations" <${fromEmail}>`,
          to,
          subject,
          text,
        });

        console.log(`[Email Sent Successfully] To: ${to}, Subject: ${subject}`);
        return res.json({
          success: true,
          message: "Email sent successfully via SMTP",
          sentRealEmail: true,
        });
      } else {
        // Fallback: Simulation/Mock mode
        console.log(`
========================================================================
[EMAIL SIMULATION MODE] SMTP credentials not fully configured in environment.
------------------------------------------------------------------------
FROM: "HSO Healthcare Operations" <${fromEmail}>
TO: ${to}
SUBJECT: ${subject}
BODY:
${text}
========================================================================
`);
        return res.json({
          success: true,
          message: "Email simulated successfully (SMTP not configured)",
          sentRealEmail: false,
          preview: text,
        });
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      return res.status(500).json({
        error: error.message || "Failed to send email through SMTP mailer",
      });
    }
  });

  // API Route: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
