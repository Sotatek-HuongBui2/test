import { ApiProperty } from '@nestjs/swagger'
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Max,Min} from 'class-validator'

import { NFT_TYPE } from '../constant'

export class GetImageNftInMintingPageDto {
  @ApiProperty({ default: 1, required: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number;

  @ApiProperty({ default: 10, required: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number;

  @ApiProperty({ required: true })
  @IsString()
  owner: string

  @IsEnum(NFT_TYPE)
  @ApiProperty({ 
    required: true,
    enum: NFT_TYPE,
    description: 'Nft type',
  })
  type: NFT_TYPE;
}
