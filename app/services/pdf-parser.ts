import axios from 'axios';

export interface PdfParseResult {
  success: boolean;
  text?: string;
  document_type?: string;
  error?: string;
  metadata?: {
    filename?: string;
    [key: string]: any;
  };
}

export class PdfParserService {
  private parserUrl: string;

  constructor() {
    // Use the URL from the GitHub repository's example
    this.parserUrl = process.env.PDF_PARSER_API_URL || 'http://localhost:5000';
  }

  async parsePdfFromUrl(
    url: string, 
    contentType: string = 'application/pdf'
  ): Promise<PdfParseResult> {
    try {
      console.log(`Parsing document from URL: ${url}`);
      
      // Validate URL
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid document URL provided');
      }

      // Special handling for Google Drive URLs
      let parsedUrl = url;
      if (url.includes('drive.google.com')) {
        console.log('Detected Google Drive URL, sending directly to parser');
      }

      // Make the API call directly with the URL as shown in the README
      const response = await axios.post(this.parserUrl, 
        { url: parsedUrl },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // 30 seconds timeout
        }
      );

      // Handle the response according to the README format
      if (response.data && response.data.text) {
        return {
          success: true,
          text: response.data.text,
          document_type: response.data.document_type || 
            (contentType.includes('pdf') ? 'pdf' : 
            contentType.includes('docx') ? 'docx' : 
            url.includes('drive.google.com') ? 'gdrive' : 'unknown'),
          metadata: {
            filename: url.split('/').pop()
          }
        };
      }

      // Response error handling
      return {
        success: false,
        error: 'No content extracted from document'
      };
    } catch (error) {
      console.error('Document Parsing Error:', error);

      // Detailed error handling
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Unknown document parsing error'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown document parsing error'
      };
    }
  }
} 