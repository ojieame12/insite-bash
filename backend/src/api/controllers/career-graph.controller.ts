import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

/**
 * Career Graph Controller
 * Returns complete portfolio data snapshot for rendering
 */

/**
 * GET /career-graph
 * Get complete career graph for authenticated user
 */
export async function getCareerGraph(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Fetching career graph', { userId });

    // Get user profile
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Get work experiences with companies
    const { data: workExperiences } = await supabase
      .from('work_experiences')
      .select(`
        *,
        companies (
          id,
          canonical_name
        )
      `)
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    // Get achievements with rankings
    const workExpIds = workExperiences?.map((we) => we.id) || [];
    const { data: achievements } = await supabase
      .from('achievements')
      .select(`
        *,
        achievement_rankings (
          rank,
          score,
          category
        )
      `)
      .in('work_experience_id', workExpIds)
      .order('created_at', { ascending: false });

    // Get skills
    const { data: skills } = await supabase
      .from('skills')
      .select('*')
      .eq('user_id', userId);

    // Get skill offers
    const { data: skillOffers } = await supabase
      .from('skill_offers')
      .select('*')
      .eq('user_id', userId);

    // Get story
    const { data: story } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get image placements with assets
    const { data: imagePlacements } = await supabase
      .from('image_placements')
      .select(`
        *,
        assets (
          id,
          kind,
          storage_url,
          label
        )
      `)
      .eq('user_id', userId);

    // Get company logos
    const companyIds = workExperiences?.map((we) => we.company_id).filter(Boolean) || [];
    const { data: companyAssets } = await supabase
      .from('company_assets')
      .select(`
        company_id,
        assets (
          id,
          kind,
          storage_url,
          label
        )
      `)
      .in('company_id', companyIds);

    // Get completeness scores
    const { data: completeness } = await supabase
      .from('completeness')
      .select('*')
      .eq('user_id', userId);

    // Get site settings
    const { data: siteSettings } = await supabase
      .from('site_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Build career graph snapshot
    const careerGraph = {
      user: {
        id: user?.id,
        email: user?.email,
        full_name: user?.full_name,
        user_role: user?.user_role,
      },
      work_experiences: workExperiences || [],
      achievements: achievements || [],
      skills: skills || [],
      skill_offers: skillOffers || [],
      story: story || null,
      image_placements: imagePlacements || [],
      company_logos: companyAssets || [],
      completeness: completeness || [],
      site_settings: siteSettings || null,
      generated_at: new Date().toISOString(),
    };

    logger.info('Career graph fetched successfully', {
      userId,
      workExperiences: workExperiences?.length || 0,
      achievements: achievements?.length || 0,
      skills: skills?.length || 0,
    });

    res.json(careerGraph);
  } catch (error: any) {
    logger.error('Failed to fetch career graph', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch career graph' });
  }
}

/**
 * GET /career-graph/:userId (public)
 * Get career graph for public portfolio view
 */
export async function getPublicCareerGraph(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    logger.info('Fetching public career graph', { userId });

    // Check if user has published their portfolio
    const { data: siteSettings } = await supabase
      .from('site_settings')
      .select('is_public')
      .eq('user_id', userId)
      .maybeSingle();

    if (!siteSettings?.is_public) {
      return res.status(404).json({ error: 'Portfolio not found or not public' });
    }

    // Get latest published site version
    const { data: siteVersion } = await supabase
      .from('site_versions')
      .select('career_graph_snapshot')
      .eq('user_id', userId)
      .eq('build_status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!siteVersion) {
      return res.status(404).json({ error: 'No published portfolio found' });
    }

    logger.info('Public career graph fetched successfully', { userId });

    res.json(siteVersion.career_graph_snapshot);
  } catch (error: any) {
    logger.error('Failed to fetch public career graph', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch career graph' });
  }
}
