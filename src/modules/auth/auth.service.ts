import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto';
import { User } from '../users/user.entity';

export interface JwtPayload {
  sub: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto.email, dto.password);
    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      ...token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (
      !user ||
      !(await this.usersService.validatePassword(user, dto.password))
    ) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      ...token,
    };
  }

  async googleLogin(idToken: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new BadRequestException(
        'El token de Google no contiene un email válido',
      );
    }

    const googleId = payload.sub;
    const email = payload.email;

    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      user = await this.usersService.findByEmail(email);

      if (user) {
        if (user.googleId) {
          throw new ConflictException(
            'Esta cuenta ya está vinculada a otro usuario de Google',
          );
        }

        if (user.password) {
          throw new ConflictException(
            'Este email ya está registrado con contraseña. Inicia sesión con tu email y contraseña.',
          );
        }

        await this.usersService.linkGoogleAccount(user.id, googleId);
        user.googleId = googleId;
      } else {
        user = await this.usersService.createGoogleUser(email, googleId);
      }
    }

    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      ...token,
    };
  }

  private generateToken(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: '7d',
    };
  }

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }
}
