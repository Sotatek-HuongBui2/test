import {Body, Controller, Get, Optional, Post, Put, Query, Req, UseGuards} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

import {BedDetailDto} from "./dtos/bed-detail.dto";
import { ListItemOwnerDto } from './dtos/list-item-by-owner.dto';
import { ListJewelOwnerDto } from './dtos/list-jewel-by-owner.dto';
import { ListNftsByOwnerDto } from './dtos/list-nft-by-owner.dto';
import { ListNftsInHomePageDto } from './dtos/list-nft-in-home-page.dto';
import { NftAttributesSevice } from './nft-attributes.service'

@ApiTags('nft-attributes')
@Controller('nft-attributes')
export class NftAttributesController {
  constructor(private readonly nftAttributesSevice: NftAttributesSevice) { }

  @Get('nft-by-owner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getNftByOwner(
    @Query() payload: ListNftsByOwnerDto,
    @Req() req: any
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.getNftByOwner(userInfo.wallet, payload);
  }


  @Get('nft-in-home-page')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listBedByOwnerInHomePage(
    @Query() payload: ListNftsInHomePageDto,
    @Req() req: any
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.listBedByOwnerInHomePage(userInfo.wallet, payload);
  }

  @Post('item-by-owner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getItemByOwner(
    @Body() payload: ListItemOwnerDto,
    @Req() req: any
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.getItemByOwner(userInfo.wallet, payload);
  }

  @Get('bed-detail')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async bedDetail(
    @Query() bedDetailDto: BedDetailDto,
    @Req() req: any,
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.bedDetail(bedDetailDto, userInfo.wallet)
  }

  @Get('list-jewels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getListJewelsByUser(
    @Req() req: any,
    @Query() payload: ListNftsInHomePageDto,
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.getListJewelsByUser(userInfo.wallet, payload)
  }

  @Put('add-item-for-bed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addItemForBed(
    @Req() req: any,
    @Query('bedId') bedId: number,
    @Query('itemId') itemId: number,
  ) {

    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.addItemForBed(userInfo.wallet, bedId, itemId)
  }

  @Put('remove-item-from-bed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeItemFromBed(
    @Req() req: any,
    @Query('bedId') bedId: number,
    @Query('itemId') itemId: number,
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.removeItemFromBed(userInfo.wallet, bedId, itemId)
  }

  @Put('open-socket')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async openSocket(
    @Req() req: any,
    @Query('bedId') bedId: number) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return this.nftAttributesSevice.openSocket(userInfo.wallet, bedId)
  }

  @Put('add-jewels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addJewelsForBed(
    @Req() req: any,
    @Body() listJewelOwnerDto: ListJewelOwnerDto
  ) {

    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.addJewelsForBed(userInfo.wallet, listJewelOwnerDto)
  }

  @Put('remove-jewels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeJewelForBed(
    @Req() req: any,
    @Body() listJewelOwnerDto: ListJewelOwnerDto
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.removeJewelForBed(userInfo.wallet, listJewelOwnerDto)
  }

  @Get('list-bedbox')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listBedBoxByOwner(@Req() req: any,) {

    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.listBedBoxByOwner(userInfo.wallet)
  }

  @Post('open-bedbox')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async openBedBox(
    @Query('bedboxId') bedboxId: number,
    @Req() req: any
  ) {
    const userInfo = await this.nftAttributesSevice.getUserWalletByUserId(req.user.id);
    if(!userInfo || (userInfo && !userInfo.wallet)) return ;
    return await this.nftAttributesSevice.openBedBox(userInfo.wallet, bedboxId);
  }
}
