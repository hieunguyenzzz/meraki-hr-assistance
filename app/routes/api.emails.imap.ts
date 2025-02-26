import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { simpleParser } from 'mailparser';
import * as Imap from 'node-imap';
import { extractApplicantDetails, ApplicantDetails } from '~/services/openai-applicant-extraction';

// Interface for parsed email
interface ParsedEmail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  hasAttachment: boolean;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
    contentPreview: string;
  }>;
  body: string;
  applicantDetails?: ApplicantDetails | null;
}

// IMAP Email Fetcher
class ImapEmailFetcher {
  private config: Imap.Config;

  constructor() {
    this.config = {
      user: process.env.ZOHO_IMAP_USERNAME,
      password: process.env.ZOHO_IMAP_APP_PASSWORD,
      host: 'imap.zoho.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
  }

  // Fetch emails from IMAP server
  async fetchEmails(limit: number = 5): Promise<ParsedEmail[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.config);
      const emails: ParsedEmail[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, async (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          // Calculate start and end sequence numbers
          const start = Math.max(1, box.messages.total - limit);
          const end = box.messages.total;

          const fetch = imap.seq.fetch(`${start}:${end}`, {
            bodies: ['HEADER', 'TEXT'],
            markSeen: false,
            envelope: true,
            struct: true
          });

          fetch.on('message', (msg) => {
            const email: Partial<ParsedEmail> = {
              attachments: []
            };

            msg.on('body', async (stream, info) => {
              if (info.which === 'HEADER') {
                const header = await this.parseHeader(stream);
                email.subject = header.subject;
                email.from = header.from;
                email.to = header.to;
                email.date = header.date;
              }

              if (info.which === 'TEXT') {
                const parsed = await simpleParser(stream);
                email.body = parsed.text || '';
                email.snippet = parsed.text?.substring(0, 200) || '';
                email.hasAttachment = parsed.attachments.length > 0;

                // Process attachments
                for (const attachment of parsed.attachments) {
                  try {
                    const contentPreview = await this.getAttachmentPreview(attachment);
                    email.attachments?.push({
                      id: attachment.checksum,
                      filename: attachment.filename || 'unnamed',
                      contentType: attachment.contentType,
                      size: attachment.size,
                      content: attachment.content,
                      contentPreview
                    });
                  } catch (attachmentError) {
                    console.error('Attachment processing error:', attachmentError);
                  }
                }
              }
            });

            msg.once('end', () => {
              if (email.subject && email.body) {
                emails.push(email as ParsedEmail);
              }
            });
          });

          fetch.once('error', (fetchErr) => {
            console.error('Fetch error:', fetchErr);
            reject(fetchErr);
          });

          fetch.once('end', async () => {
            // Sort emails by date (most recent first)
            emails.sort((a, b) => b.date.getTime() - a.date.getTime());

            // Extract applicant details for each email
            for (const email of emails) {
              try {
                email.applicantDetails = await extractApplicantDetails(
                  email.body, 
                  email.attachments.map(a => a.contentPreview)
                );
              } catch (detailsError) {
                console.error('Error extracting applicant details:', detailsError);
                email.applicantDetails = null;
              }
            }

            imap.end();
            resolve(emails);
          });
        });
      });

      imap.once('error', (err) => {
        console.error('IMAP connection error:', err);
        reject(err);
      });

      imap.connect();
    });
  }

  // Parse email header
  private parseHeader(stream: NodeJS.ReadableStream): Promise<{
    subject: string;
    from: string;
    to: string;
    date: Date;
  }> {
    return new Promise((resolve, reject) => {
      Imap.parseHeader(stream, (err, headers) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          subject: headers.subject?.[0] || 'No Subject',
          from: headers.from?.[0] || 'Unknown Sender',
          to: headers.to?.[0] || 'Unknown Recipient',
          date: new Date(headers.date?.[0] || Date.now())
        });
      });
    });
  }

  // Get attachment preview
  private async getAttachmentPreview(attachment: any): Promise<string> {
    try {
      // Handle different content types
      if (attachment.contentType.includes('text')) {
        const textContent = attachment.content.toString('utf-8');
        return textContent.substring(0, 100) + '...';
      } else if (attachment.contentType.includes('pdf')) {
        return '[PDF document]';
      } else if (attachment.contentType.includes('image')) {
        return '[Image content]';
      } else if (attachment.contentType.includes('application')) {
        return `[${attachment.contentType.split('/')[1].toUpperCase()} document]`;
      }
      return '[Binary content]';
    } catch (error) {
      console.error('Attachment preview error:', error);
      return 'Content preview unavailable';
    }
  }
}

// Loader function for the API route
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    
    // Check if IMAP credentials are set
    if (!process.env.ZOHO_IMAP_USERNAME || !process.env.ZOHO_IMAP_APP_PASSWORD) {
      return json({
        success: false,
        error: 'IMAP credentials not configured',
        emails: []
      }, { status: 401 });
    }

    // Fetch emails using IMAP
    const imapFetcher = new ImapEmailFetcher();
    const emails = await imapFetcher.fetchEmails(limit);
    
    return json({
      success: true,
      emails,
      total: emails.length
    });
  } catch (error) {
    console.error('Detailed IMAP Emails Error:', {
      message: error.message,
      stack: error.stack
    });

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      emails: []
    }, { status: 500 });
  }
} 