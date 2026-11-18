const nodemailer = require("nodemailer");

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Email configuration error:", error.message);
  } else {
    console.log("✅ Email service ready to send emails");
  }
});

// Validate and send via Brevo Transactional Email REST API
const sendBrevoTransactionalEmail = async ({ to, subject, htmlContent, textContent }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const senderName = process.env.BREVO_SENDER_NAME || "ArenaSync";

  if (!apiKey || !senderEmail) {
    throw new Error("Brevo OTP email service is not configured (missing api key or sender email)");
  }

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: to }],
    subject,
    htmlContent,
  };

  if (textContent) {
    payload.textContent = textContent;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Brevo API error: ${response.status}`);
  }

  return true;
};

// Resilient dispatcher: Attempts Brevo API first (if configured), then automatically falls back to Nodemailer (Gmail)
const sendEmailWithFallback = async ({ to, subject, htmlContent, textContent }) => {
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.startsWith("xkeysib-")) {
    try {
      await sendBrevoTransactionalEmail({ to, subject, htmlContent, textContent });
      console.log(`✅ Email sent to ${to} via Brevo API`);
      return true;
    } catch (brevoErr) {
      console.warn(`⚠️ Brevo API delivery failed (${brevoErr.message}). Automatically falling back to Nodemailer (Gmail)...`);
    }
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const mailOptions = {
        from: `"ArenaSync" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: htmlContent,
        text: textContent,
      };
      await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${to} via Nodemailer (Gmail)`);
      return true;
    } catch (nodemailerErr) {
      console.error(`❌ Nodemailer delivery failed to ${to}:`, nodemailerErr.message);
      return false;
    }
  }

  console.error("❌ No working email transport available.");
  return false;
};

// Helper: Wrapper for responsive, cross-client email layout with modern styling
const buildEmailWrapper = ({ badge = "Sports & Arena Management", title, contentHtml }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; width: 100%; padding: 40px 12px;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%); padding: 32px 24px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #e0e7ff; letter-spacing: 1.2px; text-transform: uppercase;">
                    ${badge}
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                🏆 ArenaSync
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 28px 28px 28px; text-align: center; color: #334155; line-height: 1.6;">
              ${contentHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569; font-weight: 600;">
                ArenaSync • Real-Time Sports & Tournament Ecosystem
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                © ${new Date().getFullYear()} ArenaSync. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ================= SEND VERIFICATION EMAIL =================
const sendVerificationEmail = async (email, verificationCode, name) => {
  try {
    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
        Hello, ${name || "User"}! 👋
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
        Thank you for joining <strong>ArenaSync</strong>. Please enter the verification code below to verify your email address:
      </p>
      
      <div style="background: #f8fafc; border: 2px dashed #4f46e5; border-radius: 12px; padding: 22px; margin: 24px 0; text-align: center;">
        <div style="font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
          Your Verification Code
        </div>
        <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1e1b4b; font-family: Consolas, Monaco, monospace; padding-left: 10px;">
          ${verificationCode}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
          ⏱️ This code will expire in <strong>1 hour</strong>
        </div>
      </div>
      
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
        If you didn't create an account with ArenaSync, you can safely ignore this email.
      </p>
      <div style="font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 16px;">
        ⚠️ Never share your verification code with anyone.
      </div>
    `;

    return await sendEmailWithFallback({
      to: email,
      subject: "🔐 Verify Your Email - ArenaSync",
      htmlContent: buildEmailWrapper({ title: "Email Verification", contentHtml }),
      textContent: `Hello ${name || "User"}!\nYour ArenaSync verification code is: ${verificationCode}\nThis code will expire in 1 hour.`,
    });
  } catch (error) {
    console.error("❌ Verification email error:", error.message);
    return false;
  }
};

