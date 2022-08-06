import { Body, ClassSerializerInterceptor, Controller, Get, HttpStatus, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserScope } from 'src/auth/decorators/user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LuckyBox } from 'src/databases/entities/lucky_box.entity';
import { User } from 'src/databases/entities/user.entity';
import { SwaggerBaseApiResponse } from 'src/shared/dtos/base-api-response.dto';

import { SpeedUpInput } from './dtos/speed-up.dto';
import { LuckyBoxSevice } from './lucky-box.service';

@ApiTags('lucky_box')
@Controller('lucky_box')
export class LuckyBoxController {
  constructor(private readonly luckyBoxSevice: LuckyBoxSevice) { }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary: 'Get Lucky Box API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  async getLuckyBox(@UserScope() user: User) {
    return this.luckyBoxSevice.getLuckyBoxOfUser(user)
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('open')
  @ApiOperation({
    summary: 'Open Lucky Box API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  async openLuckyBox(@Query('luckyBoxId') luckyBoxId: number, @UserScope() user: User) {
    return this.luckyBoxSevice.openLuckyBox(luckyBoxId, user)
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary: 'Speed up API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  async speedUp(@Body() input: SpeedUpInput, @UserScope() user: User) {
    return this.luckyBoxSevice.speedUp(input, user)
  }
}
