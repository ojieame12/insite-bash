import axios from 'axios';
import { logger } from '../../utils/logger';
import { supabase } from '../../config/supabase';
import { ImagePipelineInput, ImagePipelineOutput } from '../../../../shared/types';

/**
 * Image Pipeline - Generate professional portraits using Nanobanna/Gemini
 * Creates 4 archetypes: hero, formal, desk, casual
 */
export async function generateProfessionalImages(
  userId: string,
  sourcePhotoUrl: string
): Promise<ImagePipelineOutput> {
  const archetypes = ['hero', 'formal', 'desk', 'casual'] as const;
  const generations: any[] = [];
  const placements: any[] = [];

  for (const archetype of archetypes) {
    try {
      const prompt = getPromptForArchetype(archetype);
      const generatedImage = await generateWithNanobanna(sourcePhotoUrl, prompt);

      if (generatedImage) {
        // Save to Supabase Storage
        const assetId = await saveImageAsset(userId, generatedImage, archetype);

        // Create image_generation record
        const { data: generation } = await supabase
          .from('image_generations')
          .insert({
            user_id: userId,
            archetype,
            model: 'gemini-nanobanna',
            prompt,
            status: 'generated',
            generated_asset_id: assetId,
            final_score: 0.85, // TODO: Implement quality scoring
          })
          .select()
          .single();

        if (generation) {
          generations.push(generation);
        }
      }
    } catch (error) {
      logger.error(`Failed to generate ${archetype} image:`, error);
    }
  }

  return { generations, placements };
}

function getPromptForArchetype(archetype: string): string {
  const prompts: Record<string, string> = {
    hero: `Transform this person into a business professional portrait. 
    Wide landscape format (2400x720px), professional attire, confident pose, 
    black background, high quality, editorial style lighting.`,
    
    formal: `Transform this person into a semi-professional portrait. 
    Portrait orientation (720x2400px), business casual attire, approachable expression, 
    black background, natural lighting, professional quality.`,
    
    desk: `Transform this person into a casual tech entrepreneur at desk. 
    Bust only, wide format (2400x720px), modern workspace background, 
    black background, relaxed but professional, high quality.`,
    
    casual: `Transform this person into a casual tech entrepreneur facing left. 
    Wide format (2400x720px), casual professional attire, side profile, 
    black background, modern aesthetic, high quality.`,
  };

  return prompts[archetype] || prompts.hero;
}

async function generateWithNanobanna(
  sourcePhotoUrl: string,
  prompt: string
): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not configured');
      return null;
    }

    // TODO: Implement actual Nanobanna/Gemini API call
    // This is a placeholder for the actual implementation
    const response = await axios.post(
      'https://api.gemini.google.com/v1/images/generate',
      {
        source_image: sourcePhotoUrl,
        prompt,
        model: 'nanobanna',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.image_url) {
      return response.data.image_url;
    }

    return null;
  } catch (error) {
    logger.error('Nanobanna generation failed:', error);
    return null;
  }
}

async function saveImageAsset(
  userId: string,
  imageUrl: string,
  archetype: string
): Promise<string> {
  // Download image
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);

  // Upload to Supabase Storage
  const fileName = `${userId}/generated/${archetype}_${Date.now()}.png`;
  const { data, error } = await supabase.storage
    .from('assets')
    .upload(fileName, buffer, {
      contentType: 'image/png',
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('assets')
    .getPublicUrl(fileName);

  // Create asset record
  const { data: asset } = await supabase
    .from('assets')
    .insert({
      user_id: userId,
      kind: 'banner_generated',
      storage_url: publicUrl,
      label: `Generated ${archetype} portrait`,
    })
    .select()
    .single();

  return asset!.id;
}
