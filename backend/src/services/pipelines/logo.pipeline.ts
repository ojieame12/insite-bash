import axios from 'axios';
import { logger } from '../../utils/logger';
import { LogoPipelineInput, LogoPipelineOutput } from '../../../../shared/types';

/**
 * Logo Pipeline - Multi-stage fallback system
 * 1. Try Brandfetch
 * 2. Fallback to Logo.dev
 * 3. Fallback to Ideogram (generate typographic wordmark)
 */
export async function fetchCompanyLogo(
  companyName: string
): Promise<LogoPipelineOutput> {
  try {
    // Stage 1: Try Brandfetch
    const brandfetchResult = await tryBrandfetch(companyName);
    if (brandfetchResult) {
      return { logoUrl: brandfetchResult, source: 'brandfetch' };
    }

    // Stage 2: Try Logo.dev
    const logodevResult = await tryLogoDev(companyName);
    if (logodevResult) {
      return { logoUrl: logodevResult, source: 'logo.dev' };
    }

    // Stage 3: Generate with Ideogram
    const ideogramResult = await generateWithIdeogram(companyName);
    if (ideogramResult) {
      return { logoUrl: ideogramResult, source: 'ideogram' };
    }

    // Fallback: No logo found
    return { source: 'fallback' };
  } catch (error) {
    logger.error('Logo pipeline error:', error);
    return { source: 'fallback' };
  }
}

async function tryBrandfetch(companyName: string): Promise<string | null> {
  try {
    const apiKey = process.env.BRANDFETCH_API_KEY;
    if (!apiKey) return null;

    const response = await axios.get(
      `https://api.brandfetch.io/v2/search/${encodeURIComponent(companyName)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (response.data && response.data[0]?.icon) {
      return response.data[0].icon;
    }

    return null;
  } catch (error) {
    logger.warn('Brandfetch lookup failed:', error);
    return null;
  }
}

async function tryLogoDev(companyName: string): Promise<string | null> {
  try {
    const apiKey = process.env.LOGODEV_API_KEY;
    if (!apiKey) return null;

    // Extract domain from company name (simplified)
    const domain = `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;

    const response = await axios.get(
      `https://img.logo.dev/${domain}?token=${apiKey}`
    );

    if (response.status === 200) {
      return response.config.url!;
    }

    return null;
  } catch (error) {
    logger.warn('Logo.dev lookup failed:', error);
    return null;
  }
}

async function generateWithIdeogram(companyName: string): Promise<string | null> {
  try {
    const apiKey = process.env.IDEOGRAM_API_KEY;
    if (!apiKey) return null;

    // Take first word of company name
    const firstWord = companyName.split(' ')[0];

    const prompt = `A clean, modern typographic wordmark logo for "${firstWord}". 
    Minimalist design, professional typography, black text on white background, 
    no additional graphics or symbols, just elegant lettering.`;

    const response = await axios.post(
      'https://api.ideogram.ai/generate',
      {
        prompt,
        aspect_ratio: '1:1',
        model: 'V_2',
      },
      {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.data && response.data.data[0]?.url) {
      return response.data.data[0].url;
    }

    return null;
  } catch (error) {
    logger.warn('Ideogram generation failed:', error);
    return null;
  }
}
