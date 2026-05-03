import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto';
import { User } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
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
    return { user: this.sanitizeUser(user), ...token };
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
    return { user: this.sanitizeUser(user), ...token };
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
