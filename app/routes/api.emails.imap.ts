import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { simpleParser } from 'mailparser';
import * as imapSimple from 'imap-simple'
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { R2UploadService } from '~/services/r2-upload';
import { PdfParserService, PdfParseResult } from '~/services/pdf-parser';
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
    filename: string;
    contentType: string;
    size: number;
    contentPreview: string;
    url?: string;
  }>;
  body: string;
  applicantDetails?: ApplicantDetails;
}

// Create portfolio directory if it doesn't exist
const portfolioDir = path.join(process.cwd(), 'public', 'portfolio');
if (!fs.existsSync(portfolioDir)) {
  fs.mkdirSync(portfolioDir, { recursive: true });
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
        authTimeout: 30000
      }
    };
  }

  async fetchEmails(limit: number = 5, flaggedOnly: boolean = false): Promise<ParsedEmail[]> {
    console.log('Connecting to IMAP server...');
    
    try {
      // Connect to IMAP server
      const connection = await imapSimple.connect(this.config);
      console.log('Connected to IMAP server, opening INBOX...');
      
      // Open inbox
      await connection.openBox('INBOX');
      
      // Get most recent emails
      console.log(`Fetching the most recent ${limit} emails...`);
      
      // Modify search criteria to include flagged emails if requested
      const searchCriteria = flaggedOnly 
        ? ['FLAGGED'] 
        : ['ALL'];
      
      // Fetch UIDs based on search criteria
      const allUids = await connection.search(searchCriteria, { uid: true });
      console.log(`Found ${allUids.length} ${flaggedOnly ? 'flagged' : 'total'} messages`);
      
      // Get the most recent UIDs
      const recentUids = allUids.slice(-limit).map(msg => msg.attributes.uid);
      console.log(`Fetching ${recentUids.length} most recent ${flaggedOnly ? 'flagged' : ''} emails (UIDs: ${recentUids.join(',')})`);

      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false
      };
     
      // Fetch the specific UIDs
      const messages = await connection.search([['UID', recentUids.join(',')]], fetchOptions);
      console.log(`Fetched ${messages.length} messages`);
      
      // Get only the most recent messages
      const recentMessages = messages.slice(-limit);
      console.log(`Processing ${recentMessages.length} most recent messages`);
      
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
            attachments = await Promise.all(parsed.attachments.map(async (attachment) => {
              const r2Uploader = new R2UploadService();
              let publicUrl = '';

              // Upload PDFs and get public URL
              if (attachment.contentType.includes('pdf')) {
                publicUrl = await r2Uploader.uploadFile(
                  attachment.content, 
                  attachment.filename, 
                  'application/pdf'
                );
              }

              const attachmentInfo = {
                filename: attachment.filename || 'unnamed',
                contentType: attachment.contentType,
                size: attachment.size,
                contentPreview: await this.getAttachmentPreview(attachment),
                url: publicUrl  // Add the URL for PDF attachments
              };

              return attachmentInfo;
            }));
          }

          // Log email body and attachments
          console.log(`\n--- Email from ${from} ---`);
          console.log(`Subject: ${subject}`);
          console.log(`Body: ${body.substring(0, 500)}${body.length > 500 ? '...' : ''}`);
          
          if (attachments.length > 0) {
            console.log(`\n--- Attachments (${attachments.length}) ---`);
            attachments.forEach((attachment, index) => {
              console.log(`Attachment ${index + 1}: ${attachment.filename} (${attachment.contentType})`);
              console.log(`Preview: ${attachment.contentPreview}`);
            });
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
            // Combine email body with attachment text for better extraction
            const allText = [
              body,
              ...attachments.map(a => a.contentPreview)
            ].join('\n\n');
            
            console.log('\n--- Sending combined content for applicant extraction ---');
            email.applicantDetails = await extractApplicantDetails(allText, attachments);
            console.log('Extracted applicant details:', JSON.stringify(email.applicantDetails, null, 2));
          } catch (error) {
            console.error('Error extracting applicant details:', error);
          }
          
          emails.push(email);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }

      console.log(`Processed ${emails.length} emails`);
      
      // Close the connection
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

  // Get attachment preview and full content
  private async getAttachmentPreview(attachment: any): Promise<string> {
    try {
      let contentPreview = '';

      // Handle different content types
      if (attachment.contentType.includes('text')) {
        const textContent = attachment.content.toString('utf-8');
        contentPreview = textContent.substring(0, 100) + '...';
        
        console.log(`\n--- Full Text Attachment: ${attachment.filename} ---`);
        console.log(textContent);
        
        return contentPreview;
      } else if (attachment.contentType.includes('pdf')) {
        try {
          // Upload PDF to R2
          const r2Uploader = new R2UploadService();
          const publicUrl = await r2Uploader.uploadFile(
            attachment.content, 
            attachment.filename, 
            'application/pdf'
          );
          
          console.log(`\n--- PDF Attachment: ${attachment.filename} ---`);
          console.log(`Uploaded to: ${publicUrl}`);
          
          // Parse PDF content
          const pdfParserService = new PdfParserService();
          const parseResult = await pdfParserService.parsePdfFromUrl(publicUrl);
          
          if (parseResult.success && parseResult.content) {
            console.log(`\n--- PDF Content Parsed: ${attachment.filename} ---`);
            console.log(parseResult.content.substring(0, 500) + '...');
            
            contentPreview = `[PDF document available at: ${publicUrl}. Content preview: ${parseResult.content.substring(0, 200)}...]`;
          } else {
            console.warn(`Failed to parse PDF content: ${parseResult.error}`);
            contentPreview = `[PDF document available at: ${publicUrl}. Content extraction failed.]`;
          }
          
          return contentPreview;
        } catch (err) {
          console.error(`Error processing PDF ${attachment.filename}:`, err);
          return `[PDF: ${attachment.filename} - processing failed]`;
        }
      } else if (attachment.contentType.includes('image')) {
        contentPreview = '[Image content]';
        
        console.log(`\n--- Image Attachment: ${attachment.filename} ---`);
        console.log('Image content is binary and cannot be directly printed.');
      } else if (attachment.contentType.includes('application')) {
        contentPreview = `[${attachment.contentType.split('/')[1].toUpperCase()} document]`;
        
        console.log(`\n--- Application Attachment: ${attachment.filename} ---`);
        console.log('Application document content is binary and cannot be directly printed.');
      } else {
        contentPreview = '[Binary content]';
        
        console.log(`\n--- Unknown Attachment: ${attachment.filename} ---`);
        console.log('Attachment content type is unrecognized.');
      }

      return contentPreview;
    } catch (error) {
      console.error(`Error processing attachment ${attachment.filename}:`, error);
      return 'Content preview unavailable';
    }
  }
}

// Loader function for the API route
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    const flaggedOnly = url.searchParams.get('flagged') === 'true';
    
    if (!process.env.ZOHO_IMAP_USERNAME || !process.env.ZOHO_IMAP_APP_PASSWORD) {
      console.error('IMAP credentials not configured');
      return json({
        success: false,
        error: 'IMAP credentials not configured',
        emails: []
      }, { status: 401 });
    }

    console.log(`Starting IMAP email fetch (${flaggedOnly ? 'flagged only' : 'all emails'})...`);
    const imapFetcher = new ImapEmailFetcher();
    const emails = await imapFetcher.fetchEmails(limit, flaggedOnly);
    
    return json({
      success: true,
      emails,
      total: emails.length,
      flaggedOnly
    });
  } catch (error) {
    console.error('Detailed IMAP Emails Error:', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      emails: []
    }, { status: 500 });
  }
} 