import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginDto } from './dto/google-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or username is already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
      },
    });

    const token = this.generateToken(user.id, user.email);

    delete user.passwordHash;
    return {
      user,
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.emailOrUsername }, { username: dto.emailOrUsername }],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.email);

    delete user.passwordHash;
    return {
      user,
      accessToken: token,
    };
  }

  async googleLogin(googleUser: any) {
    if (!googleUser) {
      throw new BadRequestException('No user from google');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {

      const baseUsername = googleUser.email.split('@')[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const username = `${baseUsername}_${randomSuffix}`;

      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          username,
          googleId: googleUser.googleId,
          avatarUrl: googleUser.picture,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId },
      });
    }

    const token = this.generateToken(user.id, user.email);

    delete user.passwordHash;
    return {
      user,
      accessToken: token,
    };
  }

  async googleLoginWithToken(dto: GoogleLoginDto) {
    let email = dto.email;
    let googleId = dto.googleId;
    let avatarUrl = dto.avatarUrl;
    let username = dto.username;

    if (dto.idToken) {
      try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: dto.idToken,
        });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email || email;
          googleId = payload.sub || googleId;
          avatarUrl = payload.picture || avatarUrl;
        }
      } catch (err) {

      }
    }

    if (!email) {
      throw new BadRequestException('Email is required for Google login');
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(googleId ? [{ googleId }] : []),
        ],
      },
    });

    if (!user) {
      const baseUsername = username || email.split('@')[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const finalUsername = `${baseUsername.replace(/[^a-zA-Z0-9_]/g, '')}_${randomSuffix}`;

      user = await this.prisma.user.create({
        data: {
          email,
          username: finalUsername,
          googleId,
          avatarUrl,
        },
      });
    } else if (googleId && !user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    const token = this.generateToken(user.id, user.email);
    delete user.passwordHash;

    return {
      user,
      accessToken: token,
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }
}
