import axios from 'axios';
import { logger } from '../../utils/logger';
import { supabase } from '../../config/supabase';
import { LogoPipelineInput, LogoPipelineOutput, Asset } from '../../../../shared/types';

/**
 * Logo Pipeline - Multi-stage fallback system with persistence
 * 1. Try Brandfetch
 * 2. Fallback to Logo.dev
 * 3. Fallback to Ideogram (generate typographic wordmark)
 * 4. Save to assets and link to company
 */

/**
 * Run logo pipeline for a user (fetches logos for all their companies)
 */
export async function runLogoPipeline(userId: string): Promise<void> {
  try {
    logger.info('Starting logo pipeline', { userId });

    // Get companies from user's work experiences
    const { data: workExps } = await supabase
      .from('work_experiences')
      .select('company_id, companies(id, canonical_name)')
      .eq('user_id', userId);

    if (!workExps || workExps.length === 0) {
      logger.warn('No work experiences found for logo pipeline', { userId });
      return;
    }

    // Get unique companies
    const companies = new Map<string, string>();
    for (const exp of workExps) {
      if (exp.company_id && (exp as any).companies) {
        const company = (exp as any).companies;
        companies.set(company.id, company.canonical_name);
      }
    }

    logger.info(`Processing logos for ${companies.size} companies`, { userId });

    // Fetch and save logo for each company
    for (const [companyId, companyName] of companies.entries()) {
      try {
        // Check if logo already exists
        const { data: existing } = await supabase
          .from('company_assets')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();

        if (existing) {
          logger.info('Logo already exists for company', { companyId, companyName });
          continue;
        }

        // Fetch logo
        const result = await fetchAndSaveCompanyLogo(companyId, companyName);
        
        if (result.success) {
          logger.info('Logo saved successfully', { companyId, companyName, source: result.source });
        } else {
          logger.warn('Failed to fetch logo', { companyId, companyName });
        }
      } catch (error: any) {
        logger.error('Error processing logo for company', { 
          companyId, 
          companyName, 
          error: error.message 
        });
      }
    }

    logger.info('Logo pipeline completed', { userId, companiesProcessed: companies.size });
  } catch (error: any) {
    logger.error('Logo pipeline failed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Fetch logo and save to database
 */
async function fetchAndSaveCompanyLogo(
  companyId: string,
  companyName: string
): Promise<{ success: boolean; source?: string }> {
  try {
    // Stage 1: Try Brandfetch
    let logoUrl = await tryBrandfetch(companyName);
    let source: 'brandfetch' | 'logo.dev' | 'ideogram' = 'brandfetch';

    if (!logoUrl) {
      // Stage 2: Try Logo.dev
      logoUrl = await tryLogoDev(companyName);
      source = 'logo.dev';
    }

    if (!logoUrl) {
      // Stage 3: Generate with Ideogram
      logoUrl = await generateWithIdeogram(companyName);
      source = 'ideogram';
    }

    if (!logoUrl) {
      logger.warn('No logo found for company', { companyId, companyName });
      return { success: false };
    }

    // Download logo
    const response = await axios.get(logoUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(response.data);
    
    // Determine file extension
    const contentType = response.headers['content-type'] || 'image/svg+xml';
    const ext = contentType.includes('svg') ? 'svg' : 'png';
    const fileName = `logos/${companyId}/${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      logger.error('Failed to upload logo to storage', { error: uploadError, companyId });
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(fileName);

    // Create asset record
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        kind: ext === 'svg' ? 'logo_svg' : 'logo_png',
        storage_url: publicUrl,
        label: `${companyName} Logo`,
        source,
      })
      .select()
      .single();

    if (assetError) {
      logger.error('Failed to create asset record', { error: assetError, companyId });
      throw assetError;
    }

    // Link asset to company
    const { error: linkError } = await supabase
      .from('company_assets')
      .insert({
        company_id: companyId,
        asset_id: asset.id,
        is_primary: true,
      });

    if (linkError) {
      logger.error('Failed to link asset to company', { error: linkError, companyId });
      throw linkError;
    }

    return { success: true, source };
  } catch (error: any) {
    logger.error('fetchAndSaveCompanyLogo failed', { error: error.message, companyId });
    return { success: false };
  }
}

/**
 * Try fetching logo from Brandfetch
 */
async function tryBrandfetch(companyName: string): Promise<string | null> {
  try {
    const apiKey = process.env.BRANDFETCH_API_KEY;
    if (!apiKey) {
      logger.debug('Brandfetch API key not configured');
      return null;
    }

    const response = await axios.get(
      `https://api.brandfetch.io/v2/search/${encodeURIComponent(companyName)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      }
    );

    if (response.data && response.data[0]?.icon) {
      logger.info('Logo found via Brandfetch', { companyName });
      return response.data[0].icon;
    }

    return null;
  } catch (error: any) {
    logger.warn('Brandfetch lookup failed', { companyName, error: error.message });
    return null;
  }
}

/**
 * Try fetching logo from Logo.dev
 */
async function tryLogoDev(companyName: string): Promise<string | null> {
  try {
    const apiKey = process.env.LOGODEV_API_KEY;
    if (!apiKey) {
      logger.debug('Logo.dev API key not configured');
      return null;
    }

    // Extract domain from company name (simplified)
    const domain = `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;

    const url = `https://img.logo.dev/${domain}?token=${apiKey}`;
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: (status) => status === 200,
    });

    if (response.status === 200) {
      logger.info('Logo found via Logo.dev', { companyName, domain });
      return url;
    }

    return null;
  } catch (error: any) {
    logger.warn('Logo.dev lookup failed', { companyName, error: error.message });
    return null;
  }
}

/**
 * Generate typographic wordmark with Ideogram
 */
async function generateWithIdeogram(companyName: string): Promise<string | null> {
  try {
    const apiKey = process.env.IDEOGRAM_API_KEY;
    if (!apiKey) {
      logger.debug('Ideogram API key not configured');
      return null;
    }

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
        timeout: 30000,
      }
    );

    if (response.data && response.data.data && response.data.data[0]?.url) {
      logger.info('Logo generated via Ideogram', { companyName, firstWord });
      return response.data.data[0].url;
    }

    return null;
  } catch (error: any) {
    logger.warn('Ideogram generation failed', { companyName, error: error.message });
    return null;
  }
}

/**
 * Legacy function for backwards compatibility
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
