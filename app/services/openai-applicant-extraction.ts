import OpenAI from 'openai';

export interface ApplicantDetails {
  name: string;
  dateOfBirth: string;
  education: string;
  experiences: string;
}

export async function extractApplicantDetails(
  emailBody: string, 
  attachmentContents: string[]
): Promise<ApplicantDetails> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // Combine email body and attachment contents
  const combinedText = `
    Email Body: ${emailBody}
    
    Attachments:
    ${attachmentContents.map((content, index) => `Attachment ${index + 1}: ${content}`).join('\n')}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system", 
          content: `You are an HR assistant specializing in extracting applicant details for a Wedding Planner position. 
          Extract the following details from the email and attachments:
          1. Full Name of Applicant
          2. Date of Birth
          3. Education (Highest Degree, Major, Institution)
          4. Relevant Work Experiences

          If any information is not clearly present, return "Not Found" for that field.
          Provide the response in a structured JSON format.`
        },
        {
          role: "user",
          content: combinedText
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the response
    const applicantDetails = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      name: applicantDetails.name || 'Not Found',
      dateOfBirth: applicantDetails.dateOfBirth || 'Not Found',
      education: applicantDetails.education || 'Not Found',
      experiences: applicantDetails.experiences || 'Not Found'
    };
  } catch (error) {
    console.error('Error extracting applicant details:', error);
    return {
      name: 'Extraction Failed',
      dateOfBirth: 'Extraction Failed',
      education: 'Extraction Failed',
      experiences: 'Extraction Failed'
    };
  }
} 