import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
dotenv.config({ path: path.join(__dirname2, '.env') });

// Generate 6-digit code
export function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create transporter
function createTransporter() {
    // Use Gmail SMTP if credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return null;
}

// Send verification email
export async function sendVerificationEmail(toEmail, code) {
    const transporter = createTransporter();
    
    if (!transporter) {
        console.log('');
        console.log('══════════════════════════════════════════════════');
        console.log(`📧 EMAIL VERIFICATION CODE (Dev Mode)`);
        console.log(`   Email: ${toEmail}`);
        console.log(`   Code : ${code}`);
        console.log('══════════════════════════════════════════════════');
        console.log('');
        console.log('💡 To send real emails, add your Gmail credentials to the .env file.');
        console.log('');
        return { success: true, devMode: true };
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0d1117; color: #ffffff; margin: 0; padding: 40px 20px; }
            .container { max-width: 500px; margin: 0 auto; background: #161b22; border-radius: 20px; border: 1px solid #30363d; overflow: hidden; }
            .header { background: linear-gradient(135deg, #2081e2, #10b981); padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; }
            .content { padding: 35px; text-align: center; }
            .code-box { background: #0d1117; border: 2px solid #2081e2; border-radius: 16px; padding: 25px; margin: 25px 0; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #2081e2; }
            .info { color: #8b949e; font-size: 14px; line-height: 1.6; }
            .footer { padding: 20px; text-align: center; border-top: 1px solid #30363d; }
            .footer p { color: #484f58; font-size: 11px; margin: 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>LITTLEFUN</h1>
            </div>
            <div class="content">
                <h2 style="margin: 0 0 10px; font-weight: 800;">Email Verification</h2>
                <p class="info">Use the code below to verify your account:</p>
                <div class="code-box">${code}</div>
                <p class="info">This code will expire in <strong>5 minutes</strong>.<br>Do not share this code with anyone.</p>
            </div>
            <div class="footer">
                <p>If you did not request this email, please ignore it.</p>
                <p style="margin-top: 5px;">© 2026 LITTLEFUN — Premium Web3 Gaming</p>
            </div>
        </div>
    </body>
    </html>`;

    try {
        await transporter.sendMail({
            from: `"LITTLEFUN" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: '🔐 LITTLEFUN — Your Email Verification Code',
            html: htmlContent
        });
        console.log(`✅ Verification code sent: ${toEmail}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Email could not be sent:', error.message);
        console.log(`📧 Code: ${code} (${toEmail})`);
        return { success: false, error: error.message, devMode: true, code };
    }
}
