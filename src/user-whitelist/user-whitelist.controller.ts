import { Body, Controller, Delete, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'
import { User } from 'src/databases/entities/user.entity'

import {UserScope} from "../auth/decorators/user.decorator";
import { UpdateUserWhitelistDto } from './dto/update-user-whitelist.dto'
import { UserWhitelistDto } from './dto/user-whitelist.dto'
import { UserWhitelistSevice } from './user-whitelist.service'
@ApiTags('user-whitelist')
@Controller('user-whitelist')
export class UserWhitelistController {
  constructor(private readonly userWhitelistSevice: UserWhitelistSevice) { }

  @Post()
  @ApiOperation({
    summary: 'Create user whitelist',
  })
  async createUserWhitelist(
    @Body() dto: UserWhitelistDto
  ) {
    return await this.userWhitelistSevice.createUserWhitelist(
      dto
    );
  }


  @Put()
  @ApiOperation({
    summary: 'Update user whitelist',
  })
  async updateUserWhitelist(
    @Body() dto: UpdateUserWhitelistDto
  ) {
    return await this.userWhitelistSevice.updateUserWhitelist(
      dto
    );
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete user whitelist',
  })
  async deleteUserWhitelist(
    @Body() dto: UserWhitelistDto
  ) {
    return await this.userWhitelistSevice.deleteUserWhitelist(
      dto
    );
  }
}
