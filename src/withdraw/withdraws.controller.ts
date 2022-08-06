import { Body, Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UserScope } from 'src/auth/decorators/user.decorator'
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'
import { User } from 'src/databases/entities/user.entity'
import { Withdraw } from 'src/databases/entities/withdraw.entity'
import { BaseApiErrorResponse, SwaggerBaseApiResponse } from 'src/shared/dtos/base-api-response.dto'

import { CreateWithdrawDto } from './dto/create-withdraw.dto'
import { CreateWithdrawNftDto } from './dto/create-withdraw-nft.dto'
import { GetEstimateGas } from './dto/get-estimate-gas.dto'
import { GetWithdrawInput } from './dto/get-withdraw.dto'
import { WithdrawSevice } from './withdraws.service'
@ApiTags('withdraw')
@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly withdrawSevice: WithdrawSevice) { }

  @Get('estimate-gas')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get estimate gas API',
  })
  @ApiResponse({
    status: HttpStatus.OK
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: BaseApiErrorResponse,
  })
  async getEstimateGas(@Query() input: GetEstimateGas, @UserScope() user: User) {
    return this.withdrawSevice.getEstimateGas(input, user)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get withdraw API',
  })
  @ApiResponse({
    status: HttpStatus.OK
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: BaseApiErrorResponse,
  })
  async getWithdrawByStatus(@Query() input: GetWithdrawInput, @UserScope() user: User) {
    return this.withdrawSevice.getWithdrawByStatus(user, input)
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('token')
  async withdrawTokenToMainWallet(@Body() createWithdrawDto: CreateWithdrawDto, @UserScope() user: User) {
    return await this.withdrawSevice.withdrawTokenToMainWallet(createWithdrawDto, user)
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('nft')
  async withdrawNftToMainWallet(@Body() createWithdrawNftDto: CreateWithdrawNftDto, @UserScope() user: User) {
    return await this.withdrawSevice.withdrawNftToMainWallet(createWithdrawNftDto, user)
  }
}
