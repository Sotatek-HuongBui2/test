import {Body, Controller, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiTags} from '@nestjs/swagger';
import {User} from 'src/databases/entities/user.entity'

import {ActionHistoriesService} from "../action-histories/action-histories.service";
import {UserScope} from "../auth/decorators/user.decorator";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {ReqContext} from "../shared/request-context/req-context.decorator";
import {RequestContext} from "../shared/request-context/request-context.dto";
import {BuyNftsInMarketPlaceDto} from './dto/buy-nft.dto';
import {ListNftsInMarketPlaceDto} from './dto/list-nft.dto';
import {MarketPlaceSevice} from './market-place.service';

@ApiTags('market-place')
@Controller('market-place')
export class MarketPlaceController {
  constructor(
    private readonly marketPlaceSevice: MarketPlaceSevice,
  ) {
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getNftInMarketPlace(
    @Body() listNftsInMarketPlaceDto: ListNftsInMarketPlaceDto,
    @UserScope() user: User
  ) {
    return await this.marketPlaceSevice.getNftInMarketPlace(
      listNftsInMarketPlaceDto,
      user.wallet
    );
  }

  @Post('buy-nft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async buyNft(
    @Body() body: BuyNftsInMarketPlaceDto,
    @ReqContext() ctx: RequestContext,
  ) {
    return await this.marketPlaceSevice.buyNftInMarketPlace(body, ctx);
  }
}
