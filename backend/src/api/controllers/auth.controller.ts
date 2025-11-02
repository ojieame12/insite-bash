import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { SignupRequest, SignupResponse, LoginRequest, LoginResponse } from '../../../../shared/types';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const signup = async (
  req: Request<{}, {}, SignupRequest>,
  res: Response<SignupResponse>,
  next: NextFunction
) => {
  try {
    // Validate input
    const validated = signupSchema.parse(req.body);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validated.email)
      .single();

    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, 10);

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: `${validated.firstName} ${validated.lastName}'s Workspace` })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant.id,
        email: validated.email,
        password_hash: passwordHash,
        first_name: validated.firstName,
        last_name: validated.lastName,
      })
      .select()
      .single();

    if (userError) throw userError;

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('Invalid input: ' + error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
};

export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response<LoginResponse>,
  next: NextFunction
) => {
  try {
    // Validate input
    const validated = loginSchema.parse(req.body);

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', validated.email)
      .single();

    if (error || !user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isValid = await bcrypt.compare(validated.password, user.password_hash);

    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      userId: user.id,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('Invalid input: ' + error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
};
