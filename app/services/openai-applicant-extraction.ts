import OpenAI from 'openai';

export interface ApplicantDetails {
  name: string;
  email: string;
  position: string;
  dateOfBirth: string;
  education: {
    degree: string;
    major: string;
    institution: string;
    graduationYear?: string;
  };
  workExperiences: Array<{
    company: string;
    position: string;
    duration: string;
    responsibilities?: string[];
  }>;
  salaryExpectation: string;
  address: {
    full?: string;
    city?: string;
    country?: string;
  };
  availability: {
    startDate?: string;
    noticePeriod?: string;
  };
  contactInfo: {
    phoneNumber?: string;
    email?: string;
  };
  additionalNotes?: string;
  extractionStatus: 'success' | 'partial' | 'failed';
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

  // Detailed debugging log
  console.log('OpenAI Extraction Debug:', {
    emailBodyLength: emailBody.length,
    attachmentCount: attachmentContents.length,
    apiKeyPresent: !!process.env.OPENAI_API_KEY
  });

  try {
    console.log('Starting OpenAI extraction...');
    console.log('Combined text:', combinedText.length);
    console.log('API Key:', !!process.env.OPENAI_API_KEY);

    // More detailed system prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system", 
          content: `You are an advanced HR assistant specializing in extracting comprehensive applicant details for a Wedding Planner position. 

          Carefully analyze the email and attachments to extract as much information as possible. Be thorough and precise.

          Extract the following details with maximum possible specificity:
          1. Full Name (First, Middle, Last if possible)
          2. Contact Information
             - Email Address
             - Phone Number
             - Full Address
          3. Professional Details
             - Position Applied For
             - Current/Most Recent Job
             - Relevant Work Experiences (detailed)
          4. Educational Background
             - Highest Degree
             - Major/Specialization
             - Institution Name
             - Graduation Year
          5. Additional Insights
             - Salary Expectation
             - Earliest Start Date
             - Notice Period
             - Any unique skills or experiences relevant to Wedding Planning

          Provide a structured, comprehensive response. If any information is not clearly present, explain why in the 'additionalNotes' field.

          Response must be a valid, complete JSON object covering all these aspects.`
        },
        {
          role: "user",
          content: combinedText
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000  // Increased to allow more detailed response
    });

    // Log the raw response for debugging
    console.log('OpenAI Raw Response:', JSON.stringify(response, null, 2));

    // Attempt to parse the response
    let applicantDetails;
    try {
      applicantDetails = JSON.parse(response.choices[0].message.content || '{}');
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError);
      throw new Error('Failed to parse OpenAI response');
    }

    // Comprehensive validation and default handling
    const processedDetails: ApplicantDetails = {
      name: applicantDetails.name || 'Not Found',
      email: applicantDetails.contactInfo?.email || applicantDetails.email || 'Not Found',
      position: applicantDetails.position || 'Wedding Planner Assistant',
      dateOfBirth: applicantDetails.dateOfBirth || 'Not Found',
      education: {
        degree: applicantDetails.education?.degree || 'Not Found',
        major: applicantDetails.education?.major || 'Not Specified',
        institution: applicantDetails.education?.institution || 'Not Found',
        graduationYear: applicantDetails.education?.graduationYear
      },
      workExperiences: Array.isArray(applicantDetails.workExperiences) 
        ? applicantDetails.workExperiences 
        : [],
      salaryExpectation: applicantDetails.salaryExpectation || 'Not Disclosed',
      address: {
        full: applicantDetails.address?.full,
        city: applicantDetails.address?.city,
        country: applicantDetails.address?.country
      },
      availability: {
        startDate: applicantDetails.availability?.startDate,
        noticePeriod: applicantDetails.availability?.noticePeriod
      },
      contactInfo: {
        phoneNumber: applicantDetails.contactInfo?.phoneNumber,
        email: applicantDetails.contactInfo?.email
      },
      additionalNotes: applicantDetails.additionalNotes || '',
      extractionStatus: 'success'
    };

    // Additional logging for verification
    console.log('Processed Applicant Details:', JSON.stringify(processedDetails, null, 2));

    return processedDetails;
  } catch (error) {
    console.error('Comprehensive Error in Applicant Details Extraction:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    });

    // Return a detailed error response
    return {
      name: 'Extraction Failed',
      email: 'Not Found',
      position: 'Not Found',
      dateOfBirth: 'Not Found',
      education: {
        degree: 'Extraction Failed',
        major: 'Extraction Failed',
        institution: 'Extraction Failed'
      },
      workExperiences: [],
      salaryExpectation: 'Not Found',
      address: {},
      availability: {},
      contactInfo: {},
      additionalNotes: `Extraction failed: ${error.message}`,
      extractionStatus: 'failed'
    };
  }
} 