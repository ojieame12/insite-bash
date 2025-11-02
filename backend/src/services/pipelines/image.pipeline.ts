import axios from 'axios';
import { logger } from '../../utils/logger';
import { supabase } from '../../config/supabase';
import { ImagePipelineInput, ImagePipelineOutput, Asset } from '../../../../shared/types';

/**
 * Archetype specifications matching Figma + PRD
 */
const ARCHETYPES = {
  hero: {
    placement: 'hero' as const,
    kind: 'banner_generated' as Asset['kind'],
    aspectRatio: '16:9',
    dimensions: [2400, 1350] as [number, number],
    description: 'Business professional portrait for hero section',
  },
  formal: {
    placement: 'achievements_general_main' as const,
    kind: 'feature_square_generated' as Asset['kind'],
    aspectRatio: '1:1',
    dimensions: [1200, 1200] as [number, number],
    description: 'Semi-professional square portrait',
  },
  desk: {
    placement: 'achievements_career_main' as const,
    kind: 'card_portrait_generated' as Asset['kind'],
    aspectRatio: '4:5',
    dimensions: [1200, 1500] as [number, number],
    description: 'Casual tech entrepreneur at desk',
  },
  casual: {
    placement: 'certifications_bg' as const,
    kind: 'cert_banner_generated' as Asset['kind'],
    aspectRatio: '21:9',
    dimensions: [2100, 900] as [number, number],
    description: 'Casual tech entrepreneur facing left',
  },
} as const;

type ArchetypeKey = keyof typeof ARCHETYPES;

/**
 * Image Pipeline - Generate professional portraits using Nanobanna/Gemini
 * Creates 4 archetypes with correct aspect ratios and placements
 */
