// app/api/assistants/vision/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { imageBase64, question } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data not provided' }, 
        { status: 400 }
      );
    }

    // Add size validation (OpenAI limit is 20MB)
    const sizeInBytes = Buffer.from(imageBase64, 'base64').length;
    if (sizeInBytes > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image size exceeds 20MB limit' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // Note: gpt-4o-mini in docs appears to be outdated
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: question 
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "auto"  // Can be "low", "high", or "auto"
              }
            }
          ]
        }
      ],
      max_tokens: 300,
    });

    // The Node.js examples show using choices[0] directly
    const result = completion.choices[0].message.content;
    
    if (!result) {
      throw new Error('No response content from OpenAI');
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error in vision analysis:', error);
    
    // Check for specific error types
    if (error instanceof Error) {
      // Common OpenAI API errors
      if (error.message.includes('maximum context length')) {
        return NextResponse.json(
          { error: 'Image is too large or complex to process' },
          { status: 400 }
        );
      } else if (error.message.includes('invalid_api_key')) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      } else if (error.message.includes('rate_limit_exceeded')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze the image' },
      { status: 500 }
    );
  }
}