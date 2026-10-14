import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

/**
 * Email Job Data Structure
 */
export interface EmailJobData {
  type: 'schedule_created' | 'schedule_cancelled';
  customerEmail: string;
  customerName: string;
  doctorName: string;
  scheduledAt: string; // ISO 8601 UTC timestamp
  objective: string;
}

/**
 * NotificationProcessor
 * 
 * Processes email notification jobs from the Bull queue.
 * Uses Nodemailer to send emails via Mailpit SMTP.
 * */
@Processor('notification')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly transporter: Transporter;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    // Get SMTP configuration from environment
    this.smtpHost = this.configService.get<string>('SMTP_HOST') || 'mailpit';
    this.smtpPort = this.configService.get<number>('SMTP_PORT') || 1025;
    this.fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || 'noreply@healthcare-scheduling.com';
    this.fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'Healthcare Scheduling System';

    // Create Nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: false, // Mailpit doesn't use TLS
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates for Mailpit
      },
    });

    this.logger.log(`Email transporter configured: ${this.smtpHost}:${this.smtpPort}`);
  }

  /**
   * Process email notification jobs
   * 
   * Formats and sends emails based on job type (schedule_created or schedule_cancelled).
   * Converts UTC timestamps to Jakarta timezone for display.
   *   */
  @Process('send-email')
  async handleEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { type, customerEmail, customerName, doctorName, scheduledAt, objective } = job.data;

    this.logger.log(`Processing email job ${job.id}: ${type} for ${customerEmail}`);

    try {
      // Convert UTC timestamp to Jakarta timezone (Asia/Jakarta, UTC+7)
      const jakartaTime = this.formatDateTimeJakarta(scheduledAt);

      // Build email subject and body based on type
      let subject: string;
      let html: string;

      if (type === 'schedule_created') {
        // Confirmation email template
        subject = `Konfirmasi Jadwal - ${doctorName}`;
        html = this.buildScheduleCreatedEmail(customerName, doctorName, jakartaTime, objective);
      } else if (type === 'schedule_cancelled') {
        // Cancellation email template
        subject = `Pembatalan Jadwal - ${doctorName}`;
        html = this.buildScheduleCancelledEmail(customerName, doctorName, jakartaTime, objective);
      } else {
        throw new Error(`Unknown email type: ${type}`);
      }

      // Send email using Nodemailer
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: customerEmail,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${customerEmail}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to process email job ${job.id}:`, error);
      throw error; // Let Bull handle retry logic
    }
  }

  /**
   * Format UTC timestamp to Jakarta timezone (Asia/Jakarta, UTC+7)
   * Returns formatted string: "Kamis, 15 Oktober 2026 pukul 14:00 WIB"
   *   */
  private formatDateTimeJakarta(isoTimestamp: string): string {
    const date = new Date(isoTimestamp);

    // Format date in Jakarta timezone
    const formatted = date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${formatted} WIB`;
  }

  /**
   * Build email HTML for schedule_created notification
   *   */
  private buildScheduleCreatedEmail(
    customerName: string,
    doctorName: string,
    jakartaTime: string,
    objective: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          h2 { color: #2c5282; }
          .details { background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .details ul { list-style: none; padding: 0; }
          .details li { margin: 10px 0; }
          .label { font-weight: bold; color: #2d3748; }
          .footer { margin-top: 30px; font-size: 0.9em; color: #718096; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Konfirmasi Jadwal Konsultasi</h2>
          <p>Halo <strong>${customerName}</strong>,</p>
          <p>Jadwal konsultasi Anda telah berhasil dibuat dengan detail berikut:</p>
          
          <div class="details">
            <ul>
              <li><span class="label">Dokter:</span> ${doctorName}</li>
              <li><span class="label">Waktu:</span> ${jakartaTime}</li>
              <li><span class="label">Keperluan:</span> ${objective}</li>
            </ul>
          </div>
          
          <p>Terima kasih telah menggunakan layanan kami.</p>
          
          <div class="footer">
            <p>Email ini dikirim secara otomatis, mohon tidak membalas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build email HTML for schedule_cancelled notification
   *   */
  private buildScheduleCancelledEmail(
    customerName: string,
    doctorName: string,
    jakartaTime: string,
    objective: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          h2 { color: #c53030; }
          .details { background-color: #fff5f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #fc8181; }
          .details ul { list-style: none; padding: 0; }
          .details li { margin: 10px 0; }
          .label { font-weight: bold; color: #2d3748; }
          .notice { background-color: #fef5e7; padding: 10px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 0.9em; color: #718096; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Pembatalan Jadwal Konsultasi</h2>
          <p>Halo <strong>${customerName}</strong>,</p>
          <p>Jadwal konsultasi Anda telah dibatalkan dengan detail berikut:</p>
          
          <div class="details">
            <ul>
              <li><span class="label">Dokter:</span> ${doctorName}</li>
              <li><span class="label">Waktu:</span> ${jakartaTime}</li>
              <li><span class="label">Keperluan:</span> ${objective}</li>
            </ul>
          </div>
          
          <div class="notice">
            <p><strong>Pemberitahuan:</strong> Jadwal konsultasi ini telah dibatalkan. Jika Anda memerlukan konsultasi, silakan buat jadwal baru melalui sistem kami.</p>
          </div>
          
          <p>Mohon maaf atas ketidaknyamanannya.</p>
          
          <div class="footer">
            <p>Email ini dikirim secara otomatis, mohon tidak membalas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
