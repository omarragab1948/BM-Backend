import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'johndoe_updated' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ApiPropertyOptional({ example: 'Software engineer and media enthusiast' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const val = obj?.isPrivate ?? value;
    if (val === undefined || val === null) return undefined;
    if (val === 'true' || val === true || val === '1' || val === 1) return true;
    if (val === 'false' || val === false || val === '0' || val === 0) return false;
    return Boolean(val);
  })
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Avatar image file' })
  @IsOptional()
  avatar?: any;
}
