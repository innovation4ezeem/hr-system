import { prisma } from '@/lib/prisma';
import { createUserController } from '@/controllers/userController';
import { type ApiRole } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';
import { createToken, verifyToken } from '@/lib/jwt';

export async function registerUserController(payload: {
  email: string;
  password?: string;
  fullName: string;
  employeeId: string;
  dept: string;
  role: ApiRole;
}) {
  // 1. Hash the password
  const hashedPassword = await bcrypt.hash(payload.password || `Ezeem@${Date.now()}`, 10);

  // 2. Create user record in our MySQL 'users' table
  try {
    const userRecord = await createUserController({
      id: payload.employeeId,
      name: payload.fullName,
      email: payload.email,
      role: payload.role,
      dept: payload.dept,
      status: 'pending', // Require activation/verification
      joinDate: new Date().toLocaleDateString('en-GB'),
      password: hashedPassword
    });

    // Send verification email logic (optional, keep existing if needed)
    // We'll simulate success for now as the Supabase logic is removed

    return {
      user: userRecord,
      message: 'Registration successful. Please wait for HOD activation.',
    };
  } catch (error) {
    throw error;
  }
}

export async function loginUserController(payload: {
  email: string;
  password?: string;
}) {
  const lookupEmails = [payload.email.toLowerCase()];

  // 1. Check internal user in MySQL
  const dbUser = await prisma.users.findFirst({
    where: {
      email: { in: lookupEmails }
    }
  });

  if (!dbUser) {
    throw new Error('Account not found in HR system. Please contact admin.');
  }

  // 2. Verify password via bcrypt
  if (!dbUser.password) {
    throw new Error('This account has no password set. Please use "Forgot Password".');
  }

  const isMatch = await bcrypt.compare(payload.password || '', dbUser.password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // 3. Block login for non-active users
  if (dbUser.status === 'pending') {
    throw new Error('Your account is awaiting HOD activation.');
  }
  if (dbUser.status !== 'active') {
    throw new Error(`Your account status is ${dbUser.status}. Please contact HR.`);
  }

  // 4. Create secure JWT token
  const token = await createToken({
    userId: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    name: dbUser.name
  });

  return {
    token,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      db_user_id: dbUser.id,
      status: dbUser.status,
      db_role: dbUser.role,
      db_name: dbUser.name,
      db_dept: dbUser.dept
    },
  };
}

export async function adminCreateUserController(payload: {
  email: string;
  password?: string;
  fullName: string;
  employeeId?: string;
  dept: string;
  role: ApiRole;
}) {
  const hashedPassword = await bcrypt.hash(payload.password || `Ezeem@${Date.now()}`, 10);

  // Insert into local users table with active status
  try {
    const userRecord = await createUserController({
      id: payload.employeeId || `u-${Date.now()}`,
      name: payload.fullName,
      email: payload.email,
      role: payload.role,
      dept: payload.dept,
      status: 'active',
      joinDate: new Date().toLocaleDateString('en-GB'),
      password: hashedPassword
    });

    return {
      user: userRecord,
      message: 'User successfully created and activated in local database.',
    };
  } catch (error) {
    throw error;
  }
}

export async function changeUserPasswordController(userId: string, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.users.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  return { message: 'Password updated successfully in local database' };
}

export async function requestPasswordResetController(email: string) {
  // Validate that the user exists in our DB first
  const dbUser = await prisma.users.findUnique({
    where: { email }
  });

  if (!dbUser) {
    // Return success to prevent email enumeration, even if not found
    return { message: 'If an account exists, a temporary password and reset link have been sent.' };
  }

  try {
    // 1. Generate a temporary password (8 chars)
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // 2. Update the user's password in the database
    await prisma.users.update({
      where: { id: dbUser.id },
      data: { password: hashedPassword }
    });

    // 3. Create a standard reset token for the link (as a fallback)
    const resetToken = await createToken({
      userId: dbUser.id,
      email: dbUser.email,
      purpose: 'password-reset'
    });

    const resetLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4028'}/?action=reset&token=${resetToken}`;

    const { sendPasswordResetEmailController } = await import('@/controllers/notificationController');
    sendPasswordResetEmailController({
      recipientEmail: email,
      recipientName: dbUser.name,
      resetLink: resetLink,
      tempPassword: tempPassword
    }).catch(err => console.error('Background reset email failed:', err));
    
  } catch (error) {
    console.error('Failed to generate temporary password:', error);
  }

  return { message: 'If an account exists, a temporary password and reset link have been sent.' };
}

export async function confirmPasswordResetController(token: string, newPassword: string) {
  const payload = await verifyToken(token);

  if (!payload || payload.purpose !== 'password-reset' || !payload.userId) {
    throw new Error('Invalid or expired password reset token. Please request a new one.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update the user's password in local database
  await prisma.users.update({
    where: { id: String(payload.userId) },
    data: { password: hashedPassword },
  });

  return { message: 'Password has been successfully reset. You can now log in.' };
}
