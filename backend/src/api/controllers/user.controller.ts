import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { User, UpdateUserRequest } from '../../../../shared/types';

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  userRole: z.string().optional(),
  photoUrl: z.string().url().optional(),
  headline: z.string().optional(),
});

export const getMe = async (
  req: AuthRequest,
  res: Response<User>,
  next: NextFunction
) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId!)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      userRole: user.user_role,
      photoUrl: user.photo_url,
      headline: user.headline,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (
  req: AuthRequest<{}, {}, UpdateUserRequest>,
  res: Response<User>,
  next: NextFunction
) => {
  try {
    const validated = updateUserSchema.parse(req.body);

    const updates: any = {};
    if (validated.firstName) updates.first_name = validated.firstName;
    if (validated.lastName) updates.last_name = validated.lastName;
    if (validated.userRole) updates.user_role = validated.userRole;
    if (validated.photoUrl) updates.photo_url = validated.photoUrl;
    if (validated.headline) updates.headline = validated.headline;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.userId!)
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      userRole: user.user_role,
      photoUrl: user.photo_url,
      headline: user.headline,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('Invalid input: ' + error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
};

export const deleteMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.userId!);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
