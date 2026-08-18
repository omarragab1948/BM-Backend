import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiPropertyOptional({ example: 'eyJhbGciOiJSUzI1NiIs...' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({ example: 'google_user_id_12345' })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiPropertyOptional({ example: 'john.doe@gmail.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'johndoe_google' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/...' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
