import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export interface Attachment {
  filename: string;
  contentType: string;
  contentPreview: string;
  url: string;
}

export interface ApplicantDetails {
  fullName?: string;
  position?: string;
  yearOfBirth?: number;
  phone?: string;
  email?: string;
  address?: string;
  cvUrl?: string;
  portfolioUrl?: string;
  source?: string;
  school?: string;
  otherAttachmentUrls?: string[];
  summary?: string;
}

export async function extractApplicantDetails(
  text: string, 
  attachments: Attachment[]
): Promise<ApplicantDetails> {
  try {
    // Prepare detailed attachment information
    const attachmentDetails = attachments.map(attachment => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      preview: attachment.contentPreview.slice(0, 500),
      url: attachment.url
    }));

    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system', 
          content: `You are a professional resume and portfolio analyzer. 
          Extract structured information about the applicant and identify CV and portfolio.
          
          Provide JSON with these fields: 
          fullName, position, yearOfBirth, phone, email, address, cvUrl, portfolioUrl, source, school, otherAttachmentUrls, summary

          Attachment Analysis Rules:
          - Carefully examine each attachment's filename, content type, and preview
          - Identify which attachment is most likely a CV/Resume
          - Identify which attachment is most likely a Portfolio
          - Use the URL of the identified attachments
          - If unsure, leave CV or Portfolio URL empty
          - the position is either "Wedding Planner" or "Wedding Planner Assistant", if not found or not sure, leave it empty
          
          Summary Guidelines:
          - Create a detail summary of the applicant, education, experience, skills, and potential
          - Include the applicant's strengths, weaknesses, and potential
          - Include the details of the applicant's experience
          - Keep it around 300 400 characters
          - vietnamese
          
          Other Attachments Guidelines:
          - Identify any attachments that are NOT CV or Portfolio
          - Collect URLs of these other attachments
          - If no other attachments, leave otherAttachmentUrls as an empty array
          
          Extraction Guidelines:
          - Use the most relevant information from the text and attachments
          - address is location
          - yearOfBirth should be 4-digit year, if not found or not sure, leave it empty
          - Be precise and concise`
        },
        {
          role: 'user', 
          content: `
            Extract applicant details from this text and attachments:

            Text:
            ${text.slice(0, 4000)}

            Attachments:
            ${JSON.stringify(attachmentDetails, null, 2)}
          `
        }
      ],
      max_tokens: 500
    })

    const rawContent = extraction.choices[0].message.content || '{}';
    const parsedDetails: ApplicantDetails = JSON.parse(rawContent);

    return parsedDetails;
  } catch (error) {
    console.error('Applicant details extraction error:', error)
    return {};
  }
} 