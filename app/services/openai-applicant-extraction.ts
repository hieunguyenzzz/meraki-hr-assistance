import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function extractApplicantInfo(text: string) {
  try {
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system', 
          content: 'You are a professional resume parser and extractor.'
        },
        {
          role: 'user', 
          content: `
            Extract the most important professional information from this text:
            - Full Name
            - Job Title/Role
            - Key Skills
            - Professional Summary

            Text:
            ${text.slice(0, 4000)}
          `
        }
      ],
      max_tokens: 500
    })

    return extraction.choices[0].message.content || 'No information extracted'
  } catch (error) {
    console.error('Applicant info extraction error:', error)
    return 'Extraction failed'
  }
} 