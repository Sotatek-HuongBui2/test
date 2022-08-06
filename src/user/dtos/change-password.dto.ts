import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';

export class ChangePasswordBodyDto {
  @ApiPropertyOptional()
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsNumber()
  otp: number;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsString()
  newPassword: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}