// ================= SEND PASSWORD RESET EMAIL =================
const sendResetPasswordEmail = async (email, resetCode, name) => {
  try {
    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
        Hello, ${name || "User"}! 👋
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
        We received a request to reset the password for your ArenaSync account. Enter the verification code below:
      </p>
      
      <div style="background: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 22px; margin: 24px 0; text-align: center;">
        <div style="font-size: 12px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
          Password Reset Code
        </div>
        <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #991b1b; font-family: Consolas, Monaco, monospace; padding-left: 10px;">
          ${resetCode}
        </div>
        <div style="font-size: 12px; color: #b91c1c; margin-top: 8px;">
          ⏱️ This code will expire in <strong>1 hour</strong>
        </div>
      </div>
      
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
      <div style="font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 16px;">
        ⚠️ Never share this reset code with anyone.
      </div>
    `;

    return await sendEmailWithFallback({
      to: email,
      subject: "🔐 Password Reset Request - ArenaSync",
      htmlContent: buildEmailWrapper({ title: "Password Reset", contentHtml }),
      textContent: `Hello ${name || "User"}!\nYour ArenaSync password reset code is: ${resetCode}\nThis code will expire in 1 hour.`,
    });
  } catch (error) {
    console.error("❌ Password reset email error:", error.message);
    return false;
  }
};

// ================= SEND WELCOME EMAIL =================
const sendWelcomeEmail = async (email, name) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const contentHtml = `
      <h2 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #0f172a;">
        Welcome, ${name || "Champion"}! 🎉
      </h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
        Your ArenaSync account has been <strong>successfully verified</strong>! You're ready to dive into tournaments and arena operations.
      </p>
      
      <!-- Feature highlights table for 100% email client compatibility -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
        <tr>
          <td width="44" valign="middle" style="padding: 12px 0 12px 16px; font-size: 22px; line-height: 1;">⚽</td>
          <td valign="middle" style="padding: 12px 16px 12px 6px; text-align: left;">
            <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 2px;">Create & Manage Teams</div>
            <div style="font-size: 12px; color: #64748b;">Build custom rosters, manage player invites, and approve teammates.</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
        <tr>
          <td width="44" valign="middle" style="padding: 12px 0 12px 16px; font-size: 22px; line-height: 1;">🏆</td>
          <td valign="middle" style="padding: 12px 16px 12px 6px; text-align: left;">
            <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 2px;">Enter Tournaments</div>
            <div style="font-size: 12px; color: #64748b;">Browse public fixtures and register squads with Razorpay checkout.</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
        <tr>
          <td width="44" valign="middle" style="padding: 12px 0 12px 16px; font-size: 22px; line-height: 1;">📊</td>
          <td valign="middle" style="padding: 12px 16px 12px 6px; text-align: left;">
            <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 2px;">Live Timetables & Results</div>
            <div style="font-size: 12px; color: #64748b;">Track real-time score updates, leaderboards, and prize allocations.</div>
          </td>
        </tr>
      </table>

      <!-- Primary CTA Button (Centered on its own line) -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 28px auto 8px auto;">
        <tr>
          <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);">
            <a href="${frontendUrl}/login" target="_blank" style="display: inline-block; padding: 14px 34px; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: 10px; letter-spacing: 0.3px;">
              Login to Your Account →
            </a>
          </td>
        </tr>
      </table>
    `;

    return await sendEmailWithFallback({
      to: email,
      subject: "🎉 Welcome to ArenaSync!",
      htmlContent: buildEmailWrapper({ title: "Welcome to ArenaSync", contentHtml }),
      textContent: `Welcome, ${name || "Champion"}!\nYour ArenaSync account has been verified.\nLogin now at: ${frontendUrl}/login`,
    });
  } catch (error) {
    console.error("❌ Welcome email error:", error.message);
    return false;
  }
};

// ================= SEND REGISTRATION EMAIL OTP =================
const sendRegistrationEmailOtp = async (email, otpCode) => {
  try {
    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
        Verify Your Email Address
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
        Here is your 6-digit verification code to complete your registration on <strong>ArenaSync</strong>:
      </p>
      
      <div style="background: #f8fafc; border: 2px dashed #4f46e5; border-radius: 12px; padding: 22px; margin: 24px 0; text-align: center;">
        <div style="font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
          Your 6-Digit OTP Code
        </div>
        <div style="font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #1e1b4b; font-family: Consolas, Monaco, monospace; padding-left: 12px;">
          ${otpCode}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
          ⏱️ This OTP expires in <strong>5 minutes</strong>
        </div>
      </div>
      
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
        If you did not request this verification, please safely ignore this email.
      </p>
      <div style="font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 16px;">
        ⚠️ Never share your OTP code with anyone.
      </div>
    `;

    return await sendEmailWithFallback({
      to: email,
      subject: "ArenaSync Email Verification",
      htmlContent: buildEmailWrapper({ title: "Email Verification", contentHtml }),
      textContent: `Your ArenaSync verification code is:\n\n${otpCode}\n\nThis OTP expires in 5 minutes.\n\nIf you did not request this verification, ignore this email.`,
    });
  } catch (error) {
    console.error("❌ Registration OTP email error:", error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendRegistrationEmailOtp
};
