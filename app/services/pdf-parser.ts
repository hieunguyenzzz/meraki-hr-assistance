import axios from 'axios';

export interface PdfParseResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    filename?: string;
    pageCount?: number;
    [key: string]: any;
  };
}

export class PdfParserService {
  private parserUrl: string;

  constructor() {
    this.parserUrl = process.env.PDF_PARSER_URL || 'https://pdf-parser.hieunguyen.dev';
  }

  async parsePdfFromUrl(pdfUrl: string): Promise<PdfParseResult> {
    try {
      // Validate URL
      if (!pdfUrl || !pdfUrl.startsWith('http')) {
        throw new Error('Invalid PDF URL provided');
      }

      // Make the API call
      const response = await axios.post(this.parserUrl, 
        { url: pdfUrl },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // 30 seconds timeout
        }
      );

      // Check response
      if (response.data && response.data.text) {
        return {
          success: true,
          content: response.data.text,
          metadata: {
            // You can add more metadata parsing if needed
            filename: pdfUrl.split('/').pop()
          }
        };
      }

      // If no content is returned
      return {
        success: false,
        error: 'No content extracted from PDF'
      };
    } catch (error) {
      console.error('PDF Parsing Error:', error);

      // Detailed error handling
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Unknown PDF parsing error'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown PDF parsing error'
      };
    }
  }
} 