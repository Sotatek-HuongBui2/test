import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'

import { AddPoinDto } from './dto/add-poin.dto'
import { PoinsSevice } from './poins.service'
@ApiTags('poins')
@Controller('poins')
export class PoinsController {
  constructor(private readonly poinsSevice: PoinsSevice) {
  }

  @Get('poins-of-owner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async poinsOfOwner(
    @Query('bedId') bedId: number,
    @Req() req: any
  ) {
    return await this.poinsSevice.poinsOfOwner(req.user.id, bedId)
  }

  @Put('add-poin-for-bed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addPoinForJewel(
    @Body() addPoinDto: AddPoinDto,
    @Req() req: any
  ) {
    return await this.poinsSevice.addPoinForJewel(req.user.id, addPoinDto)
  }

}