export async function generateProfessionalImages(
  userId: string,
  sourcePhotoUrl: string,
  siteVersionId?: string
): Promise<ImagePipelineOutput> {
  const generations: any[] = [];
  const placements: any[] = [];

  // Get or create site version
  const currentSiteVersionId = siteVersionId || (await getOrCreateSiteVersion(userId));

  for (const [archetypeKey, spec] of Object.entries(ARCHETYPES)) {
    try {
      const archetype = archetypeKey as ArchetypeKey;
      const prompt = getPromptForArchetype(archetype, spec);
      
      logger.info(`Generating ${archetype} image`, {
        userId,
        aspectRatio: spec.aspectRatio,
        dimensions: spec.dimensions,
      });

      const generatedImageUrl = await generateWithNanobanna(sourcePhotoUrl, prompt, spec.dimensions);

      if (generatedImageUrl) {
        // Score the generated image
        const scores = await scoreGeneratedImage(generatedImageUrl, sourcePhotoUrl);

        // Upscale if needed (placeholder for now)
        const finalImageUrl = await upscaleImage(generatedImageUrl);

        // Save to Supabase Storage with correct kind
        const assetId = await saveImageAsset(userId, finalImageUrl, spec.kind, archetype);

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
            likeness_score: scores.likeness,
            artifact_score: scores.artifact,
            framing_score: scores.framing,
            style_score: scores.style,
            final_score: scores.final,
          })
          .select()
          .single();

        if (generation) {
          generations.push(generation);

          // Create image_placement record
          const placement = await createImagePlacement(
            userId,
            currentSiteVersionId,
            spec.placement,
            assetId,
            archetype
          );
          
          if (placement) {
            placements.push(placement);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to generate ${archetypeKey} image:`, error);
    }
  }

  return { generations, placements };
}

function getPromptForArchetype(
  archetype: ArchetypeKey,
  spec: typeof ARCHETYPES[ArchetypeKey]
): string {
  const [width, height] = spec.dimensions;
  
  const prompts: Record<ArchetypeKey, string> = {
    hero: `Transform this person into a business professional portrait. 
    Aspect ratio ${spec.aspectRatio} (${width}x${height}px), professional business attire, 
    confident pose, black background, high quality editorial style lighting, 
    sharp focus, professional photography.`,
    
    formal: `Transform this person into a semi-professional portrait. 
    Square format ${spec.aspectRatio} (${width}x${height}px), business casual attire, 
    approachable expression, black background, natural lighting, 
    professional quality, centered composition.`,
    
    desk: `Transform this person into a casual tech entrepreneur at desk. 
    Portrait orientation ${spec.aspectRatio} (${width}x${height}px), modern workspace, 
    black background, relaxed but professional, high quality, 
    upper body shot, contemporary aesthetic.`,
    
    casual: `Transform this person into a casual tech entrepreneur facing left. 
    Ultra-wide format ${spec.aspectRatio} (${width}x${height}px), casual professional attire, 
    side profile, black background, modern aesthetic, high quality, 
    cinematic composition.`,
  };

  return prompts[archetype];
}

async function generateWithNanobanna(
  sourcePhotoUrl: string,
  prompt: string,
  dimensions: [number, number]
): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not configured, using placeholder');
      // Return placeholder for development
      return `https://placehold.co/${dimensions[0]}x${dimensions[1]}/000000/FFFFFF/png?text=Generated`;
    }

    // TODO: Implement actual Nanobanna/Gemini API call
    // This is a placeholder for the actual implementation
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateImage',
      {
        source_image: sourcePhotoUrl,
        prompt,
        width: dimensions[0],
        height: dimensions[1],
        model: 'nanobanna',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.image_url) {
      return response.data.image_url;
    }

    return null;
  } catch (error) {
    logger.error('Nanobanna generation failed:', error);
    // Return placeholder on error for development
    return `https://placehold.co/${dimensions[0]}x${dimensions[1]}/000000/FFFFFF/png?text=Generated`;
  }
}

async function scoreGeneratedImage(
  generatedUrl: string,
  sourceUrl: string
): Promise<{
  likeness: number;
  artifact: number;
  framing: number;
  style: number;
  final: number;
}> {
  // TODO: Implement actual scoring using face embeddings or ML model
  // For now, return placeholder scores
  const likeness = 0.85;
  const artifact = 0.92;
  const framing = 0.88;
  const style = 0.90;
  const final = (likeness + artifact + framing + style) / 4;

  return { likeness, artifact, framing, style, final };
}

async function upscaleImage(imageUrl: string): Promise<string> {
  // TODO: Implement actual upscaling (4x)
  // For now, return the original URL
  return imageUrl;
}

async function saveImageAsset(
  userId: string,
  imageUrl: string,
  kind: Asset['kind'],
  archetype: string
): Promise<string> {
  try {
    // Download image
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const buffer = Buffer.from(response.data);

    // Upload to Supabase Storage
    const fileName = `${userId}/generated/${archetype}_${Date.now()}.png`;
    const { data, error } = await supabase.storage
      .from('assets')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(fileName);

    // Create asset record with correct kind
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        kind,
        storage_url: publicUrl,
        label: `Generated ${archetype} portrait`,
        source: 'gemini-nano',
      })
      .select()
      .single();

    if (assetError) throw assetError;

    return asset!.id;
  } catch (error) {
    logger.error('Failed to save image asset:', error);
    throw error;
  }
}

async function createImagePlacement(
  userId: string,
  siteVersionId: string,
  placement: string,
  assetId: string,
  archetype: string
): Promise<any> {
  try {
    // Determine crop and gradient based on placement
    const crop = { x: 0, y: 0, w: 1, h: 1 }; // Full image by default
    
    let gradient = null;
    if (placement === 'hero' || placement === 'certifications_bg') {
      gradient = {
        side: 'left',
        start: '#000000',
        end: 'transparent',
        opacity: 0.30,
      };
    }

    const { data, error } = await supabase
      .from('image_placements')
      .insert({
        user_id: userId,
        site_version_id: siteVersionId,
        placement,
        asset_id: assetId,
        crop,
        gradient,
        chosen_by: 'system',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Created image placement`, {
      userId,
      placement,
      archetype,
    });

    return data;
  } catch (error) {
    logger.error('Failed to create image placement:', error);
    return null;
  }
}

async function getOrCreateSiteVersion(userId: string): Promise<string> {
  // Get latest site version
  const { data: existing } = await supabase
    .from('site_versions')
    .select('id')
    .eq('user_id', userId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new site version
  const { data: newVersion } = await supabase
    .from('site_versions')
    .insert({
      user_id: userId,
      version_number: 1,
      status: 'draft',
    })
    .select()
    .single();

  return newVersion!.id;
}
