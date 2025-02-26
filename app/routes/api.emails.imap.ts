import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { simpleParser } from 'mailparser';
import { createRequire } from 'module';
import { extractApplicantDetails, ApplicantDetails } from '~/services/openai-applicant-extraction';

import * as imapSimple from 'imap-simple'


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
    filename: string;
    contentType: string;
    size: number;
    contentPreview: string;
    downloadUrl?: string;
  }>;
  body: string;
  applicantDetails?: ApplicantDetails | null;
}

// IMAP Email Fetcher
class ImapEmailFetcher {
  private config: any;

  constructor() {
    this.config = {
      imap: {
        user: process.env.ZOHO_IMAP_USERNAME,
        password: process.env.ZOHO_IMAP_APP_PASSWORD,
        host: 'imappro.zoho.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
      }
    };
  }

  async fetchEmails(limit: number = 5): Promise<ParsedEmail[]> {
    console.log('Connecting to IMAP server...');
    
    try {
      // Add timeout to the connection attempt
      const connectionPromise = imapSimple.connect(this.config);
      const connection = await Promise.race([
        connectionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000))
      ]) as any;
      
      console.log('Connected to IMAP server, opening INBOX...');
      await connection.openBox('INBOX');

      // Use a more targeted search to improve performance
      // Search only for messages received in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      console.log('Searching for emails from the last 7 days...');
      const searchCriteria = [['SINCE', sevenDaysAgo]];
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false
      };

      // Add timeout to the search operation
      const searchPromise = connection.search(searchCriteria, fetchOptions);
      const messages = await Promise.race([
        searchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Search timeout after 30 seconds')), 30000))
      ]) as any;
      
      console.log(`Found ${messages.length} emails in the last 7 days`);
      
      // Get the last 'limit' messages
      const recentMessages = messages.slice(-limit);
      const emails: ParsedEmail[] = [];
      
      // Process each message
      for (const message of recentMessages) {
        try {
          // Get header and parse info
          const headerPart = message.parts.find(part => part.which === 'HEADER');
          const bodyPart = message.parts.find(part => part.which === 'TEXT');
          const fullPart = message.parts.find(part => part.which === '');
          
          const header = headerPart ? headerPart.body : {};
          const subject = Array.isArray(header.subject) ? header.subject[0] : header.subject || 'No Subject';
          const from = Array.isArray(header.from) ? header.from[0] : header.from || 'Unknown';
          const to = Array.isArray(header.to) ? header.to[0] : header.to || 'Unknown';
          const date = new Date(header.date ? header.date[0] : Date.now());
          
          // Parse email content
          let body = '';
          let attachments = [];
          
          if (fullPart) {
            const parsed = await simpleParser(fullPart.body);
            body = parsed.text || '';
            
            // Process attachments
            attachments = parsed.attachments.map(attachment => ({
              filename: attachment.filename || 'unnamed',
              contentType: attachment.contentType,
              size: attachment.size,
              contentPreview: this.getAttachmentPreview(attachment)
            }));
          }
          
          // Create email object
          const email: ParsedEmail = {
            id: message.attributes.uid.toString(),
            subject,
            from,
            to,
            date,
            snippet: body.substring(0, 200),
            hasAttachment: attachments.length > 0,
            attachments,
            body
          };
          
          // Extract applicant details
          try {
            email.applicantDetails = await extractApplicantDetails(
              body, 
              attachments.map(a => a.contentPreview)
            );
          } catch (error) {
            console.error('Error extracting applicant details:', error);
          }
          
          emails.push(email);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }

      console.log(`Processed ${emails.length} emails`);
      
      // Make sure to close the connection in a finally block
      try {
        await connection.end();
        console.log('IMAP connection closed');
      } catch (endError) {
        console.error('Error closing IMAP connection:', endError);
      }
      
      return emails;
    } catch (error) {
      console.error('IMAP operation failed:', error);
      throw error;
    }
  }

  // Get attachment preview
  private getAttachmentPreview(attachment: any): string {
    try {
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
      return 'Content preview unavailable';
    }
  }
}

// Loader function for the API route
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    
    if (!process.env.ZOHO_IMAP_USERNAME || !process.env.ZOHO_IMAP_APP_PASSWORD) {
      console.error('IMAP credentials not configured');
      return json({
        success: false,
        error: 'IMAP credentials not configured',
        emails: []
      }, { status: 401 });
    }

    console.log('Starting IMAP email fetch...');
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